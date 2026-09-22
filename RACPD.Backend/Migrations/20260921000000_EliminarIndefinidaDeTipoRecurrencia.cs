using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RACPD.Backend.Migrations
{
    /// <summary>
    /// Spec-007 §10 — Migración de datos: elimina la recurrencia "Indefinida"
    /// del modelo. Los bloques con <c>TipoRecurrencia = 'Indefinida'</c> se
    /// transforman a <c>'Semanas'</c> con <c>IntervaloSemanas = 1</c>
    /// (semanal), que es la traducción semánticamente más cercana al
    /// comportamiento que tenían (repetir cada 7 días).
    ///
    /// La decisión está documentada en
    /// docs/specs/007-semana2-persona1-proyeccion-recurrencia.md §10.3.
    ///
    /// Esta migración NO toca el esquema (columnas): sólo datos. Es idempotente:
    /// si ya no quedan filas con 'Indefinida', el UPDATE no afecta a nadie.
    /// </summary>
    public partial class EliminarIndefinidaDeTipoRecurrencia : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Transformar 'Indefinida' -> 'Semanas' con intervalo semanal.
            // Postgres permite UPDATE directo porque TipoRecurrencia es TEXT.
            migrationBuilder.Sql(
                @"UPDATE ""BloquesTurno""
                  SET ""TipoRecurrencia"" = 'Semanas',
                      ""IntervaloSemanas"" = COALESCE(""IntervaloSemanas"", 1)
                  WHERE ""TipoRecurrencia"" = 'Indefinida';");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Rollback: bloques que fueron migrados tenían TipoRecurrencia='Semanas'
            // e IntervaloSemanas entre 1 y 24. No es posible saber cuáles provenían
            // de 'Indefinida' salvo que se hubiera guardado un flag. Por seguridad
            // no revertimos automáticamente — el cuidador puede recrear manualmente
            // un bloque 'Indefinida' si lo necesita. Aquí solo registramos la
            // operación para auditoría.
            migrationBuilder.Sql(
                @"-- Rollback intencionalmente no destructivo.
                  -- Los bloques 'Semanas' creados tras esta migración se conservan.
                  SELECT 1;");
        }
    }
}