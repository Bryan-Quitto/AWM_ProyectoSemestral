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
    public DbSet<VinculoDependiente> VinculosDependientes { get; set; } = null!;
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

        modelBuilder.Entity<PerfilDependiente>()
            .HasIndex(p => p.CreadoPorUsuarioId);

        // === VinculoDependiente ===
        modelBuilder.Entity<VinculoDependiente>(entity =>
        {
            entity.HasKey(v => v.Id);

            entity.Property(v => v.RolEnDependiente)
                .HasConversion<string>();

            entity.HasOne(v => v.Usuario)
                .WithMany()
                .HasForeignKey(v => v.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(v => v.PerfilDependiente)
                .WithMany()
                .HasForeignKey(v => v.PerfilDependienteId)
                .OnDelete(DeleteBehavior.Cascade);

            // Índice único: no permitir dos vínculos activos del mismo
            // usuario hacia el mismo perfil.
            entity.HasIndex(v => new { v.UsuarioId, v.PerfilDependienteId })
                .IsUnique()
                .HasFilter("\"Activo\" = true");

            // Índice único parcial en Postgres: máximo un cuidador principal
            // activo por perfil dependiente.
            entity.HasIndex(v => v.PerfilDependienteId)
                .IsUnique()
                .HasFilter("\"RolEnDependiente\" = 'CuidadorPrincipal' AND \"Activo\" = true")
                .HasDatabaseName("IX_VinculosDependientes_UnSoloCuidadorPrincipalActivo");

            entity.HasIndex(v => v.UsuarioId);
            entity.HasIndex(v => v.PerfilDependienteId);
        });

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
