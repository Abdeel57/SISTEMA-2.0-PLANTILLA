import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import {
  ExternalLink,
  Copy,
  Globe,
  HelpCircle,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { updateRiferoSchema, DEFAULT_FAQS, type FaqItemDTO, type RiferoProfileDTO } from '@bismark/shared';
import { riferoService } from '@/services/riferos';
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

  // Single-tenant: la página pública del rifero es la raíz del propio dominio.
  const publicUrl = window.location.origin.replace(/^https?:\/\//, '');

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
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
            <Button asChild variant="outline" size="sm">
              <Link to="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Ver mi página
              </Link>
            </Button>
          </div>
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

      {/* Preguntas frecuentes (sección independiente con su propio guardar) */}
      {profile && <FaqEditor profile={profile} />}
    </div>
  );
}

// ── Editor de preguntas frecuentes ───────────────────────────
// Las preguntas de la sección "Preguntas frecuentes" de la página pública.
// Mientras el rifero no guarde las suyas se muestran las de fábrica
// (DEFAULT_FAQS), que también precargan este editor como punto de partida.
function FaqEditor({ profile }: { profile: RiferoProfileDTO }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<FaqItemDTO[]>(() =>
    profile.faqs.length > 0 ? profile.faqs.map((f) => ({ ...f })) : DEFAULT_FAQS.map((f) => ({ ...f })),
  );
  const [dirty, setDirty] = useState(false);

  const save = useMutation({
    mutationFn: (faqs: FaqItemDTO[]) => riferoService.update({ faqs }),
    onSuccess: (res) => {
      toast.success('Preguntas frecuentes guardadas');
      queryClient.setQueryData(['rifero', 'me'], res);
      void queryClient.invalidateQueries({ queryKey: ['rifero', 'me'] });
      setDirty(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudieron guardar las preguntas'),
  });

  const update = (i: number, patch: Partial<FaqItemDTO>) => {
    setItems((cur) => cur.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
    setDirty(true);
  };
  const remove = (i: number) => {
    setItems((cur) => cur.filter((_, idx) => idx !== i));
    setDirty(true);
  };
  const move = (i: number, dir: -1 | 1) => {
    setItems((cur) => {
      const next = [...cur];
      const j = i + dir;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
    setDirty(true);
  };
  const add = () => {
    setItems((cur) => [...cur, { q: '', a: '' }]);
    setDirty(true);
  };
  const restoreDefaults = () => {
    setItems(DEFAULT_FAQS.map((f) => ({ ...f })));
    setDirty(true);
  };

  const invalid = items.some((f) => f.q.trim().length < 3 || f.a.trim().length < 3);

  const submit = () => {
    if (invalid) {
      toast.error('Completa la pregunta y la respuesta de cada elemento (o elimínalo).');
      return;
    }
    save.mutate(items.map((f) => ({ q: f.q.trim(), a: f.a.trim() })));
  };

  return (
    <Card className="mb-5 mt-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          Preguntas frecuentes
        </CardTitle>
        <CardDescription>
          Las preguntas que aparecen al final de tu página pública. Puedes editarlas, reordenarlas o agregar
          nuevas (máximo 10).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Sin preguntas propias: tu página mostrará las preguntas de fábrica.
          </p>
        )}
        {items.map((f, i) => (
          <div key={i} className="rounded-xl border p-3.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-ticket text-xs font-bold text-muted-foreground">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Subir"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  aria-label="Bajar"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => remove(i)}
                  aria-label="Eliminar pregunta"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <Label htmlFor={`faq-q-${i}`}>Pregunta</Label>
                <Input
                  id={`faq-q-${i}`}
                  value={f.q}
                  maxLength={120}
                  placeholder="¿Cómo participo?"
                  onChange={(e) => update(i, { q: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`faq-a-${i}`}>Respuesta</Label>
                <Textarea
                  id={`faq-a-${i}`}
                  rows={2}
                  value={f.a}
                  maxLength={600}
                  placeholder="Explica el paso a paso con tus palabras."
                  onChange={(e) => update(i, { a: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={add} disabled={items.length >= 10}>
            <Plus className="h-4 w-4" />
            Agregar pregunta
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={restoreDefaults}>
            <RotateCcw className="h-4 w-4" />
            Restaurar predeterminadas
          </Button>
        </div>

        <Button
          type="button"
          size="lg"
          variant="brand"
          className="w-full"
          loading={save.isPending}
          disabled={!dirty || save.isPending}
          onClick={submit}
        >
          Guardar preguntas
        </Button>
      </CardContent>
    </Card>
  );
}
