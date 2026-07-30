import { Router } from 'express';
import { db } from '../db.js';
import { toCategory, isValidColor, parseId, optionalText, ValidationError } from '../helpers.js';
import { getStats } from '../stats.js';

export const categoriesRouter = Router();

/**
 * Announces a category change to every connected client.
 *
 * A fresh `stats` snapshot goes out alongside the notification because the
 * dashboard's chart reads its colours and names from that snapshot. Without it,
 * renaming or recolouring a category in admin would not reach the dashboard
 * until somebody happened to scan something.
 */
function broadcastCategoryChange(req) {
  const io = req.app.get('io');
  if (!io) return;
  io.emit('categories:changed');
  io.emit('stats', getStats());
}

const selectAll = db.prepare(
  'SELECT * FROM categories ORDER BY sort_order ASC, id ASC'
);
const selectOne = db.prepare('SELECT * FROM categories WHERE id = ?');

categoriesRouter.get('/', (req, res) => {
  res.json(selectAll.all().map(toCategory));
});

categoriesRouter.get('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new ValidationError({ id: 'Must be a positive integer' });

  const category = toCategory(selectOne.get(id));
  if (!category) return res.status(404).json({ error: 'Category not found' });

  res.json(category);
});

categoriesRouter.post('/', (req, res) => {
  const { name, color, disposalTip, impactText, sortOrder } = req.body ?? {};
  const errors = {};

  const cleanName = optionalText(name, { max: 60 });
  if (!cleanName) errors.name = 'Name is required';
  if (!isValidColor(color)) errors.color = 'Must be a hex colour like #22c55e';

  if (Object.keys(errors).length) throw new ValidationError(errors);

  // Sort new categories to the end unless a position was given.
  const { maxOrder } = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM categories')
    .get();

  try {
    const result = db
      .prepare(
        `INSERT INTO categories (name, color, disposal_tip, impact_text, sort_order)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        cleanName,
        color.trim(),
        optionalText(disposalTip) ?? '',
        optionalText(impactText) ?? '',
        Number.isInteger(sortOrder) ? sortOrder : maxOrder + 1
      );

    const created = toCategory(selectOne.get(result.lastInsertRowid));
    broadcastCategoryChange(req);
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ValidationError({ name: 'A category with that name already exists' });
    }
    throw err;
  }
});

categoriesRouter.put('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new ValidationError({ id: 'Must be a positive integer' });

  const existing = selectOne.get(id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });

  const { name, color, disposalTip, impactText, sortOrder } = req.body ?? {};
  const errors = {};

  const cleanName = optionalText(name, { max: 60 });
  if (name !== undefined && !cleanName) errors.name = 'Name cannot be empty';
  if (color !== undefined && !isValidColor(color)) {
    errors.color = 'Must be a hex colour like #22c55e';
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);

  // Only overwrite fields the client actually sent.
  const next = {
    name: cleanName ?? existing.name,
    color: color !== undefined ? color.trim() : existing.color,
    disposal_tip: optionalText(disposalTip) ?? existing.disposal_tip,
    impact_text: optionalText(impactText) ?? existing.impact_text,
    sort_order: Number.isInteger(sortOrder) ? sortOrder : existing.sort_order
  };

  try {
    db.prepare(
      `UPDATE categories
          SET name = @name, color = @color, disposal_tip = @disposal_tip,
              impact_text = @impact_text, sort_order = @sort_order
        WHERE id = @id`
    ).run({ ...next, id });

    const updated = toCategory(selectOne.get(id));
    broadcastCategoryChange(req);
    res.json(updated);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ValidationError({ name: 'A category with that name already exists' });
    }
    throw err;
  }
});

categoriesRouter.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new ValidationError({ id: 'Must be a positive integer' });

  const existing = selectOne.get(id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });

  // ON DELETE CASCADE removes this category's keyword mappings and its scans
  // too, so the dashboard totals never reference a category that is gone.
  const { scanCount } = db
    .prepare('SELECT COUNT(*) AS scanCount FROM scans WHERE category_id = ?')
    .get(id);

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);

  broadcastCategoryChange(req);

  res.json({
    deleted: true,
    id,
    name: existing.name,
    deletedScans: scanCount
  });
});
