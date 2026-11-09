import * as fs from 'fs';
import * as path from 'path';

const rawPath = path.resolve('anki-extracted/anki_extracted_full.json');
if (!fs.existsSync(rawPath)) {
  console.error('File not found:', rawPath);
  process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
// rawData is { marketing: [...], economics: [...], islam: [...], management_theory: [...] }
const allNotes: any[] = [];
const subjectMap: Record<string, string> = {
  marketing: 'marketing',
  economics: 'economics_micro',
  islam: 'islamic_theory',
  management_theory: 'management_theory'
};

for (const [subjectKey, notes] of Object.entries(rawData) as [string, any[]][]) {
  const subjectId = subjectMap[subjectKey] || subjectKey;
  for (const note of notes) {
    const fields = note.fields || [];
    // fields is an array; front=fields[0], back=fields[1]
    const front = fields.length > 0 ? String(fields[0]).trim() : 'سؤال';
    const back = fields.length > 1 ? String(fields[1]).trim() : 'پاسخ';
    allNotes.push({
      id: `anki_${subjectId}_${allNotes.length + 1}`,
      subjectId,
      front,
      back,
      sourceDeck: subjectKey,
      tags: [subjectId, 'anki_import', '1405_verified'],
      difficulty: 'medium'
    });
  }
}

console.log(`Loaded ${allNotes.length} notes from Anki export across ${Object.keys(rawData).length} subjects.`);

const outputPath = path.resolve('src/data/flashcardsAnkiImport.ts');
const fileContent = `// Auto-generated Anki Flashcards Import
export interface AnkiFlashcardItem {
  id: string;
  subjectId: string;
  front: string;
  back: string;
  sourceDeck: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export const ANKI_IMPORTED_FLASHCARDS: AnkiFlashcardItem[] = ${JSON.stringify(allNotes, null, 2)};
`;

fs.writeFileSync(outputPath, fileContent, 'utf8');
console.log(`Successfully generated ${allNotes.length} flashcards at ${outputPath}`);