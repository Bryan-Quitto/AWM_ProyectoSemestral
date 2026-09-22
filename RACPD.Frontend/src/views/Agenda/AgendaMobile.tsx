import { useState, useMemo } from 'react';
import { Plus, Calendar } from 'lucide-react';
import { toast } from 'sonner';
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

type Filtro = 'Todos' | 'Disponibles' | 'MisReservas' | 'MisBloques';

/**
 * Extrae un mensaje legible desde una respuesta RFC 7807 de FastEndpoints.
 *
 * Orden de preferencia (pensado para el cuidador):
 * 1. `errors[campo][i]` con mensajes específicos por campo.
 * 2. `detail` específico (no genérico). Se descartan `detail` genéricos como
 *    "Los datos no cumplen las reglas de negocio del turno." porque no dicen
 *    al cuidador qué campo falló.
 * 3. `title` no genérico.
 * 4. Fallback.
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
  const mensajes = entradas
    .map(([campo, lista]) => {
      const primero = Array.isArray(lista) && lista.length > 0 ? lista[0] : null;
      return primero ? `${campo}: ${primero}` : null;
    })
    .filter((m): m is string => m !== null);
  if (mensajes.length === 0) return null;
  if (mensajes.length === 1) return mensajes[0];
  const visibles = mensajes.slice(0, 3).join(' • ');
  return mensajes.length > 3 ? `${visibles} • (+${mensajes.length - 3} más)` : visibles;
};

const extraerMensajeError = (respuesta: any, fallback: string): string => {
  const data = respuesta?.data;

  if (data?.errors && typeof data.errors === 'object') {
    const formateado = formatearErroresValidacion(data.errors as Record<string, string[]>);
    if (formateado) return formateado;
  }

  if (data?.detail && !esDetalleGenerico(data.detail)) {
    return String(data.detail);
  }

  if (data?.title && !esDetalleGenerico(data.title)) {
    return String(data.title);
  }

  return fallback;
};

export const AgendaMobile = () => {
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [bloqueEditando, setBloqueEditando] = useState<RACPDBackendFeaturesAgendaBloqueTurnoDto | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  // Toast local legado del proyecto. Convive con el `toast` de sonner
  // (importado arriba): aquí se renderiza el cuadro verde/rojo de la UI
  // y para evitar colisión de nombres se llama `toastLocal`.
  const [toastLocal, setToastLocal] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  const [mostrarCalendario, setMostrarCalendario] = useState(true);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null);
  
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

  const { data: perfilData } = useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint();
  // El hook puede devolver Success (data con MiPerfilResponse) o Error
  // (data: void). Narrowing: solo accedemos a `rol`/`id` si la respuesta
  // es satisfactoria (status === 200) y `data` no es void.
  const perfilExitoso =
    perfilData?.status === 200 && perfilData.data
      ? (perfilData.data as { id?: string; rol?: string })
      : null;
  const esPrincipal = perfilExitoso?.rol === 'CuidadorPrincipal';
  const usuarioId = perfilExitoso?.id;

  const { bloques, mutate } = useAgenda({ filtro });
  const { trigger: crearBloque, isMutating: creando } = useCrearBloque();
  const { trigger: editarBloque, isMutating: editando } = useEditarBloque();
  const { trigger: eliminarBloque, isMutating: eliminando } = useEliminarBloque();
  const { trigger: reservar, isMutating: reservando } = useReservarTurno();
  const { trigger: cancelarReserva, isMutating: cancelando } = useCancelarReserva();

  const isMutating = creando || editando || eliminando || reservando || cancelando;

  const mostrarToast = (mensaje: string, tipo: 'exito' | 'error') => {
    setToastLocal({ mensaje, tipo });
    setTimeout(() => setToastLocal(null), 3000);
  };

  // Filtrar bloques - CORREGIDO
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
    const id = typeof ocurrencia === 'string' ? ocurrencia : ocurrencia.id;
    const fechaOc = typeof ocurrencia === 'string' ? undefined : ocurrencia.fecha;

    // Defensa redundante del guard 72h (Persona 2 / Semana 2).
    // Ver notas en AgendaDesktop.tsx — el backend sigue siendo la verdad.
    const bloque = bloques.find((b) => b.id === id);
    if (bloque && calcularAntelacionMinima(bloque.fecha, bloque.horaInicio)) {
      toast.error(MENSAJE_BLOQUEO_72H, { duration: 6000 });
      return;
    }
    setConfirmCancelar({ abierto: true, bloqueId: id, fechaOc });
  };

  const filtros: { id: Filtro; label: string }[] = [
    { id: 'Todos', label: 'Todos' },
    { id: 'MisBloques', label: 'Míos' },
    { id: 'Disponibles', label: 'Disp.' },
    { id: 'MisReservas', label: 'Mis Res.' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Agenda</h1>
            <p className="text-sm text-gray-500">{bloquesFiltrados.length} turno{bloquesFiltrados.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {esPrincipal && (
              <Boton
                onClick={() => setDialogoAbierto(true)}
                aria-label="Nuevo turno"
                className="!w-11 !h-11 !p-0 !rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </Boton>
            )}
            <button
              onClick={() => setMostrarCalendario(!mostrarCalendario)}
              className={`p-3 rounded-xl cursor-pointer transition-all ${
                mostrarCalendario ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
              aria-label="Mostrar u ocultar calendario"
            >
              <Calendar className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filtros compactos */}
        <div className="flex gap-2 mt-3">
          {filtros.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                filtro === f.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
          {(filtro !== 'Todos' || fechaSeleccionada) && (
            <button
              onClick={() => { setFiltro('Todos'); setFechaSeleccionada(null); }}
              className="px-3 py-1.5 text-xs text-blue-600 cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Calendario */}
      {mostrarCalendario && (
        <div className="p-4">
          <CalendarioAgenda
            bloques={bloques}
            fechaSeleccionada={fechaSeleccionada}
            onSeleccionarFecha={setFechaSeleccionada}
          />
        </div>
      )}

      {/* Lista */}
      <div className="p-4 space-y-3 pb-24">
        {bloquesFiltrados.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {filtro === 'Disponibles' 
                ? 'No hay disponibles' 
                : filtro === 'MisReservas'
                ? 'Sin reservas'
                : 'Sin turnos'
              }
            </p>
          </div>
        ) : (
          bloquesFiltrados.map(bloque => (
            <TarjetaBloque
              // Key compuesta: el backend emite el mismo `bloque.id` (Guid
              // maestro) para todas las ocurrencias recurrentes de un mismo
              // bloque, lo que provocaba el warning de React "Encountered two
              // children with the same key" al renderizar dos o más tarjetas
              // del mismo maestro.
              //
              // Sintesis minima en cliente: par {maestroId, fechaOc} que
              // coincide con `OcurrenciaIdHelper.CalcularIdOcurrencia` en el
              // servidor (`ListarBloquesEndpoint.cs`).
              //
              // Pendiente: regenerar Orval para que el DTO incluya
              // `idBloqueMaestro` / `idOcurrencia`. Cuando exista, migrar a
              // `bloque.idOcurrencia`.
              key={bloque.fecha ? `${bloque.id}-${bloque.fecha}` : bloque.id}
              bloque={bloque}
              esMiBloque={bloque.creadoPor?.id === usuarioId}
              puedeEditar={esPrincipal}
              onReservar={handleReservar}
              onCancelar={handleCancelar}
              onEditar={setBloqueEditando}
              onEliminar={handleEliminar}
              isMutating={isMutating}
            />
          ))
        )}
      </div>

      {/* FAB (Floating Action Button) para crear un nuevo turno.
          Ahora vive en el header junto al toggle de calendario,
          siguiendo tu indicación. Mejor accesibilidad en móvil para
          cuidadores con una mano ocupada. */}

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
        mensaje="¿Cancelar esta reserva?"
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
        <div className={`fixed bottom-24 left-4 right-4 p-3 rounded-xl shadow-lg text-center font-medium ${
          toastLocal.tipo === 'exito' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toastLocal.mensaje}
        </div>
      )}
    </div>
  );
};
