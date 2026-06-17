import { BRAND, buildWhatsappLink } from '@bismark/shared';
import { webEnv } from '@/lib/env';
import { LogoMark } from './LogoMark';
import { cn } from '@/lib/cn';

// Marca discreta para páginas públicas: "Desarrollado por Bismark".
// Si hay WhatsApp de Bismark configurado, enlaza al chat; si no, es solo texto.
export function PoweredBy({ className }: { className?: string }) {
  const classes = cn(
    'inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-muted-foreground',
    className,
  );
  const content = (
    <>
      <LogoMark className="h-4 w-4" />
      {BRAND.poweredBy}
    </>
  );

  if (!webEnv.bismarkWhatsapp) {
    return <span className={classes}>{content}</span>;
  }
  return (
    <a
      href={buildWhatsappLink(webEnv.bismarkWhatsapp, 'Hola Bismark, quiero mi propia página de rifas.')}
      target="_blank"
      rel="noopener noreferrer"
      className={classes}
    >
      {content}
    </a>
  );
}
