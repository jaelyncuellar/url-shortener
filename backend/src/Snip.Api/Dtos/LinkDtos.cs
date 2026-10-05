namespace Snip.Api.Dtos;

public sealed record CreateLinkRequest(string DestinationUrl, string? Slug);
public sealed record UpdateLinkRequest(bool? IsActive);

public sealed record LinkResponse(
    Guid Id,
    string Slug,
    string DestinationUrl,
    string ShortUrl,
    long Clicks,
    bool IsActive,
    DateTime? ExpiresAt,
    DateTime CreatedAt);

public sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Page, int PageSize, long Total);
