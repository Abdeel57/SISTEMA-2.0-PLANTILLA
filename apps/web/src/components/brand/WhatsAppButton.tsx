import { MessageCircle } from 'lucide-react';
import { buildWhatsappLink } from '@bismark/shared';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface Props extends Omit<ButtonProps, 'asChild'> {
  phone: string;
  message: string;
  label?: string;
  // Lada del número (52 México por defecto, 1 USA). Para contactar compradores
  // con número de otro país y que el enlace de WhatsApp abra correctamente.
  dialCode?: string;
}

export function WhatsAppButton({ phone, message, label = 'WhatsApp', dialCode, className, ...props }: Props) {
  if (!phone) return null;
  return (
    <Button asChild className={cn('bg-emerald-600 text-white hover:bg-emerald-700', className)} {...props}>
      <a href={buildWhatsappLink(phone, message, dialCode)} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="h-5 w-5" />
        {label}
      </a>
    </Button>
  );
}
