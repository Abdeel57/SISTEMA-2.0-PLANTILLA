import { Download, X } from 'lucide-react';
import { useInstallPrompt } from '@/lib/pwa/useInstallPrompt';
import { Button } from '@/components/ui/button';

/**
 * Banner "Instala Bismark" descartable (A2HS). Aparece abajo, al alcance del
 * pulgar, solo cuando el navegador ofrece la instalación y el usuario no la ha
 * descartado antes. El descarte se recuerda en localStorage (ver useInstallPrompt).
 */
export function InstallBanner() {
  const { canInstall, promptInstall, dismiss } = useInstallPrompt();
  if (!canInstall) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 safe-bottom">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border bg-card p-3 shadow-2xl">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-lg font-black text-white">
          B
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">Instala Bismark</p>
          <p className="truncate text-xs text-muted-foreground">
            Ábrela como app, sin navegador y más rápida.
          </p>
        </div>
        <Button size="sm" onClick={() => void promptInstall()}>
          <Download className="h-4 w-4" />
          Instalar
        </Button>
        <button
          onClick={dismiss}
          aria-label="Descartar"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
