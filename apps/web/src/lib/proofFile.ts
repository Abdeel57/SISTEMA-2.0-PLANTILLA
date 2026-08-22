// Prepara el comprobante ANTES de subirlo.
//
// El comprador casi siempre manda una foto de la pantalla de su banco o una
// captura, y eso traía tres problemas:
//   · Las fotos de un teléfono moderno pesan 6-12 MB y el servidor las rechaza.
//   · El iPhone guarda en HEIC, un formato que Windows y muchos navegadores no
//     abren, así que el organizador no podía ver el comprobante.
//   · Subir 12 MB por datos móviles es lento y se corta a media subida.
//
// Aquí se redibuja la imagen en un canvas y se exporta como JPEG: una foto de
// 12 MB queda en ~300 KB, el HEIC se convierte solo (Safari sí lo decodifica) y
// el organizador siempre recibe algo que puede abrir. Los PDF pasan intactos —
// no se pueden dibujar en un canvas y ya son ligeros.
//
// Si algo falla (un formato que el navegador no sabe decodificar) se devuelve el
// archivo original: el servidor lo acepta igual, mejor eso que bloquear al comprador.

const MAX_SIDE = 1600; // suficiente para leer un comprobante sin perder nitidez
const QUALITY = 0.82;

export const PROOF_ACCEPT = 'image/*,application/pdf';

/** ¿El archivo es algo que aceptamos como comprobante? */
export function isValidProof(file: File): boolean {
  return file.type.startsWith('image/') || file.type === 'application/pdf';
}

function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap respeta la orientación EXIF: sin esto, las fotos tomadas
  // en vertical con el teléfono se guardarían acostadas.
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

export async function prepareProofFile(file: File): Promise<File> {
  if (file.type === 'application/pdf') return file;
  if (!file.type.startsWith('image/')) return file;

  try {
    const bitmap = await loadBitmap(file);
    const w = 'width' in bitmap ? bitmap.width : 0;
    const h = 'height' in bitmap ? bitmap.height : 0;
    if (!w || !h) return file;

    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // Fondo blanco: los PNG con transparencia quedarían negros al pasar a JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    if ('close' in bitmap) bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', QUALITY),
    );
    if (!blob) return file;
    // Si comprimir no ayudó (ya era una captura pequeña), se queda el original.
    if (blob.size >= file.size && file.type === 'image/jpeg') return file;

    const name = file.name.replace(/\.[^.]+$/, '') || 'comprobante';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
