using System.Threading.Channels;

namespace Snip.Infrastructure.Clicks;

/// <summary>A single redirect to be recorded. Produced on the request path,
/// consumed asynchronously by <see cref="ClickProcessorService"/>.</summary>
public sealed record ClickRecord(Guid LinkId, string? Referrer, string? UserAgent);

/// <summary>Bounded in-memory queue decoupling redirects from analytics writes.
/// Never blocks the redirect path: if the queue is full the click is dropped
/// rather than slowing down the response.</summary>
public interface IClickQueue
{
    bool TryEnqueue(ClickRecord click);
    ChannelReader<ClickRecord> Reader { get; }
}

public sealed class ClickQueue : IClickQueue
{
    private readonly Channel<ClickRecord> _channel =
        Channel.CreateBounded<ClickRecord>(new BoundedChannelOptions(10_000)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
        });

    public bool TryEnqueue(ClickRecord click) => _channel.Writer.TryWrite(click);
    public ChannelReader<ClickRecord> Reader => _channel.Reader;
}
