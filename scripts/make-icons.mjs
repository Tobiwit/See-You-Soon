// Generates the PWA / Home Screen icons from one SVG. Run: npm run icons
// The mark: a geometric heart whose left half is an "A" and right half a "T"
// (same geometry as src/components/ui/HeartMark.tsx).
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const COBALT = "#2236e0";
const BLUSH = "#f4b9c8";
const PAPER = "#f3eee4";

const P = {
  a: "M247 430 L101.9 262.3 A86 86 0 1 1 247 174.4 L247 430 Z",
  aBar: "M155 292 L247 292",
  t: "M265 174.4 A86 86 0 1 1 410.1 262.3 L265 430 Z",
  tStem: "M345 120 L345 318",
};

// scale < 1 shrinks the mark towards the centre (safe zone for maskable icons)
const svg = (scale = 1, stroke = 30) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${COBALT}"/>
  <g transform="translate(256 270) scale(${scale}) translate(-256 -275)" fill="none" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
    <path d="${P.a}" stroke="${PAPER}"/><path d="${P.aBar}" stroke="${PAPER}"/>
    <path d="${P.t}" stroke="${BLUSH}"/><path d="${P.tStem}" stroke="${BLUSH}"/>
  </g>
</svg>`;

writeFileSync("public/icons/icon.svg", svg(1, 34));
const out = [
  ["icon-192.png", 192, 1, 34],
  ["icon-512.png", 512, 1, 30],
  ["icon-maskable-512.png", 512, 0.72, 34],
  ["apple-touch-icon.png", 180, 0.92, 34],
];
for (const [name, size, scale, stroke] of out) {
  await sharp(Buffer.from(svg(scale, stroke))).resize(size, size).png().toFile(`public/icons/${name}`);
}
console.log("icons written");
