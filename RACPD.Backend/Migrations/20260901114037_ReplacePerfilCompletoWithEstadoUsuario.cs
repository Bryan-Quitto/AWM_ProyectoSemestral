using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RACPD.Backend.Migrations
{
    /// <inheritdoc />
    public partial class ReplacePerfilCompletoWithEstadoUsuario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Estado",
                table: "Usuarios",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.Sql("UPDATE \"Usuarios\" SET \"Estado\" = 3 WHERE \"PerfilCompleto\" = true;");

            migrationBuilder.DropColumn(
                name: "PerfilCompleto",
                table: "Usuarios");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "PerfilCompleto",
                table: "Usuarios",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql("UPDATE \"Usuarios\" SET \"PerfilCompleto\" = true WHERE \"Estado\" = 3;");

            migrationBuilder.DropColumn(
                name: "Estado",
                table: "Usuarios");
        }
    }
}
