using System.Text.Json;
using StackExchange.Redis;

namespace Snip.Infrastructure.Caching;

/// <summary>Cache-aside store for redirect resolution: slug → link id + destination.
/// A hit avoids the PostgreSQL round-trip entirely on the hot path.</summary>
public interface ILinkCache
{
    Task<CachedLink?> GetAsync(string slug, CancellationToken ct = default);
    Task SetAsync(string slug, Guid linkId, string destinationUrl, CancellationToken ct = default);
    Task RemoveAsync(string slug, CancellationToken ct = default);
}

public sealed record CachedLink(Guid LinkId, string DestinationUrl);

public sealed class RedisLinkCache(IConnectionMultiplexer redis) : ILinkCache
{
    private const string KeyPrefix = "snip:link:";
    private static readonly TimeSpan Ttl = TimeSpan.FromHours(1);
    private readonly IDatabase _db = redis.GetDatabase();

    public async Task<CachedLink?> GetAsync(string slug, CancellationToken ct = default)
    {
        var raw = await _db.StringGetAsync(KeyPrefix + slug);
        if (raw.IsNullOrEmpty) return null;
        try
        {
            return JsonSerializer.Deserialize<CachedLink>(raw.ToString());
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public Task SetAsync(string slug, Guid linkId, string destinationUrl, CancellationToken ct = default) =>
        _db.StringSetAsync(
            KeyPrefix + slug,
            JsonSerializer.Serialize(new CachedLink(linkId, destinationUrl)),
            Ttl);

    public Task RemoveAsync(string slug, CancellationToken ct = default) =>
        _db.KeyDeleteAsync(KeyPrefix + slug);
}
