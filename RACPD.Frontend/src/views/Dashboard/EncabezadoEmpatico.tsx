import { obtenerSaludoContextual } from './utilidades';

interface EncabezadoEmpaticoProps {
  /** Nombre del cuidador (logueado) o cadena vacía si aún carga. */
  nombreCuidador: string;
}

/**
 * EncabezadoEmpatico
 *
 * Saludo dinámico y empático con resumen operativo general de la agenda.
 */
export const EncabezadoEmpatico = ({ nombreCuidador }: EncabezadoEmpaticoProps) => {
  const saludo = obtenerSaludoContextual();
  const nombre = nombreCuidador.trim() ? `, ${nombreCuidador}` : '';

  return (
    <header className="space-y-1">
      <h1 className="text-2xl md:text-3xl font-bold text-blue-900 tracking-tight">
        {saludo}
        {nombre}
      </h1>
      <p className="text-sm md:text-base text-blue-700/80">
        Resumen operativo y estado de tu agenda de cuidado
      </p>
    </header>
  );
};
