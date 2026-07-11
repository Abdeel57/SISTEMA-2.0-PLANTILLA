// Genera los íconos PNG de la PWA a partir de los SVG de /public.
// iOS y muchas tiendas/instaladores prefieren PNG; el SVG no basta para
// "Agregar a pantalla de inicio" ni para la instalabilidad de Lighthouse.
//
// Uso: node scripts/gen-icons.mjs   (o: npm run gen:icons)
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

async function png(svgFile, size, outFile) {
  const svg = await readFile(join(PUBLIC, svgFile));
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(PUBLIC, outFile));
  console.log('  ✓', outFile, `(${size}×${size})`);
}

console.log('Generando íconos PNG…');
await png('icon.svg', 192, 'icon-192.png');
await png('icon.svg', 512, 'icon-512.png');
await png('maskable-icon.svg', 512, 'maskable-512.png');
await png('apple-touch-icon.svg', 180, 'apple-touch-icon.png');
await png('favicon.svg', 32, 'favicon-32.png');

// Imagen por defecto para vista previa de enlaces (Open Graph) 1200×630:
// fondo de marca con el logotipo B centrado. Es el fallback cuando una rifa
// no tiene imagen propia (la edge function usa la de la rifa cuando existe).
const logo = await sharp(await readFile(join(PUBLIC, 'icon.svg')), { density: 384 })
  .resize(340, 340)
  .png()
  .toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#070b18' } })
  .composite([{ input: logo, gravity: 'center' }])
  .png()
  .toFile(join(PUBLIC, 'og-default.png'));
console.log('  ✓ og-default.png (1200×630)');
console.log('Listo.');
