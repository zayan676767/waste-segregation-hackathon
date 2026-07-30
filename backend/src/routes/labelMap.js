import { Router } from 'express';
import { db } from '../db.js';
import { toLabelMapping, parseId, optionalText, ValidationError } from '../helpers.js';

export const labelMapRouter = Router();

const selectAllQuery = `
  SELECT m.*, c.name AS category_name
    FROM label_map m
    JOIN categories c ON c.id = m.category_id
   ORDER BY LENGTH(m.keyword) DESC, m.keyword ASC
`;

const selectOne = db.prepare(
  `SELECT m.*, c.name AS category_name
     FROM label_map m
     JOIN categories c ON c.id = m.category_id
    WHERE m.id = ?`
);

/**
 * Ordered longest-keyword-first so the frontend can take the first match and
 * get the most specific one — "plastic bag" wins over "bag".
 */
labelMapRouter.get('/', (req, res) => {
  res.json(db.prepare(selectAllQuery).all().map(toLabelMapping));
});

labelMapRouter.post('/', (req, res) => {
  const { keyword, categoryId } = req.body ?? {};
  const errors = {};

  const cleanKeyword = optionalText(keyword, { max: 60 })?.toLowerCase();
  if (!cleanKeyword) errors.keyword = 'Keyword is required';

  const id = parseId(categoryId);
  if (!id) {
    errors.categoryId = 'Must be a positive integer';
  } else if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id)) {
    errors.categoryId = 'No category with that id';
  }

  if (Object.keys(errors).length) throw new ValidationError(errors);

  try {
    const result = db
      .prepare('INSERT INTO label_map (keyword, category_id) VALUES (?, ?)')
      .run(cleanKeyword, id);

    req.app.get('io')?.emit('labelmap:changed');
    res.status(201).json(toLabelMapping(selectOne.get(result.lastInsertRowid)));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ValidationError({ keyword: 'That keyword is already mapped' });
    }
    throw err;
  }
});

labelMapRouter.put('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new ValidationError({ id: 'Must be a positive integer' });

  const existing = selectOne.get(id);
  if (!existing) return res.status(404).json({ error: 'Mapping not found' });

  const { keyword, categoryId } = req.body ?? {};
  const errors = {};

  const cleanKeyword = optionalText(keyword, { max: 60 })?.toLowerCase();
  if (keyword !== undefined && !cleanKeyword) errors.keyword = 'Keyword cannot be empty';

  let nextCategoryId = existing.category_id;
  if (categoryId !== undefined) {
    const parsed = parseId(categoryId);
    if (!parsed) {
      errors.categoryId = 'Must be a positive integer';
    } else if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(parsed)) {
      errors.categoryId = 'No category with that id';
    } else {
      nextCategoryId = parsed;
    }
  }

  if (Object.keys(errors).length) throw new ValidationError(errors);

  try {
    db.prepare('UPDATE label_map SET keyword = ?, category_id = ? WHERE id = ?').run(
      cleanKeyword ?? existing.keyword,
      nextCategoryId,
      id
    );

    req.app.get('io')?.emit('labelmap:changed');
    res.json(toLabelMapping(selectOne.get(id)));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ValidationError({ keyword: 'That keyword is already mapped' });
    }
    throw err;
  }
});

labelMapRouter.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new ValidationError({ id: 'Must be a positive integer' });

  const result = db.prepare('DELETE FROM label_map WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Mapping not found' });

  req.app.get('io')?.emit('labelmap:changed');
  res.json({ deleted: true, id });
});
