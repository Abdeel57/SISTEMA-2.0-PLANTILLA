import { useMemo } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { riferoService } from '@/services/riferos';
import { raffleService } from '@/services/raffles';
import { PageLoader } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import PublicRifero from '@/pages/public/PublicRifero';

// Shell del administrador (/admin): renderiza la página pública del dueño como
// fondo (visible en escritorio detrás del drawer) y el administrador encima.
export function OwnerShell() {
  const profileQ = useQuery({ queryKey: ['rifero', 'me'], queryFn: () => riferoService.me() });
  const rafflesQ = useQuery({ queryKey: ['raffles'], queryFn: () => raffleService.list() });

  const profile = profileQ.data?.profile;
  const raffles = useMemo(() => rafflesQ.data?.items ?? [], [rafflesQ.data]);

  // Construye los MISMOS datos que consume la página pública (PublicRifero),
  // pero a partir de los datos del dueño → vista previa siempre fiel.
  const previewData = useMemo(() => {
    if (!profile) return undefined;
    return {
      active: true,
      rifero: {
        id: profile.id,
        publicName: profile.publicName,
        slug: profile.slug,
        logoUrl: profile.logoUrl,
        coverUrl: profile.coverUrl,
        description: profile.description,
        whatsapp: profile.whatsapp,
        facebook: profile.facebook,
        instagram: profile.instagram,
        tiktok: profile.tiktok,
        primaryColor: profile.primaryColor,
        secondaryColor: profile.secondaryColor,
        templateKey: profile.templateKey,
        logoScale: profile.logoScale,
        logoGlow: profile.logoGlow,
        verified: profile.verified,
        faqs: profile.faqs,
        raffles: raffles.map((r) => ({
          id: r.id,
          eventNumber: r.eventNumber,
          eventLabel: r.eventLabel,
          title: r.title,
          prize: r.prize,
          ticketPrice: r.ticketPrice,
          totalTickets: r.totalTickets,
          soldCount: r.soldCount,
          coverUrl: r.images[0]?.url ?? null,
          status: r.status,
          drawDate: r.drawDate,
        })),
      },
      winners: [],
    };
  }, [profile, raffles]);

  if (profileQ.isLoading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center">
        <PageLoader label="Cargando tu página..." />
      </div>
    );
  }

  if (profileQ.isError || !profile || !previewData) {
    return (
      <div className="grid min-h-[100dvh] place-items-center px-6 text-center">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-bold">No pudimos cargar tu página</h1>
          <p className="mt-2 text-muted-foreground">
            Revisa tu conexión a internet e inténtalo de nuevo.
          </p>
          <Button
            className="mt-6 w-full"
            size="lg"
            loading={profileQ.isFetching}
            onClick={() => void profileQ.refetch()}
          >
            Reintentar
          </Button>
          <Button asChild variant="ghost" className="mt-2 w-full" size="lg">
            <Link to="/login">Volver a iniciar sesión</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PublicRifero previewData={previewData} />
      <Outlet />
    </>
  );
}
