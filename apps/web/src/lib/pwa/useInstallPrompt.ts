import { useCallback, useEffect, useState } from 'react';

// El evento `beforeinstallprompt` no está en lib.dom estándar; lo tipamos aquí.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

const DISMISS_KEY = 'bismark:a2hs-dismissed';

function alreadyDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS expone navigator.standalone; el resto usa display-mode.
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
}

interface InstallPromptState {
  /** true cuando hay un prompt disponible y el usuario no lo descartó ni instaló. */
  canInstall: boolean;
  /** Lanza el diálogo nativo de instalación. */
  promptInstall: () => Promise<void>;
  /** Oculta el banner y recuerda el descarte en localStorage. */
  dismiss: () => void;
}

/**
 * Captura `beforeinstallprompt` para ofrecer un banner "Instala Bismark"
 * personalizado. Recuerda el descarte del usuario en localStorage para no
 * volver a molestarlo. No hace nada si la app ya está instalada (standalone).
 */
export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(alreadyDismissed);

  useEffect(() => {
    if (isStandalone()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // evita el mini-infobar por defecto de Chrome
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* almacenamiento no disponible */
      }
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === 'dismissed') {
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* noop */
      }
      setDismissed(true);
    }
  }, [deferred]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* noop */
    }
    setDismissed(true);
  }, []);

  return {
    canInstall: !!deferred && !dismissed,
    promptInstall,
    dismiss,
  };
}
