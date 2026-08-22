import { useEffect } from 'react';

// Aplica los colores de marca del rifero como variables CSS en un contenedor.
// Las páginas públicas del rifero usan estos colores para sentirse "propias".
export function RiferoTheme({
  primaryColor,
  secondaryColor,
  children,
}: {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    if (primaryColor) root.style.setProperty('--rifero-primary', primaryColor);
    if (secondaryColor) root.style.setProperty('--rifero-secondary', secondaryColor);

    // La franja de arriba del teléfono (hora, señal, batería) la pinta el
    // NAVEGADOR, no la página. Safari en iPhone la tiñe con el color de fondo
    // del <body>; <meta theme-color> por sí solo NO basta (se comprobó en el
    // sitio en vivo: el theme-color era correcto y la franja seguía blanca).
    // Por eso se pintan los tres: la etiqueta, el <html> y el <body>.
    // El contenido va sobre un contenedor con `min-h-screen bg-background`, así
    // que este color solo asoma donde debe: detrás de la barra de estado y en el
    // "rebote" al arrastrar la página.
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevTheme = meta?.getAttribute('content') ?? null;
    const prevRootBg = root.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;
    if (primaryColor) {
      meta?.setAttribute('content', primaryColor);
      root.style.backgroundColor = primaryColor;
      document.body.style.backgroundColor = primaryColor;
    }

    return () => {
      root.style.removeProperty('--rifero-primary');
      root.style.removeProperty('--rifero-secondary');
      if (prevTheme !== null) meta?.setAttribute('content', prevTheme);
      root.style.backgroundColor = prevRootBg;
      document.body.style.backgroundColor = prevBodyBg;
    };
  }, [primaryColor, secondaryColor]);

  return (
    <div
      style={
        {
          '--rifero-primary': primaryColor ?? '#1A4DFF',
          '--rifero-secondary': secondaryColor ?? '#0f172a',
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
