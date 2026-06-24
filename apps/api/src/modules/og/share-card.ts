// Tarjeta de "compartir" 1:1: el logo del rifero centrado sobre fondo BLANCO.
//
// Las redes (WhatsApp, Facebook) necesitan una imagen raster real como og:image;
// no sirve un SVG ni el logo crudo (que puede ser transparente → se ve sobre fondo
// oscuro). Aquí componemos un PNG cuadrado 1200×1200 con el logo centrado y margen
// blanco. Se genera al vuelo desde el logo actual del admin y se memoiza por origen
// (el nombre de archivo es un hash aleatorio → su contenido es inmutable).

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';

const SIZE = 1200; // lienzo cuadrado 1:1
const LOGO_RATIO = 0.66; // el logo ocupa ~66% del lienzo; el resto es margen blanco
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

interface BrandImages {
  logoUrl: string | null;
  coverUrl: string | null;
}

// Imagen de origen para la tarjeta: el LOGO del admin; si no hay, la portada.
export function shareCardSource(p: BrandImages | null): string | null {
  return p?.logoUrl || p?.coverUrl || null;
}

// Ruta relativa del endpoint con un token de versión derivado del origen, para que
// las redes invaliden su caché cuando el rifero cambia su logo.
export function shareCardRelUrl(p: BrandImages | null): string {
  const src = shareCardSource(p);
  const v = createHash('sha1').update(src ?? 'none').digest('hex').slice(0, 10);
  return `/s/card.png?v=${v}`;
}

let memo: { src: string; png: Buffer } | null = null;

async function loadSourceBytes(srcUrl: string): Promise<Buffer | null> {
  try {
    if (/^https?:\/\//i.test(srcUrl)) {
      const res = await fetch(srcUrl);
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    }
    if (srcUrl.startsWith('/uploads/')) {
      const key = srcUrl.slice('/uploads/'.length);
      if (env.storage.driver === 'db') {
        const asset = await prisma.storedAsset.findUnique({ where: { key } });
        return asset ? Buffer.from(asset.bytes) : null;
      }
      return await readFile(join(env.storage.localDir, key));
    }
    if (srcUrl.startsWith('/demo-assets/')) {
      const rel = srcUrl.slice('/demo-assets/'.length);
      const dir = fileURLToPath(new URL('../../../prisma/demo-assets/', import.meta.url));
      return await readFile(join(dir, rel));
    }
    return null;
  } catch {
    return null; // archivo ausente / formato ilegible → la ruta cae al og-default
  }
}

// Compone el PNG 1:1 (logo sobre blanco). Devuelve null si no hay logo utilizable.
export async function composeShareCard(srcUrl: string | null): Promise<Buffer | null> {
  if (!srcUrl) return null;
  if (memo && memo.src === srcUrl) return memo.png;

  const bytes = await loadSourceBytes(srcUrl);
  if (!bytes) return null;

  try {
    const inner = Math.round(SIZE * LOGO_RATIO);
    const logo = await sharp(bytes)
      .resize(inner, inner, { fit: 'inside', withoutEnlargement: false })
      .toBuffer();
    const png = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: WHITE } })
      .composite([{ input: logo, gravity: 'centre' }])
      .png()
      .toBuffer();
    memo = { src: srcUrl, png };
    return png;
  } catch {
    return null; // imagen corrupta → fallback
  }
}
