import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  ORDER_STATUS_LABELS,
  TICKET_STATUS_LABELS,
  type MessageKey,
  type OrderStatus,
  type TicketStatus,
} from '@bismark/shared';
import { useT } from '@/store/site';

const ORDER_VARIANT: Record<OrderStatus, BadgeProps['variant']> = {
  PENDING: 'warning',
  RESERVED: 'warning',
  PAID: 'success',
  REJECTED: 'danger',
  CANCELLED: 'muted',
  EXPIRED: 'muted',
};

const TICKET_VARIANT: Record<TicketStatus, BadgeProps['variant']> = {
  AVAILABLE: 'success',
  RESERVED: 'warning',
  PENDING_PAYMENT: 'warning',
  PAID: 'info',
  RIFERO_RESERVED: 'secondary',
  CANCELLED: 'muted',
  WINNER: 'default',
};

// Claves de traducción por estado: el comprador ve este badge en su boleto.
const ORDER_KEY: Record<OrderStatus, MessageKey> = {
  PENDING: 'status.pending',
  RESERVED: 'status.reserved',
  PAID: 'status.paid',
  REJECTED: 'status.rejected',
  CANCELLED: 'status.cancelled',
  EXPIRED: 'status.expired',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tr = useT();
  return <Badge variant={ORDER_VARIANT[status]}>{tr(ORDER_KEY[status]) || ORDER_STATUS_LABELS[status]}</Badge>;
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant={TICKET_VARIANT[status]}>{TICKET_STATUS_LABELS[status]}</Badge>;
}
