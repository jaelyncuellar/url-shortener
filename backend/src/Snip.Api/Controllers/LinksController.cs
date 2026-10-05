using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Snip.Api.Dtos;
using Snip.Infrastructure.Caching;
using Snip.Infrastructure.Data;
using Snip.Infrastructure.Entities;

namespace Snip.Api.Controllers;

[ApiController]
[Route("api/links")]
[Authorize]
public sealed class LinksController(AppDbContext db, ILinkCache cache, IConfiguration config) : ControllerBase
{
    private static readonly Regex SlugPattern = new("^[a-z0-9-]{1,64}$", RegexOptions.Compiled);
    private string BaseUrl => config["App:BaseUrl"]?.TrimEnd('/') ?? "http://localhost:8080";

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private LinkResponse ToResponse(ShortLink l) => new(
        l.Id, l.Slug, l.DestinationUrl, $"{BaseUrl}/{l.Slug}",
        l.ClickCount, l.IsActive, l.ExpiresAt, l.CreatedAt);

    [HttpPost]
    public async Task<ActionResult<LinkResponse>> Create(CreateLinkRequest request)
    {
        if (!Uri.TryCreate(request.DestinationUrl, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return BadRequest(new { error = "DestinationUrl must be an absolute http(s) URL." });

        var slug = string.IsNullOrWhiteSpace(request.Slug)
            ? GenerateSlug()
            : request.Slug.Trim().ToLowerInvariant();

        if (!SlugPattern.IsMatch(slug))
            return BadRequest(new { error = "Slug may only contain lowercase letters, numbers, and hyphens (max 64 chars)." });
        if (await db.ShortLinks.AnyAsync(l => l.Slug == slug))
            return Conflict(new { error = $"The alias '{slug}' is already taken." });

        var link = new ShortLink
        {
            UserId = UserId,
            Slug = slug,
            DestinationUrl = uri.ToString(),
        };
        db.ShortLinks.Add(link);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = link.Id }, ToResponse(link));
    }

    [HttpGet]
    public async Task<ActionResult<PagedResponse<LinkResponse>>> List(
        [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.ShortLinks
            .AsNoTracking()
            .Where(l => l.UserId == UserId)
            .OrderByDescending(l => l.CreatedAt);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            query = (IOrderedQueryable<ShortLink>)query.Where(l =>
                l.Slug.Contains(q) || l.DestinationUrl.ToLower().Contains(q));
        }

        var total = await query.LongCountAsync();
        // Materialize before projecting: ToResponse() can't be translated to SQL.
        var items = (await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync())
            .Select(ToResponse)
            .ToList();

        return Ok(new PagedResponse<LinkResponse>(items, page, pageSize, total));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<LinkResponse>> GetById(Guid id)
    {
        var link = await db.ShortLinks.AsNoTracking()
            .SingleOrDefaultAsync(l => l.Id == id && l.UserId == UserId);
        return link is null ? NotFound() : Ok(ToResponse(link));
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<LinkResponse>> Update(Guid id, UpdateLinkRequest request)
    {
        var link = await db.ShortLinks
            .SingleOrDefaultAsync(l => l.Id == id && l.UserId == UserId);
        if (link is null) return NotFound();

        if (request.IsActive.HasValue && request.IsActive.Value != link.IsActive)
        {
            link.IsActive = request.IsActive.Value;
            // Deactivating must take effect immediately: drop the cached entry.
            if (!link.IsActive)
                await cache.RemoveAsync(link.Slug);
        }

        await db.SaveChangesAsync();
        return Ok(ToResponse(link));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var link = await db.ShortLinks
            .SingleOrDefaultAsync(l => l.Id == id && l.UserId == UserId);
        if (link is null) return NotFound();

        db.ShortLinks.Remove(link);
        await db.SaveChangesAsync();
        await cache.RemoveAsync(link.Slug);

        return NoContent();
    }

    private static string GenerateSlug()
    {
        const string alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
        return string.Create(7, alphabet, (span, abc) =>
        {
            var bytes = RandomNumberGenerator.GetBytes(span.Length);
            for (var i = 0; i < span.Length; i++)
                span[i] = abc[bytes[i] % abc.Length];
        });
    }
}
