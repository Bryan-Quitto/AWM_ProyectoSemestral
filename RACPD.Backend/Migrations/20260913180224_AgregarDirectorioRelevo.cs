using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RACPD.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AgregarDirectorioRelevo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DirectorioRelevos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PerfilDependienteId = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioApoyoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nombre = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Telefono = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Estado = table.Column<string>(type: "text", nullable: false, defaultValue: "Disponible"),
                    Listado = table.Column<bool>(type: "boolean", nullable: false),
                    Notas = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DirectorioRelevos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DirectorioRelevos_PerfilesDependientes_PerfilDependienteId",
                        column: x => x.PerfilDependienteId,
                        principalTable: "PerfilesDependientes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DirectorioRelevos_Usuarios_UsuarioApoyoId",
                        column: x => x.UsuarioApoyoId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DirectorioRelevos_Nombre",
                table: "DirectorioRelevos",
                column: "Nombre");

            migrationBuilder.CreateIndex(
                name: "IX_DirectorioRelevos_PerfilDependienteId",
                table: "DirectorioRelevos",
                column: "PerfilDependienteId");

            migrationBuilder.CreateIndex(
                name: "IX_DirectorioRelevos_PerfilDependienteId_UsuarioApoyoId",
                table: "DirectorioRelevos",
                columns: new[] { "PerfilDependienteId", "UsuarioApoyoId" },
                unique: true,
                filter: "\"Activo\" = true");

            migrationBuilder.CreateIndex(
                name: "IX_DirectorioRelevos_UsuarioApoyoId",
                table: "DirectorioRelevos",
                column: "UsuarioApoyoId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DirectorioRelevos");
        }
    }
}
