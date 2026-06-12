import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { ExternalLink, Copy, Globe } from 'lucide-react';
import { updateRiferoSchema } from '@bismark/shared';
import { riferoService } from '@/services/riferos';
import { useAuthStore } from '@/store/auth';
import { ApiError } from '@/lib/api';
import { PanelIntro } from '@/components/owner/PanelKit';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/misc';
import { VerifiedBadge } from '@/components/brand/VerifiedBadge';
import { toast } from 'sonner';

// Sólo los campos públicos editables en esta pantalla (el nombre se edita en Apariencia).
const profileFormSchema = updateRiferoSchema.pick({
  description: true,
  whatsapp: true,
  facebook: true,
  instagram: true,
  tiktok: true,
});
type ProfileForm = z.infer<typeof profileFormSchema>;

export default function Profile() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['rifero', 'me'],
    queryFn: () => riferoService.me(),
  });
  const profile = data?.profile;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      description: '',
      whatsapp: '',
      facebook: '',
      instagram: '',
      tiktok: '',
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        description: profile.description ?? '',
        whatsapp: profile.whatsapp ?? '',
        facebook: profile.facebook ?? '',
        instagram: profile.instagram ?? '',
        tiktok: profile.tiktok ?? '',
      });
    }
  }, [profile, reset]);

  const mutation = useMutation({
    mutationFn: (values: ProfileForm) => riferoService.update(values),
    onSuccess: (res) => {
      toast.success('Perfil actualizado');
      queryClient.setQueryData(['rifero', 'me'], res);
      void queryClient.invalidateQueries({ queryKey: ['rifero', 'me'] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Algo salió mal');
    },
  });

  const slug = user?.slug ?? profile?.slug ?? '';
  const publicUrl = `${slug || 'tuslug'}.bismark.com`;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(`https://${publicUrl}`);
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  };

  if (isLoading) return <PageLoader label="Cargando tu perfil..." />;

  return (
    <div>
      <PanelIntro description="Estos son los datos que verán tus compradores en tu página de rifas." />

      {/* Página pública + verificación */}
      <Card className="mb-5">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Tu página pública
            </CardTitle>
            {profile?.verified && (
              <Badge variant="info" className="gap-1">
                <VerifiedBadge size={14} />
                Verificado
              </Badge>
            )}
          </div>
          <CardDescription>Comparte este enlace para que la gente compre tus boletos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3.5 py-3">
            <span className="truncate text-sm font-semibold">{publicUrl}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto h-9 w-9 shrink-0"
              onClick={copyUrl}
              aria-label="Copiar enlace"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" disabled={!slug}>
              <Link to={`/r/${slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Ver mi página
              </Link>
            </Button>
            <Badge variant="muted">Tu enlace: /r/{slug || 'tuslug'}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            El nombre de tu página (tuslug) no se puede cambiar desde aquí.
          </p>
        </CardContent>
      </Card>

      {/* Formulario de datos públicos */}
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Datos públicos</CardTitle>
            <CardDescription>Nombre, descripción y formas de contacto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Cuéntale a la gente quién eres y por qué confiar en tus rifas."
                {...register('description')}
              />
              {errors.description && (
                <p className="text-destructive text-sm mt-1">{errors.description.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="whatsapp">WhatsApp de contacto</Label>
              <Input id="whatsapp" inputMode="tel" placeholder="55 1234 5678" {...register('whatsapp')} />
              {errors.whatsapp && (
                <p className="text-destructive text-sm mt-1">{errors.whatsapp.message}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Aquí te escribirán tus compradores.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Redes sociales</CardTitle>
            <CardDescription>Opcional. Pega el enlace o usuario de cada red.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="facebook">Facebook</Label>
              <Input id="facebook" placeholder="facebook.com/turifa" {...register('facebook')} />
              {errors.facebook && (
                <p className="text-destructive text-sm mt-1">{errors.facebook.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="instagram">Instagram</Label>
              <Input id="instagram" placeholder="@turifa" {...register('instagram')} />
              {errors.instagram && (
                <p className="text-destructive text-sm mt-1">{errors.instagram.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="tiktok">TikTok</Label>
              <Input id="tiktok" placeholder="@turifa" {...register('tiktok')} />
              {errors.tiktok && (
                <p className="text-destructive text-sm mt-1">{errors.tiktok.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Barra de guardar sticky: visible apenas hay cambios. */}
        <div className="sticky bottom-0 z-10 -mx-4 -mb-[max(1.25rem,env(safe-area-inset-bottom))] border-t bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-5 sm:px-5">
          {isDirty && (
            <p className="mb-2 text-center text-xs font-semibold text-amber-600 dark:text-amber-400">
              Tienes cambios sin guardar
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            variant="brand"
            className="w-full"
            loading={mutation.isPending}
            disabled={!isDirty || mutation.isPending}
          >
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  );
}
