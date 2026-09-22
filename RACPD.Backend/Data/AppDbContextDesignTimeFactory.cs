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
///
/// Para comandos que SÍ requieren comparar contra la BD real
/// (ej. <c>dotnet ef migrations list</c>, <c>migrations script</c>,
/// <c>database update</c>), si existe <c>.env</c> se usa la cadena
/// <c>MIGRATION_DB_CONNECTION_STRING</c> para que el reporte refleje
/// el estado real de Supabase. Si no hay .env o la variable no está
/// definida, se usa la cadena dummy como fallback offline.
/// </summary>
public class AppDbContextDesignTimeFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    private const string CadenaDummy =
        "Host=localhost;Port=5432;Database=racpd_design;Username=postgres;Password=postgres";

    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();

        // 1) Intentar resolver la cadena real desde .env en la raíz del backend.
        var cadenaConexion = ResolverCadenaConexion() ?? CadenaDummy;

        optionsBuilder.UseNpgsql(cadenaConexion);

        return new AppDbContext(optionsBuilder.Options);
    }

    /// <summary>
    /// Lee <c>RACPD.Backend/.env</c> buscando <c>MIGRATION_DB_CONNECTION_STRING</c>
    /// o, en su defecto, <c>SUPABASE_DB_CONNECTION_STRING</c>. Devuelve <c>null</c>
    /// si el archivo no existe, si no contiene la variable, o si el formato es
    /// inválido (en cuyo caso el caller hace fallback a la cadena dummy).
    /// </summary>
    private static string? ResolverCadenaConexion()
    {
        try
        {
            // .env vive un nivel arriba de Data/, junto al .csproj.
            var rutaEnv = Path.Combine(
                Directory.GetCurrentDirectory(),
                ".env");

            if (!File.Exists(rutaEnv))
                return null;

            foreach (var linea in File.ReadAllLines(rutaEnv))
            {
                // Ignorar comentarios y líneas vacías.
                var trimmed = linea.TrimStart();
                if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith('#'))
                    continue;

                // Formato esperado: CLAVE=VALOR (sin '=' dentro del valor).
                var separador = trimmed.IndexOf('=');
                if (separador <= 0)
                    continue;

                var clave = trimmed[..separador].Trim();
                var valor = trimmed[(separador + 1)..].Trim();

                // Quitar comillas envolventes si las tiene.
                if (valor.Length >= 2 &&
                    ((valor.StartsWith('"') && valor.EndsWith('"')) ||
                     (valor.StartsWith('\'') && valor.EndsWith('\''))))
                {
                    valor = valor[1..^1];
                }

                if (clave == "MIGRATION_DB_CONNECTION_STRING" ||
                    clave == "SUPABASE_DB_CONNECTION_STRING")
                {
                    return valor;
                }
            }
        }
        catch
        {
            // Cualquier error de lectura: degradar al dummy silenciosamente.
            // Las herramientas de EF deben seguir funcionando offline.
        }

        return null;
    }
}