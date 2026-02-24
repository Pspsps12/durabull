/**
 * Favicon Generation Script
 *
 * Generates all required favicon sizes from the source SVG for Google SEO compliance.
 * Google requires favicons to be at least 48x48 pixels (multiples of 48px preferred).
 *
 * Usage: bun run generate-favicons.ts
 *
 * Required: Install sharp first
 *   bun add -D sharp @types/sharp
 */

import sharp from "sharp";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = join(__dirname, "../../apps/web/public");
const SVG_PATH = join(PUBLIC_DIR, "favicon.svg");

// Favicon sizes needed for full SEO coverage
const SIZES = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "favicon-48x48.png", size: 48 }, // Google minimum requirement
  { name: "favicon-96x96.png", size: 96 }, // Google recommended (multiple of 48)
  { name: "favicon-192x192.png", size: 192 }, // Android Chrome / PWA
  { name: "favicon-512x512.png", size: 512 }, // PWA splash screen
  { name: "apple-touch-icon.png", size: 180 }, // iOS Safari
];

// OG Image size for social sharing
const OG_IMAGE_SIZE = { width: 1200, height: 630 };

async function generateFavicons() {
  if (!existsSync(SVG_PATH)) {
    console.error(`SVG not found at: ${SVG_PATH}`);
    process.exit(1);
  }

  console.log("Generating favicons from SVG...\n");

  const svgBuffer = readFileSync(SVG_PATH);

  for (const { name, size } of SIZES) {
    const outputPath = join(PUBLIC_DIR, name);
    await sharp(svgBuffer, { density: 300 })
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(outputPath);

    console.log(`✓ Generated ${name} (${size}x${size})`);
  }

  // Generate favicon.ico (multi-size ICO containing 16x16 and 32x32)
  // Note: sharp doesn't support ICO directly, so we'll use PNG-to-ICO conversion
  // For now, we'll create the 32x32 as the .ico (browsers accept PNG)
  const icoPath = join(PUBLIC_DIR, "favicon.ico");
  await sharp(svgBuffer, { density: 300 })
    .resize(32, 32, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(icoPath);
  console.log("✓ Generated favicon.ico (32x32 PNG)");

  console.log("\n✅ All favicons generated successfully!");
  console.log("\n📝 Next steps:");
  console.log(
    "1. Create an OG image (1200x630) at /apps/web/public/og-image.png"
  );
  console.log("   - Include your logo and brand name");
  console.log("   - Use a dark background (#0a0a0a) with emerald accent");
  console.log("2. Test with Google Rich Results Test: https://search.google.com/test/rich-results");
  console.log("3. Request re-indexing in Google Search Console");
}

async function main() {
  try {
    await generateFavicons();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Cannot find package")
    ) {
      console.error("\n❌ Sharp is not installed. Please run:");
      console.error("   cd tooling/scripts && bun add -D sharp @types/sharp");
      process.exit(1);
    }
    throw error;
  }
}

main();
