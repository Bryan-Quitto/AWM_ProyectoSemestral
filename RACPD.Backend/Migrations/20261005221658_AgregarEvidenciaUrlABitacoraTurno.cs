using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RACPD.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AgregarEvidenciaUrlABitacoraTurno : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EvidenciaUrl",
                table: "BitacorasTurno",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EvidenciaUrl",
                table: "BitacorasTurno");
        }
    }
}
