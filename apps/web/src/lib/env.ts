export const webEnv = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api',
  brandName: (import.meta.env.VITE_BRAND_NAME as string | undefined) || 'Sortea - Digital',
  // WhatsApp de Bismark (el desarrollador del sitio). Lo enlaza el pie de
  // página "Desarrollado por Bismark". Número con código de país, sin "+".
  bismarkWhatsapp: (import.meta.env.VITE_BISMARK_WHATSAPP as string | undefined) || '',
  // Monitoreo de errores (Sentry) y analítica (PostHog). Vacío = desactivado.
  sentryDsn: (import.meta.env.VITE_SENTRY_DSN as string | undefined) || '',
  posthogKey: (import.meta.env.VITE_POSTHOG_KEY as string | undefined) || '',
  posthogHost: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com',
  prod: import.meta.env.PROD,
};
