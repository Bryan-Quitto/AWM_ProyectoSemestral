import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, BellRing, Loader2, ShieldAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { useRACPDBackendFeaturesAlertasSosDispararSosEndpoint } from '../../api/generated/api/api';

interface ModalConfirmacionSosProps {
  abierto: boolean;
  onCerrar: () => void;
}

const SEGUNDOS_CUENTA_REGRESIVA = 4;

/**
 * Modal de Confirmación SOS (Persona 3 / Semana 6).
 *
 * Previene falsos positivos con una cuenta regresiva breve de 4 segundos
 * antes de despachar la notificación push ALERTA_SOS_URGENTE a los
 * cuidadores de Apoyo vinculados, permitiendo confirmar de inmediato,
 * cancelar o abrir únicamente la ficha médica local.
 */
export function ModalConfirmacionSos({ abierto, onCerrar }: ModalConfirmacionSosProps) {
  const navigate = useNavigate();
  const [segundosRestantes, setSegundosRestantes] = useState(SEGUNDOS_CUENTA_REGRESIVA);
  const enviadoRef = useRef(false);

  const { trigger: dispararSos, isMutating: enviando } =
    useRACPDBackendFeaturesAlertasSosDispararSosEndpoint();

  const ejecutarEnvioSos = async () => {
    if (enviadoRef.current) return;
    enviadoRef.current = true;

    try {
      const res = await dispararSos({ perfilDependienteId: null });
      if (res.status === 201) {
        const cantidad = res.data.cuidadoresNotificados ?? 0;
        toast.success(
          cantidad > 0
            ? `Alerta SOS enviada a ${cantidad} cuidador${cantidad === 1 ? '' : 'es'} de tu red.`
            : 'Modo emergencia activado. No hay otros cuidadores vinculados con cuenta activa.'
        );
      } else {
        toast.warning('No se pudo confirmar el envío push. Abriendo ficha de emergencia.');
      }
    } catch {
      toast.warning('Sin conexión para enviar alerta push. Abriendo ficha médica y teléfonos.');
    } finally {
      onCerrar();
      void navigate({ to: '/sos' });
    }
  };

  useEffect(() => {
    if (!abierto) {
      setSegundosRestantes(SEGUNDOS_CUENTA_REGRESIVA);
      enviadoRef.current = false;
      return;
    }

    const intervalo = window.setInterval(() => {
      setSegundosRestantes((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalo);
          void ejecutarEnvioSos();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  if (!abierto) return null;

  const abrirSoloFicha = () => {
    enviadoRef.current = true;
    onCerrar();
    void navigate({ to: '/sos' });
  };

  const cancelar = () => {
    enviadoRef.current = true;
    onCerrar();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-sos"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border-2 border-red-200 bg-white shadow-2xl">
        {/* Cabecera de emergencia */}
        <div className="flex items-center justify-between bg-red-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6 shrink-0" aria-hidden="true" />
            <h2 id="titulo-modal-sos" className="text-lg font-extrabold tracking-tight">
              Confirmar Alerta SOS
            </h2>
          </div>
          <button
            type="button"
            onClick={cancelar}
            disabled={enviando}
            aria-label="Cancelar alerta SOS"
            className="rounded-full p-1.5 text-white/90 transition hover:bg-white/20 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 border-2 border-red-200 text-red-700 font-extrabold text-2xl">
            {enviando ? (
              <Loader2 className="h-7 w-7 animate-spin text-red-600" />
            ) : (
              segundosRestantes
            )}
          </div>

          <p className="text-sm font-semibold text-gray-900">
            {enviando
              ? 'Enviando alerta urgente a tu red de apoyo…'
              : `Se enviará una notificación urgente a los cuidadores de Apoyo en ${segundosRestantes}s`}
          </p>
          <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">
            Al confirmar se abrirá la ficha médica crítica y los teléfonos de emergencia.
          </p>

          <div className="mt-5 space-y-2.5">
            <button
              type="button"
              onClick={() => void ejecutarEnvioSos()}
              disabled={enviando}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-red-700 active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando alerta…
                </>
              ) : (
                <>
                  <BellRing className="h-4 w-4" aria-hidden="true" />
                  Enviar Alerta Ahora
                </>
              )}
            </button>

            <button
              type="button"
              onClick={abrirSoloFicha}
              disabled={enviando}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800 transition hover:bg-blue-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Solo ver ficha médica (no enviar push)
            </button>

            <button
              type="button"
              onClick={cancelar}
              disabled={enviando}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
