using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RACPD.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddBitacoraTurno : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BitacorasTurno",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BloqueTurnoId = table.Column<Guid>(type: "uuid", nullable: false),
                    RegistradoPorUsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    EstadoAnimo = table.Column<string>(type: "text", nullable: false),
                    Sintomas = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    HorasSueno = table.Column<decimal>(type: "numeric(4,2)", precision: 4, scale: 2, nullable: true),
                    ObservacionesGenerales = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    TareasRealizadasIds = table.Column<List<Guid>>(type: "uuid[]", nullable: false),
                    FechaCierre = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Activa = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BitacorasTurno", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BitacorasTurno_BloquesTurno_BloqueTurnoId",
                        column: x => x.BloqueTurnoId,
                        principalTable: "BloquesTurno",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BitacorasTurno_Usuarios_RegistradoPorUsuarioId",
                        column: x => x.RegistradoPorUsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BitacorasTurno_FechaCierre",
                table: "BitacorasTurno",
                column: "FechaCierre");

            migrationBuilder.CreateIndex(
                name: "IX_BitacorasTurno_RegistradoPorUsuarioId",
                table: "BitacorasTurno",
                column: "RegistradoPorUsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_BitacorasTurno_UnSoloCierreActivoPorBloque",
                table: "BitacorasTurno",
                column: "BloqueTurnoId",
                unique: true,
                filter: "\"Activa\" = true");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BitacorasTurno");
        }
    }
}
