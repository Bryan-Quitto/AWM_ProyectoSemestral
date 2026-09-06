import { useState, useMemo } from 'react';
import { Plus, Calendar } from 'lucide-react';
import { TarjetaBloque } from './TarjetaBloque';
import { DialogoBloque } from './DialogoBloque';
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

interface FormData {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  cuposMaximos: number;
  descripcion?: string;
}

type Filtro = 'Todos' | 'Disponibles' | 'MisReservas';

export const AgendaMobile = () => {
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [bloqueEditando, setBloqueEditando] = useState<RACPDBackendFeaturesAgendaBloqueTurnoDto | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  const [mostrarCalendario, setMostrarCalendario] = useState(true);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null);
  
  const [confirmCancelar, setConfirmCancelar] = useState<{ abierto: boolean; bloqueId: string | null }>({
    abierto: false,
    bloqueId: null,
  });

  const { data: perfilData } = useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint();
  const esPrincipal = perfilData?.data?.rol === 'CuidadorPrincipal';
  const usuarioId = perfilData?.data?.id;

  const { bloques, mutate } = useAgenda();
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

  // Filtrar bloques - CORREGIDO
  const bloquesFiltrados = useMemo(() => {
    let resultado = [...bloques];

    if (fechaSeleccionada) {
      resultado = resultado.filter(b => b.fecha === fechaSeleccionada);
    }

    switch (filtro) {
      case 'Disponibles':
        resultado = resultado.filter(b => 
          (b.cuposDisponibles ?? 0) > 0 && 
          !b.yaReservé
        );
        break;
      case 'MisReservas':
        resultado = resultado.filter(b => b.yaReservé);
        break;
    }

    return resultado;
  }, [bloques, filtro, fechaSeleccionada]);

  const handleCrear = async (data: FormData) => {
    setApiError(null);
    try {
      const respuesta = await crearBloque({
        fecha: data.fecha,
        horaInicio: data.horaInicio,
        horaFin: data.horaFin,
        cuposMaximos: data.cuposMaximos,
        descripcion: data.descripcion,
      }) as any;

      if (respuesta?.status >= 400) {
        const errores = respuesta.data?.errors;
        if (errores && typeof errores === 'object') {
          const mensajes = Object.values(errores as Record<string, string[]>).flat();
          setApiError(mensajes[0] || 'Error al crear');
        } else {
          setApiError('Error al crear');
        }
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

  const handleEditar = async (data: FormData) => {
    if (!bloqueEditando?.id) return;
    setApiError(null);
    try {
      const respuesta = await editarBloque({ id: bloqueEditando.id, data: {
        fecha: data.fecha,
        horaInicio: data.horaInicio,
        horaFin: data.horaFin,
        cuposMaximos: data.cuposMaximos,
        descripcion: data.descripcion,
      } }) as any;

      if (respuesta?.status >= 400) {
        setApiError(respuesta.data?.errors?.[0] || 'Error al editar');
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

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar?')) return;
    try {
      const respuesta = await eliminarBloque(id) as any;
      if (respuesta?.status >= 400) {
        mostrarToast(respuesta.data?.errors?.[0] || 'Error', 'error');
        return;
      }
      mutate();
      mostrarToast('Bloque eliminado', 'exito');
    } catch {
      mostrarToast('Error de conexión', 'error');
    }
  };

  const handleReservar = async (id: string) => {
    try {
      const respuesta = await reservar(id) as any;
      if (respuesta?.status >= 400) {
        mostrarToast(respuesta.data?.errors?.[0] || 'Error', 'error');
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
        mostrarToast(respuesta.data?.errors?.[0] || 'Error', 'error');
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

  const filtros: { id: Filtro; label: string }[] = [
    { id: 'Todos', label: 'Todos' },
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
          <button
            onClick={() => setMostrarCalendario(!mostrarCalendario)}
            className={`p-3 rounded-xl cursor-pointer transition-all ${
              mostrarCalendario ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Calendar className="w-5 h-5" />
          </button>
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
              key={bloque.id}
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

      {/* FAB */}
      {esPrincipal && (
        <button
          onClick={() => setDialogoAbierto(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center cursor-pointer active:scale-95"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <DialogoBloque
        abierto={dialogoAbierto}
        onCerrar={() => setDialogoAbierto(false)}
        onSubmit={handleCrear}
        isMutating={creando}
        apiError={apiError}
      />

      <DialogoBloque
        abierto={!!bloqueEditando}
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
        onCancelar={() => setConfirmCancelar({ abierto: false, bloqueId: null })}
        cargando={cancelando}
        tipo="peligro"
      />

      {toast && (
        <div className={`fixed bottom-24 left-4 right-4 p-3 rounded-xl shadow-lg text-center font-medium ${
          toast.tipo === 'exito' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.mensaje}
        </div>
      )}
    </div>
  );
};
