import { toast } from 'sonner';

// Copia texto al portapapeles con aviso. Best-effort: si la API no está
// disponible (http o navegador viejo), muestra un error amable.
export async function copyToClipboard(text: string, label = 'Copiado'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label}.`);
  } catch {
    toast.error('No se pudo copiar. Copia el texto manualmente.');
  }
}
