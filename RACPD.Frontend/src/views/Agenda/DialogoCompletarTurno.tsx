import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm, useWatch, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Camera,
  ClipboardList,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  VideoOff,
  X,
} from 'lucide-react';
import { Boton } from '../../components/Boton';
import { TruncadorLinea } from '../../components/TruncadorLinea';
import {
  completarBitacoraSchema,
  ETIQUETAS_ESTADO_ANIMO,
  estadoAnimoBitacoraEnum,
  type CompletarBitacoraFormData,
  type EstadoAnimoBitacora,
} from './bitacoraSchema';
import { useCompletarTurno } from '../../features/agenda/hooks/useCompletarTurno';
import { useRACPDBackendFeaturesEvidenciasSubirSubirEvidenciaEndpoint } from '../../api/generated/api/api';

/**
 * Persona 3 / Semana 2 & Persona 1 / Semana 3 — Modal para cerrar un turno con su Bitacora.
 *
 * Flujo de Evidencia Fotográfica Médica:
 *  - Control táctil <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment">
 *  - Previsualización en memoria local (URL.createObjectURL).
 *  - Al confirmar submit, se sube primero a POST /api/evidencias/subir (máx 20MB, Magic Bytes).
 *  - Se inyecta la URL relativa en el payload de POST /api/agenda/{id}/completar.
 */

interface TareaBloque {
  id: string;
  descripcion: string;
  orden: number;
}

interface DialogoCompletarTurnoProps {
  abierto: boolean;
  bloqueId: string;
  tareas: TareaBloque[];
  /** Nombre del dependiente mostrado en el header (UX, no se envia al backend). */
  nombreDependiente: string;
  onCerrar: () => void;
  onCompletado: (bitacoraId: string) => void;
  fecha?: string | null;
}

export const DialogoCompletarTurno = ({
  abierto,
  bloqueId,
  tareas,
  nombreDependiente,
  onCerrar,
  onCompletado,
  fecha,
}: DialogoCompletarTurnoProps) => {
  const { trigger: completar, isMutating } = useCompletarTurno();
  const { trigger: subirEvidencia, isMutating: isSubiendoEvidencia } =
    useRACPDBackendFeaturesEvidenciasSubirSubirEvidenciaEndpoint();

  const [archivoFoto, setArchivoFoto] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputGaleriaRef = useRef<HTMLInputElement | null>(null);

  const STORAGE_KEY = `borrador_completar_turno_${bloqueId}`;

  const obtenerValoresIniciales = (): CompletarBitacoraFormData => {
    try {
      const guardado = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
      if (guardado) {
        const parsed = JSON.parse(guardado);
        return {
          estadoAnimo: parsed.estadoAnimo ?? 'Neutral',
          sintomas: parsed.sintomas ?? '',
          horasSueno: typeof parsed.horasSueno === 'number' ? parsed.horasSueno : undefined,
          observacionesGenerales: parsed.observacionesGenerales ?? '',
          tareasRealizadasIds: Array.isArray(parsed.tareasRealizadasIds) ? parsed.tareasRealizadasIds : [],
          evidenciaUrl: null,
        };
      }
    } catch {
      // Fallback
    }
    return {
      estadoAnimo: 'Neutral',
      sintomas: '',
      observacionesGenerales: '',
      tareasRealizadasIds: [],
      evidenciaUrl: null,
    };
  };

  const form = useForm<CompletarBitacoraFormData>({
    resolver: zodResolver(completarBitacoraSchema),
    defaultValues: obtenerValoresIniciales(),
    mode: 'onChange',
  });

  const [tareasSeleccionadas, setTareasSeleccionadas] = useState<Set<string>>(() => {
    try {
      const guardado = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
      if (guardado) {
        const parsed = JSON.parse(guardado);
        if (Array.isArray(parsed.tareasRealizadasIds)) {
          return new Set(parsed.tareasRealizadasIds);
        }
      }
    } catch {
      // Ignorar errores de parsing
    }
    return new Set();
  });

  // Persistir cambios en sessionStorage ante cierres o recargas accidentales
  useEffect(() => {
    const guardar = () => {
      try {
        const valores = form.getValues();
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...valores,
            tareasRealizadasIds: Array.from(tareasSeleccionadas),
          }),
        );
      } catch {
        // Ignorar
      }
    };

    window.addEventListener('beforeunload', guardar);
    return () => {
      guardar();
      window.removeEventListener('beforeunload', guardar);
    };
  }, [form, STORAGE_KEY, tareasSeleccionadas]);

  const toggleTarea = (tareaId: string) => {
    setTareasSeleccionadas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(tareaId)) siguiente.delete(tareaId);
      else siguiente.add(tareaId);
      return siguiente;
    });
  };

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCamaraActiva(false);
    setErrorCamara(null);
  };

  const iniciarCamara = async () => {
    setErrorCamara(null);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setErrorCamara('Tu navegador o dispositivo no soporta captura de cámara en vivo.');
        return;
      }

      // Intentar primero cámara trasera con resolución balanceada
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        // Fallback genérico de cámara si environment no está disponible
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      setCamaraActiva(true);

      // Conectar stream al elemento video
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (err: any) {
      const mensaje =
        err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
          ? 'Permiso de cámara denegado. Puedes habilitarlo en los ajustes del navegador o seleccionar una foto de la galería.'
          : 'No se pudo iniciar la cámara del dispositivo.';
      setErrorCamara(mensaje);
      toast.error(mensaje);
    }
  };

  const capturarFotoDesdeVideo = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error('No se pudo generar la imagen de la captura.');
          return;
        }
        const file = new File([blob], `evidencia-${Date.now()}.jpg`, { type: 'image/jpeg' });
        if (previewFoto) {
          URL.revokeObjectURL(previewFoto);
        }
        setArchivoFoto(file);
        setPreviewFoto(URL.createObjectURL(file));
        detenerCamara();
      },
      'image/jpeg',
      0.9,
    );
  };

  const TIPOS_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
  const EXTENSIONES_PERMITIDAS = ['.jpg', '.jpeg', '.png', '.webp'];

  const handleSeleccionarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const nombre = file.name.toLowerCase();
    const tieneExtensionValida = EXTENSIONES_PERMITIDAS.some((ext) => nombre.endsWith(ext));
    const tieneMimeValido = TIPOS_IMAGEN_PERMITIDOS.includes(file.type);

    if (!tieneMimeValido || !tieneExtensionValida) {
      toast.error('Formato no permitido.', {
        description: 'Solo se admiten fotografías e imágenes médicas en formato JPG, PNG o WebP.',
      });
      if (inputGaleriaRef.current) inputGaleriaRef.current.value = '';
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('La imagen excede el tamaño máximo permitido de 20 MB.');
      if (inputGaleriaRef.current) inputGaleriaRef.current.value = '';
      return;
    }

    if (previewFoto) {
      URL.revokeObjectURL(previewFoto);
    }

    setArchivoFoto(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewFoto(objectUrl);
  };

  const descartarFoto = () => {
    if (previewFoto) {
      URL.revokeObjectURL(previewFoto);
    }
    setArchivoFoto(null);
    setPreviewFoto(null);
    detenerCamara();
    if (inputGaleriaRef.current) inputGaleriaRef.current.value = '';
  };

  const limpiarBorrador = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorar
    }
  };

  // Limpieza al desmontar o cerrar
  useEffect(() => {
    return () => {
      detenerCamara();
      if (previewFoto) {
        URL.revokeObjectURL(previewFoto);
      }
    };
  }, [previewFoto]);

  const estadoAnimoSeleccionado = useWatch({ control: form.control, name: 'estadoAnimo' });

  const onSubmit: SubmitHandler<CompletarBitacoraFormData> = async (data) => {
    try {
      let urlEvidenciaSubida: string | null = null;

      // Si el usuario seleccionó una foto, subirla primero
      if (archivoFoto) {
        try {
          const resultadoSubida: any = await subirEvidencia({ archivo: archivoFoto });
          urlEvidenciaSubida = resultadoSubida?.data?.url ?? null;
        } catch (errorSubida: any) {
          const detalle = errorSubida?.response?.data?.detail
            ?? errorSubida?.message
            ?? 'No se pudo subir la fotografía de evidencia.';
          toast.error(detalle, { duration: 6000 });
          return;
        }
      }

      // Normalizar horasSueno
      const horasSuenoNormalizadas =
        typeof data.horasSueno === 'number' && Number.isFinite(data.horasSueno)
          ? data.horasSueno
          : null;

      const respuesta: any = await completar({
        bloqueId,
        estadoAnimo: data.estadoAnimo,
        sintomas: data.sintomas || null,
        horasSueno: horasSuenoNormalizadas,
        observacionesGenerales: data.observacionesGenerales || null,
        tareasRealizadasIds: Array.from(tareasSeleccionadas),
        evidenciaUrl: urlEvidenciaSubida,
        fecha: fecha || null,
      });

      if (respuesta?.status >= 400) {
        const errores = respuesta?.data?.errors as Record<string, string[]> | undefined;
        const primerError = errores ? Object.values(errores).flat()[0] : undefined;
        const detalle = primerError ?? respuesta?.data?.detail ?? 'No se pudo cerrar el turno.';
        toast.error(detalle, { duration: 6000 });
        return;
      }

      toast.success('Turno cerrado correctamente.', {
        description: 'La bitácora y la evidencia fotográfica fueron guardadas exitosamente.',
      });
      limpiarBorrador();
      descartarFoto();
      onCompletado(respuesta?.data?.bitacoraId);
      onCerrar();
    } catch (err: any) {
      const errores = err?.response?.data?.errors as Record<string, string[]> | undefined;
      const primerError = errores ? Object.values(errores).flat()[0] : undefined;
      const detalle = primerError
        ?? err?.response?.data?.detail
        ?? err?.message
        ?? 'Error de conexión. Intente de nuevo.';
      toast.error(detalle, { duration: 6000 });
    }
  };

  const manejarSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    void form.handleSubmit(onSubmit)(e);
  };

  if (!abierto) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialogo-completar-titulo"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <header className="sticky top-0 bg-white border-b border-blue-100 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div>
            <h2
              id="dialogo-completar-titulo"
              className="text-lg font-bold text-blue-900 flex items-center gap-2"
            >
              <ClipboardList size={18} />
              Cerrar turno
            </h2>
            <p className="text-sm text-blue-600 mt-1 truncate">
              {nombreDependiente}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={isMutating}
            className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 p-1.5 rounded-full text-blue-700 hover:bg-blue-50 transition"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <form
          onSubmit={manejarSubmit}
          className="p-5 space-y-5"
          noValidate
        >
          {/* === Checklist de tareas === */}
          {tareas.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-blue-900 mb-2">
                Tareas del turno
              </h3>
              <p className="text-xs text-blue-600 mb-3">
                Marca las tareas que completaste.
              </p>
              <ul className="space-y-2">
                {tareas.map((t) => {
                  const checked = tareasSeleccionadas.has(t.id);
                  return (
                    <li key={t.id}>
                      <label
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition min-w-0
                          ${checked
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-blue-200 hover:border-blue-300 hover:bg-blue-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTarea(t.id)}
                          disabled={isMutating}
                          className="mt-0.5 cursor-pointer disabled:cursor-not-allowed accent-emerald-600 shrink-0"
                        />
                        <TruncadorLinea
                          texto={t.descripcion}
                          maxLineas={2}
                          className={`text-sm ${checked ? 'line-through text-blue-500' : 'text-blue-900'}`}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* === Estado de animo (obligatorio) === */}
          <section>
            <label
              htmlFor="estadoAnimo"
              className="block text-sm font-bold text-blue-900 mb-2"
            >
              Estado de animo del paciente <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {estadoAnimoBitacoraEnum.options.map((valor: EstadoAnimoBitacora) => {
                const seleccionado = estadoAnimoSeleccionado === valor;
                return (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => form.setValue('estadoAnimo', valor, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })}
                    disabled={isMutating}
                    className={`cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 py-2 px-1 rounded-xl border-2 text-xs font-medium transition
                      ${seleccionado
                        ? 'border-sky-500 bg-sky-50 text-sky-900'
                        : 'border-blue-200 text-blue-700 hover:border-blue-300'}`}
                  >
                    {ETIQUETAS_ESTADO_ANIMO[valor]}
                  </button>
                );
              })}
            </div>
            {form.formState.errors.estadoAnimo?.message && (
              <p className="text-xs text-red-500 mt-1.5">
                {form.formState.errors.estadoAnimo.message}
              </p>
            )}
          </section>

          {/* === Sintomas === */}
          <section>
            <label
              htmlFor="sintomas"
              className="block text-sm font-bold text-blue-900 mb-1"
            >
              Sintomas observados (opcional)
            </label>
            <textarea
              id="sintomas"
              rows={2}
              maxLength={1000}
              {...form.register('sintomas')}
              disabled={isMutating}
              placeholder="Ej: tos leve, sin fiebre..."
              className="w-full px-3 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition resize-y disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-[10px] text-blue-500 mt-1">Max 1000 caracteres.</p>
          </section>

          {/* === Horas de sueno === */}
          <section>
            <label
              htmlFor="horasSueno"
              className="block text-sm font-bold text-blue-900 mb-1"
            >
              Horas de sueno (opcional)
            </label>
            <input
              id="horasSueno"
              type="number"
              min={0}
              max={24}
              step={0.5}
              {...form.register('horasSueno', {
                setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number.isNaN(Number(v)) ? undefined : Number(v)),
              })}
              disabled={isMutating}
              placeholder="Ej: 7.5"
              className="w-32 px-3 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {form.formState.errors.horasSueno?.message && (
              <p className="text-xs text-red-500 mt-1">
                {form.formState.errors.horasSueno.message}
              </p>
            )}
          </section>

          {/* === Observaciones generales === */}
          <section>
            <label
              htmlFor="observacionesGenerales"
              className="block text-sm font-bold text-blue-900 mb-1"
            >
              Observaciones generales (opcional)
            </label>
            <textarea
              id="observacionesGenerales"
              rows={3}
              maxLength={2000}
              {...form.register('observacionesGenerales')}
              disabled={isMutating || isSubiendoEvidencia}
              placeholder="Notas para el cuidador principal o el proximo relevo..."
              className="w-full px-3 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition resize-y disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-[10px] text-blue-500 mt-1">Max 2000 caracteres.</p>
          </section>

          {/* === Evidencia Fotográfica Médica === */}
          <section className="bg-sky-50/70 border border-sky-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-blue-950 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-sky-600" />
                  Evidencia fotográfica médica (opcional)
                </p>
                <p className="text-xs text-blue-700">
                  Captura recetas, heridas o estado general del dependiente.
                </p>
              </div>
            </div>

            {/* Input para seleccionar imagen guardada desde la galería o archivos */}
            <input
              type="file"
              ref={inputGaleriaRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleSeleccionarFoto}
              className="hidden"
            />

            {/* Error de permisos o soporte de cámara */}
            {errorCamara && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <VideoOff className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{errorCamara}</span>
              </div>
            )}

            {/* Estado 1: Cámara en vivo integrada en el modal con visor prominente */}
            {camaraActiva && (
              <div className="relative rounded-2xl overflow-hidden border-2 border-sky-400 bg-slate-950 p-2 space-y-2 shadow-inner">
                <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center min-h-[260px] max-h-[360px] sm:max-h-80">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-full min-h-[260px] max-h-[360px] sm:max-h-80 object-cover rounded-xl"
                  />
                  {/* Botón flotante para cerrar / cancelar cámara */}
                  <div className="absolute top-3 right-3 z-10">
                    <button
                      type="button"
                      onClick={detenerCamara}
                      className="cursor-pointer bg-black/60 hover:bg-black/90 text-white p-2 rounded-full transition shadow-lg backdrop-blur-sm"
                      aria-label="Cerrar cámara"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Botón obturador flotante sobre el propio video estilo cámara nativa */}
                  <div className="absolute bottom-4 inset-x-0 flex flex-col items-center justify-center gap-2 z-10">
                    <button
                      type="button"
                      onClick={capturarFotoDesdeVideo}
                      className="cursor-pointer p-1.5 rounded-full bg-white/30 backdrop-blur-md border-2 border-white/80 hover:scale-105 active:scale-95 transition shadow-2xl"
                      aria-label="Tomar fotografía"
                    >
                      <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg">
                        <Camera className="w-7 h-7 text-sky-600" />
                      </div>
                    </button>
                    <span className="text-[11px] font-bold text-white tracking-wide drop-shadow-md bg-black/50 px-2.5 py-0.5 rounded-full">
                      Toca para capturar
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center pt-1">
                  <button
                    type="button"
                    onClick={detenerCamara}
                    className="cursor-pointer py-1.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Estado 2: Botones iniciales (Tomar foto con cámara interna o Galería) */}
            {!camaraActiva && !previewFoto && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={iniciarCamara}
                  disabled={isMutating || isSubiendoEvidencia}
                  className="cursor-pointer disabled:cursor-not-allowed w-full py-3 px-3 border-2 border-dashed border-sky-300 rounded-xl bg-white hover:bg-sky-50 text-sky-800 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-sm"
                >
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600 shrink-0" />
                  <span>Tomar fotografía</span>
                </button>
                <button
                  type="button"
                  onClick={() => inputGaleriaRef.current?.click()}
                  disabled={isMutating || isSubiendoEvidencia}
                  className="cursor-pointer disabled:cursor-not-allowed w-full py-3 px-3 border border-sky-200 rounded-xl bg-white hover:bg-sky-50 text-sky-700 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-sm"
                >
                  <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-sky-500 shrink-0" />
                  <span>Elegir de galería</span>
                </button>
              </div>
            )}

            {/* Estado 3: Fotografía lista / previsualización */}
            {!camaraActiva && previewFoto && (
              <div className="relative rounded-xl overflow-hidden border border-sky-200 bg-white p-2">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-sky-100">
                  <span className="text-xs font-semibold text-sky-900 inline-flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-sky-600" />
                    Fotografía lista ({archivoFoto?.name})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={iniciarCamara}
                      disabled={isMutating || isSubiendoEvidencia}
                      className="cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1 text-xs text-sky-700 hover:text-sky-800 font-medium p-1 hover:bg-sky-50 rounded-lg transition disabled:opacity-50"
                      title="Volver a tomar foto"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retomar</span>
                    </button>
                    <button
                      type="button"
                      onClick={descartarFoto}
                      disabled={isMutating || isSubiendoEvidencia}
                      className="cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold p-1 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  </div>
                </div>
                <div className="max-h-64 overflow-hidden rounded-lg bg-slate-900/5 flex items-center justify-center p-1">
                  <img
                    src={previewFoto}
                    alt="Previsualización de evidencia médica"
                    className="max-h-60 w-auto max-w-full object-contain rounded-md shadow-sm"
                  />
                </div>
              </div>
            )}
          </section>

          <footer className="sticky bottom-0 bg-white pt-2 flex items-center justify-end gap-3">
            <Boton
              type="button"
              variante="secundario"
              onClick={onCerrar}
              disabled={isMutating || isSubiendoEvidencia}
              className="py-2.5 px-5 rounded-xl cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </Boton>
            <Boton
              type="submit"
              disabled={isMutating || isSubiendoEvidencia || !estadoAnimoSeleccionado || Object.keys(form.formState.errors).length > 0}
              className="py-2.5 px-5 rounded-xl cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isMutating || isSubiendoEvidencia ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isSubiendoEvidencia ? 'Subiendo foto...' : 'Guardando...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Cerrar turno
                </>
              )}
            </Boton>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
};