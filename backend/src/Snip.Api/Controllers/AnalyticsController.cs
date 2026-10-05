using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Snip.Api.Dtos;
using Snip.Infrastructure.Data;

namespace Snip.Api.Controllers;

[ApiController]
[Route("api/analytics")]
[Authorize]
public sealed class AnalyticsController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("summary")]
    public async Task<ActionResult<AnalyticsSummary>> Summary()
    {
        var userId = UserId;
        var totalLinks = await db.ShortLinks.LongCountAsync(l => l.UserId == userId);
        var activeLinks = await db.ShortLinks.LongCountAsync(l => l.UserId == userId && l.IsActive);
        var totalClicks = await db.ShortLinks
            .Where(l => l.UserId == userId)
            .SumAsync(l => l.ClickCount);

        var topLinks = await db.ShortLinks
            .AsNoTracking()
            .Where(l => l.UserId == userId)
            .OrderByDescending(l => l.ClickCount)
            .Take(5)
            .Select(l => new TopLink(l.Slug, l.DestinationUrl, l.ClickCount))
            .ToListAsync();

        return Ok(new AnalyticsSummary(totalLinks, activeLinks, totalClicks, topLinks));
    }

    [HttpGet("clicks")]
    public async Task<ActionResult<IReadOnlyList<DailyClicks>>> Clicks([FromQuery] int days = 30)
    {
        days = Math.Clamp(days, 1, 365);
        var userId = UserId;
        var since = DateTime.UtcNow.Date.AddDays(-(days - 1));

        var rows = await db.ClickEvents
            .AsNoTracking()
            .Where(c => c.ShortLink!.UserId == userId && c.ClickedAt >= since)
            .GroupBy(c => c.ClickedAt.Date)
            .Select(g => new { Date = g.Key, Count = g.LongCount() })
            .ToListAsync();

        var byDate = rows.ToDictionary(r => r.Date, r => r.Count);
        var result = Enumerable.Range(0, days)
            .Select(i => since.AddDays(i))
            .Select(d => new DailyClicks(d.ToString("yyyy-MM-dd"), byDate.GetValueOrDefault(d)))
            .ToList();

        return Ok(result);
    }
}
