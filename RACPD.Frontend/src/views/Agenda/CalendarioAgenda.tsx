import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RACPDBackendFeaturesAgendaBloqueTurnoDto } from '../../api/generated/model';

interface CalendarioAgendaProps {
  bloques: RACPDBackendFeaturesAgendaBloqueTurnoDto[];
  fechaSeleccionada: string | null;
  onSeleccionarFecha: (fecha: string | null) => void;
}

const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const CalendarioAgenda = ({
  bloques,
  fechaSeleccionada,
  onSeleccionarFecha,
}: CalendarioAgendaProps) => {
  const [mesActual, setMesActual] = useState(() => new Date());

  const { diasCalendario } = useMemo(() => {
    const year = mesActual.getFullYear();
    const month = mesActual.getMonth();
    
    const primerDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month + 1, 0);
    const primerDiaSemana = primerDia.getDay();
    const totalDias = ultimoDia.getDate();
    
    const dias: Array<{ fecha: string | null; dia: number | null; esPasado: boolean }> = [];
    
    for (let i = 0; i < primerDiaSemana; i++) {
      dias.push({ fecha: null, dia: null, esPasado: false });
    }
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    for (let d = 1; d <= totalDias; d++) {
      const fecha = new Date(year, month, d);
      const fechaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dias.push({
        fecha: fechaStr,
        dia: d,
        esPasado: fecha < hoy,
      });
    }
    
    return { diasCalendario: dias };
  }, [mesActual]);

  const bloquesPorFecha = useMemo(() => {
    const mapa: Record<string, { disponibles: number; conReserva: boolean }> = {};
    bloques.forEach(bloque => {
      const fecha = bloque.fecha || '';
      if (!fecha) return;
      if (!mapa[fecha]) {
        mapa[fecha] = { disponibles: 0, conReserva: false };
      }
      if ((bloque.cuposDisponibles ?? 0) > 0) mapa[fecha].disponibles++;
      if (bloque.yaReservé) mapa[fecha].conReserva = true;
    });
    return mapa;
  }, [bloques]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() - 1, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h3 className="text-lg font-semibold text-gray-800">
          {meses[mesActual.getMonth()]} {mesActual.getFullYear()}
        </h3>
        <button
          onClick={() => setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {diasSemana.map(dia => (
          <div key={dia} className="text-center text-xs font-medium text-gray-500 py-2">
            {dia}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {diasCalendario.map((dia, idx) => {
          if (!dia.fecha || dia.dia === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const info = bloquesPorFecha[dia.fecha];
          const estaSeleccionado = fechaSeleccionada === dia.fecha;

          return (
            <button
              key={dia.fecha}
              onClick={() => onSeleccionarFecha(dia.fecha === fechaSeleccionada ? null : dia.fecha)}
              className={`
                aspect-square rounded-lg flex flex-col items-center justify-center text-sm
                transition-all cursor-pointer relative
                ${estaSeleccionado ? 'bg-blue-600 text-white ring-2 ring-blue-300' : ''}
                ${!estaSeleccionado && info ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : ''}
                ${!estaSeleccionado && !info && !dia.esPasado ? 'hover:bg-gray-100 text-gray-700' : ''}
                ${dia.esPasado && !info ? 'text-gray-300 cursor-not-allowed' : ''}
              `}
            >
              <span className="font-medium">{dia.dia}</span>
              {info && !estaSeleccionado && (
                <div className="flex gap-0.5 mt-0.5">
                  {info.conReserva && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                  {info.disponibles > 0 && !info.conReserva && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                  {info.disponibles === 0 && !info.conReserva && <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs text-gray-500">Reservado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-gray-500">Disponible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="text-xs text-gray-500">Completo</span>
        </div>
      </div>
    </div>
  );
};
