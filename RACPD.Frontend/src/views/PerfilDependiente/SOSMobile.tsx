import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowLeft,
  Phone,
  MessageCircle,
  User,
  Droplets,
  Pill,
  Clock,
} from 'lucide-react';
import {
  useRACPDBackendFeaturesPerfilesDependientesObtenerMiDependienteObtenerMiDependienteEndpoint,
} from '../../api/generated/api/api';
import type { RACPDBackendFeaturesPerfilesDependientesObtenerMiDependienteContactoEmergenciaDto } from '../../api/generated/model';
import { TIPOS_SANGRE } from './schema';

const TIPO_SANGRE_LABELS: Record<(typeof TIPOS_SANGRE)[number], string> = {
  APositivo: 'A+',
  ANegativo: 'A−',
  BPositivo: 'B+',
  BNegativo: 'B−',
  ABPositivo: 'AB+',
  ABNegativo: 'AB−',
  OPositivo: 'O+',
  ONegativo: 'O−',
  Desconocido: 'Desconocido',
};

export function SOSMobile() {
  const navigate = useNavigate();
  const { data: perfilData, isLoading: isCargando, error } =
    useRACPDBackendFeaturesPerfilesDependientesObtenerMiDependienteObtenerMiDependienteEndpoint();

  const perfil = perfilData?.data;

  const tipoSangre = useMemo(() => {
    if (!perfil?.tipoSangre) return 'Desconocido';
    const ts = perfil.tipoSangre as (typeof TIPOS_SANGRE)[number];
    return (TIPOS_SANGRE as readonly string[]).includes(ts)
      ? TIPO_SANGRE_LABELS[ts]
      : 'Desconocido';
  }, [perfil?.tipoSangre]);

  const alergias = perfil?.alergiasEstructuradas ?? [];
  const contactos: RACPDBackendFeaturesPerfilesDependientesObtenerMiDependienteContactoEmergenciaDto[] =
    (perfil?.contactosEmergencia as
      | RACPDBackendFeaturesPerfilesDependientesObtenerMiDependienteContactoEmergenciaDto[]
      | undefined) ?? [];

  if (isCargando) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-8">
        <div className="text-blue-800 font-medium">Cargando ficha SOS...</div>
      </div>
    );
  }

  if (!perfil || error) {
    return (
      <div className="min-h-screen bg-blue-50">
        <header className="bg-red-600 px-4 py-4 flex items-center gap-3 shadow-md">
          <button
            type="button"
            onClick={() => navigate({ to: '/perfil-dependiente' })}
            className="cursor-pointer disabled:cursor-not-allowed p-2 rounded-full text-white hover:bg-red-500 transition disabled:opacity-50"
            aria-label="Volver a la ficha"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-white font-bold text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> SOS Emergencia
          </h1>
        </header>
        <div className="px-4 py-8">
          <div className="bg-white border-2 border-red-300 rounded-2xl p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-600 mx-auto mb-3" />
            <p className="text-red-800 font-semibold mb-2">
              No hay ficha del dependiente registrada.
            </p>
            <p className="text-gray-600 text-sm mb-4">
              Crea la ficha primero para tener acceso a la información crítica en emergencias.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: '/perfil-dependiente' })}
              className="cursor-pointer disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl transition disabled:opacity-50"
            >
              Ir a crear la ficha
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-blue-50 to-blue-100 pb-10">
      {/* Header Emergencia */}
      <header className="bg-red-600 px-4 py-4 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: '/perfil-dependiente' })}
            className="cursor-pointer disabled:cursor-not-allowed p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
            aria-label="Volver a la ficha"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-white/90 text-xs uppercase tracking-wider font-bold">
              Modo Emergencia
            </div>
            <h1 className="text-white font-extrabold text-xl leading-tight truncate flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" /> SOS - {perfil.nombreCompleto}
            </h1>
          </div>
        </div>
      </header>

      <main className="px-4 pt-5 space-y-4 max-w-2xl mx-auto">
        {/* Identificación rápida */}
        <section className="bg-white rounded-2xl shadow-lg border-2 border-red-200 overflow-hidden">
          <div className="bg-gradient-to-r from-sky-600 to-blue-500 px-5 py-3 text-white flex items-center gap-3">
            <User className="w-5 h-5 shrink-0" />
            <h2 className="font-bold">Identificación</h2>
          </div>
          <div className="p-5">
            <div className="text-2xl font-extrabold text-gray-900 break-words leading-tight">
              {perfil.nombreCompleto}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-center">
                <div className="text-xs font-semibold text-red-700 uppercase tracking-wide flex items-center justify-center gap-1.5 mb-1">
                  <Droplets className="w-4 h-4" /> Sangre
                </div>
                <div className="text-2xl font-extrabold text-red-700">
                  {tipoSangre}
                </div>
              </div>
              <div className="bg-sky-50 border-2 border-sky-200 rounded-xl p-3">
                <div className="text-xs font-semibold text-sky-800 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                  <Pill className="w-4 h-4 shrink-0" /> Diagnóstico
                </div>
                <p className="text-xs text-sky-900 leading-snug line-clamp-4 whitespace-pre-wrap break-words">
                  {perfil.condicionesCronicas || (
                    <span className="italic text-sky-500">Sin datos registrados.</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Alergias destacadas */}
        <section className="bg-amber-100 rounded-2xl border-2 border-amber-400 shadow-md">
          <div className="bg-amber-300/80 px-5 py-3 rounded-t-2xl flex items-center gap-3 border-b-2 border-amber-400">
            <AlertTriangle className="w-6 h-6 text-amber-900 shrink-0" />
            <h2 className="font-extrabold text-amber-950 text-lg uppercase tracking-wide">
              ALERGIAS
            </h2>
          </div>
          <div className="p-5">
            {alergias.length === 0 ? (
              <p className="text-amber-900 text-sm font-medium">
                Sin alergias registradas en la ficha.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {alergias.map((a, i) => (
                  <li
                    key={`${a}-${i}`}
                    className="px-3.5 py-1.5 bg-white text-orange-700 border-2 border-orange-400 rounded-full text-sm font-bold shadow-sm"
                  >
                    {a}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Contactos Emergencia - Acciones directas */}
        <section className="bg-white rounded-2xl shadow-lg border-2 border-blue-200 overflow-hidden">
          <div className="bg-green-600 px-5 py-3 text-white flex items-center gap-3">
            <MessageCircle className="w-5 h-5 shrink-0" />
            <h2 className="font-bold">Contactos de Emergencia</h2>
          </div>
          <div className="divide-y divide-blue-100">
            {contactos.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                <p className="font-medium text-gray-700 mb-1">
                  Sin contactos de emergencia configurados.
                </p>
                <p>Edita la ficha del dependiente para añadirlos.</p>
              </div>
            ) : (
              contactos.map((c, i) => {
                const telefonoSoloDigitos = (c.telefonoWhatsApp ?? '').replace(/\D/g, '');
                return (
                  <div key={`${c.telefonoWhatsApp ?? i}-${i}`} className="p-4 sm:p-5">
                    <div className="mb-3">
                      <div className="text-lg font-bold text-gray-900 truncate">
                        {c.nombre ?? 'Contacto'}
                      </div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
                        {c.relacion ?? ''}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <a
                        href={`tel:${c.telefonoWhatsApp ?? ''}`}
                        className="cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold py-3.5 px-5 rounded-xl shadow-sm transition disabled:opacity-50"
                      >
                        <Phone className="w-5 h-5 shrink-0" />
                        📞 Llamar a {c.nombre ?? 'Contacto'}
                      </a>
                      <a
                        href={`https://wa.me/${telefonoSoloDigitos}?text=${encodeURIComponent(
                          `Hola ${
                            c.nombre ?? ''
                          }. Te contactamos desde RACPD por una EMERGENCIA con ${
                            perfil.nombreCompleto ?? 'el dependiente'
                          }. Por favor, contesta inmediatamente.`
                        )}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-bold py-3.5 px-5 rounded-xl shadow-sm transition disabled:opacity-50"
                      >
                        <MessageCircle className="w-5 h-5 shrink-0" />
                        💬 WhatsApp {c.nombre ?? 'Contacto'}
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Footer timestamp */}
        <footer className="pt-2 pb-4 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-blue-800/70 bg-white/60 backdrop-blur px-4 py-2 rounded-full border border-blue-200">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Información cargada desde ficha oficial RACPD · ID #{perfil.id?.slice(0, 8)}
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
