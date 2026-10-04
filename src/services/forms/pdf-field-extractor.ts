/**
 * Best-effort extraction of candidate casillero rows from a form 104 PDF's
 * text layer (ADR-015, step "Subir PDF → extraer"). This is a pre-fill for
 * the admin to review, edit, and correct before publishing -- it is not
 * trusted as correct on its own, and it never sees or stores any value,
 * only the surrounding structure (code, label, which value column it sits
 * in). A scanned PDF with no text layer produces zero candidates, which
 * the caller treats as "nothing to pre-fill", not an error.
 */

export interface CandidateField {
  code: string;
  label: string;
  columnKind: 'GROSS' | 'NET' | 'TAX' | 'SINGLE';
}

// Every page repeats a header with the filer's own identity (RUC, legal
// name) and filing metadata -- none of it is a casillero. This list is
// deliberately generous: a label is safer dropped than kept when the
// alternative is writing a taxpayer's name into form_fields.label
// (CLAUDE.md -- the PDF "trae datos personales").
const BOILERPLATE_LINE =
  /^(la información reposa|código verificador|página|--.*--$|\d+$|sridec|obligación tributaria|identificación:|razón social|período fiscal|tipo declaración|formulario sustituye|estado de la declaración|cumplida$|resumen de (ventas|adquisiciones))|\(valor bruto/i;

const CODE_VALUE = /(\d{3})\s+(\d+(?:\.\d+)?)/g;

// Only the last couple of lines right before a code are ever treated as
// its label. Looking further back risks pulling in the page header (see
// BOILERPLATE_LINE) or an unrelated previous row; the common case -- a
// label on the line right above its code, occasionally wrapped onto one
// extra line -- still comes through, just not longer runs.
const LABEL_LOOKBACK_LINES = 2;

function cleanLabel(raw: string): string {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !BOILERPLATE_LINE.test(line));

  return lines
    .slice(-LABEL_LOOKBACK_LINES)
    .join(' ')
    .replace(/\s+/g, ' ')
    // A lone "." is the PDF's placeholder for a column that doesn't apply
    // to the previous row -- it leaks into the start of this row's label
    // slice, not part of the label itself.
    .replace(/^[.\s]+/, '')
    .trim();
}

/**
 * A run of 1-3 consecutive (code, value) pairs with no other text between
 * them maps to SINGLE / GROSS+NET / GROSS+NET+TAX, in that left-to-right
 * order -- the form's own column headers are "VALOR BRUTO · VALOR NETO ·
 * IMPUESTO GENERADO", always in that order, when all three are present.
 * A row missing its earlier column(s) (printed as "." in the PDF) still
 * degrades to SINGLE here -- the admin corrects columnKind by hand, which
 * is far less work than typing the whole row from scratch.
 */
const COLUMN_KIND_BY_POSITION: Record<number, CandidateField['columnKind'][]> = {
  1: ['SINGLE'],
  2: ['GROSS', 'NET'],
  3: ['GROSS', 'NET', 'TAX'],
};

export function extractCandidateFields(text: string): CandidateField[] {
  const matches = [...text.matchAll(CODE_VALUE)];
  if (matches.length === 0) return [];

  const groups: Array<{ codes: string[]; labelStart: number; end: number }> = [];
  let current: { codes: string[]; labelStart: number; end: number } | null = null;

  for (const match of matches) {
    const start = match.index;
    const end = start + match[0].length;
    const gapSincePrevious = current ? text.slice(current.end, start) : '';

    // Same row: nothing but whitespace/a lone "." placeholder between
    // this pair and the previous one.
    const isContinuation = current !== null && /^[\s.]*$/.test(gapSincePrevious) && current.codes.length < 3;

    if (isContinuation && current) {
      current.codes.push(match[1]);
      current.end = end;
    } else {
      if (current) groups.push(current);
      current = { codes: [match[1]], labelStart: start, end };
    }
  }
  if (current) groups.push(current);

  const fields: CandidateField[] = [];
  let previousGroupEnd = 0;

  for (const group of groups) {
    const rawLabel = text.slice(previousGroupEnd, group.labelStart);
    const label = cleanLabel(rawLabel);
    previousGroupEnd = group.end;

    if (!label) continue;

    const kinds = COLUMN_KIND_BY_POSITION[group.codes.length] ?? [];
    group.codes.forEach((code, i) => {
      fields.push({ code, label, columnKind: kinds[i] ?? 'SINGLE' });
    });
  }

  return fields;
}
