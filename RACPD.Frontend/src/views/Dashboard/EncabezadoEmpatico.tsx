import { obtenerSaludoContextual } from './utilidades';

interface EncabezadoEmpaticoProps {
  /** Nombre del cuidador (logueado) o cadena vacía si aún carga. */
  nombreCuidador: string;
  /** Nombre del dependiente activo o cadena vacía. */
  nombreDependiente: string;
}

/**
 * EncabezadoEmpatico
 *
 * Saludo dinámico + subtítulo. UI ligada al feature Dashboard; vive en
 * `/views/Dashboard/` según la regla de dominio. Es agnóstico al layout
 * (Desktop/Mobile): el tamaño tipográfico se controla desde el padre.
 *
 * La función `obtenerSaludoContextual` se importa desde `./utilidades`
 * para no romper la regla `react(only-export-components)` de oxlint.
 */
export const EncabezadoEmpatico = ({
  nombreCuidador,
  nombreDependiente,
}: EncabezadoEmpaticoProps) => {
  const saludo = obtenerSaludoContextual();
  const nombre = nombreCuidador.trim() ? `, ${nombreCuidador}` : '';
  const subtitulo = nombreDependiente.trim()
    ? `Resumen operativo y estado del cuidado de ${nombreDependiente}`
    : 'Resumen operativo del cuidado';

  return (
    <header className="space-y-1">
      <h1 className="text-2xl md:text-3xl font-bold text-blue-900 tracking-tight">
        {saludo}
        {nombre}
      </h1>
      <p className="text-sm md:text-base text-blue-700/80">{subtitulo}</p>
    </header>
  );
};
