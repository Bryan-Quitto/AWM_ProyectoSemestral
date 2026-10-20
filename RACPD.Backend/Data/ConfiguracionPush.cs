using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Domain.Entities;
namespace RACPD.Backend.Data;
public static class ConfiguracionPush
{
    public static void ConfigurarPush(this ModelBuilder modelo)
    {
        modelo.Entity<SuscripcionPush>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.UrlDestino).HasMaxLength(2048);
            e.Property(x => x.HuellaDestino).HasMaxLength(64);
            e.Property(x => x.ClavePublica).HasMaxLength(128);
            e.Property(x => x.SecretoAutenticacion).HasMaxLength(64);
            e.Property(x => x.Version).IsRowVersion();
            e.HasIndex(x => x.HuellaDestino).IsUnique();
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Cascade);
        });
        modelo.Entity<EntregaPush>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Estado).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.UltimoErrorClasificado).HasMaxLength(100);
            e.HasIndex(x => new { x.OutboxMensajeId, x.SuscripcionPushId }).IsUnique();
            e.HasIndex(x => new { x.Estado, x.ProximoIntento });
            e.HasOne<OutboxMensaje>().WithMany().HasForeignKey(x => x.OutboxMensajeId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<SuscripcionPush>().WithMany().HasForeignKey(x => x.SuscripcionPushId).OnDelete(DeleteBehavior.Restrict);
        });
        modelo.Entity<OutboxMensaje>().Property(x => x.VersionCarga).HasDefaultValue(1);
        modelo.Entity<OutboxMensaje>().Property(x => x.UltimoErrorClasificado).HasMaxLength(100);
    }
}
