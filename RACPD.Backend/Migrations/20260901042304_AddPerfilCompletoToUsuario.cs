using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RACPD.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPerfilCompletoToUsuario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "FechaCompletadoPerfil",
                table: "Usuarios",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "FechaCreacion",
                table: "Usuarios",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<bool>(
                name: "PerfilCompleto",
                table: "Usuarios",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Backfill: cualquier usuario existente antes de este deploy ya tiene datos personales
            // (o es administrador creado manualmente). Se marca como perfil completo para no
            // atraparlo en el guard de redirección a /completar-perfil.
            migrationBuilder.Sql(
                "UPDATE \"Usuarios\" SET \"PerfilCompleto\" = true, \"FechaCompletadoPerfil\" = NOW() WHERE \"PerfilCompleto\" = false;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FechaCompletadoPerfil",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "FechaCreacion",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "PerfilCompleto",
                table: "Usuarios");
        }
    }
}
