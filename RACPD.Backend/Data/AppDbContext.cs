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
    public DbSet<BloqueTurno> BloquesTurno { get; set; } = null!;
    public DbSet<ReservaTurno> ReservasTurno { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // === Usuario ===
        modelBuilder.Entity<Usuario>()
            .Property(u => u.Rol)
            .HasConversion<string>();

        modelBuilder.Entity<Usuario>()
            .Property(u => u.Nombre)
            .HasMaxLength(100);

        modelBuilder.Entity<Usuario>()
            .Property(u => u.Apellido)
            .HasMaxLength(100);

        // === PerfilDependiente ===
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

        // === BloqueRelevo ===
        modelBuilder.Entity<BloqueRelevo>()
            .Property(b => b.Estado)
            .HasConversion<string>();

        modelBuilder.Entity<BloqueRelevo>()
            .Property(b => b.Version)
            .IsRowVersion();

        // === BloqueTurno ===
        modelBuilder.Entity<BloqueTurno>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Descripcion)
                .HasMaxLength(200);

            entity.HasOne(e => e.CreadoPor)
                .WithMany()
                .HasForeignKey(e => e.CreadoPorId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.Fecha);
        });

        // === ReservaTurno ===
        modelBuilder.Entity<ReservaTurno>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasOne(e => e.BloqueTurno)
                .WithMany(b => b.Reservas)
                .HasForeignKey(e => e.BloqueTurnoId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Usuario)
                .WithMany()
                .HasForeignKey(e => e.UsuarioId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.BloqueTurnoId, e.UsuarioId })
                .IsUnique()
                .HasFilter("\"Activa\" = true");

            entity.HasIndex(e => e.UsuarioId);
        });
    }
}