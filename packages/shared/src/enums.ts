// Enums espejo del schema Prisma. Mantener sincronizados.

export const UserRole = {
  VISITOR: 'VISITOR',
  RIFERO: 'RIFERO',
  SELLER: 'SELLER',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// Etiquetas para los roles del panel (solo los que se asignan a staff).
export const STAFF_ROLE_LABELS: Record<'RIFERO' | 'SELLER', string> = {
  RIFERO: 'Administrador',
  SELLER: 'Vendedor',
};

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const RiferoStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING: 'PENDING',
  DELETED: 'DELETED',
} as const;
export type RiferoStatus = (typeof RiferoStatus)[keyof typeof RiferoStatus];

export const PlanStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type PlanStatus = (typeof PlanStatus)[keyof typeof PlanStatus];

export const SubscriptionStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const RaffleStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED',
} as const;
export type RaffleStatus = (typeof RaffleStatus)[keyof typeof RaffleStatus];

export const TicketStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  RIFERO_RESERVED: 'RIFERO_RESERVED',
  CANCELLED: 'CANCELLED',
  WINNER: 'WINNER',
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const OrderStatus = {
  PENDING: 'PENDING',
  RESERVED: 'RESERVED',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentMethod = {
  TRANSFER: 'TRANSFER',
  DEPOSIT: 'DEPOSIT',
  OTHER: 'OTHER',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentProofStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type PaymentProofStatus = (typeof PaymentProofStatus)[keyof typeof PaymentProofStatus];

// Etiquetas en español para UI
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  AVAILABLE: 'Disponible',
  RESERVED: 'Apartado',
  PENDING_PAYMENT: 'Pendiente de pago',
  PAID: 'Pagado',
  RIFERO_RESERVED: 'Reservado',
  CANCELLED: 'Cancelado',
  WINNER: 'Ganador',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  RESERVED: 'Apartada',
  PAID: 'Pagada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Expirada',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  PENDING: 'Pendiente de activación',
  ACTIVE: 'Activo',
  EXPIRED: 'Vencido',
  SUSPENDED: 'Suspendido',
  CANCELLED: 'Cancelado',
};

export const RAFFLE_STATUS_LABELS: Record<RaffleStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicada',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada',
};

// Colores por estado de boleto (hex) para TicketGrid
export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  AVAILABLE: '#22c55e', // verde
  RESERVED: '#eab308', // amarillo
  PENDING_PAYMENT: '#f97316', // naranja
  PAID: '#3b82f6', // azul
  RIFERO_RESERVED: '#111827', // negro
  CANCELLED: '#9ca3af', // gris
  WINNER: '#d4af37', // dorado
};
