// Motor de precios por cantidad (promociones de volumen).
//
// Dos mecánicas, combinables, en una misma rifa:
//  - NIVELES por umbral (tiers): "a partir de `minQty` boletos, cada boleto cuesta
//    `unitPrice`". Aplica a TODO el pedido (all-units): al llegar a 30, los 30
//    boletos cuestan el precio del nivel.
//  - PAQUETES exactos (bundles): "`qty` boletos por `price`" (precio total).
//
// El total del pedido es SIEMPRE el más barato posible combinando ambas reglas.
// Esta misma función la usan el frontend (mostrar) y el backend (cobrar), para
// que el total no se pueda manipular desde el navegador.

export interface PriceTier {
  minQty: number; // a partir de esta cantidad de boletos
  unitPrice: number; // precio por boleto (aplica a todo el pedido)
}

export interface PriceBundle {
  qty: number; // cantidad exacta del paquete
  price: number; // precio total del paquete
}

export interface PricingConfig {
  basePrice: number;
  tiers?: PriceTier[];
  bundles?: PriceBundle[];
}

export interface PriceResult {
  count: number;
  total: number; // total a pagar (el más barato posible)
  baseTotal: number; // count * basePrice (sin promociones)
  savings: number; // baseTotal - total
  unitEffective: number; // total / count (puede ser fraccionario)
}

function cleanTiers(tiers: PriceTier[] | undefined): PriceTier[] {
  return (tiers ?? [])
    .filter(
      (t) => !!t && Number.isFinite(t.minQty) && Number.isFinite(t.unitPrice) && t.minQty >= 1 && t.unitPrice >= 0,
    )
    .sort((a, b) => a.minQty - b.minQty);
}

function cleanBundles(bundles: PriceBundle[] | undefined): PriceBundle[] {
  return (bundles ?? [])
    .filter((b) => !!b && Number.isFinite(b.qty) && Number.isFinite(b.price) && b.qty >= 1 && b.price >= 0)
    .sort((a, b) => a.qty - b.qty);
}

// Precio por boleto del pedido completo según los niveles (all-units): el menor
// entre el precio base y el de los niveles cuyo umbral ya se alcanzó.
export function tierUnitPrice(count: number, basePrice: number, tiers?: PriceTier[]): number {
  let unit = basePrice;
  for (const t of cleanTiers(tiers)) {
    if (count >= t.minQty && t.unitPrice < unit) unit = t.unitPrice;
  }
  return unit;
}

// Total más barato para `count` boletos combinando boletos sueltos (al precio
// del nivel alcanzado) con paquetes exactos. Programación dinámica O(count·bundles).
export function computeOrderPrice(count: number, cfg: PricingConfig): PriceResult {
  const basePrice = Math.max(0, cfg.basePrice);
  const n = Math.max(0, Math.floor(count));
  const baseTotal = n * basePrice;
  if (n === 0) return { count: 0, total: 0, baseTotal: 0, savings: 0, unitEffective: 0 };

  const tiers = cleanTiers(cfg.tiers);
  const bundles = cleanBundles(cfg.bundles);
  const unit = tierUnitPrice(n, basePrice, tiers);

  const cost = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY);
  cost[0] = 0;
  for (let k = 1; k <= n; k++) {
    let best = cost[k - 1] + unit; // un boleto suelto más
    for (const b of bundles) {
      if (b.qty <= k) {
        const c = cost[k - b.qty] + b.price;
        if (c < best) best = c;
      }
    }
    cost[k] = best;
  }

  const total = Math.min(cost[n], baseTotal);
  return {
    count: n,
    total,
    baseTotal,
    savings: Math.max(0, baseTotal - total),
    unitEffective: total / n,
  };
}

// Empujón para el comprador: la cantidad-objetivo más cercana ARRIBA de `count`
// que abarata el precio por boleto (un nivel o un paquete). Para mensajes como
// "agrega 1 más y los 3 boletos te salen en $25".
export interface DealHint {
  atQty: number; // cantidad a la que conviene llegar
  addQty: number; // cuántos faltan desde count
  newTotal: number; // total en esa cantidad
  newUnit: number; // precio por boleto efectivo en esa cantidad
}

export function nextDealHint(count: number, cfg: PricingConfig): DealHint | null {
  const tiers = cleanTiers(cfg.tiers);
  const bundles = cleanBundles(cfg.bundles);
  if (tiers.length === 0 && bundles.length === 0) return null;

  const current = computeOrderPrice(Math.max(1, count), cfg).unitEffective;
  const candidates = new Set<number>();
  for (const t of tiers) if (t.minQty > count) candidates.add(t.minQty);
  for (const b of bundles) {
    if (b.qty > count) candidates.add(b.qty);
    // siguiente múltiplo del paquete por encima de count (p. ej. de 4 → 6 con paquetes de 3)
    const mult = Math.ceil((count + 1) / b.qty) * b.qty;
    if (mult > count) candidates.add(mult);
  }

  for (const q of [...candidates].sort((a, b) => a - b)) {
    const r = computeOrderPrice(q, cfg);
    if (r.unitEffective < current - 1e-9) {
      return { atQty: q, addQty: q - count, newTotal: r.total, newUnit: r.unitEffective };
    }
  }
  return null;
}
