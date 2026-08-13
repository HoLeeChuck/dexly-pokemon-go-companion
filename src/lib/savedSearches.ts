export const SAVED_SEARCH_SCHEMA_VERSION = 1 as const;

export const SEARCH_QUALITIES = ['exact', 'compressed', 'candidate'] as const;
export type SearchQuality = (typeof SEARCH_QUALITIES)[number];

export const SEARCH_CLAUSE_POLARITIES = ['include', 'exclude'] as const;
export type SearchClausePolarity = (typeof SEARCH_CLAUSE_POLARITIES)[number];

export const SEARCH_CLAUSE_JOINS = ['and', 'or'] as const;
export type SearchClauseJoin = (typeof SEARCH_CLAUSE_JOINS)[number];

export interface SavedSearchClause {
  id: string;
  polarity: SearchClausePolarity;
  term: string;
  value?: string;
}

export interface SavedSearchBuilder {
  version: typeof SAVED_SEARCH_SCHEMA_VERSION;
  join: SearchClauseJoin;
  clauses: readonly SavedSearchClause[];
}

/**
 * Portable saved-search representation. `query` is always the authoritative
 * Pokemon GO search string. `builder` is optional so searches created outside
 * the visual builder remain portable.
 */
export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  quality: SearchQuality;
  interpretation?: string;
  builder?: SavedSearchBuilder;
  createdAt: string;
  updatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownKeyErrors(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): string[] {
  const allowedKeys = new Set(allowed);
  return Object.keys(value)
    .filter((key) => !allowedKeys.has(key))
    .map((key) => `${path}.${key} is not part of this schema.`);
}

function hasUnexpectedControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (code <= 31 && ![9, 10, 13].includes(code)) || code === 127;
  });
}

function isBoundedString(value: unknown, maximum: number, allowEmpty = false): value is string {
  return (
    typeof value === 'string' &&
    value.length <= maximum &&
    (allowEmpty || value.trim().length > 0) &&
    !hasUnexpectedControlCharacters(value)
  );
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
}

export function validateSavedSearch(value: unknown, path = 'savedSearch'): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];

  const errors = unknownKeyErrors(
    value,
    ['id', 'name', 'query', 'quality', 'interpretation', 'builder', 'createdAt', 'updatedAt'],
    path,
  );
  if (!isBoundedString(value.id, 128)) errors.push(`${path}.id must be a non-empty string.`);
  if (!isBoundedString(value.name, 120)) errors.push(`${path}.name must be a non-empty string.`);
  if (!isBoundedString(value.query, 4_000)) {
    errors.push(`${path}.query must be a non-empty search string.`);
  }
  if (!SEARCH_QUALITIES.includes(value.quality as SearchQuality)) {
    errors.push(`${path}.quality is not supported.`);
  }
  if (value.interpretation !== undefined && !isBoundedString(value.interpretation, 2_000, true)) {
    errors.push(`${path}.interpretation must be a string.`);
  }
  if (!isDateString(value.createdAt)) errors.push(`${path}.createdAt must be a valid date.`);
  if (!isDateString(value.updatedAt)) errors.push(`${path}.updatedAt must be a valid date.`);

  if (value.builder !== undefined) {
    if (!isRecord(value.builder)) {
      errors.push(`${path}.builder must be an object.`);
    } else {
      errors.push(
        ...unknownKeyErrors(value.builder, ['version', 'join', 'clauses'], `${path}.builder`),
      );
      if (value.builder.version !== SAVED_SEARCH_SCHEMA_VERSION) {
        errors.push(`${path}.builder.version is not supported.`);
      }
      if (!SEARCH_CLAUSE_JOINS.includes(value.builder.join as SearchClauseJoin)) {
        errors.push(`${path}.builder.join is not supported.`);
      }
      if (!Array.isArray(value.builder.clauses) || value.builder.clauses.length > 100) {
        errors.push(`${path}.builder.clauses must contain at most 100 clauses.`);
      } else {
        const ids = new Set<string>();
        value.builder.clauses.forEach((clause, index) => {
          const clausePath = `${path}.builder.clauses[${index}]`;
          if (!isRecord(clause)) {
            errors.push(`${clausePath} must be an object.`);
            return;
          }
          errors.push(...unknownKeyErrors(clause, ['id', 'polarity', 'term', 'value'], clausePath));
          if (!isBoundedString(clause.id, 128)) {
            errors.push(`${clausePath}.id must be a non-empty string.`);
          } else if (ids.has(clause.id)) {
            errors.push(`${clausePath}.id is duplicated.`);
          } else {
            ids.add(clause.id);
          }
          if (!SEARCH_CLAUSE_POLARITIES.includes(clause.polarity as SearchClausePolarity)) {
            errors.push(`${clausePath}.polarity is not supported.`);
          }
          if (!isBoundedString(clause.term, 120)) {
            errors.push(`${clausePath}.term must be a non-empty string.`);
          }
          if (clause.value !== undefined && !isBoundedString(clause.value, 500, true)) {
            errors.push(`${clausePath}.value must be a string.`);
          }
        });
      }
    }
  }

  return errors;
}

export function isSavedSearch(value: unknown): value is SavedSearch {
  return validateSavedSearch(value).length === 0;
}
