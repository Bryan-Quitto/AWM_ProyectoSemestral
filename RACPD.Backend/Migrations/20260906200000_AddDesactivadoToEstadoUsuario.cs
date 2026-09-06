using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RACPD.Backend.Migrations
{
    /// <summary>
    /// Documenta la adición del valor <c>Desactivado = 4</c> al enum
    /// <c>EstadoUsuario</c>. No requiere cambio de esquema porque la
    /// columna <c>Estado</c> en <c>Usuarios</c> ya es de tipo <c>integer</c>;
    /// los registros existentes conservan su valor (1, 2 o 3) y nunca
    /// serán <c>4</c> salvo por acción explícita del AdministradorSistema
    /// mediante <c>PATCH /api/usuarios/{id}/estado</c>.
    ///
    /// Esta migración existe únicamente para mantener trazabilidad en el
    /// historial del repositorio y permitir la reversión del código si
    /// se necesitara.
    /// </summary>
    public partial class AddDesactivadoToEstadoUsuario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Sin operación a nivel SQL. El cambio es puramente en el enum C#.
            // Se deja explícito para que el historial de migraciones refleje
            // la intención del cambio de dominio.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Sin operación. La reversión se realiza restaurando el enum en
            // el código fuente; los valores 4 ya persistidos se volverían
            // inaccesibles pero no se eliminan físicamente.
        }
    }
}
