using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RACPD.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddVinculoAndRenameCuidadorPrincipalId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PerfilesDependientes_Usuarios_CuidadorPrincipalId",
                table: "PerfilesDependientes");

            migrationBuilder.RenameColumn(
                name: "CuidadorPrincipalId",
                table: "PerfilesDependientes",
                newName: "CreadoPorUsuarioId");

            migrationBuilder.RenameIndex(
                name: "IX_PerfilesDependientes_CuidadorPrincipalId",
                table: "PerfilesDependientes",
                newName: "IX_PerfilesDependientes_CreadoPorUsuarioId");

            migrationBuilder.AddColumn<bool>(
                name: "Activo",
                table: "PerfilesDependientes",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "FechaEliminacion",
                table: "PerfilesDependientes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "VinculosDependientes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    PerfilDependienteId = table.Column<Guid>(type: "uuid", nullable: false),
                    RolEnDependiente = table.Column<string>(type: "text", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    FechaAsignacion = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AsignadoPorUsuarioId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VinculosDependientes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VinculosDependientes_PerfilesDependientes_PerfilDependiente~",
                        column: x => x.PerfilDependienteId,
                        principalTable: "PerfilesDependientes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_VinculosDependientes_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VinculosDependientes_UnSoloCuidadorPrincipalActivo",
                table: "VinculosDependientes",
                column: "PerfilDependienteId",
                unique: true,
                filter: "\"RolEnDependiente\" = 'CuidadorPrincipal' AND \"Activo\" = true");

            migrationBuilder.CreateIndex(
                name: "IX_VinculosDependientes_UsuarioId",
                table: "VinculosDependientes",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_VinculosDependientes_UsuarioId_PerfilDependienteId",
                table: "VinculosDependientes",
                columns: new[] { "UsuarioId", "PerfilDependienteId" },
                unique: true,
                filter: "\"Activo\" = true");

            // ============================================================
            // DATA SEED: Backfill de vínculos para perfiles existentes.
            // Por cada PerfilDependiente creamos un VinculoDependiente
            // activo donde el Usuario es el creador del perfil
            // (ex CuidadorPrincipalId, ahora CreadoPorUsuarioId) con
            // RolEnDependiente = CuidadorPrincipal.
            // Sin esto, los cuidadores principales actuales perderían
            // acceso a sus perfiles tras la migración.
            //
            // CREATE EXTENSION es idempotente y necesario para gen_random_uuid().
            // ============================================================
            migrationBuilder.Sql(@"CREATE EXTENSION IF NOT EXISTS ""pgcrypto"";");

            migrationBuilder.Sql(@"
                INSERT INTO ""VinculosDependientes"" (
                    ""Id"",
                    ""UsuarioId"",
                    ""PerfilDependienteId"",
                    ""RolEnDependiente"",
                    ""Activo"",
                    ""FechaAsignacion"",
                    ""AsignadoPorUsuarioId""
                )
                SELECT
                    gen_random_uuid(),
                    ""CreadoPorUsuarioId"",
                    ""Id"",
                    'CuidadorPrincipal',
                    true,
                    NOW(),
                    ""CreadoPorUsuarioId""
                FROM ""PerfilesDependientes"";
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Antes de dropear la tabla de vínculos, eliminamos los registros
            // sembrados por esta migración para mantener simetría con el Up.
            // (Si hubiera vínculos creados por usuarios tras aplicar la migración,
            // también se eliminarían. Esto es aceptable en un Down de desarrollo;
            // en producción se requeriría un plan de rollback más cuidadoso.)
            migrationBuilder.Sql(@"DELETE FROM ""VinculosDependientes"";");

            migrationBuilder.DropTable(
                name: "VinculosDependientes");

            migrationBuilder.DropColumn(
                name: "Activo",
                table: "PerfilesDependientes");

            migrationBuilder.DropColumn(
                name: "FechaEliminacion",
                table: "PerfilesDependientes");

            migrationBuilder.RenameColumn(
                name: "CreadoPorUsuarioId",
                table: "PerfilesDependientes",
                newName: "CuidadorPrincipalId");

            migrationBuilder.RenameIndex(
                name: "IX_PerfilesDependientes_CreadoPorUsuarioId",
                table: "PerfilesDependientes",
                newName: "IX_PerfilesDependientes_CuidadorPrincipalId");

            migrationBuilder.AddForeignKey(
                name: "FK_PerfilesDependientes_Usuarios_CuidadorPrincipalId",
                table: "PerfilesDependientes",
                column: "CuidadorPrincipalId",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
