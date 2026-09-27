import { Calendar, Clock, Users, Trash2, Edit2, User, ListChecks, Repeat, ClipboardCheck, Eye, CheckCircle2, Moon, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Boton } from '../../components/Boton';
import { TruncadorLinea } from '../../components/TruncadorLinea';
import { ModalDetalle } from '../../components/ModalDetalle';
import { DialogoCompletarTurno } from './DialogoCompletarTurno';
import {
  calcularAntelacionMinima,
  MENSAJE_BLOQUEO_72H,
} from '../../features/agenda/lib/calcularAntelacionMinima';
import { useObtenerBitacora } from '../../features/agenda/hooks/useObtenerBitacora';
import {
  ETIQUETAS_ESTADO_ANIMO,
  type EstadoAnimoBitacora,
} from './bitacoraSchema';
import type { RACPDBackendFeaturesAgendaBloqueTurnoDto } from '../../api/generated/model';

/**
 * Argumento que pueden recibir los handlers onReservar / onCancelar.
 * Persona 2 / Semana 2: además del id del bloque maestro, se envía la fecha
 * de la OCURRENCIA concreta (YYYY-MM-dd) para que el backend aplique reglas
 * temporales sobre la proyección recurrente correcta.
 */
export type OcurrenciaRef = {
  id: string;
  fecha?: string;
};

interface TarjetaBloqueProps {
  bloque: RACPDBackendFeaturesAgendaBloqueTurnoDto;
  esMiBloque: boolean;
  puedeEditar: boolean;
  onReservar?: (ocurrencia: OcurrenciaRef | string) => void;
  onCancelar?: (ocurrencia: OcurrenciaRef | string) => void;
  onEditar?: (bloque: RACPDBackendFeaturesAgendaBloqueTurnoDto) => void;
  onEliminar?: (id: string) => void;
  /**
   * Notifica al padre cuando el cuidador cierra exitosamente un turno.
   * El padre deberia disparar `mutate()` de SWR para refrescar la lista.
   */
  onBloqueCerrado?: (ocurrencia: OcurrenciaRef) => void;
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

/**
 * Clave estable de la OCURRENCIA. Coincide con el patron usado en
 * AgendaDesktop.tsx / AgendaMobile.tsx (`${id}-${fecha}`) para evitar
 * colisiones de key en bloques recurrentes. Se usa tambien para
 * identificar turnos ya cerrados en el set optimista de la sesion.
 */
const claveOcurrencia = (id?: string, fecha?: string): string =>
  fecha ? `${id}-${fecha}` : (id ?? '');

export const TarjetaBloque = ({
  bloque,
  esMiBloque,
  puedeEditar,
  onReservar,
  onCancelar,
  onEditar,
  onEliminar,
  onBloqueCerrado,
  isMutating,
}: TarjetaBloqueProps) => {
  const esCompleto = (bloque.cuposDisponibles ?? 0) === 0;
  const estaVencido = bloque.fecha
    ? new Date(bloque.fecha) < new Date(new Date().toISOString().split('T')[0])
    : false;

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

  // Estado para mostrar el detalle completo del bloque (nombre, cuidador, etc.)
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  // Estado para mostrar exclusivamente el listado completo de tareas del bloque
  const [modalTareasAbierto, setModalTareasAbierto] = useState(false);
  // Estado del modal de cierre de turno / bitacora.
  const [dialogoCerrarAbierto, setDialogoCerrarAbierto] = useState(false);
  // Estado del modal de lectura de bitacora (modo lectura, sin formulario).
  const [modalBitacoraAbierto, setModalBitacoraAbierto] = useState(false);

  // Persona 3 / Semana 3:
  // El backend ya expone `estaCompletado` y `bitacoraId` en BloqueTurnoDto,
  // así que el relevo entrante puede ver el reporte del cuidador anterior.
  // Mantenemos un set optimista local para que el cuidador que cierra su
  // propio turno vea la insignia sin esperar al round-trip de SWR.
  const [cerradosEnSesion, setCerradosEnSesion] = useState<Set<string>>(
    () => new Set(),
  );
  const claveBloque = useMemo(
    () => claveOcurrencia(bloque.id, bloque.fecha),
    [bloque.id, bloque.fecha],
  );
  const completadoPorServidor = bloque.estaCompletado === true || Boolean(bloque.bitacoraId);
  const completadoEnSesion = cerradosEnSesion.has(claveBloque);
  const turnoCompletado = completadoPorServidor || completadoEnSesion;

  // Hook de lectura: solo fetchea cuando el modal está abierto. La R3 del
  // backend (ObtenerBitacoraEndpoint) valida tenancy: el cuidador debe ser
  // creador, tener reserva activa o vínculo activo con el dependiente.
  const {
    bitacora,
    isLoading: bitacoraCargando,
    error: bitacoraError,
    refetch: recargarBitacora,
  } = useObtenerBitacora({
    bloqueId: bloque.id,
    modalAbierto: modalBitacoraAbierto,
  });

  // Reglas para mostrar el boton "Cerrar turno":
  //   (yaReservé || esMiBloque)  -> el usuario participa del turno
  //   !estaVencido               -> la fecha ya paso
  //   !turnoCompletado           -> el backend ya lo cerro
  // Esto encaja con la autorizacion R1 del backend
  // (CompletarTurnoEndpoint.cs): solo el creador o un reservador activo
  // puede cerrar. El backend rechaza con 403 si no se cumple.
  const puedeCerrarTurno =
    (bloque.yaReservé || esMiBloque) &&
    !!bloque.id &&
    !estaVencido &&
    !turnoCompletado;

  // Reglas para mostrar el boton "Ver bitacora":
  //   turnoCompletado: backend confirma (o sesion optimista local)
  // El backend aplica la R3 de tenancy al servir el detalle, asi que un
  // cuidador sin acceso recibira 403 y vera el mensaje de error en el modal.
  const puedeVerBitacora = turnoCompletado;

  const handleCerradoExitoso = (bitacoraId?: string) => {
    // Marcamos localmente para que aparezca la insignia inmediatamente.
    setCerradosEnSesion((prev) => {
      const siguiente = new Set(prev);
      siguiente.add(claveBloque);
      return siguiente;
    });
    // Avisamos al padre para que invalide SWR (refresca la pagina,
    // reordena filtros, etc.). Hacemos esto ANTES de cerrar el modal
    // para que cuando el cuidador vea la insignia el resto ya este
    // sincronizado.
    if (bloque.id) {
      onBloqueCerrado?.({ id: bloque.id, fecha: bloque.fecha });
    }
    setDialogoCerrarAbierto(false);
    // Feedback adicional: la insignia aparece sola, pero dejamos
    // huella del ID de bitacora por si el cuidador quiere compartirlo.
    // Nota: DialogoCompletarTurno ya emite un toast de exito propio;
    // aqui solo agregamos description contextual para no duplicar.
    if (bitacoraId) {
      toast.success(`Bitacora #${bitacoraId.slice(0, 8)} registrada.`);
    }
  };

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
            <TruncadorLinea
              texto={bloque.creadoPor?.nombreCompleto ?? ''}
              className="text-sm text-blue-600"
              onExpand={() => setDetalleAbierto(true)}
            />

            {/* === NUEVO (Persona 1 / Semana 1) === */}
            {bloque.nombreDependiente && (
              <div className="flex items-center gap-1 mt-1 text-xs text-blue-700 min-w-0">
                <User className="w-3 h-3 shrink-0" />
                <TruncadorLinea
                  texto={bloque.nombreDependiente}
                  onExpand={() => setDetalleAbierto(true)}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {/* Badge recurrencia */}
              {bloque.tipoRecurrencia && bloque.tipoRecurrencia !== 'Unica' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-medium">
                  <Repeat className="w-3 h-3" />
                  {bloque.tipoRecurrencia === 'Semanas' && bloque.intervaloSemanas
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

              {/* Badge turno completado (Persona 3 / Semana 3) */}
              {turnoCompletado && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-medium"
                  title={
                    completadoPorServidor
                      ? 'Este turno ya fue cerrado. La bitacora esta disponible.'
                      : 'Cerraste este turno en esta sesion.'
                  }
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Turno Completado
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
        <details className="mb-3 text-xs text-gray-600 min-w-0">
          <summary className="cursor-pointer font-medium text-blue-700 hover:underline">
            Ver {cantidadTareas} tarea{cantidadTareas === 1 ? '' : 's'}
          </summary>
          {/* `list-none` + bullet propio: el wrapper block de TruncadorLinea
              rompe el cálculo de bullets nativos con `list-inside`, dejando
              el bullet del <li> en una línea vacía. Pintamos el bullet
              nosotros mismos con `::before` para tener un layout predecible. */}
          <ul className="mt-2 space-y-1 list-none">
            {tareas.map((t, i) => (
              <li
                key={t.id ?? i}
                className="flex items-start gap-1.5 min-w-0 before:content-['•'] before:text-blue-500 before:shrink-0 before:leading-[1.25rem]"
              >
                <TruncadorLinea
                  texto={t.descripcion ?? ''}
                  maxLineas={2}
                  className="text-xs text-gray-600 min-w-0"
                  onExpand={() => setModalTareasAbierto(true)}
                />
              </li>
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

      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
        {bloque.puedoReservar && (
          <Boton
            onClick={() => {
              // === Persona 2 / Semana 2: enviar fecha de la OCURRENCIA ===
              // Con la proyección de ocurrencias (Persona 1), un bloque recurrente
              // genera múltiples turnos. Enviamos la fecha concreta de esta
              // ocurrencia para que las reglas temporales del backend operen
              // sobre el instante correcto (no sobre la fecha base del maestro).
              if (!bloque.id) return;
              onReservar?.({ id: bloque.id, fecha: bloque.fecha });
            }}
            cargando={isMutating}
            className="flex-1 py-2 cursor-pointer"
            title="Tomar este turno de apoyo"
          >
            Tomar turno
          </Boton>
        )}

        {bloque.yaReservé && (
          <Boton
            onClick={() => {
              // === REGLA DURA 72h (Persona 2 / Semana 2) ===
              // Bloqueamos en cliente para evitar round-trip cuando
              // faltarían menos de 72h. La verdad sigue siendo el servidor
              // (CancelarReservaEndpoint), que también valida y devuelve
              // 400 ProblemDetails; defensa redundante ver
              // AgendaDesktop.tsx / AgendaMobile.tsx.
              if (calcularAntelacionMinima(bloque.fecha, bloque.horaInicio)) {
                toast.error(MENSAJE_BLOQUEO_72H, { duration: 6000 });
                return;
              }
              if (!bloque.id) return;
              // Enviar id + fecha de la OCURRENCIA para que la antena 72h
              // evalúe el instante correcto.
              onCancelar?.({ id: bloque.id, fecha: bloque.fecha });
            }}
            variante="secundario"
            cargando={isMutating}
            disabled={calcularAntelacionMinima(bloque.fecha, bloque.horaInicio)}
            className="flex-1 py-2 cursor-pointer"
            title={
              calcularAntelacionMinima(bloque.fecha, bloque.horaInicio)
                ? 'No puedes cancelar con menos de 72h de antelación'
                : 'Cancelar tu reserva en este turno'
            }
          >
            Cancelar Reserva
          </Boton>
        )}

        {/* Botón "Cerrar turno" — solo si soy participante del turno y
            NO está vencido ni cerrado en la sesión. */}
        {puedeCerrarTurno && (
          <Boton
            onClick={() => setDialogoCerrarAbierto(true)}
            variante="primario"
            disabled={isMutating}
            className="flex-1 py-2 cursor-pointer"
            title="Cerrar este turno y registrar la bitácora del cuidado"
          >
            <ClipboardCheck className="w-4 h-4 mr-1.5" />
            Cerrar turno
          </Boton>
        )}

        {/* Botón "Ver bitácora / novedades" — visible para cualquier
            cuidador con acceso al bloque (relevo entrante, creador o
            vinculado al dependiente). El backend valida tenancy en R3. */}
        {puedeVerBitacora && (
          <Boton
            onClick={() => setModalBitacoraAbierto(true)}
            variante="secundario"
            className="flex-1 py-2 cursor-pointer"
            title="Ver el resumen del cierre de turno (animo, sueno, sintomas, observaciones)"
          >
            <Eye className="w-4 h-4 mr-1.5" />
            Ver bitácora
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
              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              title={(bloque.reservas?.length ?? 0) > 0 ? 'Primero cancela las reservas' : 'Eliminar bloque'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      <ModalDetalle
        abierto={detalleAbierto}
        onCerrar={() => setDetalleAbierto(false)}
        titulo="Detalle del bloque"
        icono={<Calendar className="w-5 h-5 text-blue-600" />}
      >
        <div className="space-y-4 p-1 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
              <span className="text-xs text-blue-700 font-semibold block mb-0.5">Cuidador Creador</span>
              <p className="font-medium text-gray-900">{bloque.creadoPor?.nombreCompleto ?? '—'}</p>
            </div>
            {bloque.nombreDependiente && (
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="text-xs text-blue-700 font-semibold block mb-0.5">Dependiente</span>
                <p className="font-medium text-gray-900">{bloque.nombreDependiente}</p>
              </div>
            )}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-xs text-gray-500 font-medium block mb-0.5">Fecha y Horario</span>
              <p className="font-semibold text-gray-800">
                {formatearFecha(bloque.fecha)} ({bloque.horaInicio?.slice(0, 5)} — {bloque.horaFin?.slice(0, 5)})
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-xs text-gray-500 font-medium block mb-0.5">Ocupación de Cupos</span>
              <p className="font-semibold text-gray-800">
                {(bloque.cuposMaximos ?? 0) - (bloque.cuposDisponibles ?? 0)} de {bloque.cuposMaximos ?? 0} ocupados
              </p>
            </div>
          </div>

          {bloque.descripcion && (
            <div className="p-3.5 bg-sky-50/50 rounded-xl border border-sky-100">
              <span className="text-xs text-sky-800 font-semibold block mb-1">Descripción / Notas del turno</span>
              <p className="text-gray-700 leading-relaxed italic">{bloque.descripcion}</p>
            </div>
          )}
        </div>
      </ModalDetalle>

      <ModalDetalle
        abierto={modalTareasAbierto}
        onCerrar={() => setModalTareasAbierto(false)}
        titulo={`Tareas del turno (${cantidadTareas})`}
        icono={<ListChecks className="w-5 h-5 text-blue-600" />}
      >
        <div className="space-y-3 p-1">
          <p className="text-xs text-gray-500">
            Lista completa de tareas y cuidados asignados para este turno:
          </p>
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden bg-gray-50/50">
            {tareas.map((t, idx) => (
              <li
                key={t.id ?? idx}
                className="p-3 text-sm text-gray-800 flex items-start gap-3 bg-white"
              >
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="flex-1 leading-relaxed break-words" style={{ overflowWrap: 'anywhere' }}>
                  {t.descripcion}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </ModalDetalle>

      {/* Modal de cierre de turno / bitacora. Usamos `key` para forzar
          remount limpio entre ocurrencias: asi evitamos el anti-patron
          de sincronizar el formulario con useEffect (regla React 19). */}
      {bloque.id && (
        <DialogoCompletarTurno
          key={`cerrar-${claveBloque}`}
          abierto={dialogoCerrarAbierto}
          bloqueId={bloque.id}
          tareas={tareas.map((t) => ({
            id: t.id ?? '',
            descripcion: t.descripcion ?? '',
            orden: 0,
          }))}
          nombreDependiente={bloque.nombreDependiente ?? 'Dependiente'}
          onCerrar={() => setDialogoCerrarAbierto(false)}
          onCompletado={handleCerradoExitoso}
        />
      )}

      {/* Modal de lectura de bitacora (Persona 3 / Semana 3).
          Carga los datos reales desde GET /api/agenda/{id}/bitacora via
          useObtenerBitacora. Visible para cualquier cuidador con acceso
          al bloque (creador, reservador activo o vinculado al dependiente). */}
      <ModalDetalle
        abierto={modalBitacoraAbierto}
        onCerrar={() => setModalBitacoraAbierto(false)}
        titulo="Bitacora del turno"
        icono={<ClipboardCheck className="w-5 h-5 text-emerald-600" />}
      >
        <div className="space-y-3 p-1 text-sm">
          {bitacoraCargando && (
            <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl text-center text-blue-700">
              Cargando bitacora...
            </div>
          )}

          {!bitacoraCargando && Boolean(bitacoraError) && (
            <div className="p-3.5 bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">No se pudo cargar la bitacora.</p>
                <p className="text-xs mt-1">
                  Puede ser que el turno aun no haya sido cerrado o que no
                  tengas permisos para consultarla.
                </p>
                <button
                  type="button"
                  onClick={() => recargarBitacora()}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-xs font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {!bitacoraCargando && !bitacoraError && bitacora && (
            <>
              {/* Encabezado: dependiente + fecha + estado */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1 inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Turno cerrado
                </p>
                <p className="font-medium text-emerald-900">
                  {bloque.nombreDependiente ?? 'Dependiente'} —{' '}
                  {formatearFecha(bloque.fecha)} ({bloque.horaInicio?.slice(0, 5)} — {bloque.horaFin?.slice(0, 5)})
                </p>
              </div>

              {/* Estado de animo con badge */}
              <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl">
                <p className="text-xs font-semibold text-sky-800 uppercase tracking-wide mb-1">
                  Estado de animo
                </p>
                <p className="font-semibold text-sky-900 text-base">
                  {ETIQUETAS_ESTADO_ANIMO[bitacora.estadoAnimo as EstadoAnimoBitacora] ??
                    bitacora.estadoAnimo ??
                    'No registrado'}
                </p>
              </div>

              {/* Horas de sueno */}
              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1 inline-flex items-center gap-2">
                  <Moon className="w-4 h-4" />
                  Horas de sueno
                </p>
                <p className="font-semibold text-blue-900">
                  {bitacora.horasSueno != null
                    ? `${bitacora.horasSueno} h`
                    : 'No especificado'}
                </p>
              </div>

              {/* Sintomas observados */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Sintomas observados
                </p>
                <p className="text-gray-800 whitespace-pre-wrap break-words italic">
                  {bitacora.sintomas && bitacora.sintomas.trim().length > 0
                    ? bitacora.sintomas
                    : 'Sin sintomas reportados.'}
                </p>
              </div>

              {/* Observaciones generales */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 inline-flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Observaciones del cuidador
                </p>
                <p className="text-gray-800 whitespace-pre-wrap break-words">
                  {bitacora.observacionesGenerales && bitacora.observacionesGenerales.trim().length > 0
                    ? bitacora.observacionesGenerales
                    : <span className="italic text-gray-400">Sin observaciones registradas.</span>}
                </p>
              </div>

              {/* Checklist: realizadas vs pendientes */}
              {bitacora.tareasDelBloque && bitacora.tareasDelBloque.length > 0 && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Tareas del turno
                  </p>
                  <ul className="space-y-1.5 list-none">
                    {bitacora.tareasDelBloque.map((t, i) => {
                      const esRealizada = Boolean(
                        t.id && bitacora.tareasRealizadasIds?.includes(t.id),
                      );
                      return (
                        <li
                          key={t.id ?? i}
                          className={`flex items-start gap-2 p-2 rounded-lg border ${
                            esRealizada
                              ? 'bg-emerald-50 border-emerald-200'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <span
                            className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 ${
                              esRealizada
                                ? 'bg-emerald-500 text-white'
                                : 'bg-gray-200 text-gray-500'
                            }`}
                            aria-hidden="true"
                          >
                            {esRealizada ? '✓' : '·'}
                          </span>
                          <span
                            className={`text-sm leading-snug ${
                              esRealizada
                                ? 'line-through text-emerald-900/70'
                                : 'text-gray-800'
                            }`}
                          >
                            {t.descripcion}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Auditoria: registrado por */}
              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs text-blue-700">
                <p className="font-semibold mb-0.5">
                  Registrado por {bitacora.registradoPor?.nombreCompleto ?? 'cuidador no identificado'}
                </p>
                {bitacora.fechaCierre && (
                  <p className="text-blue-600">
                    el {new Date(bitacora.fechaCierre).toLocaleString('es-EC', {
                      dateStyle: 'long',
                      timeStyle: 'short',
                    })}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </ModalDetalle>
    </div>
  );
};