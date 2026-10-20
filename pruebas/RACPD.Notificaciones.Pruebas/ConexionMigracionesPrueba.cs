using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
static class ConexionMigracionesPrueba
{
    public static void Ejecutar()
    {
        var carpeta = Path.Combine(Path.GetTempPath(), "racpd_conexion_" + Guid.NewGuid().ToString("N"));
        var directorioAnterior = Directory.GetCurrentDirectory();
        var variableAnterior = Environment.GetEnvironmentVariable("MIGRATION_DB_CONNECTION_STRING");
        Directory.CreateDirectory(carpeta);
        try
        {
            Environment.SetEnvironmentVariable("MIGRATION_DB_CONNECTION_STRING", null);
            Directory.SetCurrentDirectory(carpeta);
            const string preferida = "Host=localhost;Database=migraciones_prueba;Username=postgres";
            File.WriteAllText(Path.Combine(carpeta, ".env"), "SUPABASE_DB_CONNECTION_STRING=Host=localhost;Database=general_prueba;Username=postgres\nMIGRATION_DB_CONNECTION_STRING=" + preferida);
            using var db = new AppDbContextDesignTimeFactory().CreateDbContext([]);
            if (db.Database.GetConnectionString() != preferida) throw new InvalidOperationException("No priorizó la conexión de migraciones.");
            Environment.SetEnvironmentVariable("MIGRATION_DB_CONNECTION_STRING", "Host=localhost;Database=variable_prueba;Username=postgres");
            using var desdeVariable = new AppDbContextDesignTimeFactory().CreateDbContext([]);
            if (desdeVariable.Database.GetConnectionString() != Environment.GetEnvironmentVariable("MIGRATION_DB_CONNECTION_STRING")) throw new InvalidOperationException("No respetó la variable de entorno explícita.");
            Console.WriteLine("Correcto: conexión de migraciones priorizada sin depender del orden del archivo .env.");
        }
        finally
        {
            Directory.SetCurrentDirectory(directorioAnterior);
            Environment.SetEnvironmentVariable("MIGRATION_DB_CONNECTION_STRING", variableAnterior);
            File.Delete(Path.Combine(carpeta, ".env"));
            Directory.Delete(carpeta);
        }
    }
}
