import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowLeft, Ticket, Star, BadgeCheck } from 'lucide-react';
import { LogoMark } from '@/components/brand/LogoMark';

interface Props {
  children: ReactNode;
  badge: string;
  sideTitle: ReactNode;
  sideSubtitle: string;
  bullets: string[];
  /** Microetiqueta del boleto del formulario (ej. "Boleto de acceso"). */
  ticketLabel?: string;
}

// Layout de autenticación — concepto "Boleto Bismark": panel de marca en tinta
// (izq, desktop) y el formulario dentro de un boleto troquelado sobre papel azul suave.
export function AuthLayout({ children, badge, sideTitle, sideSubtitle, bullets, ticketLabel = 'Acceso Bismark' }: Props) {
  return (
    <div className="min-h-screen font-body lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Panel de marca ── */}
      <aside className="relative hidden overflow-hidden bg-brand-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Atmósfera */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-24 h-[28rem] w-[28rem] rounded-full bg-brand/30 blur-[120px]" />
          <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-brand-deep/40 blur-[110px]" />
          <div className="absolute bottom-1/3 left-1/4 h-60 w-60 rounded-full bg-brand-mint/10 blur-[90px]" />
        </div>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="grain pointer-events-none absolute inset-0 opacity-[0.15]" />
        {/* Serial decorativo */}
        <p className="pointer-events-none absolute -bottom-6 -right-4 select-none font-ticket text-[8rem] font-bold leading-none text-white/[0.04]" aria-hidden>
          Nº001
        </p>

        {/* Logo */}
        <Link to="/" className="relative z-10 flex w-fit items-center gap-2 font-display text-xl font-extrabold text-white">
          <LogoMark variant="white" className="h-8 w-8" />
          Bismark
        </Link>

        {/* Mensaje */}
        <div className="relative z-10 max-w-md">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/80 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-brand-mint" />
            {badge}
          </span>
          <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight">{sideTitle}</h2>
          <p className="mt-4 text-white/70">{sideSubtitle}</p>

          <ul className="mt-8 space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-center gap-3 text-sm text-white/85">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-mint/15 text-brand-mint">
                  <Check className="h-3 w-3" />
                </span>
                {b}
              </li>
            ))}
          </ul>

          {/* Boleto decorativo (azul eléctrico de marca) */}
          <div className="mt-10 w-fit rotate-[-3deg] animate-float-slow">
            <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-brand-electric via-brand to-brand-deep px-4 py-3 text-white shadow-[0_14px_40px_-12px_rgba(26,77,255,0.6)]">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
                <Ticket className="h-5 w-5" />
              </div>
              <div className="border-l-2 border-dashed border-white/30 pl-3">
                <p className="font-ticket text-[10px] font-bold uppercase tracking-widest text-white/65">Boleto digital</p>
                <p className="font-ticket text-base font-bold">E1 · 0427</p>
              </div>
              <BadgeCheck className="ml-1 h-4 w-4 text-brand-mint" />
            </div>
          </div>
        </div>

        {/* Pie */}
        <p className="relative z-10 flex items-center gap-2 text-xs text-white/40">
          <Star className="h-3 w-3 text-brand-mint" /> Hecho en México · Sin comisión por boleto
        </p>
      </aside>

      {/* ── Área del formulario (papel crema) ── */}
      <main className="relative flex min-h-screen flex-col bg-[#F5F7FF] dark:bg-background">
        <div className="flex items-center justify-between p-4 lg:p-5">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold lg:hidden">
            <LogoMark className="h-7 w-7" />
            Bismark
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Inicio
            </Link>
          </div>
        </div>

        <div className="flex flex-1 items-start justify-center px-4 pb-12 pt-2 sm:items-center sm:px-6">
          {/* Boleto del formulario */}
          <div className="w-full max-w-md animate-reveal">
            <div className="relative overflow-hidden rounded-3xl border border-[#E3E9F8] bg-white shadow-[0_24px_60px_-24px_rgba(13,20,43,0.25)] dark:border-border dark:bg-card">
              {/* Cabecera del boleto */}
              <div className="flex items-center justify-between px-6 pt-5 sm:px-8">
                <p className="inline-flex items-center gap-2 font-ticket text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
                  <Star className="h-3 w-3 text-brand-mint" />
                  {ticketLabel}
                </p>
                <p className="font-ticket text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
                  Nº 000001
                </p>
              </div>
              {/* Perforación con muescas */}
              <div className="relative mt-4">
                <div className="border-t-2 border-dashed border-[#E3E9F8] dark:border-border" />
                <span className="absolute -left-3.5 -top-3.5 h-7 w-7 rounded-full bg-[#F5F7FF] dark:bg-background" aria-hidden />
                <span className="absolute -right-3.5 -top-3.5 h-7 w-7 rounded-full bg-[#F5F7FF] dark:bg-background" aria-hidden />
              </div>

              <div className="px-6 py-7 sm:px-8 sm:py-8">{children}</div>
            </div>

            <p className="mt-5 text-center font-ticket text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/50">
              ★ Datos protegidos · Sin tarjeta ★
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
