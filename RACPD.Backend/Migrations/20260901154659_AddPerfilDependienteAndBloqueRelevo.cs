using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RACPD.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPerfilDependienteAndBloqueRelevo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PerfilesDependientes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CuidadorPrincipalId = table.Column<Guid>(type: "uuid", nullable: false),
                    NombreCompleto = table.Column<string>(type: "text", nullable: false),
                    TipoSangre = table.Column<string>(type: "text", nullable: false),
                    CondicionesCronicas = table.Column<string>(type: "text", nullable: false),
                    AlergiasEstructuradas = table.Column<List<string>>(type: "text[]", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    ContactosEmergencia = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerfilesDependientes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PerfilesDependientes_Usuarios_CuidadorPrincipalId",
                        column: x => x.CuidadorPrincipalId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BloquesRelevo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PerfilDependienteId = table.Column<Guid>(type: "uuid", nullable: false),
                    InicioUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    FinUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Estado = table.Column<string>(type: "text", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BloquesRelevo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BloquesRelevo_PerfilesDependientes_PerfilDependienteId",
                        column: x => x.PerfilDependienteId,
                        principalTable: "PerfilesDependientes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BloquesRelevo_PerfilDependienteId",
                table: "BloquesRelevo",
                column: "PerfilDependienteId");

            migrationBuilder.CreateIndex(
                name: "IX_PerfilesDependientes_CuidadorPrincipalId",
                table: "PerfilesDependientes",
                column: "CuidadorPrincipalId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BloquesRelevo");

            migrationBuilder.DropTable(
                name: "PerfilesDependientes");
        }
    }
}
