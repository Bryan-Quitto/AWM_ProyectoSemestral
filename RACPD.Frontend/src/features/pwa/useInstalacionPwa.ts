import { useEffect, useState } from 'react';

interface EventoAntesDeInstalar extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

const CLAVE_DESCARTADO = 'racpd:pwa-banner-descartado';

function esEventoAntesDeInstalar(evento: Event): evento is EventoAntesDeInstalar {
  return 'prompt' in evento && typeof (evento as EventoAntesDeInstalar).prompt === 'function';
}

/**
 * Hook para capturar `beforeinstallprompt` y gestionar la instalación PWA de RACPD.
 */
export function useInstalacionPwa() {
  const [eventoDiferido, setEventoDiferido] = useState<EventoAntesDeInstalar | null>(null);
  const [instalando, setInstalando] = useState(false);
  const [instalada, setInstalada] = useState(false);
  const [descartado, setDescartado] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(CLAVE_DESCARTADO) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const manejarAntesDeInstalar = (evento: Event) => {
      evento.preventDefault();
      if (esEventoAntesDeInstalar(evento)) {
        setEventoDiferido(evento);
      }
    };

    const manejarInstalada = () => {
      setInstalada(true);
      setEventoDiferido(null);
    };

    window.addEventListener('beforeinstallprompt', manejarAntesDeInstalar);
    window.addEventListener('appinstalled', manejarInstalada);

    return () => {
      window.removeEventListener('beforeinstallprompt', manejarAntesDeInstalar);
      window.removeEventListener('appinstalled', manejarInstalada);
    };
  }, []);

  const instalar = async () => {
    if (!eventoDiferido || instalando) return;
    setInstalando(true);
    try {
      await eventoDiferido.prompt();
      const { outcome } = await eventoDiferido.userChoice;
      if (outcome === 'accepted') {
        setInstalada(true);
        setEventoDiferido(null);
      }
    } finally {
      setInstalando(false);
    }
  };

  const descartar = () => {
    setDescartado(true);
    try {
      window.localStorage.setItem(CLAVE_DESCARTADO, '1');
    } catch {
      // Ignorar si storage está bloqueado
    }
  };

  const mostrarBanner = Boolean(eventoDiferido) && !instalada && !descartado;

  return {
    mostrarBanner,
    instalando,
    instalar,
    descartar,
  };
}
