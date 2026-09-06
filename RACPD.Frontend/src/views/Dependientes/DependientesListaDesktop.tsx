import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint } from '../../api/generated/api/api';
import { Boton } from '../../components/Boton';
import { TruncadorLinea } from '../../components/TruncadorLinea';
import { ModalDetalle } from '../../components/ModalDetalle';
import { Edit3, Eye, Plus, User, Droplets, AlertTriangle, Users, HeartPulse, ShieldAlert } from 'lucide-react';

interface Props {
  /** Habilita el botón "Crear nuevo dependiente" (solo rol CuidadorPrincipal). */
  puedeCrear: boolean;
}

export function DependientesListaDesktop({ puedeCrear }: Props) {
  const navigate = useNavigate();
  const { data, isLoading, mutate } =
    useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint();

  const dependientes = (data?.data ?? []) as Array<{
    perfilId?: string;
    nombreCompleto?: string;
    tipoSangre?: string;
    rolEnDependiente?: string;
    puedeEditar?: boolean;
    condicionesCronicas?: string | null;
    alergiasEstructuradas?: string[];
  }>;

  // Modal de detalle: 'condiciones' | 'alergias' | null
  const [modalContenido, setModalContenido] = useState<{
    tipo: 'condiciones' | 'alergias';
    nombre: string;
    texto: string;
  } | null>(null);

  // Refrescar lista al volver desde cualquier vista relacionada
  useEffect(() => {
    const handleFocus = () => void mutate();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [mutate]);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500 bg-blue-50 min-h-screen">
        Cargando dependientes...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 bg-blue-50 min-h-screen">
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-900">Dependientes</h1>
          <p className="text-blue-700 mt-1">
            Personas a tu cuidado. Selecciona una para ver detalles o administrar sus accesos.
          </p>
        </div>
        {puedeCrear && (
          <Boton
            type="button"
            onClick={() => navigate({ to: '/dependientes/nuevo' })}
            className="py-3 px-5 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" /> Crear nuevo dependiente
          </Boton>
        )}
      </div>

      {dependientes.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-blue-200 rounded-2xl p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-blue-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-blue-900 mb-2">
            Aún no tienes dependientes asignados
          </h3>
          <p className="text-gray-600 mb-4 max-w-md mx-auto">
            {puedeCrear
              ? 'Crea la ficha del paciente que vas a cuidar. Podrás agregar contactos de emergencia y compartir el acceso con familiares.'
              : 'Pídele al cuidador principal que te invite como Apoyo desde la sección "Personas con acceso" de la ficha del paciente.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {dependientes.map((d) => (
            <article
              key={d.perfilId}
              className="bg-white rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col"
            >
              <div className="bg-gradient-to-r from-sky-600 to-blue-500 px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-base leading-tight truncate">
                      {d.nombreCompleto ?? 'Sin nombre'}
                    </h2>
                    <p className="text-xs text-sky-50/90 mt-0.5">
                      {d.rolEnDependiente === 'CuidadorPrincipal'
                        ? 'Cuidador principal'
                        : d.rolEnDependiente === 'Apoyo'
                        ? 'Apoyo'
                        : 'Sin rol'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center gap-2 text-gray-700 mb-3">
                  <Droplets className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium">Tipo de sangre:</span>
                  <span className="text-sm font-bold text-gray-900">
                    {d.tipoSangre || 'Desconocido'}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-gray-700 mb-2">
                  <HeartPulse className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                  <span className="text-sm font-medium shrink-0">Condiciones:</span>
                  <TruncadorLinea
                    className="text-sm text-gray-800"
                    texto={d.condicionesCronicas ?? ''}
                    placeholderVacio="Sin condiciones registradas"
                    onExpand={() =>
                      setModalContenido({
                        tipo: 'condiciones',
                        nombre: d.nombreCompleto ?? 'Sin nombre',
                        texto: d.condicionesCronicas ?? '',
                      })
                    }
                  />
                </div>
                <div className="flex items-start gap-2 text-gray-700 mb-4">
                  <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <span className="text-sm font-medium shrink-0">Alergias:</span>
                  <TruncadorLinea
                    className="text-sm text-gray-800"
                    texto={(d.alergiasEstructuradas ?? []).join(', ')}
                    placeholderVacio="Sin alergias registradas"
                    onExpand={() =>
                      setModalContenido({
                        tipo: 'alergias',
                        nombre: d.nombreCompleto ?? 'Sin nombre',
                        texto: (d.alergiasEstructuradas ?? []).join(', '),
                      })
                    }
                  />
                </div>
                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Boton
                      type="button"
                      variante="secundario"
                      onClick={() =>
                        d.perfilId &&
                        navigate({
                          to: '/dependientes/$perfilId',
                          params: { perfilId: d.perfilId },
                        })
                      }
                      className="flex-1 py-2 rounded-xl text-sm"
                    >
                      <Eye className="w-4 h-4 mr-1.5" /> Ver detalles
                    </Boton>
                    {d.puedeEditar && d.perfilId && (
                      <Boton
                        type="button"
                        onClick={() =>
                          navigate({
                            to: '/dependientes/$perfilId',
                            params: { perfilId: d.perfilId as string },
                            search: { editar: '1' },
                          })
                        }
                        className="flex-1 py-2 rounded-xl text-sm"
                      >
                        <Edit3 className="w-4 h-4 mr-1.5" /> Editar
                      </Boton>
                    )}
                  </div>
                  {d.puedeEditar && d.perfilId && (
                    <Boton
                      type="button"
                      variante="secundario"
                      onClick={() =>
                        navigate({
                          to: '/dependientes/$perfilId/acceso',
                          params: { perfilId: d.perfilId as string },
                        })
                      }
                      className="w-full py-2 rounded-xl text-sm"
                    >
                      <Users className="w-4 h-4 mr-1.5" /> Gestionar accesos
                    </Boton>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ModalDetalle
        abierto={modalContenido !== null}
        onCerrar={() => setModalContenido(null)}
        titulo={
          modalContenido
            ? `${modalContenido.tipo === 'condiciones' ? 'Condiciones críticas' : 'Alergias'} — ${modalContenido.nombre}`
            : ''
        }
        icono={
          modalContenido?.tipo === 'condiciones' ? (
            <HeartPulse className="w-5 h-5 text-rose-600" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-amber-600" />
          )
        }
      >
        {modalContenido?.texto}
      </ModalDetalle>
    </div>
  );
}
