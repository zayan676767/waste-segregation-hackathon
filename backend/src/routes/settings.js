import { Router } from 'express';
import { db } from '../db.js';
import { castSetting, ValidationError } from '../helpers.js';

export const settingsRouter = Router();

const selectAll = db.prepare('SELECT * FROM settings ORDER BY key ASC');
const selectOne = db.prepare('SELECT * FROM settings WHERE key = ?');

/**
 * Returns settings twice over: `values` is a flat key -> typed value map that
 * the frontend can use directly, while `meta` carries the type and label the
 * admin panel needs to render the right input for each one.
 */
settingsRouter.get('/', (req, res) => {
  const rows = selectAll.all();

  const values = {};
  const meta = [];

  for (const row of rows) {
    values[row.key] = castSetting(row.value, row.type);
    meta.push({
      key: row.key,
      value: castSetting(row.value, row.type),
      type: row.type,
      label: row.label,
      updatedAt: row.updated_at
    });
  }

  res.json({ values, meta });
});

// Per-setting rules that protect the demo from an unusable value being saved.
const CONSTRAINTS = {
  confidence_threshold: {
    check: (v) => v >= 0 && v <= 1,
    message: 'Must be between 0 and 1 (0.6 means 60%)'
  },
  inference_interval_ms: {
    check: (v) => v >= 250 && v <= 10000,
    message: 'Must be between 250 and 10000 milliseconds'
  }
};

settingsRouter.put('/', (req, res) => {
  const updates = req.body ?? {};
  const keys = Object.keys(updates);

  if (keys.length === 0) {
    throw new ValidationError({ _: 'Provide at least one setting to update' });
  }

  const errors = {};
  const writes = [];

  for (const key of keys) {
    const row = selectOne.get(key);
    if (!row) {
      errors[key] = 'Unknown setting';
      continue;
    }

    const raw = updates[key];

    if (row.type === 'number') {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        errors[key] = 'Must be a number';
        continue;
      }
      const constraint = CONSTRAINTS[key];
      if (constraint && !constraint.check(parsed)) {
        errors[key] = constraint.message;
        continue;
      }
      writes.push({ key, value: String(parsed) });
      continue;
    }

    if (typeof raw !== 'string') {
      errors[key] = 'Must be a string';
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      errors[key] = 'Cannot be empty';
      continue;
    }
    writes.push({ key, value: trimmed.slice(0, 500) });
  }

  if (Object.keys(errors).length) throw new ValidationError(errors);

  const update = db.prepare(
    "UPDATE settings SET value = @value, updated_at = datetime('now') WHERE key = @key"
  );
  db.transaction(() => {
    for (const write of writes) update.run(write);
  })();

  const rows = selectAll.all();
  const values = {};
  for (const row of rows) values[row.key] = castSetting(row.value, row.type);

  // Camera and dashboard clients apply the new threshold without a reload.
  req.app.get('io')?.emit('settings:changed', values);

  res.json({ values, updated: writes.map((w) => w.key) });
});
