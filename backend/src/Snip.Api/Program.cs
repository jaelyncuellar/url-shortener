using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Snip.Api;
using Snip.Api.Services;
using Snip.Infrastructure.Caching;
using Snip.Infrastructure.Clicks;
using Snip.Infrastructure.Data;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// ─── Data ───────────────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
    ConnectionMultiplexer.Connect(builder.Configuration.GetConnectionString("Redis")!));
builder.Services.AddSingleton<ILinkCache, RedisLinkCache>();

// ─── Click pipeline: bounded channel + background batch writer ──────────
builder.Services.AddSingleton<IClickQueue, ClickQueue>();
builder.Services.AddHostedService<ClickProcessorService>();

// ─── Auth ───────────────────────────────────────────────────────────────
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddSingleton<JwtTokenService>();

var jwt = builder.Configuration.GetSection("Jwt");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!)),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });
builder.Services.AddAuthorization();

// ─── Rate limiting: redirects are the hot path ──────────────────────────
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("redirect", o =>
    {
        o.PermitLimit = 120;
        o.Window = TimeSpan.FromMinutes(1);
        o.QueueLimit = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    await DbSeeder.MigrateAndSeedAsync(app);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ─── Redirect: GET /{slug} ──────────────────────────────────────────────
// Cache-aside: Redis hit avoids PostgreSQL entirely. Clicks are queued for
// the background worker so the 302 never waits on analytics writes.
app.MapGet("/{slug}", async (
        string slug,
        AppDbContext db,
        ILinkCache cache,
        IClickQueue clicks,
        HttpContext http,
        CancellationToken ct) =>
    {
        Guid linkId;
        string destination;

        var cached = await cache.GetAsync(slug, ct);
        if (cached is not null)
        {
            (linkId, destination) = (cached.LinkId, cached.DestinationUrl);
        }
        else
        {
            var now = DateTime.UtcNow;
            var link = await db.ShortLinks.AsNoTracking().SingleOrDefaultAsync(
                l => l.Slug == slug && l.IsActive && (l.ExpiresAt == null || l.ExpiresAt > now), ct);
            if (link is null) return Results.NotFound(new { error = "Unknown or inactive link." });

            linkId = link.Id;
            destination = link.DestinationUrl;
            await cache.SetAsync(slug, linkId, destination, ct);
        }

        clicks.TryEnqueue(new ClickRecord(
            linkId,
            http.Request.Headers.Referer.ToString() is { Length: > 0 } r ? r : null,
            http.Request.Headers.UserAgent.ToString() is { Length: > 0 } u ? u : null));

        return Results.Redirect(destination, permanent: false);
    })
    .RequireRateLimiting("redirect");

app.Run();
