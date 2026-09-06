import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Users, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  useRACPDBackendFeaturesPerfilesDependientesVinculosListarVinculosListarVinculosEndpoint,
  useRACPDBackendFeaturesPerfilesDependientesVinculosAgregarVinculoAgregarVinculoEndpoint,
  useRACPDBackendFeaturesUsuariosUsuariosDeApoyoListarUsuariosDeApoyoListarUsuariosDeApoyoEndpoint,
  rACPDBackendFeaturesPerfilesDependientesVinculosDesactivarVinculoDesactivarVinculoEndpoint,
} from '../../api/generated/api/api';
import { Boton } from '../../components/Boton';
import { BuscadorDinamico, type OpcionBuscador } from '../../components/BuscadorDinamico';

interface Props {
  perfilId: string;
  variant?: 'desktop' | 'mobile';
}

/**
 * Sección "Personas con acceso".
 * Solo se debe renderizar cuando el usuario es CuidadorPrincipal del
 * perfil (la vista padre decide si mostrar o no esta sección).
 */
export function PersonasAccesoPanel({ perfilId, variant = 'desktop' }: Props) {
  const { data, mutate } =
    useRACPDBackendFeaturesPerfilesDependientesVinculosListarVinculosListarVinculosEndpoint(perfilId);
  const { trigger: agregarVinculo, isMutating: isAgregando } =
    useRACPDBackendFeaturesPerfilesDependientesVinculosAgregarVinculoAgregarVinculoEndpoint(perfilId);

  // El endpoint DELETE recibe `vinculoId` por path param. El hook generado por
  // Orval cierra el `vinculoId` en la closure, lo que impide sobreescribirlo
  // con `trigger(arg)`. Llamamos directamente al fetcher pasando el id real
  // y gestionamos `isDesactivando` con state local.
  const [isDesactivando, setIsDesactivando] = useState(false);

  // Lista de usuarios de apoyo del sistema (solo accesible para CuidadorPrincipal).
  const { data: dataUsuariosApoyo } =
    useRACPDBackendFeaturesUsuariosUsuariosDeApoyoListarUsuariosDeApoyoListarUsuariosDeApoyoEndpoint();

  const [usuarioIdSeleccionado, setUsuarioIdSeleccionado] = useState<string>('');
  // Por ahora todos los vínculos se crean como Apoyo. Cuando se permita
  // transferir el cuidado, este campo volverá a ser un SelectorDinamico.
  const rolEnDependienteFijo = 'Apoyo' as const;

  const vinculos = useMemo(
    () =>
      (data?.data ?? []) as Array<{
        vinculoId?: string;
        usuarioId?: string;
        nombreCompletoUsuario?: string;
        correoUsuario?: string;
        rolEnDependiente?: string;
        fechaAsignacion?: string;
      }>,
    [data?.data]
  );

  const usuariosApoyo = useMemo(
    () => (dataUsuariosApoyo?.data ?? []) as Array<{
      usuarioId?: string;
      nombreCompleto?: string;
      correo?: string;
    }>,
    [dataUsuariosApoyo]
  );

  // Filtrar usuarios que ya están vinculados activamente para no ofrecerlos duplicados.
  const usuariosYaVinculados = useMemo(
    () => new Set(vinculos.map((v) => v.usuarioId).filter(Boolean) as string[]),
    [vinculos]
  );

  const opcionesBuscador: OpcionBuscador[] = useMemo(
    () =>
      usuariosApoyo
        .filter((u) => u.usuarioId && !usuariosYaVinculados.has(u.usuarioId))
        .map((u) => ({
          valor: u.usuarioId as string,
          etiqueta: u.nombreCompleto?.trim() || u.correo || 'Sin nombre',
          subtexto: u.correo,
        })),
    [usuariosApoyo, usuariosYaVinculados]
  );

  const handleAgregar = async () => {
    if (!usuarioIdSeleccionado) {
      toast.error('Selecciona un usuario de apoyo de la lista.');
      return;
    }
    try {
      const respuesta: any = await agregarVinculo({
        perfilDependienteId: perfilId,
        usuarioId: usuarioIdSeleccionado,
        rolEnDependiente: rolEnDependienteFijo,
      });
      if (respuesta.status >= 400) {
        const detail = respuesta.data?.detail ?? 'No se pudo agregar el vínculo.';
        toast.error(detail);
        return;
      }
      toast.success('Persona agregada correctamente.');
      setUsuarioIdSeleccionado('');
      void mutate();
    } catch {
      toast.error('Error de red al agregar el vínculo.');
    }
  };

  const handleDesactivar = async (vinculoId: string) => {
    setIsDesactivando(true);
    try {
      const respuesta: any = await rACPDBackendFeaturesPerfilesDependientesVinculosDesactivarVinculoDesactivarVinculoEndpoint(
        perfilId,
        vinculoId
      );
      if (respuesta.status >= 400) {
        const detail = respuesta.data?.detail ?? 'No se pudo desactivar el vínculo.';
        toast.error(detail);
        return;
      }
      toast.success('Acceso desactivado.');
      void mutate();
    } catch {
      toast.error('Error de red al desactivar el vínculo.');
    } finally {
      setIsDesactivando(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
      <div className="bg-blue-50 px-5 py-4 border-b border-blue-100">
        <h3 className="font-bold text-blue-900 flex items-center gap-2 text-lg">
          <Users className="w-5 h-5" /> Personas con acceso
        </h3>
        <p className="text-xs text-blue-700 mt-1">
          Gestiona quién puede ver la ficha del dependiente.
        </p>
      </div>

      <div className={variant === 'mobile' ? 'p-4 space-y-4' : 'p-6 space-y-5'}>
        {/* Form agregar */}
        <div className={variant === 'mobile' ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-12 gap-3 items-end'}>
          <div className={variant === 'mobile' ? '' : 'md:col-span-9'}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Usuario de apoyo
            </label>
            <BuscadorDinamico
              id="usuarioApoyo"
              opciones={opcionesBuscador}
              value={usuarioIdSeleccionado}
              onChange={(v) => setUsuarioIdSeleccionado(String(v))}
              placeholder="Buscar por nombre o correo…"
              emptyMessage={
                opcionesBuscador.length === 0
                  ? 'No hay usuarios de apoyo disponibles para vincular.'
                  : 'Sin coincidencias.'
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              Solo aparecen usuarios con rol Apoyo y perfil activo que aún no estén vinculados.
            </p>
          </div>
          <div className={variant === 'mobile' ? '' : 'md:col-span-3'}>
            <label
              className="block text-sm font-medium text-transparent mb-1 select-none"
              aria-hidden="true"
            >
              Acción
            </label>
            <Boton
              type="button"
              onClick={handleAgregar}
              disabled={isAgregando || !usuarioIdSeleccionado}
              cargando={isAgregando}
              className="w-full py-2 rounded-lg"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Agregar
            </Boton>
            {/* Spacer invisible para alinear con el texto de ayuda del buscador. */}
            <p className="text-xs mt-1 invisible" aria-hidden="true">
              Espaciador
            </p>
          </div>
        </div>

        {/* Lista */}
        {vinculos.length === 0 ? (
          <p className="text-sm text-gray-500 italic text-center py-4">
            Nadie más tiene acceso todavía.
          </p>
        ) : (
          <ul className="divide-y divide-blue-50">
            {vinculos.map((v) => {
              const esCuidador = v.rolEnDependiente === 'CuidadorPrincipal';
              return (
                <li
                  key={v.vinculoId}
                  className={
                    variant === 'mobile'
                      ? 'py-3 flex items-start justify-between gap-3'
                      : 'py-3 flex items-center justify-between gap-4'
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 truncate">
                        {v.nombreCompletoUsuario ?? v.correoUsuario ?? 'Usuario'}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          esCuidador
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-blue-100 text-blue-900'
                        }`}
                      >
                        {esCuidador ? (
                          <ShieldCheck className="w-3 h-3" />
                        ) : (
                          <ShieldAlert className="w-3 h-3" />
                        )}
                        {esCuidador ? 'Cuidador principal' : 'Apoyo'}
                      </span>
                    </div>
                    {v.correoUsuario && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                        <Mail className="w-3 h-3" /> {v.correoUsuario}
                      </p>
                    )}
                  </div>
                  {!esCuidador && (
                    <button
                      type="button"
                      onClick={() => v.vinculoId && handleDesactivar(v.vinculoId)}
                      disabled={isDesactivando}
                      className="cursor-pointer disabled:cursor-not-allowed p-2 rounded-full text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                      aria-label={`Desactivar acceso de ${v.nombreCompletoUsuario ?? ''}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}