// OCR one rendered booklet directory (PNG pages) with tesseract.js (fas+eng).
// Emits one JSON per page: { page, lines: [{text, x, y, w, h}], rawText }.
// Usage: node ocr-booklet.js <pagesDir> <outJson>
const fs = require("fs");
const path = require("path");
const { createWorker } = require("tesseract.js");

async function main() {
  const dir = process.argv[2];
  const outPath = process.argv[3];
  if (!dir || !outPath) { console.error("usage: node ocr-booklet.js <dir> <out.json>"); process.exit(1); }
  const pages = fs.readdirSync(dir).filter(f => f.endsWith(".png")).sort();
  const worker = await createWorker(["fas"], 1, {
    langPath: "https://tessdata.projectnaptha.com/4.0.0_best",
  });
  const result = [];
  for (const f of pages) {
    const idx = parseInt(f.replace(/\D/g, ""), 10);
    const { data } = await worker.recognize(path.join(dir, f));
    const lines = [];
    for (const block of data.blocks || []) {
      for (const para of block.paragraphs || []) {
        for (const line of para.lines || []) {
          const t = line.text.replace(/\s+$/, "");
          if (!t) continue;
          lines.push({ text: t, x: Math.round(line.bbox.x0), y: Math.round(line.bbox.y0),
                       w: Math.round(line.bbox.x1 - line.bbox.x0), h: Math.round(line.bbox.y1 - line.bbox.y0) });
        }
      }
    }
    result.push({ page: idx, lines, rawText: data.text });
    console.error(`page ${idx}: ${lines.length} lines`);
  }
  fs.writeFileSync(outPath, JSON.stringify(result, null, 1), "utf-8");
  await worker.terminate();
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
