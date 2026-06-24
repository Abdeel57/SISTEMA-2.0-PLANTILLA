import { apiFetch, apiUpload } from '@/lib/api';
import type {
  PublicRiferoDTO,
  PublicRaffleDTO,
  TicketMapDTO,
  ValidationResultDTO,
  DigitalTicketDTO,
  PaymentProofDTO,
  PaymentMethodDTO,
  OrderStatus,
} from '@bismark/shared';

// Resultado de "Verificar boletos" (búsqueda por teléfono dentro de un rifero).
export interface PublicOrderLookupItem {
  code: string;
  raffleTitle: string;
  eventLabel: string;
  eventNumber: number;
  ticketNumbers: string[];
  totalAmount: number;
  status: OrderStatus;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  hasProof: boolean;
  digitalTicketCode: string | null; // sólo presente si la orden está PAGADA
}
export interface PublicPaymentProfile {
  holderName: string | null;
  bank: string | null;
  clabe: string | null;
  cardNumber: string | null;
  concept: string | null;
  instructions: string | null;
  whatsapp: string | null;
  methods?: PaymentMethodDTO[];
}
export interface PublicOrderLookupResult {
  // ¿El sitio recibe comprobantes en la plataforma? Si es false, en lugar de
  // "Subir comprobante" se ofrece enviar el pago por WhatsApp al rifero.
  allowProofUpload: boolean;
  orders: PublicOrderLookupItem[];
  paymentProfile: PublicPaymentProfile | null;
}

// Ganador publicado mostrado en el perfil del rifero (sin datos del comprador).
export interface PublicRiferoWinner {
  id: string;
  raffleTitle: string;
  eventLabel: string;
  position: number;
  ticketDisplayNumber: string;
  prizeDescription: string | null;
  evidenceUrl: string | null;
}

export const publicService = {
  riferoBySubdomain: (subdomain: string) =>
    apiFetch<{ active: boolean; rifero?: PublicRiferoDTO; publicName?: string; winners?: PublicRiferoWinner[] }>(
      `/public/riferos/by-subdomain/${encodeURIComponent(subdomain)}`,
    ),
  raffleByEvent: (subdomain: string, eventNumber: number | string) =>
    apiFetch<{ active: boolean; raffle?: PublicRaffleDTO }>(
      `/public/raffles/by-event/${encodeURIComponent(subdomain)}/${eventNumber}`,
    ),
  // Mapa compacto de estados (1 carácter por boleto): escala a 1M de boletos.
  raffleTicketMap: (raffleId: string) =>
    apiFetch<TicketMapDTO>(`/public/raffles/${raffleId}/ticket-map`),
  digitalTicket: (code: string) => apiFetch<{ ticket: DigitalTicketDTO }>(`/tickets/digital/${code}`),
  validate: (code: string) => apiFetch<ValidationResultDTO>(`/validar/${code}`),
  // El comprador sube su comprobante de pago (por folio de la orden).
  uploadProof: (orderCode: string, file: File) =>
    apiUpload<{ proof: PaymentProofDTO }>(`/public/orders/${encodeURIComponent(orderCode)}/proof`, file),
  // El comprador busca SUS órdenes (apartadas/pagadas) por teléfono dentro del rifero.
  lookupOrders: (slug: string, phone: string) =>
    apiFetch<PublicOrderLookupResult>('/public/orders/lookup', { method: 'POST', body: { slug, phone } }),
};
