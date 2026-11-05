/**
 * AEL-313 P0 — Page Reconstruction (§4.1): صفحات واقعی از middle_json MinerU.
 * شماره صفحه از خروجی واقعی parser — نه از ترتیب بلوک و نه حدس.
 * raw_text و normalized_text جدا (§4.2).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { normalizePersian } from '../normalize.mjs';

/** middle_json MinerU → PageResult[] استاندارد */
export function reconstructPagesFromMiddleJson(middle, sourceId) {
  const pdfInfo = middle.pdf_info ?? middle.pages ?? [];
  const pages = [];
  for (const [index, pageInfo] of pdfInfo.entries()) {
    const blocks = [];
    const blocksSource = pageInfo.para_blocks ?? pageInfo.blocks ?? pageInfo.preproc_blocks ?? [];
    for (const [blockIndex, block] of blocksSource.entries()) {
      const lines = block.lines ?? [];
      const text = lines
        .map(line => (line.spans ?? []).map(span => span.content ?? '').join(' '))
        .join('\n').trim();
      const bbox = block.bbox ?? null;
      blocks.push({
        block_id: `${sourceId}:p${index + 1}:b${blockIndex + 1}`,
        page_number: index + 1,
        block_type: block.type ?? 'text',
        text,
        bbox,
        reading_order: blockIndex + 1,
        extraction_method: 'mineru',
        confidence: null, // MinerU middle_json per-block confidence ندارد — null صادقانه
        source_locator: `doc:${sourceId}/page:${index + 1}/block:${blockIndex + 1}`,
      });
    }
    const rawText = blocks.map(block => block.text).join('\n\n');
    pages.push({
      page_number: index + 1,
      text: rawText,
      text_normalized: normalizePersian(rawText),
      extraction_method: 'mineru',
      blocks,
      tables: blocks.filter(block => block.block_type === 'table'),
      images: blocks.filter(block => block.block_type === 'image'),
      layout_metadata: { block_count: blocks.length },
      quality: { has_text: rawText.length > 0 },
    });
  }
  return pages;
}

/** خواندن middle_json از دایرکتوری کش MinerU */
export function loadMiddleJson(outputDir, sourceId) {
  if (!existsSync(outputDir)) return null;
  const jsonFile = readdirSync(outputDir).find(name => name.endsWith('.json'));
  if (!jsonFile) return null;
  try {
    return reconstructPagesFromMiddleJson(JSON.parse(readFileSync(join(outputDir, jsonFile), 'utf8')), sourceId);
  } catch {
    return null;
  }
}

