import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint } from '../../api/generated/api/api';
import { Boton } from '../../components/Boton';
import { TruncadorLinea } from '../../components/TruncadorLinea';
import { ModalDetalle } from '../../components/ModalDetalle';
import { etiquetaTipoSangre } from '../../schemas/tipoSangre';
import { formatearFechaAsignacion } from '../../schemas/fechaAsignacion';
import { Edit3, Eye, Plus, User, Droplets, AlertTriangle, Users, HeartPulse, ShieldAlert } from 'lucide-react';

interface Props {
  puedeCrear: boolean;
}

export function DependientesListaMobile({ puedeCrear }: Props) {
  const navigate = useNavigate();
  const { data, isLoading, mutate } =
    useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint();

  const dependientes = (data?.data ?? []) as Array<{
    perfilId?: string;
    nombreCompleto?: string;
    tipoSangre?: string;
    rolEnDependiente?: string;
    puedeEditar?: boolean;
    fechaAsignacion?: string;
    condicionesCronicas?: string | null;
    alergiasEstructuradas?: string[];
  }>;

  const [modalContenido, setModalContenido] = useState<{
    tipo: 'condiciones' | 'alergias';
    nombre: string;
    texto: string;
  } | null>(null);

  useEffect(() => {
    const handleFocus = () => void mutate();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [mutate]);

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-500 bg-blue-50 min-h-screen">
        Cargando dependientes...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 pb-24">
      <header className="bg-white px-5 py-4 shadow-sm border-b border-blue-100 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-blue-900">Mis Dependientes</h1>
            <p className="text-xs text-blue-600">Pacientes bajo tu cuidado</p>
          </div>
          {puedeCrear && (
            <Boton
              onClick={() => navigate({ to: '/dependientes/nuevo' })}
              aria-label="Crear nuevo dependiente"
              className="!w-11 !h-11 !p-0 !rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95 shrink-0"
            >
              <Plus className="w-5 h-5" />
            </Boton>
          )}
        </div>
      </header>

      <main className="px-4 pt-4 space-y-3">
        {dependientes.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-blue-200 rounded-2xl p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-blue-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-blue-900 mb-1">
              Aún no tienes dependientes asignados
            </h3>
            <p className="text-sm text-gray-600">
              {puedeCrear
                ? 'Crea la ficha del paciente que vas a cuidar.'
                : 'Pídele al cuidador principal que te invite como Apoyo.'}
            </p>
          </div>
        ) : (
          dependientes.map((d) => (
            <article
              key={d.perfilId}
              className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() =>
                  d.perfilId &&
                  navigate({
                    to: '/dependientes/$perfilId',
                    params: { perfilId: d.perfilId },
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (d.perfilId) {
                      navigate({
                        to: '/dependientes/$perfilId',
                        params: { perfilId: d.perfilId },
                      });
                    }
                  }
                }}
                className="cursor-pointer active:scale-[0.99] transition-transform bg-gradient-to-r from-sky-600 to-blue-500 px-4 py-3 text-white"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-base leading-tight truncate">
                      {d.nombreCompleto ?? 'Sin nombre'}
                    </h2>
                    {(() => {
                      const fecha = formatearFechaAsignacion(d.fechaAsignacion);
                      return fecha ? (
                        <p className="text-xs text-sky-50/90 mt-0.5">
                          Asignado el {fecha}
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-gray-700 min-w-0">
                    <Droplets className="w-4 h-4 text-red-600 shrink-0" />
                    <span className="text-xs font-medium">Sangre:</span>
                    <span className="text-xs font-bold text-gray-900 truncate">
                      {etiquetaTipoSangre(d.tipoSangre)}
                    </span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
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
                      className="py-1.5 px-3 rounded-lg text-xs"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> Detalles
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
                        className="py-1.5 px-3 rounded-lg text-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5 mr-1" /> Editar
                      </Boton>
                    )}
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex items-start gap-1.5 text-gray-700">
                    <HeartPulse className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
                    <span className="text-xs font-medium shrink-0">Cond:</span>
                    <TruncadorLinea
                      className="text-xs text-gray-800"
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
                  <div className="flex items-start gap-1.5 text-gray-700">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <span className="text-xs font-medium shrink-0">Alerg:</span>
                    <TruncadorLinea
                      className="text-xs text-gray-800"
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
                    className="w-full mt-2 py-2 rounded-xl text-xs"
                  >
                    <Users className="w-3.5 h-3.5 mr-1" /> Gestionar accesos
                  </Boton>
                )}
              </div>
            </article>
          ))
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
      </main>
    </div>
  );
}
