using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace RACPD.Backend.Data;

/// <summary>
/// Factory usado por las herramientas de EF Core en tiempo de diseño
/// (dotnet ef migrations add/remove/script). Solo construye el modelo
/// a partir de <see cref="AppDbContext.OnModelCreating"/> sin requerir
/// una cadena de conexión real a PostgreSQL.
///
/// Esto evita que <c>dotnet ef</c> falle con "Host desconocido" cuando
/// el .env no tiene la cadena de Supabase o no hay red, y desacopla
/// el scaffold de migraciones del arranque de la app.
/// </summary>
public class AppDbContextDesignTimeFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();

        // Cadena dummy: solo se usa para que Npgsql provider se registre.
        // EF Core no abre conexión durante el scaffold de migraciones,
        // solo necesita el provider para resolver tipos (uuid, uuid[], xid, etc.).
        optionsBuilder.UseNpgsql(
            "Host=localhost;Port=5432;Database=racpd_design;Username=postgres;Password=postgres");

        return new AppDbContext(optionsBuilder.Options);
    }
}