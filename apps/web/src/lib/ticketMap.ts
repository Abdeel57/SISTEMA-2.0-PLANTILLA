// Modelo en memoria del mapa compacto de boletos (hasta 1,000,000 por rifa).
//
// La API ya no manda un objeto por boleto: manda un string con un carácter por
// boleto (ver TICKET_MAP_CHAR en @bismark/shared). Aquí lo convertimos a un
// Uint8Array (1 byte por boleto ≈ 1 MB para 1M) y todo lo demás —número,
// displayNumber, filtros, búsqueda, maquinita— se deriva de índices, sin crear
// jamás un array de 1M de objetos.

import {
  TicketStatus,
  TICKET_MAP_CHAR,
  TICKET_STATUS_BY_CHAR,
  formatTicketNumber,
  type TicketMapDTO,
} from '@bismark/shared';

export interface TicketMapData {
  start: number;
  total: number;
  format: number;
  statuses: Uint8Array; // charCode del estado por índice (número - start)
  version: number; // cambia con cada parche en vivo (para invalidar memos)
}

const AVAILABLE_CODE = TICKET_MAP_CHAR.AVAILABLE.charCodeAt(0);

// charCode -> TicketStatus para lookups O(1).
const STATUS_BY_CODE: Record<number, TicketStatus> = {};
for (const [ch, status] of Object.entries(TICKET_STATUS_BY_CHAR)) {
  STATUS_BY_CODE[ch.charCodeAt(0)] = status;
}

export function decodeTicketMap(dto: TicketMapDTO): TicketMapData {
  const statuses = new Uint8Array(dto.total);
  for (let i = 0; i < dto.total; i++) statuses[i] = dto.map.charCodeAt(i);
  return { start: dto.start, total: dto.total, format: dto.format, statuses, version: 0 };
}

export function statusAt(map: TicketMapData, index: number): TicketStatus {
  return STATUS_BY_CODE[map.statuses[index]!] ?? TicketStatus.AVAILABLE;
}

// Estado de un boleto por su NÚMERO (no índice). undefined si está fuera de rango.
export function statusOfNumber(map: TicketMapData, n: number): TicketStatus | undefined {
  const idx = n - map.start;
  if (idx < 0 || idx >= map.total) return undefined;
  return statusAt(map, idx);
}

export function displayAt(map: TicketMapData, index: number): string {
  return formatTicketNumber(map.start + index, map.format);
}

export function displayOfNumber(map: TicketMapData, n: number): string {
  return formatTicketNumber(n, map.format);
}

// Aplica cambios incrementales (polling en vivo). Muta el Uint8Array y devuelve
// un objeto nuevo con version+1 para que React re-renderice.
export function applyTicketChanges(
  map: TicketMapData,
  items: { number: number; status: TicketStatus }[],
): TicketMapData {
  for (const it of items) {
    const idx = it.number - map.start;
    if (idx >= 0 && idx < map.total) {
      map.statuses[idx] = TICKET_MAP_CHAR[it.status].charCodeAt(0);
    }
  }
  return { ...map, version: map.version + 1 };
}

export function countAvailable(map: TicketMapData): number {
  let count = 0;
  const s = map.statuses;
  for (let i = 0; i < s.length; i++) if (s[i] === AVAILABLE_CODE) count++;
  return count;
}

// Índices (no números) que pasan el filtro de estado y/o la búsqueda de texto.
// null = "todos" (sin filtrar), para no materializar un array de 1M entradas.
export function filterIndices(
  map: TicketMapData,
  filter: TicketStatus | 'all',
  search: string,
): Uint32Array | null {
  const q = search.trim();
  if (filter === 'all' && !q) return null;

  const code = filter === 'all' ? -1 : TICKET_MAP_CHAR[filter].charCodeAt(0);
  const s = map.statuses;
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (code !== -1 && s[i] !== code) continue;
    if (q) {
      const n = map.start + i;
      if (!formatTicketNumber(n, map.format).includes(q) && String(n) !== q) continue;
    }
    out.push(i);
  }
  return Uint32Array.from(out);
}

// Elige `count` boletos disponibles al azar (excluyendo los ya seleccionados).
// Una pasada para juntar candidatos + Fisher-Yates parcial: O(n + count).
export function pickRandomAvailable(
  map: TicketMapData,
  count: number,
  excluded: ReadonlySet<number>,
): number[] {
  const s = map.statuses;
  const candidates: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === AVAILABLE_CODE && !excluded.has(map.start + i)) candidates.push(map.start + i);
  }
  const n = Math.min(count, candidates.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (candidates.length - i));
    const tmp = candidates[i]!;
    candidates[i] = candidates[j]!;
    candidates[j] = tmp;
  }
  return candidates.slice(0, n);
}
