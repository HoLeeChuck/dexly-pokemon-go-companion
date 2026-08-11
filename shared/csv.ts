import { CATEGORY_IDS } from './types';
import type { CatalogItem, CategoryId, CollectionEntry } from './types';

export type CsvImportPolicy = 'merge' | 'update' | 'replace';
export type CsvIssueSeverity = 'warning' | 'error';
export type CsvChangeDisposition = 'add' | 'remove' | 'unchanged' | 'ignored';

export interface CsvPreviewIssue {
  severity: CsvIssueSeverity;
  code: string;
  row: number;
  column?: string;
  message: string;
}

export interface CsvPreviewChange {
  row: number;
  formId: string;
  categoryId: CategoryId;
  before: boolean;
  after: boolean;
  disposition: CsvChangeDisposition;
}

export interface CsvPreviewSummary {
  sourceRows: number;
  resolvedRows: number;
  added: number;
  removed: number;
  unchanged: number;
  ignored: number;
  rejected: number;
}

export interface CsvImportPreview {
  policy: CsvImportPolicy;
  changes: readonly CsvPreviewChange[];
  issues: readonly CsvPreviewIssue[];
  summary: CsvPreviewSummary;
}

export type CsvScalar = string | number | boolean | null | undefined;

export interface CsvSerializationOptions {
  delimiter?: string;
  lineEnding?: '\n' | '\r\n';
  formulaSafe?: boolean;
}

export class CsvParseError extends Error {
  readonly row: number;
  readonly column: number;

  constructor(message: string, row: number, column: number) {
    super(`${message} at row ${row}, column ${column}`);
    this.name = 'CsvParseError';
    this.row = row;
    this.column = column;
  }
}

function assertDelimiter(delimiter: string): void {
  if (delimiter.length !== 1 || delimiter === '"' || /[\r\n]/.test(delimiter)) {
    throw new TypeError('CSV delimiter must be one non-quote, non-newline character');
  }
}

/** RFC 4180-style parser with escaped quotes and CRLF/LF/CR support. */
export function parseCsv(input: string, delimiter = ','): string[][] {
  assertDelimiter(delimiter);

  const source = input.startsWith('\uFEFF') ? input.slice(1) : input;
  if (source.length === 0) {
    return [];
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let afterQuote = false;
  let logicalRow = 1;
  let logicalColumn = 1;

  const finishField = (): void => {
    row.push(field);
    field = '';
    afterQuote = false;
    logicalColumn += 1;
  };

  const finishRow = (): void => {
    finishField();
    rows.push(row);
    row = [];
    logicalRow += 1;
    logicalColumn = 1;
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === undefined) {
      continue;
    }

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else if (character === '\r') {
        field += '\n';
        if (source[index + 1] === '\n') {
          index += 1;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (afterQuote) {
      if (character === delimiter) {
        finishField();
      } else if (character === '\r' || character === '\n') {
        if (character === '\r' && source[index + 1] === '\n') {
          index += 1;
        }
        finishRow();
      } else if (character !== ' ' && character !== '\t') {
        throw new CsvParseError(
          'Unexpected character after closing quote',
          logicalRow,
          logicalColumn,
        );
      }
      continue;
    }

    if (character === '"') {
      if (field.length !== 0) {
        throw new CsvParseError(
          'Quote must begin at the start of a field',
          logicalRow,
          logicalColumn,
        );
      }
      inQuotes = true;
    } else if (character === delimiter) {
      finishField();
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && source[index + 1] === '\n') {
        index += 1;
      }
      finishRow();
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    throw new CsvParseError('Unclosed quoted field', logicalRow, logicalColumn);
  }

  const endedWithNewline = /[\r\n]$/.test(source);
  if (!endedWithNewline || field.length > 0 || row.length > 0 || afterQuote) {
    finishRow();
  }

  return rows;
}

const TRUE_TOKENS = new Set(['true', 'yes', 'y', '1', 'x', 'checked']);
const FALSE_TOKENS = new Set(['', 'false', 'no', 'n', '0', 'unchecked']);

/** Returns null for an invalid token. Blank is the canonical x/blank false value. */
export function parseTruthToken(value: string): boolean | null {
  const normalized = value.trim().toLocaleLowerCase('en-US');
  if (TRUE_TOKENS.has(normalized)) {
    return true;
  }
  if (FALSE_TOKENS.has(normalized)) {
    return false;
  }
  return null;
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[\s-]+/g, '_');
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ');
}

function acceptedNames(item: CatalogItem): Set<string> {
  const values = new Set([normalizeName(item.name)]);
  if (item.formName) {
    values.add(normalizeName(item.formName));
    values.add(normalizeName(`${item.name} ${item.formName}`));
  }
  return values;
}

function collectionKey(formId: string, categoryId: CategoryId): string {
  return `${formId}\u0000${categoryId}`;
}

function parseDexNumber(rawValue: string): number | null {
  const value = rawValue.trim();
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

interface CatalogIndexes {
  byId: ReadonlyMap<string, CatalogItem>;
  byDex: ReadonlyMap<number, readonly CatalogItem[]>;
  byName: ReadonlyMap<string, readonly CatalogItem[]>;
}

function catalogIndexes(catalog: readonly CatalogItem[]): CatalogIndexes {
  const byId = new Map<string, CatalogItem>();
  const mutableByDex = new Map<number, CatalogItem[]>();
  const mutableByName = new Map<string, CatalogItem[]>();

  for (const item of catalog) {
    if (byId.has(item.id)) {
      throw new Error(`Duplicate catalog form id: ${item.id}`);
    }
    byId.set(item.id, item);

    const dexItems = mutableByDex.get(item.dexNumber) ?? [];
    dexItems.push(item);
    mutableByDex.set(item.dexNumber, dexItems);

    for (const name of acceptedNames(item)) {
      const nameItems = mutableByName.get(name) ?? [];
      nameItems.push(item);
      mutableByName.set(name, nameItems);
    }
  }

  return { byId, byDex: mutableByDex, byName: mutableByName };
}

interface HeaderIndexes {
  formId?: number;
  dexNumber?: number;
  name?: number;
  categories: ReadonlyMap<CategoryId, number>;
}

const HEADER_ALIASES: Readonly<Record<string, string>> = {
  form: 'form_id',
  dex: 'dex_number',
  dex_no: 'dex_number',
  pokedex_number: 'dex_number',
  pokemon: 'name',
  perfect: 'hundo',
};

function indexHeaders(headers: readonly string[], issues: CsvPreviewIssue[]): HeaderIndexes {
  const indexes = new Map<string, number>();

  headers.forEach((rawHeader, index) => {
    const normalized = normalizeHeader(rawHeader);
    const canonical = HEADER_ALIASES[normalized] ?? normalized;
    if (canonical.length === 0) {
      return;
    }
    if (indexes.has(canonical)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_header',
        row: 1,
        column: rawHeader,
        message: `The ${canonical} column appears more than once.`,
      });
      return;
    }
    indexes.set(canonical, index);
  });

  const categories = new Map<CategoryId, number>();
  for (const categoryId of CATEGORY_IDS) {
    const index = indexes.get(categoryId);
    if (index !== undefined) {
      categories.set(categoryId, index);
    }
  }

  return {
    formId: indexes.get('form_id'),
    dexNumber: indexes.get('dex_number'),
    name: indexes.get('name'),
    categories,
  };
}

function cell(row: readonly string[], index: number | undefined): string {
  return index === undefined ? '' : (row[index] ?? '');
}

function resolveByFallback(
  dexRaw: string,
  nameRaw: string,
  indexes: CatalogIndexes,
): readonly CatalogItem[] | null {
  let candidates: readonly CatalogItem[] | null = null;

  if (dexRaw.trim().length > 0) {
    const dexNumber = parseDexNumber(dexRaw);
    if (dexNumber === null) {
      return null;
    }
    candidates = indexes.byDex.get(dexNumber) ?? [];
  }

  if (nameRaw.trim().length > 0) {
    const nameCandidates = indexes.byName.get(normalizeName(nameRaw)) ?? [];
    candidates =
      candidates === null
        ? nameCandidates
        : candidates.filter((candidate) => nameCandidates.includes(candidate));
  }

  return candidates;
}

function resolveCatalogItem(
  row: readonly string[],
  rowNumber: number,
  headers: HeaderIndexes,
  indexes: CatalogIndexes,
  issues: CsvPreviewIssue[],
): CatalogItem | undefined {
  const formId = cell(row, headers.formId).trim();
  const dexRaw = cell(row, headers.dexNumber);
  const nameRaw = cell(row, headers.name);

  if (formId.length > 0) {
    const item = indexes.byId.get(formId);
    if (!item) {
      issues.push({
        severity: 'error',
        code: 'unmatched_form',
        row: rowNumber,
        column: 'form_id',
        message: `No catalog form matches ${formId}.`,
      });
      return undefined;
    }

    const dexNumber = dexRaw.trim().length === 0 ? item.dexNumber : parseDexNumber(dexRaw);
    const nameMatches =
      nameRaw.trim().length === 0 || acceptedNames(item).has(normalizeName(nameRaw));
    if (dexNumber !== item.dexNumber || !nameMatches) {
      issues.push({
        severity: 'error',
        code: 'identity_conflict',
        row: rowNumber,
        message: `The form_id, dex_number, and name do not identify the same catalog item.`,
      });
      return undefined;
    }
    return item;
  }

  if (dexRaw.trim().length === 0 && nameRaw.trim().length === 0) {
    issues.push({
      severity: 'error',
      code: 'missing_identity',
      row: rowNumber,
      message: 'Provide form_id, dex_number, or name.',
    });
    return undefined;
  }

  if (dexRaw.trim().length > 0 && parseDexNumber(dexRaw) === null) {
    issues.push({
      severity: 'error',
      code: 'invalid_dex_number',
      row: rowNumber,
      column: 'dex_number',
      message: `${dexRaw} is not a valid positive Pokedex number.`,
    });
    return undefined;
  }

  const candidates = resolveByFallback(dexRaw, nameRaw, indexes) ?? [];
  if (candidates.length === 1) {
    return candidates[0];
  }

  const defaults = candidates.filter((candidate) => candidate.isDefault);
  if (defaults.length === 1) {
    return defaults[0];
  }

  issues.push({
    severity: 'error',
    code: candidates.length === 0 ? 'unmatched_pokemon' : 'ambiguous_pokemon',
    row: rowNumber,
    message:
      candidates.length === 0
        ? 'No catalog item matches this row.'
        : 'This row matches multiple forms; provide form_id.',
  });
  return undefined;
}

type CellInstruction = 'true' | 'false' | 'ignore';

interface PendingCell {
  row: number;
  item: CatalogItem;
  categoryId: CategoryId;
  instruction: CellInstruction;
}

function instructionForCell(rawValue: string, policy: CsvImportPolicy): CellInstruction | null {
  const isEmpty = rawValue.trim().length === 0;
  if (isEmpty && policy !== 'replace') {
    return 'ignore';
  }

  const parsed = parseTruthToken(rawValue);
  if (parsed === null) {
    return null;
  }
  if (policy === 'merge' && !parsed) {
    return 'ignore';
  }
  return parsed ? 'true' : 'false';
}

export function previewCanonicalWideCsv(
  input: string,
  catalog: readonly CatalogItem[],
  currentEntries: readonly CollectionEntry[],
  policy: CsvImportPolicy,
): CsvImportPreview {
  const issues: CsvPreviewIssue[] = [];
  const rows = parseCsv(input);
  const sourceRows = Math.max(0, rows.length - 1);

  if (rows.length === 0) {
    return {
      policy,
      changes: [],
      issues: [
        {
          severity: 'error',
          code: 'empty_file',
          row: 1,
          message: 'The CSV file is empty.',
        },
      ],
      summary: {
        sourceRows: 0,
        resolvedRows: 0,
        added: 0,
        removed: 0,
        unchanged: 0,
        ignored: 0,
        rejected: 1,
      },
    };
  }

  const headerRow = rows[0] ?? [];
  const headers = indexHeaders(headerRow, issues);
  if (
    headers.formId === undefined &&
    headers.dexNumber === undefined &&
    headers.name === undefined
  ) {
    issues.push({
      severity: 'error',
      code: 'missing_identity_header',
      row: 1,
      message: 'CSV needs a form_id, dex_number, or name column.',
    });
  }
  if (headers.categories.size === 0) {
    issues.push({
      severity: 'error',
      code: 'missing_category_header',
      row: 1,
      message: 'CSV needs at least one supported collection category column.',
    });
  }

  const indexes = catalogIndexes(catalog);
  const pending = new Map<string, PendingCell>();
  const conflicted = new Set<string>();
  let resolvedRows = 0;

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const rowNumber = rowIndex + 1;
    if (row.every((value) => value.trim().length === 0)) {
      continue;
    }

    if (row.length > headerRow.length) {
      issues.push({
        severity: 'warning',
        code: 'extra_columns',
        row: rowNumber,
        message: 'Extra values beyond the header were ignored.',
      });
    }

    const item = resolveCatalogItem(row, rowNumber, headers, indexes, issues);
    if (!item) {
      continue;
    }
    resolvedRows += 1;

    for (const [categoryId, columnIndex] of headers.categories) {
      const rawValue = cell(row, columnIndex);
      const instruction = instructionForCell(rawValue, policy);
      if (instruction === null) {
        issues.push({
          severity: 'error',
          code: 'invalid_boolean',
          row: rowNumber,
          column: categoryId,
          message: `${rawValue} is not a recognized true/false value.`,
        });
        continue;
      }

      const key = collectionKey(item.id, categoryId);
      const previous = pending.get(key);
      if (previous) {
        if (previous.instruction !== instruction) {
          conflicted.add(key);
          issues.push({
            severity: 'error',
            code: 'conflicting_duplicate',
            row: rowNumber,
            column: categoryId,
            message: `Rows ${previous.row} and ${rowNumber} give conflicting values for ${item.name} ${categoryId}.`,
          });
        } else {
          issues.push({
            severity: 'warning',
            code: 'duplicate_value',
            row: rowNumber,
            column: categoryId,
            message: `This duplicates row ${previous.row} and will be applied once.`,
          });
        }
        continue;
      }

      pending.set(key, { row: rowNumber, item, categoryId, instruction });
    }
  }

  const current = new Set(
    currentEntries
      .filter((entry) => entry.collected)
      .map((entry) => collectionKey(entry.formId, entry.categoryId)),
  );
  const changes: CsvPreviewChange[] = [];

  for (const [key, candidate] of pending) {
    if (conflicted.has(key)) {
      continue;
    }
    const before = current.has(key);
    const ignored = candidate.instruction === 'ignore';
    const after =
      candidate.instruction === 'true' ? true : candidate.instruction === 'false' ? false : before;
    const disposition: CsvChangeDisposition = ignored
      ? 'ignored'
      : before === after
        ? 'unchanged'
        : after
          ? 'add'
          : 'remove';

    changes.push({
      row: candidate.row,
      formId: candidate.item.id,
      categoryId: candidate.categoryId,
      before,
      after,
      disposition,
    });
  }

  const count = (disposition: CsvChangeDisposition): number =>
    changes.filter((change) => change.disposition === disposition).length;
  const rejected = issues.filter((issue) => issue.severity === 'error').length;

  return {
    policy,
    changes,
    issues,
    summary: {
      sourceRows,
      resolvedRows,
      added: count('add'),
      removed: count('remove'),
      unchanged: count('unchanged'),
      ignored: count('ignored'),
      rejected,
    },
  };
}

export function makeSpreadsheetFormulaSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function serializeCell(value: CsvScalar, delimiter: string, formulaSafe: boolean): string {
  const isString = typeof value === 'string';
  let serialized = value === null || value === undefined ? '' : String(value);
  if (formulaSafe && isString) {
    serialized = makeSpreadsheetFormulaSafe(serialized);
  }
  if (serialized.includes(delimiter) || serialized.includes('"') || /[\r\n]/.test(serialized)) {
    return `"${serialized.replaceAll('"', '""')}"`;
  }
  return serialized;
}

export function serializeCsv(
  rows: readonly (readonly CsvScalar[])[],
  options: CsvSerializationOptions = {},
): string {
  const delimiter = options.delimiter ?? ',';
  const lineEnding = options.lineEnding ?? '\r\n';
  const formulaSafe = options.formulaSafe ?? true;
  assertDelimiter(delimiter);

  return rows
    .map((row) => row.map((value) => serializeCell(value, delimiter, formulaSafe)).join(delimiter))
    .join(lineEnding);
}

export function exportCollectionCsv(
  catalog: readonly CatalogItem[],
  entries: readonly CollectionEntry[],
): string {
  const collected = new Set(
    entries
      .filter((entry) => entry.collected)
      .map((entry) => collectionKey(entry.formId, entry.categoryId)),
  );
  const rows: CsvScalar[][] = [['dex_number', 'form_id', 'name', ...CATEGORY_IDS]];

  for (const item of [...catalog].sort(
    (left, right) => left.dexNumber - right.dexNumber || left.id.localeCompare(right.id),
  )) {
    rows.push([
      item.dexNumber,
      item.id,
      item.formName ? `${item.name} ${item.formName}` : item.name,
      ...CATEGORY_IDS.map((categoryId) => collected.has(collectionKey(item.id, categoryId))),
    ]);
  }

  return serializeCsv(rows);
}
