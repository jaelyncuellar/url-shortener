using Microsoft.EntityFrameworkCore;
using Snip.Api.Services;
using Snip.Infrastructure.Data;
using Snip.Infrastructure.Entities;

namespace Snip.Api;

/// <summary>Applies migrations and seeds demo data on startup (dev only).</summary>
public static class DbSeeder
{
    public static async Task MigrateAndSeedAsync(WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();

        if (await db.Users.AnyAsync()) return; // already seeded

        var demo = new User
        {
            Email = "test@gmail.com",
            PasswordHash = PasswordHasher.Hash("test"),
            DisplayName = "Demo User",
        };
        db.Users.Add(demo);

        var links = new (string Slug, string Url, long Clicks, string Created)[]
        {
            ("gh-release", "https://github.com/dotnet/aspnetcore/releases/tag/v8.0.0", 24817, "2026-05-01"),
            ("api-docs", "https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis", 18432, "2026-05-10"),
            ("redis-guide", "https://redis.io/docs/manual/patterns/distributed-locks/", 9241, "2026-05-15"),
            ("pg-perf", "https://www.postgresql.org/docs/current/performance-tips.html", 7833, "2026-05-20"),
            ("k8s-deploy", "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/", 2741, "2026-06-05"),
        };
        foreach (var (slug, url, clicks, created) in links)
        {
            db.ShortLinks.Add(new ShortLink
            {
                UserId = demo.Id,
                Slug = slug,
                DestinationUrl = url,
                ClickCount = clicks,
                CreatedAt = DateTime.Parse(created).ToUniversalTime(),
            });
        }

        await db.SaveChangesAsync();
    }
}
