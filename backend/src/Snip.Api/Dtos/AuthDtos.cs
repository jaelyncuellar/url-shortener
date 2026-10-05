namespace Snip.Api.Dtos;

public sealed record RegisterRequest(string Email, string Password, string? DisplayName);
public sealed record LoginRequest(string Email, string Password);
public sealed record AuthResponse(string Token, string Email, string DisplayName);
