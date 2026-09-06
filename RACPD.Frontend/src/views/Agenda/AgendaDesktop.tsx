import { useState, useMemo } from 'react';
import { Plus, Calendar } from 'lucide-react';
import { Boton } from '../../components/Boton';
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
    if (!window.confirm('¿Eliminar este bloque?')) return;
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

  const limpiarFiltros = () => {
    setFiltro('Todos');
    setFechaSeleccionada(null);
  };

  const filtros: { id: Filtro; label: string }[] = [
    { id: 'Todos', label: 'Todos' },
    { id: 'Disponibles', label: 'Disponibles' },
    { id: 'MisReservas', label: 'Mis Reservas' },
  ];

  const tieneFiltrosActivos = filtro !== 'Todos' || fechaSeleccionada;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
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

      {/* Barra de filtros compacta */}
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

      {/* Layout: Calendario + Bloques */}
      <div className="flex gap-6">
        {/* Calendario */}
        <div className="w-80 flex-shrink-0">
          <CalendarioAgenda
            bloques={bloques}
            fechaSeleccionada={fechaSeleccionada}
            onSeleccionarFecha={setFechaSeleccionada}
          />
        </div>

        {/* Lista de bloques */}
        <div className="flex-1">
          {bloquesFiltrados.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {filtro === 'Disponibles' 
                  ? 'No hay turnos disponibles' 
                  : filtro === 'MisReservas'
                  ? 'No has reservado ningún turno'
                  : 'No hay turnos programados'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {bloquesFiltrados.map(bloque => (
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
              ))}
            </div>
          )}
        </div>
      </div>

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
        mensaje="¿Estás seguro de que deseas cancelar esta reserva?"
        onConfirmar={handleConfirmarCancelar}
        onCancelar={() => setConfirmCancelar({ abierto: false, bloqueId: null })}
        cargando={cancelando}
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
