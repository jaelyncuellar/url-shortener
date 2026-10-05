using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Snip.Infrastructure.Data;
using Snip.Infrastructure.Entities;

namespace Snip.Infrastructure.Clicks;

/// <summary>Background worker that drains the click queue in batches and
/// persists analytics to PostgreSQL. Redirects return immediately; this
/// service absorbs the write load so traffic spikes don't touch the
/// request path's latency.</summary>
public sealed class ClickProcessorService(
    IClickQueue queue,
    IServiceScopeFactory scopes,
    ILogger<ClickProcessorService> logger) : BackgroundService
{
    private static readonly TimeSpan FlushInterval = TimeSpan.FromSeconds(2);
    private const int MaxBatchSize = 500;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var batch = new List<ClickRecord>(MaxBatchSize);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Wait for at least one click, then drain whatever else is waiting.
                if (await queue.Reader.WaitToReadAsync(stoppingToken))
                {
                    while (batch.Count < MaxBatchSize && queue.Reader.TryRead(out var click))
                        batch.Add(click);

                    if (batch.Count > 0)
                    {
                        await PersistBatchAsync(batch, stoppingToken);
                        batch.Clear();
                    }
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to persist click batch; dropping {Count} events", batch.Count);
                batch.Clear();
                await Task.Delay(FlushInterval, stoppingToken);
            }
        }
    }

    private async Task PersistBatchAsync(List<ClickRecord> batch, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTime.UtcNow;
        var events = batch.Select(c => new ClickEvent
        {
            ShortLinkId = c.LinkId,
            ClickedAt = now,
            Referrer = c.Referrer,
            UserAgent = c.UserAgent,
        });
        await db.ClickEvents.AddRangeAsync(events, ct);

        // Bump the denormalized counters in one round-trip per batch.
        var counts = batch.GroupBy(c => c.LinkId)
            .ToDictionary(g => g.Key, g => (long)g.Count());
        var links = await db.ShortLinks
            .Where(l => counts.Keys.Contains(l.Id))
            .ToListAsync(ct);
        foreach (var link in links)
            link.ClickCount += counts[link.Id];

        await db.SaveChangesAsync(ct);
    }
}
