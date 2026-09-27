import { Users, UserCheck, UserX } from 'lucide-react';
import { TarjetaMetrica } from './TarjetaMetrica';

interface DashboardAdminProps {
  totalUsuarios: number;
  usuariosActivos: number;
  usuariosInactivos: number;
  cargando: boolean;
  nombreAdmin: string;
}

export const DashboardAdmin = ({
  totalUsuarios,
  usuariosActivos,
  usuariosInactivos,
  cargando,
  nombreAdmin,
}: DashboardAdminProps) => {
  return (
    <div className="min-h-full bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 md:p-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold text-blue-900">
          Panel de Administración
        </h1>
        <p className="text-sm md:text-base text-blue-700">
          {nombreAdmin ? `Bienvenido, ${nombreAdmin}. ` : ''}
          Resumen global de cuentas y usuarios registrados en la plataforma.
        </p>
      </header>

      <section
        className="grid grid-cols-1 sm:grid-cols-3 gap-6"
        aria-label="Métricas de usuarios"
      >
        <TarjetaMetrica
          etiqueta="Usuarios totales"
          valor={totalUsuarios}
          subtexto="Registrados en la plataforma"
          icono={Users}
          tono="primario"
          cargando={cargando}
        />
        <TarjetaMetrica
          etiqueta="Usuarios activos"
          valor={usuariosActivos}
          subtexto="Con acceso habilitado"
          icono={UserCheck}
          tono="exito"
          cargando={cargando}
        />
        <TarjetaMetrica
          etiqueta="Usuarios inactivos"
          valor={usuariosInactivos}
          subtexto="Desactivados o suspendidos"
          icono={UserX}
          tono="alerta"
          cargando={cargando}
        />
      </section>
    </div>
  );
};
