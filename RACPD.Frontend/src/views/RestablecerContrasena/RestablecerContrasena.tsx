import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from '@tanstack/react-router';
import {
  restablecerContrasenaSchema,
  type RestablecerContrasenaValores
} from './schema';
import { RestablecerContrasenaDesktop } from './RestablecerContrasenaDesktop';
import { RestablecerContrasenaMobile } from './RestablecerContrasenaMobile';
import { supabase } from '../../lib/supabase';

/**
 * Mensaje de éxito mostrado tras cambiar la contraseña. Indica al
 * cuidador que será redirigido al panel principal automáticamente.
 */
const MENSAJE_EXITO =
  'Tu contraseña fue actualizada correctamente. Serás redirigido al panel principal…';

/**
 * Detecta si la URL trae indicios de que se llegó desde un enlace
 * de recuperación de Supabase.
 *
 * Soporta dos modos:
 *  - Implicit/fragment: `#access_token=...&type=recovery` (flujo
 *    clásico, el hash contiene los tokens).
 *  - PKCE/query: `?code=...` cuando Supabase está configurado con
 *    flowType=pkce.
 *
 * Si ninguno está presente, NO se considera un intento legítimo de
 * recuperación, aunque haya sesión activa (decisión de seguridad
 * documentada en el spec #5, decisión #9).
 */
const urlTraeIndiciosDeRecuperacion = (): boolean => {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.length > 0) {
    const params = new URLSearchParams(hash);
    if (
      params.get('access_token') !== null &&
      params.get('type') === 'recovery'
    ) {
      return true;
    }
  }
  const query = new URLSearchParams(window.location.search);
  if (query.has('code')) {
    return true;
  }
  return false;
};

/**
 * Mapea códigos/mensajes de error del SDK de Supabase a textos humanos.
 */
const mapearErrorRestablecimiento = (mensajeOriginal: string): string => {
  const mensaje = mensajeOriginal.toLowerCase();
  if (mensaje.includes('weak') || mensaje.includes('débil') || mensaje.includes('debil')) {
    return 'La contraseña es demasiado débil. Debe cumplir la política configurada.';
  }
  if (mensaje.includes('same as') || mensaje.includes('misma')) {
    return 'La nueva contraseña debe ser diferente a la actual.';
  }
  if (
    mensaje.includes('session') ||
    mensaje.includes('jwt') ||
    mensaje.includes('expired') ||
    mensaje.includes('invalid') ||
    mensaje.includes('token')
  ) {
    return 'El enlace expiró o ya fue usado. Solicita uno nuevo.';
  }
  if (
    mensaje.includes('failed to fetch') ||
    mensaje.includes('network') ||
    mensaje.includes('load failed') ||
    mensaje.includes('fetch failed')
  ) {
    return 'No se puede contactar al servidor. Verifica tu conexión e inténtalo de nuevo.';
  }
  return 'No se pudo actualizar la contraseña. Inténtalo nuevamente.';
};

/**
 * Contenedor de "Restablecer Contraseña".
 *
 * Implementa una máquina de tres estados:
 *  - 'esperando': loader mientras se confirma que la URL trae
 *    indicios válidos de recuperación.
 *  - 'listo':     formulario con la nueva contraseña + confirmación.
 *  - 'invalido':  enlace roto / sesión ajena al flujo de recuperación.
 *
 * Importante: el `useEffect` de montaje se suscribe al evento externo
 * `onAuthStateChange` (store de Supabase), NO sincroniza datos de SWR
 * con estado local. Esto NO viola la regla "Estado Derivado vs Efectos".
 */
export const RestablecerContrasena = () => {
  const [esMobile, setEsMobile] = useState<boolean>(window.innerWidth < 768);
  const [estado, setEstado] = useState<'esperando' | 'listo' | 'invalido'>('esperando');
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [estaMutando, setEstaMutando] = useState<boolean>(false);
  const navigate = useNavigate();
  const yaTransicionoAListo = useRef<boolean>(false);

  const form = useForm<RestablecerContrasenaValores>({
    resolver: zodResolver(restablecerContrasenaSchema),
    defaultValues: {
      nuevaContrasena: '',
      confirmarContrasena: ''
    }
  });

  useEffect(() => {
    const manejarRedimension = () => setEsMobile(window.innerWidth < 768);
    window.addEventListener('resize', manejarRedimension);
    return () => window.removeEventListener('resize', manejarRedimension);
  }, []);

  useEffect(() => {
    let temporizadorInvalido: ReturnType<typeof setTimeout> | null = null;
    const tieneIndicios = urlTraeIndiciosDeRecuperacion();

    const marcarComoListo = (): void => {
      if (yaTransicionoAListo.current) return;
      yaTransicionoAListo.current = true;
      setEstado('listo');
      if (temporizadorInvalido !== null) {
        clearTimeout(temporizadorInvalido);
      }
    };

    const marcarComoInvalido = (): void => {
      if (yaTransicionoAListo.current) return;
      setEstado('invalido');
    };

    // Chequeo inmediato: si la URL trae indicios de recuperación, vamos
    // directo a 'listo' sin esperar al evento (Supabase ya habrá emitido
    // PASSWORD_RECOVERY al procesar el fragmento).
    if (tieneIndicios) {
      marcarComoListo();
    } else {
      // Aún si no hay indicios en la URL, puede haber sesión válida si
      // Supabase intercambió un código PKCE y dejó la sesión lista. Por
      // seguridad (decisión #13 del spec), en ese caso NO consideramos
      // que sea un intento legítimo de recuperación: dejamos que el evento
      // PASSWORD_RECOVERY confirme.
      const { data: suscripcion } = supabase.auth.onAuthStateChange(
        (evento) => {
          if (evento === 'PASSWORD_RECOVERY') {
            marcarComoListo();
          }
        }
      );

      // Timeout de seguridad: si tras 5s no llega el evento ni la URL
      // traía indicios, consideramos que el usuario llegó por error.
      temporizadorInvalido = setTimeout(() => {
        marcarComoInvalido();
      }, 5000);

      return () => {
        suscripcion.subscription.unsubscribe();
        if (temporizadorInvalido !== null) {
          clearTimeout(temporizadorInvalido);
        }
      };
    }
    return undefined;
  }, []);

  const onSubmit = async (
    data: RestablecerContrasenaValores
  ): Promise<void> => {
    setErrorApi(null);
    setExito(null);
    setEstaMutando(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.nuevaContrasena
      });
      if (error !== null) {
        setErrorApi(mapearErrorRestablecimiento(error.message));
        return;
      }
      // Éxito: sesión activa tras updateUser. Redirigimos al panel
      // principal (/), NO a /inicio-sesion, porque el usuario ya está
      // autenticado (decisión #8 del spec).
      setExito(MENSAJE_EXITO);
      setTimeout(() => {
        navigate({ to: '/' });
      }, 1500);
    } catch {
      setErrorApi('No se pudo conectar al servidor. Inténtalo nuevamente.');
    } finally {
      setEstaMutando(false);
    }
  };

  if (estado === 'esperando') {
    return (
      <div
        role="status"
        className="min-h-screen bg-blue-50 flex items-center justify-center"
      >
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 mb-4" />
          <p className="text-blue-700 font-medium">
            Verificando enlace de recuperación…
          </p>
        </div>
      </div>
    );
  }

  if (estado === 'invalido') {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-blue-100 p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-blue-900 mb-3">
            Enlace inválido o expirado
          </h2>
          <p className="text-sm text-blue-700 mb-6">
            El enlace de recuperación no es válido o ya fue utilizado.
            Solicita uno nuevo desde la pantalla de inicio de sesión.
          </p>
          <Link
            to="/inicio-sesion"
            className="inline-block px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"
          >
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  const props = { form, onSubmit, estaMutando, errorApi, exito };

  return esMobile
    ? <RestablecerContrasenaMobile {...props} />
    : <RestablecerContrasenaDesktop {...props} />;
};
