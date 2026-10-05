using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Snip.Infrastructure.Data;

/// <summary>Lets <c>dotnet ef</c> build the context at design time without
/// running the API (used for generating migrations).</summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Port=5432;Database=snip;Username=snip;Password=snip")
            .Options;
        return new AppDbContext(options);
    }
}
