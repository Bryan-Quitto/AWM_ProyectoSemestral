using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RACPD.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AgregarNotificacionesPush : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "DestinatariosResueltos",
                table: "OutboxMensajes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "FechaProcesamiento",
                table: "OutboxMensajes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UltimoErrorClasificado",
                table: "OutboxMensajes",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VersionCarga",
                table: "OutboxMensajes",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateTable(
                name: "SuscripcionesPush",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    UrlDestino = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    HuellaDestino = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ClavePublica = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    SecretoAutenticacion = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Activa = table.Column<bool>(type: "boolean", nullable: false),
                    FechaCreacion = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    FechaActualizacion = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SuscripcionesPush", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SuscripcionesPush_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EntregasPush",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OutboxMensajeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SuscripcionPushId = table.Column<Guid>(type: "uuid", nullable: false),
                    PerfilDependienteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Estado = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Intentos = table.Column<int>(type: "integer", nullable: false),
                    ProximoIntento = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ArrendamientoHasta = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    TokenReclamacion = table.Column<Guid>(type: "uuid", nullable: true),
                    FechaAceptacion = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UltimoCodigoHttp = table.Column<int>(type: "integer", nullable: true),
                    UltimoErrorClasificado = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EntregasPush", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EntregasPush_OutboxMensajes_OutboxMensajeId",
                        column: x => x.OutboxMensajeId,
                        principalTable: "OutboxMensajes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EntregasPush_SuscripcionesPush_SuscripcionPushId",
                        column: x => x.SuscripcionPushId,
                        principalTable: "SuscripcionesPush",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EntregasPush_Estado_ProximoIntento",
                table: "EntregasPush",
                columns: new[] { "Estado", "ProximoIntento" });

            migrationBuilder.CreateIndex(
                name: "IX_EntregasPush_OutboxMensajeId_SuscripcionPushId",
                table: "EntregasPush",
                columns: new[] { "OutboxMensajeId", "SuscripcionPushId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EntregasPush_SuscripcionPushId",
                table: "EntregasPush",
                column: "SuscripcionPushId");

            migrationBuilder.CreateIndex(
                name: "IX_SuscripcionesPush_HuellaDestino",
                table: "SuscripcionesPush",
                column: "HuellaDestino",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SuscripcionesPush_UsuarioId",
                table: "SuscripcionesPush",
                column: "UsuarioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EntregasPush");

            migrationBuilder.DropTable(
                name: "SuscripcionesPush");

            migrationBuilder.DropColumn(
                name: "DestinatariosResueltos",
                table: "OutboxMensajes");

            migrationBuilder.DropColumn(
                name: "FechaProcesamiento",
                table: "OutboxMensajes");

            migrationBuilder.DropColumn(
                name: "UltimoErrorClasificado",
                table: "OutboxMensajes");

            migrationBuilder.DropColumn(
                name: "VersionCarga",
                table: "OutboxMensajes");
        }
    }
}
