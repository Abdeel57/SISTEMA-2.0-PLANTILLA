import { ArrowRight } from 'lucide-react';
import { BRAND, buildWhatsappLink } from '@bismark/shared';
import { webEnv } from '@/lib/env';
import { LogoMark } from './LogoMark';
import { cn } from '@/lib/cn';

// Cierre de marca a todo el ancho para el final de las páginas públicas:
// "Desarrollado por Sortea". El botón abre el WhatsApp de Sortea (configurable
// con VITE_BISMARK_WHATSAPP) para quien quiera su propia página de rifas.
export function BismarkCta({ className }: { className?: string }) {
  const whatsappHref = webEnv.bismarkWhatsapp
    ? buildWhatsappLink(webEnv.bismarkWhatsapp, '¡Hola *Sortea*! 👋 Quiero mi propia página de rifas como esta. 🎟️')
    : null;

  return (
    <section
      className={cn(
        'relative isolate w-full overflow-hidden border-t border-white/10 bg-brand-dark px-6 py-12 text-center',
        className,
      )}
    >
      {/* Degradado de marca Sortea: brillo azul a la izquierda, magenta a la derecha */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-50"
        style={{
          background:
            'radial-gradient(50% 80% at 22% 100%, rgba(34,53,249,0.40), transparent 70%), radial-gradient(50% 80% at 80% 100%, rgba(202,22,196,0.34), transparent 72%)',
        }}
      />

      <div className="mx-auto max-w-md">
        {/* Logo + nombre de marca */}
        <div className="mb-3 inline-flex items-center gap-2">
          <LogoMark variant="white" className="h-7 w-7" />
          <span className="font-display text-lg font-bold uppercase tracking-[0.22em] text-white">SORTEA</span>
        </div>

        <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
          Sitio desarrollado por Sortea
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-white/55">
          ¿Quieres tu propia página de rifas como esta? Escríbenos.
        </p>

        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:border-white/40 hover:bg-white/20"
          >
            Contactar por WhatsApp
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        )}

        <p className="mt-6 font-ticket text-[10px] uppercase tracking-[0.3em] text-white/30">
          {BRAND.poweredBy}
        </p>
      </div>
    </section>
  );
}
