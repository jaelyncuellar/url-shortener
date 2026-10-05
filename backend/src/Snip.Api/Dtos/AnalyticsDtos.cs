namespace Snip.Api.Dtos;

public sealed record AnalyticsSummary(
    long TotalLinks,
    long ActiveLinks,
    long TotalClicks,
    IReadOnlyList<TopLink> TopLinks);

public sealed record TopLink(string Slug, string DestinationUrl, long Clicks);

public sealed record DailyClicks(string Date, long Clicks);
