using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RACPD.Backend.Migrations
{
    /// <inheritdoc />
    public partial class SyncPerfilDependienteColumnTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // NOTA: Las tablas BloquesTurno y ReservasTurno YA EXISTEN en la BD
            // porque las migraciones 20260905211438_AddAgendaTables y
            // 20260906003013_RemoveVersionColumnFromBloquesTurno fueron aplicadas
            // manualmente con anterioridad. Esta migración SOLO sincroniza los
            // tipos de columna de PerfilesDependientes para que coincidan con
            // el modelo (HasMaxLength aplicado en AppDbContext.cs).

            migrationBuilder.AlterColumn<string>(
                name: "NombreCompleto",
                table: "PerfilesDependientes",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "CondicionesCronicas",
                table: "PerfilesDependientes",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "CondicionesCronicas",
                table: "PerfilesDependientes",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(4000)",
                oldMaxLength: 4000);

            migrationBuilder.AlterColumn<string>(
                name: "NombreCompleto",
                table: "PerfilesDependientes",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);
        }
    }
}