/**
 * Cliente singleton de Supabase para el Frontend de RACPD.
 *
 * Este módulo crea perezosamente (lazy) una única instancia del cliente
 * de Supabase utilizando las credenciales públicas (anon key) provistas
 * mediante variables de entorno de Vite. La inicialización se difiere
 * hasta el primer uso para que la ausencia de variables de entorno no
 * provoque un fallo en el import del módulo (lo cual provocaría que la
 * app entera no se monte y entre en bucles de recarga).
 *
 * Seguridad:
 * - SOLO se utiliza la clave anónima pública (`VITE_SUPABASE_ANON_KEY`).
 * - NUNCA debe usarse la clave `service_role`, pues esa pertenece al backend.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Bandera para inicializar el cliente una sola vez.
 */
let instancia: SupabaseClient | null = null;

/**
 * Verifica que las variables de entorno requeridas estén definidas y
 * devuelve sus valores. Si falta alguna, lanza un error descriptivo.
 */
function obtenerCredenciales(): { url: string; clave: string } {
  const url = import.meta.env['VITE_SUPABASE_PROJECT_URL'] as string | undefined;
  const claveAnonima = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;

  if (typeof url !== 'string' || url.trim().length === 0) {
    throw new Error(
      'Falta la variable de entorno VITE_SUPABASE_PROJECT_URL. ' +
        'Define la URL pública del proyecto Supabase antes de iniciar la aplicación.',
    );
  }

  if (typeof claveAnonima !== 'string' || claveAnonima.trim().length === 0) {
    throw new Error(
      'Falta la variable de entorno VITE_SUPABASE_ANON_KEY. ' +
        'Define la clave anónima pública de Supabase antes de iniciar la aplicación.',
    );
  }

  return { url, clave: claveAnonima };
}

/**
 * Inicializa y devuelve la instancia singleton del cliente de Supabase.
 * Si las variables de entorno faltan, el error se lanza aquí (en el
 * momento del primer uso), no al cargar el módulo.
 */
function obtenerClienteSupabase(): SupabaseClient {
  if (instancia === null) {
    const credenciales = obtenerCredenciales();
    instancia = createClient(credenciales.url, credenciales.clave);
  }
  return instancia;
}

/**
 * Proxy que inicializa Supabase solo cuando se accede por primera vez.
 * Permite usar `import { supabase } from '...'` como si fuera una constante,
 * sin riesgo de romper el módulo si faltan variables de entorno.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const cliente = obtenerClienteSupabase();
    const valor = Reflect.get(cliente, prop, cliente);
    return typeof valor === 'function' ? valor.bind(cliente) : valor;
  }
});
