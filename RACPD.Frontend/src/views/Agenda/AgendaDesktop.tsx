import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { Boton } from '../../components/Boton';
import { TarjetaBloque } from './TarjetaBloque';
import { DialogoCrearBloque } from './DialogoCrearBloque';
import { CalendarioAgenda } from './CalendarioAgenda';
import { ConfirmarAccion } from './ConfirmarAccion';
import {
  useAgenda,
  useCrearBloque,
  useEditarBloque,
  useEliminarBloque,
  useReservarTurno,
  useCancelarReserva,
} from '../../features/agenda/hooks/useAgenda';
import {
  calcularAntelacionMinima,
  MENSAJE_BLOQUEO_72H,
} from '../../features/agenda/lib/calcularAntelacionMinima';
import { useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint } from '../../api/generated/api/api';
import type { RACPDBackendFeaturesAgendaBloqueTurnoDto } from '../../api/generated/model';
import type { BloqueFormData } from './schema';
import type { OcurrenciaRef } from './TarjetaBloque';

/**
 * Duración en ms que la tarjeta permanece "destacada" antes de limpiar el
 * search param. Coincide con 3 ciclos del keyframe `pulse-highlight`
 * (~3.3s) para que la animación se complete de forma natural.
 */
const DURACION_DESTACADO_MS = 3300;

type Filtro = 'Todos' | 'Disponibles' | 'MisReservas' | 'MisBloques';

/**
 * Extrae un mensaje legible desde una respuesta RFC 7807 de FastEndpoints.
 *
 * Orden de preferencia (pensado para el cuidador):
 * 1. Si hay `errors[campo][i]` con mensajes específicos por campo, devolvemos
 *    el primero legible. Esto es lo habitual en ValidationProblemDetails (400).
 * 2. Si NO hay `errors` pero sí `detail` específico (no genérico), lo usamos.
 *    Se descartan `detail` genéricos como "Los datos no cumplen las reglas de
 *    negocio del turno." porque no dicen al cuidador qué campo falló.
 * 3. Fallback.
 */
const DETALLES_GENERICOS_BACKEND = new Set<string>([
  'Los datos no cumplen las reglas de negocio del turno.',
  'Los campos enviados no cumplen el formato esperado.',
]);

const esDetalleGenerico = (detalle: unknown): boolean => {
  if (typeof detalle !== 'string') return false;
  const normalizado = detalle.trim();
  if (normalizado.length === 0) return true;
  return DETALLES_GENERICOS_BACKEND.has(normalizado);
};

const formatearErroresValidacion = (errors: Record<string, string[]>): string | null => {
  const entradas = Object.entries(errors);
  if (entradas.length === 0) return null;
  // Tomamos el primer error de cada campo (suelen ser los más relevantes).
  const mensajes = entradas
    .map(([campo, lista]) => {
      const primero = Array.isArray(lista) && lista.length > 0 ? lista[0] : null;
      return primero ? `${campo}: ${primero}` : null;
    })
    .filter((m): m is string => m !== null);
  if (mensajes.length === 0) return null;
  if (mensajes.length === 1) return mensajes[0];
  // Mostrar hasta 3 errores en línea para no saturar al cuidador.
  const visibles = mensajes.slice(0, 3).join(' • ');
  return mensajes.length > 3 ? `${visibles} • (+${mensajes.length - 3} más)` : visibles;
};

const extraerMensajeError = (respuesta: any, fallback: string): string => {
  const data = respuesta?.data;

  // 1) Errores específicos por campo.
  if (data?.errors && typeof data.errors === 'object') {
    const formateado = formatearErroresValidacion(data.errors as Record<string, string[]>);
    if (formateado) return formateado;
  }

  // 2) Detail útil (no genérico).
  if (data?.detail && !esDetalleGenerico(data.detail)) {
    return String(data.detail);
  }

  // 3) Si tenemos title sin ser genérico, también sirve.
  if (data?.title && !esDetalleGenerico(data.title)) {
    return String(data.title);
  }

  return fallback;
};

export const AgendaDesktop = ({
  bloqueIdDestacado,
  fechaDestacada,
}: {
  bloqueIdDestacado?: string;
  fechaDestacada?: string;
} = {}) => {
  const navigate = useNavigate();
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [bloqueEditando, setBloqueEditando] = useState<RACPDBackendFeaturesAgendaBloqueTurnoDto | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  // Toast local legado del proyecto. Convive con el `toast` de sonner
  // (importado arriba): aquí se renderiza el cuadro verde/rojo de la UI
  // y para evitar colisión de nombres se llama `toastLocal`.
  const [toastLocal, setToastLocal] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(
    () => fechaDestacada ?? null,
  );

  const [confirmCancelar, setConfirmCancelar] = useState<{
    abierto: boolean;
    bloqueId: string | null;
    fechaOc: string | undefined;
  }>({
    abierto: false,
    bloqueId: null,
    fechaOc: undefined,
  });

  const [confirmEliminar, setConfirmEliminar] = useState<{ abierto: boolean; bloqueId: string | null }>({
    abierto: false,
    bloqueId: null,
  });

  // Lifting State Up (antes lo tenia CalendarioAgenda):
  // El padre controla el mes visible y lo envia al hijo para que se
  // re-renderice, y a su vez lo usa para acotar el rango del fetch.
  // Si llegamos con `fechaDestacada` (deep-link desde el Dashboard),
  // inicializamos `mesActual` directamente en el mes de ese turno.
  const [mesActual, setMesActual] = useState<Date>(() => {
    if (fechaDestacada) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaDestacada);
      if (match) {
        const [, y, m] = match;
        return new Date(Number(y), Number(m) - 1, 1);
      }
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  // Sincroniza fechaSeleccionada y mesActual cuando llega un nuevo deep-link
  // (por ejemplo si el usuario ya estaba en la agenda y navega a otra fecha)
  useEffect(() => {
    if (fechaDestacada) {
      setFechaSeleccionada(fechaDestacada);
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaDestacada);
      if (match) {
        const [, y, m] = match;
        const targetMes = new Date(Number(y), Number(m) - 1, 1);
        setMesActual((prev) => {
          if (
            prev.getFullYear() !== targetMes.getFullYear() ||
            prev.getMonth() !== targetMes.getMonth()
          ) {
            return targetMes;
          }
          return prev;
        });
      }
    }
  }, [fechaDestacada]);

  // Helpers locales: forman YYYY-MM-DD respetando el huso horario del
  // navegador (Regla de Negocio: America/Guayaquil = UTC-5). Usamos el
  // constructor `new Date(y, m, d)` en lugar de `toISOString()` para
  // EVITAR el off-by-one tipico de UTC (ej. 31-ago 23:00 local ->
  // 01-sep en Z). `padStart(2, '0')` cubre los ceros a la izquierda.
  const formatearFecha = (fecha: Date): string => {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const { fechaDesde, fechaHasta } = useMemo(() => {
    const year = mesActual.getFullYear();
    const month = mesActual.getMonth();
    // Dia 1 del mes actual.
    const desde = new Date(year, month, 1);
    // Dia 0 del mes SIGUIENTE = ultimo dia del mes actual (truco JS).
    const hasta = new Date(year, month + 1, 0);
    return {
      fechaDesde: formatearFecha(desde),
      fechaHasta: formatearFecha(hasta),
    };
  }, [mesActual]);

  const { data: perfilData } = useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint();
  // Narrowing para que TS strict no proteste: el hook puede devolver
  // Success (data con MiPerfilResponse) o Error (data: void). Solo
  // accedemos a `rol`/`id` si la respuesta es satisfactoria.
  const perfilExitoso =
    perfilData?.status === 200 && perfilData.data
      ? (perfilData.data as { id?: string; rol?: string })
      : null;
  const esPrincipal = perfilExitoso?.rol === 'CuidadorPrincipal';
  const usuarioId = perfilExitoso?.id;

  // Antes: `useAgenda({ filtro })` → el backend solo devolvia el mes
  // natural en curso y al navegar a octubre el padre no se enteraba.
  // Ahora pasamos el rango del mes que el hijo esta mostrando, lo que
  // dispara refetch automatico via SWR al cambiar `mesActual`.
  const { bloques, isLoading, mutate } = useAgenda({ filtro, fechaDesde, fechaHasta });
  const { trigger: crearBloque, isMutating: creando } = useCrearBloque();
  const { trigger: editarBloque, isMutating: editando } = useEditarBloque();
  const { trigger: eliminarBloque, isMutating: eliminando } = useEliminarBloque();
  const { trigger: reservar, isMutating: reservando } = useReservarTurno();
  const { trigger: cancelarReserva, isMutating: cancelando } = useCancelarReserva();

  const isMutating = creando || editando || eliminando || reservando || cancelando;

  // === Deep-link desde el Dashboard ===
  // Cuando llegamos con `?bloqueIdDestacado=<id>`:
  //   1. Si `fechaDestacada` viene informada, nos aseguramos de que `mesActual`
  //      haya sincronizado con dicho mes y SWR haya terminado de cargar (`!isLoading`).
  //   2. Si el bloque está en los datos → resaltamos y hacemos scroll.
  //   3. Si NO existe (otro cuidador lo tomó/eliminó) tras terminar la carga
  //      del mes correcto → emitimos el toast informativo.
  //   4. Tras ~3s limpiamos el search param para que F5 no vuelva a animar.
  const deepLinkProcesadoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!bloqueIdDestacado) return;
    if (deepLinkProcesadoRef.current === bloqueIdDestacado) return;
    if (isLoading) return; // esperar a que SWR finalice la petición del mes actual

    // Si viene fechaDestacada, asegurar que mesActual ya coincide con el mes de la fecha
    if (fechaDestacada) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaDestacada);
      if (match) {
        const [, y, m] = match;
        const anioT = Number(y);
        const mesT = Number(m) - 1;
        if (mesActual.getFullYear() !== anioT || mesActual.getMonth() !== mesT) {
          // El estado mesActual aún está en transición; esperamos al siguiente ciclo
          return;
        }
      }
    }

    const bloque = bloques.find((b) => b.id === bloqueIdDestacado);
    if (!bloque) {
      // Bloque fantasma (otro cuidador lo tomó/cubrió/eliminó mientras
      // el nuestro estaba en el Dashboard). Toast + aterrizar sin highlight.
      deepLinkProcesadoRef.current = bloqueIdDestacado;
      toast.info('Este turno ya no está disponible o fue cubierto por otra persona.', {
        duration: 5000,
      });
      navigate({
        to: '/agenda',
        search: {},
        replace: true,
      });
      return;
    }

    deepLinkProcesadoRef.current = bloqueIdDestacado;

    // Si el bloque cae en otro mes distinto al que muestra el calendario
    // (fallback por si no vino fechaDestacada en URL), saltamos a su mes.
    if (bloque.fecha) {
      const [year, month] = bloque.fecha.split('-').map(Number);
      if (Number.isFinite(year) && Number.isFinite(month)) {
        const mesDelBloque = new Date(year, month - 1, 1);
        if (
          mesDelBloque.getFullYear() !== mesActual.getFullYear() ||
          mesDelBloque.getMonth() !== mesActual.getMonth()
        ) {
          setMesActual(mesDelBloque);
          setFechaSeleccionada(bloque.fecha);
        }
      }
    }

    // Limpiamos el search param tras la animación completa.
    const timer = window.setTimeout(() => {
      navigate({ to: '/agenda', search: {}, replace: true });
    }, DURACION_DESTACADO_MS);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloqueIdDestacado, fechaDestacada, bloques, isLoading, mesActual]);

  const mostrarToast = (mensaje: string, tipo: 'exito' | 'error') => {
    setToastLocal({ mensaje, tipo });
    setTimeout(() => setToastLocal(null), 3000);
  };

  const bloquesFiltrados = useMemo(() => {
    // El backend ya entrega el resultado del filtro seleccionado
    // (Todos / MisBloques / Disponibles / MisReservas) gracias al hook
    // useAgenda({ filtro }). Aqui solo aplicamos el sub-filtro de UI:
    // la fecha seleccionada en el calendario.
    let resultado = [...bloques];

    if (fechaSeleccionada) {
      resultado = resultado.filter(b => b.fecha === fechaSeleccionada);
    }

    return resultado;
  }, [bloques, fechaSeleccionada]);

  const handleCrear = async (data: BloqueFormData) => {
    setApiError(null);
    try {
      const respuesta = await crearBloque({
        fecha: data.fecha,
        horaInicio: data.horaInicio,
        horaFin: data.horaFin,
        cuposMaximos: data.cuposMaximos,
        descripcion: data.descripcion ?? null,
        perfilDependienteId: data.perfilDependienteId,
        tipoRecurrencia: data.tipoRecurrencia,
        intervaloSemanas: data.intervaloSemanas ?? null,
        tareas: (data.tareas ?? []).map((t) => ({
          id: t.id,
          descripcion: t.descripcion,
          orden: t.orden,
        })),
      }) as any;

      if (respuesta?.status >= 400) {
        setApiError(extraerMensajeError(respuesta, 'Error al crear'));
        return;
      }

      setDialogoAbierto(false);
      setFechaSeleccionada(data.fecha);
      mutate();
      mostrarToast('Bloque creado', 'exito');
    } catch {
      setApiError('Error de conexión');
    }
  };

  const handleEditar = async (data: BloqueFormData) => {
    if (!bloqueEditando?.id) return;
    setApiError(null);
    try {
      const respuesta = await editarBloque({
        id: bloqueEditando.id,
        fecha: data.fecha,
        horaInicio: data.horaInicio,
        horaFin: data.horaFin,
        cuposMaximos: data.cuposMaximos,
        descripcion: data.descripcion ?? null,
        perfilDependienteId: data.perfilDependienteId,
        tipoRecurrencia: data.tipoRecurrencia,
        intervaloSemanas: data.intervaloSemanas ?? null,
        tareas: (data.tareas ?? []).map((t) => ({
          id: t.id,
          descripcion: t.descripcion,
          orden: t.orden,
        })),
      });

      if (respuesta?.status >= 400) {
        setApiError(extraerMensajeError(respuesta, 'Error al editar'));
        return;
      }

      setBloqueEditando(null);
      setFechaSeleccionada(data.fecha);
      mutate();
      mostrarToast('Bloque actualizado', 'exito');
    } catch {
      setApiError('Error de conexión');
    }
  };

  const handleEliminar = (id: string) => {
    setConfirmEliminar({ abierto: true, bloqueId: id });
  };

  const handleConfirmarEliminar = async () => {
    if (!confirmEliminar.bloqueId) return;
    try {
      const respuesta = await eliminarBloque(confirmEliminar.bloqueId) as any;
      if (respuesta?.status >= 400) {
        mostrarToast(extraerMensajeError(respuesta, 'Error'), 'error');
        return;
      }
      mutate();
      mostrarToast('Bloque eliminado', 'exito');
    } catch {
      mostrarToast('Error de conexión', 'error');
    } finally {
      setConfirmEliminar({ abierto: false, bloqueId: null });
    }
  };

  const handleReservar = async (ocurrencia: OcurrenciaRef | string) => {
    try {
      const respuesta = await reservar(
        typeof ocurrencia === 'string' ? { id: ocurrencia } : ocurrencia
      ) as any;
      if (respuesta?.status >= 400) {
        mostrarToast(extraerMensajeError(respuesta, 'Error'), 'error');
        return;
      }
      mutate();
      mostrarToast('¡Turno reservado!', 'exito');
    } catch {
      mostrarToast('Error de conexión', 'error');
    }
  };

  const handleConfirmarCancelar = async () => {
    if (!confirmCancelar.bloqueId) return;

    try {
      const respuesta = await cancelarReserva({
        id: confirmCancelar.bloqueId,
        fecha: confirmCancelar.fechaOc,
      }) as any;
      if (respuesta?.status >= 400) {
        mostrarToast(extraerMensajeError(respuesta, 'Error'), 'error');
        return;
      }
      mutate();
      mostrarToast('Reserva cancelada', 'exito');
    } catch {
      mostrarToast('Error de conexión', 'error');
    } finally {
      setConfirmCancelar({ abierto: false, bloqueId: null, fechaOc: undefined });
    }
  };

  const handleCancelar = (ocurrencia: OcurrenciaRef | string) => {
    // Aceptar string retro-compatible u objeto { id, fecha }.
    const id = typeof ocurrencia === 'string' ? ocurrencia : ocurrencia.id;
    const fechaOc = typeof ocurrencia === 'string' ? undefined : ocurrencia.fecha;

    // Defensa redundante del guard 72h (Persona 2 / Semana 2).
    // TarjetaBloque ya bloquea el botón visualmente, pero si por re-render
    // o uso programático llegara aquí un id bloqueado, abortamos ANTES de
    // abrir el modal. El backend sigue siendo la verdad y responderá 400.
    const bloque = bloques.find((b) => b.id === id);
    if (bloque && calcularAntelacionMinima(bloque.fecha, bloque.horaInicio)) {
      toast.error(MENSAJE_BLOQUEO_72H, { duration: 6000 });
      return;
    }
    setConfirmCancelar({ abierto: true, bloqueId: id, fechaOc });
  };

  const limpiarFiltros = () => {
    setFiltro('Todos');
    setFechaSeleccionada(null);
  };

  const filtros: { id: Filtro; label: string }[] = [
    { id: 'Todos', label: 'Todos' },
    { id: 'MisBloques', label: 'Mis Bloques' },
    { id: 'Disponibles', label: 'Disponibles' },
    { id: 'MisReservas', label: 'Mis Reservas' },
  ];

  const tieneFiltrosActivos = filtro !== 'Todos' || fechaSeleccionada;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-gray-900">Agenda de Turnos</h1>

        {esPrincipal && (
          <Boton
            onClick={() => setDialogoAbierto(true)}
            className="cursor-pointer gap-2 !rounded-xl !py-3 !px-5"
          >
            <Plus className="w-4 h-4" />
            Nuevo Turno
          </Boton>
        )}
      </div>

      <div className="flex items-center gap-3 mb-6 p-3 bg-white rounded-xl border border-gray-100">
        {filtros.map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              filtro === f.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}

        <div className="h-6 w-px bg-gray-200 mx-1" />

        <span className="text-sm text-gray-500">
          {bloquesFiltrados.length} turno{bloquesFiltrados.length !== 1 ? 's' : ''}
        </span>

        {tieneFiltrosActivos && (
          <button
            onClick={limpiarFiltros}
            className="text-sm text-blue-600 hover:underline cursor-pointer ml-auto"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="flex gap-6">
        <div className="w-80 flex-shrink-0">
          <CalendarioAgenda
            bloques={bloques}
            fechaSeleccionada={fechaSeleccionada}
            onSeleccionarFecha={setFechaSeleccionada}
            // Lifting State Up: el calendario ahora es controlado.
            mesActual={mesActual}
            onCambiarMes={setMesActual}
          />
        </div>

        <div className="flex-1">
          {bloquesFiltrados.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {filtro === 'Disponibles'
                  ? 'No hay turnos disponibles'
                  : filtro === 'MisReservas'
                  ? 'No has reservado ningún turno'
                  : filtro === 'MisBloques'
                  ? 'No tienes bloques creados en este rango'
                  : 'No hay turnos programados'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {bloquesFiltrados.map(bloque => (
                <TarjetaBloque
                  // Key compuesta: el backend emite el mismo `bloque.id` (Guid
                  // maestro) para todas las ocurrencias recurrentes de un
                  // mismo bloque. Sin esta síntesis React lanzaba el warning
                  // "Encountered two children with the same key". Coincide
                  // con el algoritmo servidor en
                  // `OcurrenciaIdHelper.CalcularIdOcurrencia(b.Id, fechaOc)`.
                  key={bloque.fecha ? `${bloque.id}-${bloque.fecha}` : bloque.id}
                  bloque={bloque}
                  esMiBloque={bloque.creadoPor?.id === usuarioId}
                  puedeEditar={esPrincipal}
                  onReservar={handleReservar}
                  onCancelar={handleCancelar}
                  onEditar={setBloqueEditando}
                  onEliminar={handleEliminar}
                  // Tras cerrar un turno, invalidamos SWR para que el resto
                  // de la lista (filtros, contadores, recargas) se mantenga
                  // consistente con el backend.
                  onBloqueCerrado={() => mutate()}
                  isMutating={isMutating}
                  // Deep-link desde el Dashboard: solo el bloque cuyo id
                  // coincide con `bloqueIdDestacado` recibe el highlight.
                  destacado={bloque.id === bloqueIdDestacado}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <DialogoCrearBloque
        abierto={dialogoAbierto}
        modo="crear"
        onCerrar={() => setDialogoAbierto(false)}
        onSubmit={handleCrear}
        isMutating={creando}
        apiError={apiError}
      />

      <DialogoCrearBloque
        abierto={!!bloqueEditando}
        modo="editar"
        bloque={bloqueEditando}
        onCerrar={() => setBloqueEditando(null)}
        onSubmit={handleEditar}
        isMutating={editando}
        apiError={apiError}
      />

      <ConfirmarAccion
        abierto={confirmCancelar.abierto}
        titulo="Cancelar Reserva"
        mensaje="¿Estás seguro de que deseas cancelar esta reserva?"
        onConfirmar={handleConfirmarCancelar}
        onCancelar={() => setConfirmCancelar({ abierto: false, bloqueId: null, fechaOc: undefined })}
        cargando={cancelando}
        tipo="peligro"
      />

      <ConfirmarAccion
        abierto={confirmEliminar.abierto}
        titulo="Eliminar bloque de turno"
        mensaje="¿Estás seguro de que deseas eliminar este bloque? Esta acción no se puede deshacer."
        onConfirmar={handleConfirmarEliminar}
        onCancelar={() => setConfirmEliminar({ abierto: false, bloqueId: null })}
        cargando={eliminando}
        tipo="peligro"
      />

      {toastLocal && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-lg z-50 flex items-center gap-3 ${
          toastLocal.tipo === 'exito' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <span className="font-medium">{toastLocal.mensaje}</span>
        </div>
      )}
    </div>
  );
};
