import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/Logo';
import { captureError } from '@/lib/monitoring';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message?: string;
}

// Evita que un error de render deje la app en blanco (pantalla de respaldo amable).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : undefined };
  }

  componentDidCatch(error: unknown): void {
    // eslint-disable-next-line no-console
    console.error('[Bismark] Error de render:', error);
    captureError(error); // reporta a Sentry (no-op sin DSN)
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="max-w-sm text-center">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>
          <h1 className="text-2xl font-extrabold">Algo salió mal</h1>
          <p className="mt-2 text-muted-foreground">
            Tuvimos un problema al mostrar esta pantalla. Recarga la página para continuar.
          </p>
          <div className="mt-8 flex flex-col gap-2">
            <Button onClick={() => window.location.reload()} size="lg">
              Recargar
            </Button>
            <Button variant="ghost" onClick={() => (window.location.href = '/')}>
              Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
