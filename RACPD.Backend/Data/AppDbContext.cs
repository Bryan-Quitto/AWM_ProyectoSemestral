using Microsoft.EntityFrameworkCore;

using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Usuario> Usuarios { get; set; } = null!;
    public DbSet<PerfilDependiente> PerfilesDependientes { get; set; } = null!;
    public DbSet<BloqueRelevo> BloquesRelevo { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        modelBuilder.Entity<Usuario>()
            .Property(u => u.Rol)
            .HasConversion<string>();

        modelBuilder.Entity<Usuario>()
            .Property(u => u.Nombre)
            .HasMaxLength(100);

        modelBuilder.Entity<Usuario>()
            .Property(u => u.Apellido)
            .HasMaxLength(100);

        modelBuilder.Entity<PerfilDependiente>()
            .Property(p => p.NombreCompleto).HasMaxLength(200);

        modelBuilder.Entity<PerfilDependiente>()
            .Property(p => p.CondicionesCronicas).HasMaxLength(4000);

        modelBuilder.Entity<PerfilDependiente>()
            .Property(p => p.TipoSangre)
            .HasConversion<string>();
            
        modelBuilder.Entity<PerfilDependiente>()
            .OwnsMany(p => p.ContactosEmergencia, b =>
            {
                b.ToJson();
            });

        modelBuilder.Entity<PerfilDependiente>()
            .Property(p => p.Version)
            .IsRowVersion();

        modelBuilder.Entity<BloqueRelevo>()
            .Property(b => b.Estado)
            .HasConversion<string>();

        modelBuilder.Entity<BloqueRelevo>()
            .Property(b => b.Version)
            .IsRowVersion();
    }
}
