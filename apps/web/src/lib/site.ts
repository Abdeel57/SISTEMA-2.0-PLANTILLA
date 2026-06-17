// Single-tenant: el perfil del rifero ES la página principal del sitio.
// Las URLs públicas se construyen desde el origen actual.
export function buildRiferoUrl(_slug?: string): string {
  return window.location.origin;
}

export function buildRaffleUrl(_slug: string, eventNumber: number): string {
  return `${window.location.origin}/e${eventNumber}`;
}

// Link de venta de un vendedor para UNA rifa: /eN/CODE. El comprador que entra
// por aquí queda atribuido a ese vendedor al apartar.
export function buildSellerRaffleUrl(eventNumber: number, sellerCode: string): string {
  return `${window.location.origin}/e${eventNumber}/${sellerCode}`;
}

// Link de venta general del vendedor (a la página principal del rifero). Sirve
// cuando aún no se decide la rifa; la referencia se conserva durante la sesión.
export function buildSellerHomeUrl(sellerCode: string): string {
  return `${window.location.origin}/?ref=${encodeURIComponent(sellerCode)}`;
}

// URLs para COMPARTIR por WhatsApp/Facebook: pasan por /s/... (Open Graph
// dinámico del backend) para que la vista previa muestre el premio y la imagen.
// Para humanos redirigen automáticamente a la página normal.
export function buildRiferoShareUrl(slug: string): string {
  return `${window.location.origin}/s/r/${slug}`;
}

export function buildRaffleShareUrl(slug: string, eventNumber: number): string {
  return `${window.location.origin}/s/r/${slug}/e${eventNumber}`;
}
