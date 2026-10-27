import { CATEGORIES } from '../ui';
import type { Category } from '../ui';
import { defaultPoints, validateChallenge } from './validation';
import type { ChallengeDraft } from './validation';
import type { MessageKey } from '../i18n/messages';

export const CSV_COLUMNS = [
  'category',
  'title_nb',
  'title_en',
  'body_nb',
  'body_en',
  'difficulty',
  'points',
] as const;

/** Splits CSV text into rows of cells. Handles quotes, doubled quotes and newlines in quotes. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i);
    if (quoted) {
      if (ch === '"') {
        if (input.charAt(i + 1) === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input.charAt(i + 1) === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

export interface ImportRow {
  /** Line number in the file, counting the header as line 1. */
  line: number;
  draft: ChallengeDraft | null;
  errors: MessageKey[];
}

const isCategory = (value: string): value is Category =>
  (CATEGORIES as readonly string[]).includes(value);

/** Reads a challenge CSV with a header row. Every row is checked on its own. */
export function readChallengeCsv(text: string): { rows: ImportRow[]; headerError: boolean } {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = first.includes(';') && !first.includes(',') ? ';' : ',';
  const table = parseCsv(text, delimiter);
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const index = (name: string) => header.indexOf(name);
  const required = ['category', 'title_nb', 'title_en'];
  if (required.some((name) => index(name) < 0)) return { rows: [], headerError: true };

  const rows = table.slice(1).map((cells, i): ImportRow => {
    const get = (name: string) => (cells[index(name)] ?? '').trim();
    const line = i + 2;
    const category = get('category').toLowerCase();
    const difficultyText = get('difficulty');
    const difficulty = difficultyText === '' ? 1 : Number(difficultyText);
    const errors: MessageKey[] = [];
    if (!isCategory(category)) errors.push('admin.error.category');
    if (!(difficulty === 1 || difficulty === 2 || difficulty === 3))
      errors.push('admin.error.difficulty');
    const pointsText = get('points');
    const points =
      pointsText === ''
        ? difficulty === 1 || difficulty === 2 || difficulty === 3
          ? defaultPoints(difficulty)
          : Number.NaN
        : Number(pointsText);
    if (
      errors.length > 0 ||
      !isCategory(category) ||
      !(difficulty === 1 || difficulty === 2 || difficulty === 3)
    ) {
      return { line, draft: null, errors };
    }
    const draft: ChallengeDraft = {
      category,
      titleNb: get('title_nb'),
      titleEn: get('title_en'),
      bodyNb: get('body_nb'),
      bodyEn: get('body_en'),
      difficulty,
      points,
    };
    const found = Object.values(validateChallenge(draft));
    return { line, draft: found.length > 0 ? null : draft, errors: [...new Set(found)] };
  });
  return { rows, headerError: false };
}

export const CSV_EXAMPLE = `${CSV_COLUMNS.join(',')}\nsocial,Si hei til en kollega,Say hi to a colleague,Ta en prat ved kaffemaskinen.,Have a chat by the coffee machine.,1,10\n`;
