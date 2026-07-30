/**
 * Shared shaping + validation helpers.
 *
 * SQLite columns are snake_case; the API speaks camelCase. Conversion happens
 * here so route handlers stay readable and every endpoint is consistent.
 */

export function toCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    disposalTip: row.disposal_tip,
    impactText: row.impact_text,
    sortOrder: row.sort_order,
    createdAt: row.created_at
  };
}

export function toScan(row) {
  if (!row) return null;
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name ?? null,
    categoryColor: row.category_color ?? null,
    label: row.label,
    // Per-item detail from the vision model. Defaulted so a row written by the
    // offline fallback (which has none of this) still renders.
    itemDescription: row.item_description ?? '',
    material: row.material ?? '',
    disposalInstructions: row.disposal_instructions ?? '',
    environmentalNote: row.environmental_note ?? '',
    engine: row.engine ?? 'gemini',
    confidence: row.confidence,
    source: row.source,
    createdAt: row.created_at
  };
}

export function toLabelMapping(row) {
  if (!row) return null;
  return {
    id: row.id,
    keyword: row.keyword,
    categoryId: row.category_id,
    categoryName: row.category_name ?? null
  };
}

/** Settings are stored as TEXT; cast back to the declared type on read. */
export function castSetting(value, type) {
  if (type === 'number') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (type === 'boolean') return value === 'true' || value === '1';
  return value;
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidColor(value) {
  return typeof value === 'string' && HEX_COLOR.test(value.trim());
}

export const VALID_SOURCES = ['live', 'snap', 'sample'];

/** Collects field errors so the client gets all problems in one response. */
export class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.status = 400;
    this.errors = errors;
  }
}

export function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Trims a string field and enforces a max length.
 * Returns undefined when the field is absent, so PATCH-style partial updates
 * can tell "not provided" apart from "provided as empty".
 */
export function optionalText(value, { max = 2000 } = {}) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}
