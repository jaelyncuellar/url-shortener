namespace Snip.Infrastructure.Entities;

/// <summary>One recorded visit to a short link. Written in batches by the
/// background click worker so redirects never wait on analytics I/O.</summary>
public class ClickEvent
{
    public long Id { get; set; }
    public Guid ShortLinkId { get; set; }
    public ShortLink? ShortLink { get; set; }

    public DateTime ClickedAt { get; set; } = DateTime.UtcNow;
    public string? Referrer { get; set; }
    public string? UserAgent { get; set; }
}
