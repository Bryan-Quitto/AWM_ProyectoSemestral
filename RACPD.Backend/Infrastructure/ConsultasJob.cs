using Microsoft.EntityFrameworkCore;
namespace RACPD.Backend.Infrastructure;
public static class ConsultasJob
{
    // Uso exclusivo de procesos internos; cada consumidor aplica autorización de dominio.
    public static IQueryable<T> ParaJob<T>(this IQueryable<T> consulta) where T : class => consulta.IgnoreQueryFilters();
}
