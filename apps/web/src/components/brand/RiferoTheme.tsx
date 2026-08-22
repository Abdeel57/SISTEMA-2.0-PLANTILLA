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

    // La franja de arriba del teléfono (donde va la hora y la batería) la pinta
    // el NAVEGADOR, no la página: se le indica el color con <meta theme-color>.
    // Sin esto salía blanca y rompía la cabecera de color del rifero.
    // También se tiñe el fondo del documento para que el "rebote" al arrastrar
    // la página muestre el color de la marca en vez de blanco.
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevTheme = meta?.getAttribute('content') ?? null;
    const prevBg = root.style.backgroundColor;
    if (primaryColor) {
      meta?.setAttribute('content', primaryColor);
      root.style.backgroundColor = primaryColor;
    }

    return () => {
      root.style.removeProperty('--rifero-primary');
      root.style.removeProperty('--rifero-secondary');
      if (prevTheme !== null) meta?.setAttribute('content', prevTheme);
      root.style.backgroundColor = prevBg;
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
