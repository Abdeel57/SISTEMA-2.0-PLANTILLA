// Tema activo de la app (single-tenant). El tema NO es una preferencia del
// navegador ni del sistema: lo decide el contexto y lo aplica <ThemeController>.
//   - Administrador (/admin, /login): siempre claro.
//   - Páginas públicas: lo elige el rifero (publicDarkMode); por defecto claro.
// La clase `dark` activa los tokens de color oscuros de index.css (darkMode:'class').
const LIGHT_THEME_COLOR = '#1d4ed8';

// Color de la barra del navegador para el PANEL (siempre la marca del producto).
export const ADMIN_THEME_COLOR = LIGHT_THEME_COLOR;

// `themeColor` es opcional a propósito: en las páginas públicas lo fija el color
// del rifero (ver RiferoTheme) y aquí NO se toca, para no pisarlo al navegar.
export function applyTheme(dark: boolean, themeColor?: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', dark);
  if (!themeColor) return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', themeColor);
}
