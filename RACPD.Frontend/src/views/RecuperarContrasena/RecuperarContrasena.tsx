import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  recuperarContrasenaSchema,
  type RecuperarContrasenaValores
} from './schema';
import { RecuperarContrasenaDesktop } from './RecuperarContrasenaDesktop';
import { RecuperarContrasenaMobile } from './RecuperarContrasenaMobile';
import { supabase } from '../../lib/supabase';

/**
 * Mensaje neutro que se muestra tras enviar el enlace.
 *
 * Por seguridad anti-enumeración se usa el MISMO texto tanto si el
 * correo existe como si no. Así un atacante no puede deducir qué
 * correos están registrados en el sistema.
 */
const MENSAJE_EXITO_NEUTRO =
  'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.';

const construirUrlRedireccionamiento = (): string => {
  const baseConfig = import.meta.env['VITE_APP_URL'] as string | undefined;
  const base = baseConfig !== undefined && baseConfig.trim().length > 0
    ? baseConfig
    : window.location.origin;
  return `${base.replace(/\/$/, '')}/restablecer-contrasena`;
};

/**
 * Mapea códigos de error del SDK de Supabase a mensajes humanos en español.
 */
const mapearErrorRecuperacion = (codigo: string | undefined): string | null => {
  const codigoNormalizado = (codigo ?? '').toLowerCase();

  if (
    codigoNormalizado.includes('email_address_invalid') ||
    codigoNormalizado.includes('invalid email')
  ) {
    return 'El correo no tiene un formato válido.';
  }
  if (codigoNormalizado.includes('over_email_send_rate_limit')) {
    return 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.';
  }
  if (
    codigoNormalizado.includes('failed to fetch') ||
    codigoNormalizado.includes('networkerror') ||
    codigoNormalizado.includes('load failed') ||
    codigoNormalizado.includes('fetch failed')
  ) {
    return 'No se puede contactar al servidor. Verifica tu conexión e inténtalo de nuevo.';
  }
  return null;
};

/**
 * Contenedor de la vista "Recuperar Contraseña".
 *
 * Orquesta:
 * 1. El formulario con validación Zod (solo `correo`).
 * 2. La llamada a `supabase.auth.resetPasswordForEmail`.
 * 3. La presentación de un mensaje neutro (anti-enumeración).
 * 4. La bifurcación Desktop/Mobile.
 */
export const RecuperarContrasena = () => {
  const [esMobile, setEsMobile] = useState<boolean>(window.innerWidth < 768);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [estaMutando, setEstaMutando] = useState<boolean>(false);

  const form = useForm<RecuperarContrasenaValores>({
    resolver: zodResolver(recuperarContrasenaSchema),
    defaultValues: { correo: '' }
  });

  useEffect(() => {
    const manejarRedimension = () => setEsMobile(window.innerWidth < 768);
    window.addEventListener('resize', manejarRedimension);
    return () => window.removeEventListener('resize', manejarRedimension);
  }, []);

  const onSubmit = async (data: RecuperarContrasenaValores): Promise<void> => {
    setErrorApi(null);
    setExito(null);
    setEstaMutando(true);
    try {
      const redirectTo = construirUrlRedireccionamiento();
      const { error } = await supabase.auth.resetPasswordForEmail(data.correo, {
        redirectTo
      });

      if (error !== null) {
        const mensaje = mapearErrorRecuperacion(error.code ?? error.message);
        // Si Supabase reporta un error NO contemplado, mostramos el mensaje
        // genérico (no el mensaje crudo) para no filtrar información.
        if (mensaje !== null) {
          setErrorApi(mensaje);
        } else {
          setExito(MENSAJE_EXITO_NEUTRO);
        }
        return;
      }

      // Éxito: mensaje neutro SIEMPRE (anti-enumeración).
      setExito(MENSAJE_EXITO_NEUTRO);
    } catch {
      setErrorApi('No se pudo conectar al servidor. Inténtalo nuevamente.');
    } finally {
      setEstaMutando(false);
    }
  };

  const props = { form, onSubmit, estaMutando, errorApi, exito };

  return esMobile
    ? <RecuperarContrasenaMobile {...props} />
    : <RecuperarContrasenaDesktop {...props} />;
};
