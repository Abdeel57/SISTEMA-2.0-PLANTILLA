// ── Idioma y moneda del sitio ("Modo USA") ───────────────────────────────────
// El rifero elige, desde el panel, el idioma de TODO lo que ve el comprador
// (página pública, boleto digital, WhatsApp y correos) y la moneda en la que
// cobra. El panel del rifero se queda en español a propósito.
//
// Un diccionario plano ES/EN, sin librería de i18n: la app tiene un puñado de
// pantallas públicas y esto evita sumar dependencias y peso al bundle.
// Interpolación con {llaves}: translate('en', 'raffle.youSave', { amount: '$20' }).

export type Locale = 'es' | 'en';
export type Currency = 'MXN' | 'USD';

export const LOCALES: readonly Locale[] = ['es', 'en'];
export const CURRENCIES: readonly Currency[] = ['MXN', 'USD'];

export function isLocale(v: unknown): v is Locale {
  return v === 'es' || v === 'en';
}
export function isCurrency(v: unknown): v is Currency {
  return v === 'MXN' || v === 'USD';
}

// Etiqueta BCP-47 para Intl (fechas y dinero).
export function intlLocale(locale: Locale): string {
  return locale === 'en' ? 'en-US' : 'es-MX';
}

interface Entry {
  es: string;
  en: string;
}

// En inglés se usa "giveaway" en vez de "raffle": en Estados Unidos la palabra
// raffle está regulada como juego de azar en varios estados, y giveaway es el
// término que usan los organizadores.
export const MESSAGES = {
  // ── Comunes ──
  'common.copy': { es: 'Copiar', en: 'Copy' },
  'common.copied': { es: '{label} copiado', en: '{label} copied' },
  'common.copyFailed': { es: 'No se pudo copiar', en: "Couldn't copy" },
  'common.close': { es: 'Cerrar', en: 'Close' },
  'common.goHome': { es: 'Ir al inicio', en: 'Go to home' },
  'common.loading': { es: 'Cargando', en: 'Loading' },
  'common.ticket': { es: 'boleto', en: 'ticket' },
  'common.tickets': { es: 'boletos', en: 'tickets' },
  'common.order': { es: 'orden', en: 'order' },
  'common.orders': { es: 'órdenes', en: 'orders' },
  'common.day': { es: 'día', en: 'day' },
  'common.days': { es: 'días', en: 'days' },

  // ── Cintillo superior (dos líneas por botón) ──
  'bar.pay.l1': { es: 'Métodos', en: 'Payment' },
  'bar.pay.l2': { es: 'de pago', en: 'methods' },
  'bar.upload.l1': { es: 'Sube tu', en: 'Upload your' },
  'bar.upload.l2': { es: 'pago aquí', en: 'payment here' },
  'bar.verify.l1': { es: 'Verifica tu', en: 'Verify your' },
  'bar.verify.l2': { es: 'boleto', en: 'ticket' },
  'bar.back.l1': { es: 'Regresar', en: 'Back to' },
  'bar.back.l2': { es: 'a comprar', en: 'buying' },
  'bar.send.l1': { es: 'Envía tu', en: 'Send your' },
  'bar.send.l2': { es: 'pago', en: 'payment' },

  // ── Página de la rifa ──
  'raffle.unavailable.title': { es: 'Rifa no disponible', en: 'Giveaway unavailable' },
  'raffle.unavailable.body': {
    es: 'Esta rifa no existe o ya no está disponible. Revisa el enlace o vuelve a la página del rifero.',
    en: "This giveaway doesn't exist or is no longer available. Check the link or go back to the organizer's page.",
  },
  'raffle.ticketsBelow': { es: 'Lista de boletos abajo', en: 'Ticket list below' },
  'raffle.prices': { es: 'Precios', en: 'Prices' },
  'raffle.pickTickets': { es: 'Elegir mis boletos', en: 'Pick my tickets' },
  'raffle.ticketFor': { es: 'boleto por', en: 'ticket for' },
  'raffle.ticketsFor': { es: 'boletos por', en: 'tickets for' },
  'raffle.bundle': { es: '{qty} boletos por {price}', en: '{qty} tickets for {price}' },
  'raffle.tier': { es: 'Desde {qty}: {price} c/u', en: 'From {qty}: {price} each' },
  'raffle.tapYourNumber': {
    es: 'Haz click abajo en tu número de la suerte',
    en: 'Tap your lucky number below',
  },
  'raffle.letMachinePick': {
    es: 'Deja que la maquinita elija tus números de la suerte',
    en: 'Let the lucky machine pick your numbers',
  },
  'raffle.goToNumber': { es: 'Ir a mi número', en: 'Go to my number' },
  'raffle.winners': { es: 'Ganadores', en: 'Winners' },
  'raffle.winningTicket': { es: 'Boleto ganador', en: 'Winning ticket' },
  'raffle.terms': { es: 'Términos y condiciones', en: 'Terms and conditions' },
  'raffle.whatsappQuestions': { es: 'Preguntas al WhatsApp', en: 'Questions on WhatsApp' },
  'raffle.attendedBy': { es: 'Te atiende {name}', en: '{name} is here to help' },
  'raffle.reserve': { es: 'Apartar', en: 'Reserve' },
  'raffle.youSave': { es: '¡Ahorras {amount}!', en: 'You save {amount}!' },
  'raffle.giftTickets': { es: '🎁 +{count} {noun} de regalo', en: '🎁 +{count} free {noun}' },
  'raffle.dealHint': {
    es: 'Agrega {add} más y {at} boletos te salen en {total}',
    en: 'Add {add} more and get {at} tickets for {total}',
  },
  'raffle.removeHint': { es: 'Para eliminar, toca el boleto', en: 'Tap a ticket to remove it' },
  'raffle.clearAll': { es: 'Limpiar todo', en: 'Clear all' },
  'raffle.removeTicket': { es: 'Quitar boleto', en: 'Remove ticket' },
  'raffle.comingSoonTitle': { es: 'Muy pronto', en: 'Coming soon' },
  'raffle.comingSoonBody': {
    es: 'Esta rifa todavía no está a la venta. Guarda la página: aquí mismo podrás apartar tus boletos en cuanto abra.',
    en: "This giveaway isn't on sale yet. Save this page — you'll be able to reserve your tickets here as soon as it opens.",
  },
  'raffle.comingSoonDate': { es: 'Sorteo previsto', en: 'Expected draw' },
  'raffle.comingSoonNotify': { es: 'Avísame cuando abra', en: 'Notify me when it opens' },
  'raffle.comingSoonWa': {
    es: '¡Hola! 👋\n\nMe interesa la rifa *{title}*. ¿Me avisas cuando abra la venta de boletos? 🎟️',
    en: 'Hi! 👋\n\nI am interested in the *{title}* giveaway. Can you let me know when tickets go on sale? 🎟️',
  },
  'raffle.reserveFailed': {
    es: 'No se pudo apartar. Intenta de nuevo.',
    en: "Couldn't reserve. Please try again.",
  },

  // ── Métodos de pago (diálogo) ──
  'pay.title': { es: 'Métodos de pago', en: 'Payment methods' },
  'pay.desc': {
    es: 'Realiza tu pago a estos datos y guarda tu comprobante para confirmarlo.',
    en: 'Send your payment to these details and keep your receipt to confirm it.',
  },
  'pay.none': {
    es: 'Este rifero aún no publicó sus métodos de pago. Contáctalo por WhatsApp para saber cómo pagar.',
    en: "This organizer hasn't published payment details yet. Message them on WhatsApp to find out how to pay.",
  },
  'pay.descVerify': {
    es: 'Paga a estos datos y sube tu comprobante desde tu orden.',
    en: 'Send your payment to these details and upload your receipt from your order.',
  },
  'pay.searchFirst': {
    es: 'Busca tus boletos con tu teléfono para ver los datos de pago, o contacta al rifero por WhatsApp.',
    en: 'Look up your tickets with your phone to see the payment details, or message the organizer on WhatsApp.',
  },
  'pay.ask': { es: 'Preguntar por WhatsApp', en: 'Ask on WhatsApp' },
  'pay.askTo': { es: 'Preguntar a {name}', en: 'Ask {name}' },
  'pay.holder': { es: 'Titular', en: 'Account holder' },
  'pay.bank': { es: 'Banco', en: 'Bank' },
  'pay.clabe': { es: 'CLABE', en: 'CLABE' },
  'pay.card': { es: 'Tarjeta', en: 'Card' },
  'pay.concept': { es: 'Concepto', en: 'Reference' },
  'pay.instructions': { es: 'Instrucciones', en: 'Instructions' },

  // ── Formulario del comprador ──
  'buyer.title': {
    es: 'Llena tus datos y da click en apartar',
    en: 'Fill in your details and tap reserve',
  },
  'buyer.desc': {
    es: 'Completa tus datos para apartar tus boletos.',
    en: 'Complete your details to reserve your tickets.',
  },
  'buyer.phoneCountry': { es: 'País del teléfono', en: 'Phone country' },
  'buyer.whatsapp': { es: 'WhatsApp (10 dígitos)', en: 'WhatsApp (10 digits)' },
  'buyer.firstName': { es: 'Nombre(s)', en: 'First name' },
  'buyer.lastName': { es: 'Apellidos (opcional)', en: 'Last name (optional)' },
  'buyer.selectState': { es: 'Selecciona estado', en: 'Select state' },
  'buyer.selectStateUsa': { es: 'Selecciona estado (USA)', en: 'Select state (USA)' },
  'buyer.errWhatsapp': { es: 'Escribe tu WhatsApp (10 dígitos)', en: 'Enter your WhatsApp (10 digits)' },
  'buyer.errFirstName': { es: 'Escribe tu(s) nombre(s)', en: 'Enter your first name' },
  'buyer.afterUpload': {
    es: '¡Al apartar podrás subir el comprobante de pago de tu boleto!',
    en: 'After reserving you can upload your payment receipt!',
  },
  'buyer.afterWhatsapp': {
    es: '¡Al apartar te enviaremos a WhatsApp para coordinar tu pago!',
    en: "After reserving we'll take you to WhatsApp to arrange your payment!",
  },

  // ── Recibo del apartado ──
  'receipt.title': { es: '¡Boletos apartados!', en: 'Tickets reserved!' },
  'receipt.desc': {
    es: 'Guarda tu folio y realiza tu pago para confirmar.',
    en: 'Save your code and complete your payment to confirm.',
  },
  'receipt.code': { es: 'Tu folio', en: 'Your code' },
  'receipt.codeLabel': { es: 'Folio', en: 'Code' },
  'receipt.yourTickets': { es: 'Tus boletos ({n})', en: 'Your tickets ({n})' },
  'receipt.giftTickets': { es: '🎁 Boletos de regalo ({n})', en: '🎁 Free tickets ({n})' },
  'receipt.giftExplain': {
    es: 'Por cada boleto que apartaste recibiste oportunidades adicionales de regalo. Participas con {total} números en total.',
    en: 'Each ticket you reserved earned you extra free entries. You are entered with {total} numbers in total.',
  },
  'receipt.totalToPay': { es: 'Total a pagar', en: 'Total to pay' },
  'receipt.paymentData': { es: 'Datos para tu pago', en: 'Payment details' },
  'receipt.sendProof': { es: 'Enviar comprobante por WhatsApp', en: 'Send receipt on WhatsApp' },
  'receipt.sendProofTo': { es: 'Enviar comprobante a {name}', en: 'Send receipt to {name}' },
  'receipt.download': { es: 'Descargar boleto digital', en: 'Download digital ticket' },
  'receipt.view': { es: 'Ver mi boleto', en: 'View my ticket' },

  // ── "Sube tu pago" por folio ──
  'folio.title': { es: 'Sube tu pago', en: 'Upload your payment' },
  'folio.desc': {
    es: 'Escribe el folio de tu compra (por ejemplo BSK-XXXX) para ver tu boleto y subir tu comprobante.',
    en: 'Enter your order code (for example BSK-XXXX) to see your ticket and upload your receipt.',
  },
  'folio.cta': { es: 'Ver mi pago', en: 'See my payment' },

  // ── Cuadrícula de boletos y maquinita ──
  'grid.search': { es: 'BUSCAR', en: 'SEARCH' },
  'grid.available': { es: 'Disponibles', en: 'Available' },
  'grid.unavailable': { es: 'No disponibles', en: 'Unavailable' },
  'grid.empty': { es: 'Sin boletos para mostrar', en: 'No tickets to show' },
  'grid.lucky': { es: 'Maquinita de la suerte', en: 'Lucky machine' },
  'grid.howMany': { es: '¿Cuántos boletos de la suerte?', en: 'How many lucky tickets?' },
  'grid.spin': { es: '¡A girar!', en: 'Spin!' },
  'grid.less': { es: 'Menos', en: 'Less' },
  'grid.more': { es: 'Más', en: 'More' },
  'grid.qty': { es: 'Cantidad de boletos', en: 'Ticket quantity' },
  'grid.luckyOne': { es: '¡1 boleto de la suerte!', en: '1 lucky ticket!' },
  'grid.luckyMany': { es: '¡{n} boletos de la suerte!', en: '{n} lucky tickets!' },
  'grid.maxReached': {
    es: 'Ya alcanzaste el máximo de {n} boletos',
    en: "You've reached the maximum of {n} tickets",
  },
  'grid.noneLeft': {
    es: 'No hay más boletos disponibles para agregar',
    en: 'No more tickets available to add',
  },

  // ── "Ir a mi número" ──
  'goto.title': { es: 'Ir a mi número', en: 'Go to my number' },
  'goto.desc': {
    es: 'Escribe tu número de la suerte y tócalo en "Agregar".',
    en: 'Type your lucky number and tap "Add".',
  },
  'goto.add': { es: 'Agregar este número', en: 'Add this number' },
  'goto.delete': { es: 'Borrar', en: 'Delete' },
  'goto.done': { es: 'Listo', en: 'Done' },
  'goto.added': { es: 'Boleto {label} agregado.', en: 'Ticket {label} added.' },
  'goto.already': {
    es: 'El boleto {label} ya está en tu selección.',
    en: 'Ticket {label} is already in your selection.',
  },
  'goto.taken': {
    es: 'El boleto {label} ya está apartado. Elige otro.',
    en: 'Ticket {label} is already taken. Pick another one.',
  },
  'goto.missing': { es: 'No encontramos el boleto {label}.', en: "We couldn't find ticket {label}." },
  'goto.outOfRange': { es: 'Ese número no existe en esta rifa.', en: "That number isn't in this giveaway." },

  // ── Perfil público del organizador ──
  'profile.available': { es: 'disponible', en: 'available' },
  'profile.availablePlural': { es: 'disponibles', en: 'available' },
  'profile.drawDone': { es: 'sorteo realizado', en: 'giveaway held' },
  'profile.drawsDone': { es: 'sorteos realizados', en: 'giveaways held' },
  'profile.winner': { es: 'ganador', en: 'winner' },
  'profile.winners': { es: 'ganadores', en: 'winners' },
  'profile.availableRaffles': { es: 'Rifas disponibles', en: 'Giveaways available' },
  'profile.comingSoonSection': { es: 'Próximamente', en: 'Coming soon' },
  'profile.comingSoonBadge': { es: 'Próximamente', en: 'Coming soon' },
  'profile.comingSoonCta': { es: 'Ver detalles', en: 'See details' },
  'profile.pastRaffles': { es: 'Sorteos realizados', en: 'Past giveaways' },
  'profile.winnersTitle': { es: 'Ganadores', en: 'Winners' },
  'profile.faq': { es: 'Preguntas frecuentes', en: 'Frequently asked questions' },
  'profile.emptyTitle': { es: 'Aún no hay rifas disponibles', en: 'No giveaways yet' },
  'profile.emptyDesc': {
    es: 'Este rifero todavía no publica rifas. Síguelo en redes para enterarte primero.',
    en: "This organizer hasn't published any giveaways yet. Follow them on social media to be the first to know.",
  },
  'profile.seeRaffles': { es: 'Ver rifas disponibles', en: 'See available giveaways' },
  'profile.buyTickets': { es: 'Comprar boletos', en: 'Buy tickets' },
  'profile.seeResult': { es: 'Ver resultado', en: 'See result' },
  'profile.perTicket': { es: 'POR BOLETO', en: 'PER TICKET' },
  'profile.daysLeft': { es: 'Faltan {n} días', en: '{n} days left' },
  'profile.drawsTomorrow': { es: 'Sortea mañana', en: 'Draws tomorrow' },
  'profile.trustTitle': { es: 'Compra con confianza', en: 'Buy with confidence' },
  'profile.trustDesc': {
    es: 'Cada boleto pagado genera un boleto digital con código QR para validarlo el día del sorteo.',
    en: 'Every paid ticket creates a digital ticket with a QR code you can validate on the draw date.',
  },
  'profile.verifyTickets': { es: 'Verificar mis boletos', en: 'Verify my tickets' },
  'profile.verifiedOrganizer': { es: 'Rifero verificado', en: 'Verified organizer' },
  'profile.firstPlace': { es: '1er lugar', en: '1st place' },
  'profile.nthPlace': { es: '{n}° lugar', en: 'Place #{n}' },
  'profile.video': { es: 'Video', en: 'Video' },
  'profile.inactiveTitle': { es: 'Esta página aún no está activa', en: 'This page is not active yet' },
  'profile.inactiveBody': {
    es: 'está preparando sus rifas. Vuelve pronto para participar.',
    en: 'is getting the giveaways ready. Come back soon to enter.',
  },
  'profile.notFound': { es: 'Página no encontrada', en: 'Page not found' },
  'profile.notFoundDesc': {
    es: 'Esta página de rifas no existe o fue desactivada.',
    en: 'This giveaway page does not exist or was deactivated.',
  },

  // ── Cuenta regresiva ──
  'countdown.until': { es: 'Faltan para el sorteo', en: 'Time left until the draw' },
  'countdown.days': { es: 'Días', en: 'Days' },
  'countdown.day': { es: 'Día', en: 'Day' },
  'countdown.hours': { es: 'Horas', en: 'Hours' },
  'countdown.minutes': { es: 'Min', en: 'Min' },
  'countdown.seconds': { es: 'Seg', en: 'Sec' },
  'countdown.drawDone': { es: 'Sorteo realizado', en: 'Draw completed' },
  'countdown.drawDate': { es: 'Fecha del sorteo', en: 'Draw date' },

  // ── Verificar boletos ──
  'verify.badge': { es: 'Tu billetera de boletos', en: 'Your ticket wallet' },
  'verify.title1': { es: 'Verificar', en: 'Verify' },
  'verify.title2': { es: 'mis boletos', en: 'my tickets' },
  'verify.desc': {
    es: 'Busca tus boletos por teléfono, o por tu nombre y un número de boleto.',
    en: 'Find your tickets by phone, or by your name and a ticket number.',
  },
  'verify.byPhone': { es: 'Teléfono', en: 'Phone' },
  'verify.byName': { es: 'Nombre y boleto', en: 'Name and ticket' },
  'verify.phonePlaceholder': { es: 'Tu teléfono (10 dígitos)', en: 'Your phone (10 digits)' },
  'verify.namePlaceholder': { es: 'Tu nombre completo', en: 'Your full name' },
  'verify.ticketPlaceholder': { es: 'N° de boleto', en: 'Ticket #' },
  'verify.search': { es: 'Buscar', en: 'Search' },
  'verify.searching': { es: 'Buscando tus boletos…', en: 'Searching your tickets…' },
  'verify.emptyTitle': { es: 'No encontramos boletos', en: 'No tickets found' },
  'verify.emptyPhone': {
    es: 'Revisa que sea el mismo teléfono con el que apartaste.',
    en: 'Check that it is the same phone you used to reserve.',
  },
  'verify.emptyName': {
    es: 'Revisa que tu nombre y el número de boleto sean correctos.',
    en: 'Check that your name and ticket number are correct.',
  },
  'verify.goBuy': { es: 'Ir a comprar boletos', en: 'Go buy tickets' },
  'verify.owe': { es: '¿Debes boletos? Paga aquí', en: 'Owe for tickets? Pay here' },
  'verify.yourTickets': { es: 'Tus boletos', en: 'Your tickets' },
  'verify.viewDigital': { es: 'Ver boleto digital', en: 'View digital ticket' },
  'verify.sendPayment': { es: 'Envía tu pago', en: 'Send your payment' },
  'verify.proofSent': {
    es: 'Comprobante enviado · esperando que el organizador confirme tu pago.',
    en: 'Receipt sent · waiting for the organizer to confirm your payment.',
  },
  'verify.notify': { es: 'Avisar al organizador por WhatsApp', en: 'Notify the organizer on WhatsApp' },
  'verify.notifyTo': { es: 'Avisar a {name} por WhatsApp', en: 'Notify {name} on WhatsApp' },
  'verify.needPhone': { es: 'Escribe tu teléfono (10 dígitos)', en: 'Enter your phone (10 digits)' },
  'verify.needNameTicket': {
    es: 'Escribe tu nombre y el número de boleto',
    en: 'Enter your name and the ticket number',
  },
  'verify.searchFailed': { es: 'No se pudo buscar. Intenta de nuevo.', en: "Couldn't search. Please try again." },

  // ── Estados de una orden ──
  'status.reserved': { es: 'Apartado', en: 'Reserved' },
  'status.pending': { es: 'Por confirmar', en: 'Pending' },
  'status.paid': { es: 'Pagado', en: 'Paid' },
  'status.expired': { es: 'Vencido', en: 'Expired' },
  'status.rejected': { es: 'Rechazado', en: 'Rejected' },
  'status.cancelled': { es: 'Cancelado', en: 'Cancelled' },
  'status.expiredMsg': {
    es: 'Tu apartado venció y los boletos se liberaron.',
    en: 'Your reservation expired and the tickets were released.',
  },
  'status.rejectedMsg': {
    es: 'El organizador no confirmó este pago.',
    en: 'The organizer did not confirm this payment.',
  },
  'status.cancelledMsg': { es: 'Esta orden fue cancelada.', en: 'This order was cancelled.' },

  // ── Comprobante de pago ──
  'proof.upload': { es: 'Subir comprobante', en: 'Upload receipt' },
  'proof.uploadBig': { es: 'Subir comprobante de pago', en: 'Upload payment receipt' },
  'proof.uploading': { es: 'Subiendo…', en: 'Uploading…' },
  'proof.hint': {
    es: 'Toma o elige una foto de tu comprobante (máx. 5 MB).',
    en: 'Take or choose a photo of your receipt (max 5 MB).',
  },
  'proof.sentTitle': { es: '¡Comprobante recibido!', en: 'Receipt received!' },
  'proof.sentBody': {
    es: 'El rifero lo revisará para confirmar tu pago.',
    en: 'The organizer will review it to confirm your payment.',
  },
  'proof.sentToast': {
    es: '¡Comprobante enviado! El rifero lo revisará para confirmar tu pago.',
    en: 'Receipt sent! The organizer will review it to confirm your payment.',
  },
  'proof.failed': {
    es: 'No se pudo subir el comprobante. Intenta de nuevo.',
    en: "Couldn't upload the receipt. Please try again.",
  },
  'proof.offline': {
    es: 'Conéctate a internet para subir tu comprobante.',
    en: 'Connect to the internet to upload your receipt.',
  },

  // ── Boleto digital ──
  'ticket.digital': { es: 'Boleto digital', en: 'Digital ticket' },
  'ticket.yourPayment': { es: 'Tu pago', en: 'Your payment' },
  'ticket.payNotFound': { es: 'No encontramos tu pago', en: "We couldn't find your payment" },
  'ticket.payNotFoundBody': {
    es: 'Revisa que el enlace o el folio sean correctos.',
    en: 'Check that the link or the code is correct.',
  },
  'ticket.numbers': { es: 'Números de boleto', en: 'Ticket numbers' },
  'ticket.holder': { es: 'A nombre de', en: 'Ticket holder' },
  'ticket.prize': { es: 'Premio', en: 'Prize' },
  'ticket.drawDate': { es: 'Fecha del sorteo', en: 'Draw date' },
  'ticket.unavailable': { es: 'Boleto no disponible', en: 'Ticket unavailable' },
  'ticket.unavailableBody': {
    es: 'No encontramos este boleto digital. Revisa que el enlace sea correcto.',
    en: "We couldn't find this digital ticket. Check that the link is correct.",
  },
  'ticket.savedOffline': { es: 'Guardado para verlo sin internet', en: 'Saved to view offline' },
  'ticket.offlineNotice': {
    es: 'Estás sin internet. Te mostramos tu boleto guardado.',
    en: 'You are offline. Showing your saved ticket.',
  },
  'ticket.download': { es: 'Descargar PDF', en: 'Download PDF' },
  'ticket.showAtDraw': { es: 'Muestra este código en el sorteo', en: 'Show this code at the draw' },
  'ticket.checkAuth': {
    es: 'Verificar autenticidad de este boleto',
    en: 'Verify this ticket is authentic',
  },
  'ticket.state': { es: 'Estado', en: 'State' },
  'ticket.status': { es: 'Estatus', en: 'Status' },
  'ticket.total': { es: 'Total', en: 'Total' },
  'ticket.date': { es: 'Fecha', en: 'Date' },
  'ticket.draw': { es: 'Sorteo', en: 'Draw' },
  'ticket.code': { es: 'Folio', en: 'Code' },
  'ticket.howToPay': { es: '¿Cómo pagar?', en: 'How to pay' },
  'ticket.each': { es: '{price} cada uno', en: '{price} each' },
  'ticket.payWithin': {
    es: 'Paga en las próximas {time} para no perder tus boletos.',
    en: 'Pay within {time} so you don’t lose your tickets.',
  },
  'ticket.paidTitle': { es: '¡Pago confirmado!', en: 'Payment confirmed!' },
  'ticket.paidBody': {
    es: 'Tus boletos ya están pagados. ¡Mucha suerte! 🍀',
    en: 'Your tickets are paid. Good luck! 🍀',
  },
  'ticket.inactive': {
    es: 'Esta orden ya no está activa. Si crees que es un error, contacta al rifero.',
    en: 'This order is no longer active. If you think this is a mistake, contact the organizer.',
  },

  // ── Validación por QR ──
  'validate.title': { es: 'Verificación de boleto', en: 'Ticket verification' },
  'validate.code': { es: 'Folio consultado: {code}', en: 'Code checked: {code}' },
  'validate.valid': { es: 'Boleto válido', en: 'Valid ticket' },
  'validate.notFound': { es: 'Boleto no encontrado', en: 'Ticket not found' },
  'validate.notFoundBody': {
    es: 'No existe un boleto con este folio. Revisa el código o el enlace.',
    en: 'There is no ticket with this code. Check the code or the link.',
  },

  // ── Sello de confianza ──
  'seal.safe': { es: 'Estos sorteos son seguros', en: 'These giveaways are safe' },

  // ── Instalación / sin conexión ──
  'install.title': { es: 'Instala {name}', en: 'Install {name}' },
  'install.body': {
    es: 'Ábrela como app, sin navegador y más rápido.',
    en: 'Open it like an app — faster and without the browser.',
  },
  'install.cta': { es: 'Instalar', en: 'Install' },
  'offline.banner': { es: 'Sin conexión', en: 'Offline' },
} as const satisfies Record<string, Entry>;

export type MessageKey = keyof typeof MESSAGES;

// Traduce una clave. Si falta la traducción, cae al español (nunca muestra la clave).
export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const entry = MESSAGES[key] as Entry | undefined;
  let out = entry ? (entry[locale] ?? entry.es) : (key as string);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(`{${k}}`).join(String(v));
    }
  }
  return out;
}

// Preguntas frecuentes de fábrica, en el idioma del sitio. Se muestran mientras
// el rifero no guarde las suyas.
export const DEFAULT_FAQS_EN = [
  {
    q: 'How do I enter?',
    a: 'Open the giveaway, pick your available numbers, reserve them with your name and phone, and complete your payment.',
  },
  {
    q: 'How do I pay for my tickets?',
    a: 'Send your payment using the organizer’s details (you can see them under “Payment methods”) and upload your receipt. The organizer confirms your payment.',
  },
  {
    q: 'Where can I see my tickets?',
    a: 'Under “Verify my tickets” you can look up your reserved or paid tickets with your phone, upload your receipt and open your digital ticket.',
  },
  {
    q: 'When is the draw?',
    a: 'On the date shown in each giveaway. Your paid ticket is your entry.',
  },
  {
    q: 'Is it trustworthy?',
    a: 'Every paid ticket creates a digital ticket with a QR code so it can be validated on the draw date.',
  },
] as const;
