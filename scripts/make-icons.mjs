// Generates the PWA / Home Screen icons from one SVG. Run: node scripts/make-icons.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const COBALT = "#2236e0";
const BLUSH = "#f4b9c8";
const PAPER = "#f3eee4";

// Two circles meeting: one outlined (still travelling), one solid (waiting).
const svg = (pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${COBALT}"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - pad * 2) / 512})">
    <circle cx="306" cy="270" r="118" fill="${BLUSH}"/>
    <circle cx="206" cy="242" r="118" fill="none" stroke="${PAPER}" stroke-width="22"/>
  </g>
</svg>`;

writeFileSync("public/icons/icon.svg", svg());
const out = [
  ["icon-192.png", 192, 0],
  ["icon-512.png", 512, 0],
  ["icon-maskable-512.png", 512, 70],
  ["apple-touch-icon.png", 180, 0],
];
for (const [name, size, pad] of out) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(`public/icons/${name}`);
}
console.log("icons written");
