import { Calendar, Clock, Users, Trash2, Edit2, User, ListChecks, Repeat } from 'lucide-react';
import { Boton } from '../../components/Boton';
import type { RACPDBackendFeaturesAgendaBloqueTurnoDto } from '../../api/generated/model';

interface TarjetaBloqueProps {
  bloque: RACPDBackendFeaturesAgendaBloqueTurnoDto;
  esMiBloque: boolean;
  puedeEditar: boolean;
  onReservar?: (id: string) => void;
  onCancelar?: (id: string) => void;
  onEditar?: (bloque: RACPDBackendFeaturesAgendaBloqueTurnoDto) => void;
  onEliminar?: (id: string) => void;
  isMutating?: boolean;
}

const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const formatearFecha = (fecha?: string) => {
  if (!fecha) return '';
  const [year, month, day] = fecha.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const diaSemana = diasSemana[date.getDay()];
  return `${diaSemana}, ${day} ${meses[month - 1]}`;
};

export const TarjetaBloque = ({
  bloque,
  esMiBloque,
  puedeEditar,
  onReservar,
  onCancelar,
  onEditar,
  onEliminar,
  isMutating,
}: TarjetaBloqueProps) => {
  const esCompleto = (bloque.cuposDisponibles ?? 0) === 0;
  const estaVencido = bloque.fecha ? new Date(bloque.fecha) < new Date(new Date().toISOString().split('T')[0]) : false;

  const getBorderColor = () => {
    if (bloque.yaReservé) return 'border-blue-500';
    if (esMiBloque) return 'border-green-500';
    if (esCompleto) return 'border-gray-300';
    if (estaVencido) return 'border-gray-300';
    return 'border-blue-200 hover:border-blue-400';
  };

  const getBgColor = () => {
    if (bloque.yaReservé) return 'bg-blue-50';
    if (esMiBloque) return 'bg-green-50';
    if (esCompleto) return 'bg-gray-50';
    if (estaVencido) return 'bg-gray-50';
    return 'bg-white';
  };

  const tareas = bloque.tareas ?? [];
  const cantidadTareas = tareas.length;

  return (
    <div
      className={`
        rounded-xl border-2 p-4 transition-all duration-200
        ${getBorderColor()} ${getBgColor()}
        ${bloque.puedoReservar ? 'cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99]' : ''}
        ${bloque.yaReservé || esMiBloque ? 'cursor-default' : ''}
        ${!bloque.puedoReservar && !bloque.yaReservé && !esMiBloque ? 'opacity-75' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div className="p-2 bg-blue-100 rounded-lg shrink-0">
            <Calendar className="w-5 h-5 text-blue-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-blue-900">{formatearFecha(bloque.fecha)}</p>
            <p className="text-sm text-blue-600 truncate">
              {bloque.creadoPor?.nombreCompleto ?? ''}
            </p>

            {/* === NUEVO (Persona 1 / Semana 1) === */}
            {bloque.nombreDependiente && (
              <div className="flex items-center gap-1 mt-1 text-xs text-blue-700">
                <User className="w-3 h-3 shrink-0" />
                <span className="truncate">{bloque.nombreDependiente}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {/* Badge recurrencia */}
              {bloque.tipoRecurrencia && bloque.tipoRecurrencia !== 'Unica' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-medium">
                  <Repeat className="w-3 h-3" />
                  {bloque.tipoRecurrencia === 'Indefinida'
                    ? 'Indefinido'
                    : bloque.tipoRecurrencia === 'Semanas' && bloque.intervaloSemanas
                      ? `Cada ${bloque.intervaloSemanas} sem.`
                      : bloque.tipoRecurrencia}
                </span>
              )}

              {/* Badge tareas */}
              {cantidadTareas > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 text-[10px] font-medium">
                  <ListChecks className="w-3 h-3" />
                  {cantidadTareas} tarea{cantidadTareas === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={`shrink-0 ml-2 px-2 py-1 rounded-full text-xs font-medium ${
          bloque.yaReservé
            ? 'bg-blue-200 text-blue-800'
            : esMiBloque
              ? 'bg-green-200 text-green-800'
              : esCompleto
                ? 'bg-gray-200 text-gray-600'
                : 'bg-blue-100 text-blue-700'
        }`}>
          {bloque.yaReservé ? 'Reservado' : esMiBloque ? 'Mi bloque' : esCompleto ? 'Completo' : 'Disponible'}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-blue-500" />
        <span className="text-gray-700 font-medium">
          {bloque.horaInicio?.slice(0, 5) ?? ''} — {bloque.horaFin?.slice(0, 5) ?? ''}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-blue-500" />
        <span className="text-gray-600 text-sm">
          {(bloque.cuposMaximos ?? 0) - (bloque.cuposDisponibles ?? 0)}/{bloque.cuposMaximos ?? 0} cupos ocupados
        </span>
        <div className="flex gap-1 ml-2">
          {Array.from({ length: bloque.cuposMaximos ?? 0 }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < ((bloque.cuposMaximos ?? 0) - (bloque.cuposDisponibles ?? 0))
                  ? 'bg-blue-500'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>

      {bloque.descripcion && (
        <p className="text-sm text-gray-600 mb-3 italic">{bloque.descripcion}</p>
      )}

      {/* Lista resumida de tareas (NUEVO) */}
      {cantidadTareas > 0 && (
        <details className="mb-3 text-xs text-gray-600">
          <summary className="cursor-pointer font-medium text-blue-700 hover:underline">
            Ver {cantidadTareas} tarea{cantidadTareas === 1 ? '' : 's'}
          </summary>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            {tareas.map((t, i) => (
              <li key={t.id ?? i}>{t.descripcion}</li>
            ))}
          </ul>
        </details>
      )}

      {bloque.reservas && bloque.reservas.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Reservas:</p>
          <div className="flex flex-wrap gap-1">
            {bloque.reservas.map((r, i) => (
              <span
                key={i}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  r.esMiReserva
                    ? 'bg-blue-200 text-blue-800 font-medium'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {r.usuario?.nombreCompleto ?? ''}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
        {bloque.puedoReservar && (
          <Boton
            onClick={() => bloque.id && onReservar?.(bloque.id)}
            cargando={isMutating}
            className="flex-1 py-2 cursor-pointer"
          >
            Reservar
          </Boton>
        )}

        {bloque.yaReservé && (
          <Boton
            onClick={() => bloque.id && onCancelar?.(bloque.id)}
            variante="secundario"
            cargando={isMutating}
            className="flex-1 py-2 cursor-pointer"
          >
            Cancelar Reserva
          </Boton>
        )}

        {puedeEditar && esMiBloque && (
          <>
            <button
              onClick={() => onEditar?.(bloque)}
              disabled={isMutating}
              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              title="Editar bloque"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => bloque.id && onEliminar?.(bloque.id)}
              disabled={isMutating || (bloque.reservas?.length ?? 0) > 0}
              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              title={(bloque.reservas?.length ?? 0) > 0 ? 'Primero cancela las reservas' : 'Eliminar bloque'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
