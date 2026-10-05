using Microsoft.EntityFrameworkCore;
using Snip.Infrastructure.Entities;

namespace Snip.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<ShortLink> ShortLinks => Set<ShortLink>();
    public DbSet<ClickEvent> ClickEvents => Set<ClickEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(u => u.Id);
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Email).HasMaxLength(256).IsRequired();
            e.Property(u => u.PasswordHash).IsRequired();
            e.Property(u => u.DisplayName).HasMaxLength(128);
        });

        modelBuilder.Entity<ShortLink>(e =>
        {
            e.HasKey(l => l.Id);
            // The hot lookup: redirect resolution is always by slug.
            e.HasIndex(l => l.Slug).IsUnique();
            e.HasIndex(l => l.UserId);
            e.Property(l => l.Slug).HasMaxLength(64).IsRequired();
            e.Property(l => l.DestinationUrl).HasMaxLength(2048).IsRequired();
            e.HasOne(l => l.User)
                .WithMany(u => u.Links)
                .HasForeignKey(l => l.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ClickEvent>(e =>
        {
            e.HasKey(c => c.Id);
            e.HasIndex(c => c.ShortLinkId);
            e.HasIndex(c => c.ClickedAt);
            e.Property(c => c.Referrer).HasMaxLength(2048);
            e.Property(c => c.UserAgent).HasMaxLength(512);
            e.HasOne(c => c.ShortLink)
                .WithMany()
                .HasForeignKey(c => c.ShortLinkId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
