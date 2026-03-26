/**
 * Generate app icons for Ceres mobile app using sharp.
 * Run from repo root: node apps/ceres/mobile/scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '..', 'assets');

const DARK_BG = '#1a1a2e';
const CAVARIDGE_BLUE = '#2E5090';
const WHITE = '#FFFFFF';

// Medical pulse/heartbeat icon with "C" letter mark
const iconSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
    <linearGradient id="pulse" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#4da6ff"/>
      <stop offset="100%" style="stop-color:#7c3aed"/>
    </linearGradient>
  </defs>
  <!-- Background with rounded corners -->
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>
  <!-- Subtle inner glow -->
  <rect x="${size * 0.03}" y="${size * 0.03}" width="${size * 0.94}" height="${size * 0.94}" rx="${size * 0.19}" fill="none" stroke="${CAVARIDGE_BLUE}" stroke-width="${size * 0.005}" opacity="0.3"/>
  <!-- Pulse/heartbeat line -->
  <polyline
    points="${size * 0.12},${size * 0.52} ${size * 0.28},${size * 0.52} ${size * 0.35},${size * 0.32} ${size * 0.42},${size * 0.68} ${size * 0.50},${size * 0.38} ${size * 0.56},${size * 0.58} ${size * 0.62},${size * 0.48} ${size * 0.72},${size * 0.52} ${size * 0.88},${size * 0.52}"
    fill="none"
    stroke="url(#pulse)"
    stroke-width="${size * 0.035}"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- "60" text (60-day calculator) -->
  <text x="${size * 0.50}" y="${size * 0.82}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="${size * 0.14}" fill="${WHITE}" opacity="0.9">60</text>
  <!-- Small "day" label -->
  <text x="${size * 0.50}" y="${size * 0.91}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="600" font-size="${size * 0.06}" fill="${WHITE}" opacity="0.5">DAY</text>
</svg>
`;

// Splash icon - just the pulse line, no background
const splashSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="pulse2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#4da6ff"/>
      <stop offset="100%" style="stop-color:#7c3aed"/>
    </linearGradient>
  </defs>
  <polyline
    points="${size * 0.05},${size * 0.50} ${size * 0.25},${size * 0.50} ${size * 0.35},${size * 0.20} ${size * 0.45},${size * 0.75} ${size * 0.55},${size * 0.30} ${size * 0.62},${size * 0.60} ${size * 0.70},${size * 0.45} ${size * 0.80},${size * 0.50} ${size * 0.95},${size * 0.50}"
    fill="none"
    stroke="url(#pulse2)"
    stroke-width="${size * 0.05}"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
`;

async function generate() {
  // App icon 1024x1024
  await sharp(Buffer.from(iconSvg(1024)))
    .png()
    .toFile(join(assetsDir, 'icon.png'));
  console.log('✓ icon.png (1024x1024)');

  // Adaptive icon 1024x1024
  await sharp(Buffer.from(iconSvg(1024)))
    .png()
    .toFile(join(assetsDir, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png (1024x1024)');

  // Splash icon 200x200
  await sharp(Buffer.from(splashSvg(200)))
    .png()
    .toFile(join(assetsDir, 'splash-icon.png'));
  console.log('✓ splash-icon.png (200x200)');

  // Favicon 48x48
  await sharp(Buffer.from(iconSvg(512)))
    .resize(48, 48)
    .png()
    .toFile(join(assetsDir, 'favicon.png'));
  console.log('✓ favicon.png (48x48)');

  console.log('\nAll icons generated in apps/ceres/mobile/assets/');
}

generate().catch(console.error);
