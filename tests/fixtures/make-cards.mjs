// Renders synthetic business-card PNGs for live-extraction testing.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));

const card = (bg, accent, lines) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="600">
  <rect width="1050" height="600" fill="${bg}"/>
  <rect x="0" y="0" width="18" height="600" fill="${accent}"/>
  ${lines.map((l) => `<text x="${l.x ?? 70}" y="${l.y}" font-family="Helvetica, Arial, sans-serif" font-size="${l.size}" font-weight="${l.bold ? 700 : 400}" fill="${l.fill ?? "#1a1a1a"}">${l.t}</text>`).join("\n")}
</svg>`;

const full = card("#f7f4ee", "#0b5fff", [
  { t: "MERIDIAN ANALYTICS", y: 90, size: 34, bold: true, fill: "#0b5fff" },
  { t: "Priya Nair", y: 250, size: 68, bold: true },
  { t: "Senior Product Manager", y: 310, size: 36 },
  { t: "Tel: +91 98450 12345", y: 430, size: 30 },
  { t: "priya.nair@meridian-analytics.in", y: 480, size: 30 },
  { t: "Bengaluru, Karnataka, India", y: 530, size: 30 },
]);

const partial = card("#101820", "#f2aa4c", [
  { t: "LUMEN FREIGHT", y: 90, size: 36, bold: true, fill: "#f2aa4c" },
  { t: "Daniel Okafor", y: 260, size: 64, bold: true, fill: "#ffffff" },
  { t: "Head of Partnerships", y: 320, size: 36, fill: "#dddddd" },
  { t: "daniel.okafor@lumenfreight.com", y: 500, size: 30, fill: "#ffffff" },
]);

await sharp(Buffer.from(full)).png().toFile(path.join(dir, "card-full.png"));
await sharp(Buffer.from(partial)).jpeg({ quality: 92 }).toFile(path.join(dir, "card-partial.jpg"));
console.log("wrote card-full.png, card-partial.jpg");
