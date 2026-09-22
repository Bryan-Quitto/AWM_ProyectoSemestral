import { useState, useMemo } from 'react';
import { Plus, Calendar } from 'lucide-react';
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
import { useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint } from '../../api/generated/api/api';
import type { RACPDBackendFeaturesAgendaBloqueTurnoDto } from '../../api/generated/model';
import type { BloqueFormData } from './schema';

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

export const AgendaDesktop = () => {
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [bloqueEditando, setBloqueEditando] = useState<RACPDBackendFeaturesAgendaBloqueTurnoDto | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null);

  const [confirmCancelar, setConfirmCancelar] = useState<{ abierto: boolean; bloqueId: string | null }>({
    abierto: false,
    bloqueId: null,
  });

  const [confirmEliminar, setConfirmEliminar] = useState<{ abierto: boolean; bloqueId: string | null }>({
    abierto: false,
    bloqueId: null,
  });

  const { data: perfilData } = useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint();
  const esPrincipal = perfilData?.data?.rol === 'CuidadorPrincipal';
  const usuarioId = perfilData?.data?.id;

  const { bloques, mutate } = useAgenda({ filtro });
  const { trigger: crearBloque, isMutating: creando } = useCrearBloque();
  const { trigger: editarBloque, isMutating: editando } = useEditarBloque();
  const { trigger: eliminarBloque, isMutating: eliminando } = useEliminarBloque();
  const { trigger: reservar, isMutating: reservando } = useReservarTurno();
  const { trigger: cancelarReserva, isMutating: cancelando } = useCancelarReserva();

  const isMutating = creando || editando || eliminando || reservando || cancelando;

  const mostrarToast = (mensaje: string, tipo: 'exito' | 'error') => {
    setToast({ mensaje, tipo });
    setTimeout(() => setToast(null), 3000);
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

  const handleReservar = async (id: string) => {
    try {
      const respuesta = await reservar(id) as any;
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
      const respuesta = await cancelarReserva(confirmCancelar.bloqueId) as any;
      if (respuesta?.status >= 400) {
        mostrarToast(extraerMensajeError(respuesta, 'Error'), 'error');
        return;
      }
      mutate();
      mostrarToast('Reserva cancelada', 'exito');
    } catch {
      mostrarToast('Error de conexión', 'error');
    } finally {
      setConfirmCancelar({ abierto: false, bloqueId: null });
    }
  };

  const handleCancelar = (id: string) => {
    setConfirmCancelar({ abierto: true, bloqueId: id });
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
                  // Usamos idOcurrencia (determinista por par maestro+fecha)
                  // para que las proyecciones del mismo bloque tengan keys
                  // unicas. Fallback a id para bloques sin recurrencia.
                  key={bloque.idOcurrencia ?? bloque.id}
                  bloque={bloque}
                  esMiBloque={bloque.creadoPor?.id === usuarioId}
                  puedeEditar={esPrincipal}
                  onReservar={handleReservar}
                  onCancelar={handleCancelar}
                  onEditar={setBloqueEditando}
                  onEliminar={handleEliminar}
                  isMutating={isMutating}
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
        onCancelar={() => setConfirmCancelar({ abierto: false, bloqueId: null })}
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

      {toast && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-lg z-50 flex items-center gap-3 ${
          toast.tipo === 'exito' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <span className="font-medium">{toast.mensaje}</span>
        </div>
      )}
    </div>
  );
};
