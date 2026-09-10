using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RACPD.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AgregarRecurrenciaYTareasBloqueTurno : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EsRecurrente",
                table: "BloquesTurno");

            migrationBuilder.AddColumn<int>(
                name: "IntervaloSemanas",
                table: "BloquesTurno",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PerfilDependienteId",
                table: "BloquesTurno",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Tareas",
                table: "BloquesTurno",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TipoRecurrencia",
                table: "BloquesTurno",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_BloquesTurno_PerfilDependienteId",
                table: "BloquesTurno",
                column: "PerfilDependienteId");

            migrationBuilder.AddForeignKey(
                name: "FK_BloquesTurno_PerfilesDependientes_PerfilDependienteId",
                table: "BloquesTurno",
                column: "PerfilDependienteId",
                principalTable: "PerfilesDependientes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BloquesTurno_PerfilesDependientes_PerfilDependienteId",
                table: "BloquesTurno");

            migrationBuilder.DropIndex(
                name: "IX_BloquesTurno_PerfilDependienteId",
                table: "BloquesTurno");

            migrationBuilder.DropColumn(
                name: "IntervaloSemanas",
                table: "BloquesTurno");

            migrationBuilder.DropColumn(
                name: "PerfilDependienteId",
                table: "BloquesTurno");

            migrationBuilder.DropColumn(
                name: "Tareas",
                table: "BloquesTurno");

            migrationBuilder.DropColumn(
                name: "TipoRecurrencia",
                table: "BloquesTurno");

            migrationBuilder.AddColumn<bool>(
                name: "EsRecurrente",
                table: "BloquesTurno",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }
    }
}
