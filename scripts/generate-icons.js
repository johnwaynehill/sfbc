'use strict';

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SVG_PATH = path.join(__dirname, '../public/img/icons/icon.svg');
const OUT_DIR = path.join(__dirname, '../public/img/icons');

const SIZES = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512];

async function generateIcons() {
  const svg = fs.readFileSync(SVG_PATH);

  for (const size of SIZES) {
    const outFile = path.join(OUT_DIR, `icon-${size}x${size}.png`);
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(outFile);
    console.log(`  [icon] ${size}x${size} → ${path.basename(outFile)}`);
  }

  // Also generate apple-touch-icon (180x180)
  const appleFile = path.join(OUT_DIR, 'apple-touch-icon.png');
  await sharp(svg)
    .resize(180, 180)
    .png()
    .toFile(appleFile);
  console.log('  [icon] 180x180 → apple-touch-icon.png');

  // Favicon 32x32
  const faviconFile = path.join(OUT_DIR, 'favicon-32x32.png');
  await sharp(svg)
    .resize(32, 32)
    .png()
    .toFile(faviconFile);
  console.log('  [icon] 32x32 → favicon-32x32.png');

  // Favicon 16x16
  const favicon16File = path.join(OUT_DIR, 'favicon-16x16.png');
  await sharp(svg)
    .resize(16, 16)
    .png()
    .toFile(favicon16File);
  console.log('  [icon] 16x16 → favicon-16x16.png');

  console.log('\n  Done! Generated all PWA icons.\n');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
