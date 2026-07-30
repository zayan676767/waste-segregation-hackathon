import { Router } from 'express';
import { db } from '../db.js';
import { toScan, parseId, optionalText, VALID_SOURCES, ValidationError } from '../helpers.js';
import { getStats } from '../stats.js';

export const scansRouter = Router();

const selectScan = db.prepare(
  `SELECT s.*, c.name AS category_name, c.color AS category_color
     FROM scans s
     LEFT JOIN categories c ON c.id = s.category_id
    WHERE s.id = ?`
);

scansRouter.get('/', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const rows = db
    .prepare(
      `SELECT s.*, c.name AS category_name, c.color AS category_color
         FROM scans s
         LEFT JOIN categories c ON c.id = s.category_id
        ORDER BY s.id DESC
        LIMIT ? OFFSET ?`
    )
    .all(limit, offset);

  const { total } = db.prepare('SELECT COUNT(*) AS total FROM scans').get();

  res.json({ scans: rows.map(toScan), total, limit, offset });
});

scansRouter.post('/', (req, res) => {
  const { categoryId, confidence, source, label, timestamp } = req.body ?? {};
  const errors = {};

  const id = parseId(categoryId);
  if (!id) {
    errors.categoryId = 'Must be a positive integer';
  } else {
    const exists = db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id);
    if (!exists) errors.categoryId = 'No category with that id';
  }

  const conf = Number(confidence);
  if (!Number.isFinite(conf) || conf < 0 || conf > 1) {
    errors.confidence = 'Must be a number between 0 and 1';
  }

  if (!VALID_SOURCES.includes(source)) {
    errors.source = `Must be one of: ${VALID_SOURCES.join(', ')}`;
  }

  if (Object.keys(errors).length) throw new ValidationError(errors);

  // An explicit timestamp is accepted so a queued offline scan keeps its real
  // time; anything unparseable falls back to now rather than failing the scan.
  let createdAt = null;
  if (timestamp !== undefined && timestamp !== null) {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      createdAt = parsed.toISOString().slice(0, 19).replace('T', ' ');
    }
  }

  const result = createdAt
    ? db
        .prepare(
          `INSERT INTO scans (category_id, label, confidence, source, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(id, optionalText(label, { max: 120 }) ?? '', conf, source, createdAt)
    : db
        .prepare(
          `INSERT INTO scans (category_id, label, confidence, source)
           VALUES (?, ?, ?, ?)`
        )
        .run(id, optionalText(label, { max: 120 }) ?? '', conf, source);

  const scan = toScan(selectScan.get(result.lastInsertRowid));

  // The dashboard listens for `scan` to append to its live feed, and for
  // `stats` to refresh its totals and chart — no polling, no refetch.
  const io = req.app.get('io');
  if (io) {
    io.emit('scan', scan);
    io.emit('stats', getStats());
  }

  res.status(201).json(scan);
});

scansRouter.delete('/', (req, res) => {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM scans').get();

  db.prepare('DELETE FROM scans').run();
  // Restart ids at 1 so a cleared log looks genuinely fresh on stage.
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'scans'").run();

  const io = req.app.get('io');
  if (io) {
    io.emit('scans:cleared');
    io.emit('stats', getStats());
  }

  res.json({ cleared: true, deleted: total });
});

scansRouter.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new ValidationError({ id: 'Must be a positive integer' });

  const result = db.prepare('DELETE FROM scans WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Scan not found' });

  const io = req.app.get('io');
  if (io) {
    io.emit('scans:cleared');
    io.emit('stats', getStats());
  }

  res.json({ deleted: true, id });
});
