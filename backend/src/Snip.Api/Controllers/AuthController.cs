using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Snip.Api.Dtos;
using Snip.Api.Services;
using Snip.Infrastructure.Data;
using Snip.Infrastructure.Entities;

namespace Snip.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(AppDbContext db, JwtTokenService tokens) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (!IsValidEmail(email))
            return BadRequest(new { error = "Enter a valid email address." });
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 4)
            return BadRequest(new { error = "Password must be at least 4 characters." });
        if (await db.Users.AnyAsync(u => u.Email == email))
            return Conflict(new { error = "An account with that email already exists." });

        var user = new User
        {
            Email = email,
            PasswordHash = PasswordHasher.Hash(request.Password),
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName)
                ? email.Split('@')[0]
                : request.DisplayName.Trim(),
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(Me), new AuthResponse(tokens.CreateToken(user), user.Email, user.DisplayName));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(u => u.Email == email);
        if (user is null || !PasswordHasher.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { error = "Invalid email or password." });

        return Ok(new AuthResponse(tokens.CreateToken(user), user.Email, user.DisplayName));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<AuthResponse>> Me()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await db.Users.FindAsync(Guid.Parse(userId!));
        if (user is null) return Unauthorized();
        return Ok(new { user.Email, user.DisplayName });
    }

    private static bool IsValidEmail(string email)
    {
        try { return new System.Net.Mail.MailAddress(email).Address == email; }
        catch { return false; }
    }
}
