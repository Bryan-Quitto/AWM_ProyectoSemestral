import useSWRMutation from 'swr/mutation';
import { customFetch } from '../../../api/custom-fetch';
import type { EstadoAnimoBitacora } from '../../../views/Agenda/bitacoraSchema';

/**
 * Persona 3 / Semana 2 — Endpoint: POST /api/agenda/{id}/completar.
 *
 * Como el hook Orval generado no acepta el `fecha` opcional del path,
 * uso customFetch directo para tener control total del payload y el body.
 *
 * El backend exige que el body NO este vacio (sino FastEndpoints
 * responde 415). Por eso mandamos SIEMPRE un JSON con al menos los
 * campos minimos (estadoAnimo obligatorio).
 */

const URL_BASE_API: string =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:5000';

export interface CompletarTurnoPayload {
  bloqueId: string;
  estadoAnimo: EstadoAnimoBitacora;
  sintomas?: string | null;
  horasSueno?: number | null;
  observacionesGenerales?: string | null;
  tareasRealizadasIds?: string[];
}

export interface CompletarTurnoRespuesta {
  bitacoraId: string;
  bloqueId: string;
  fechaCierre: string; // ISO 8601
  estadoAnimo: string;
}

export const useCompletarTurno = () => {
  return useSWRMutation(
    '/api/agenda/completar',
    async (_: string, { arg }: { arg: CompletarTurnoPayload }) => {
      const url = `${URL_BASE_API}/api/agenda/${arg.bloqueId}/completar`;
      return customFetch<CompletarTurnoRespuesta>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estadoAnimo: arg.estadoAnimo,
          sintomas: arg.sintomas ?? null,
          horasSueno: arg.horasSueno ?? null,
          observacionesGenerales: arg.observacionesGenerales ?? null,
          tareasRealizadasIds: arg.tareasRealizadasIds ?? [],
        }),
      });
    }
  );
};