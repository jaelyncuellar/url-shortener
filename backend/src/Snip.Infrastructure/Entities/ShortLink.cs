namespace Snip.Infrastructure.Entities;

/// <summary>A shortened URL. The <see cref="Slug"/> is globally unique and is
/// what appears after the domain (e.g. snip.dev/<c>gh-release</c>).</summary>
public class ShortLink
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public string Slug { get; set; } = string.Empty;
    public string DestinationUrl { get; set; } = string.Empty;

    /// <summary>Denormalized counter, incremented asynchronously by the click worker.</summary>
    public long ClickCount { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime? ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
