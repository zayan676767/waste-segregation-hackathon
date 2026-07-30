import { db } from './db.js';
import { toScan } from './helpers.js';

/**
 * Aggregates for the dashboard. Kept in one place so the REST endpoint and the
 * Socket.IO broadcast after each scan always return an identical shape.
 */
export function getStats({ recentLimit = 25 } = {}) {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM scans').get();

  // LEFT JOIN from categories so a category with zero scans still appears in
  // the chart at 0 rather than vanishing.
  const byCategory = db
    .prepare(
      `SELECT c.id, c.name, c.color, c.sort_order, COUNT(s.id) AS count
         FROM categories c
         LEFT JOIN scans s ON s.category_id = c.id
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.id ASC`
    )
    .all()
    .map((row) => ({
      categoryId: row.id,
      name: row.name,
      color: row.color,
      count: row.count,
      percentage: total > 0 ? Math.round((row.count / total) * 1000) / 10 : 0
    }));

  const bySource = Object.fromEntries(
    db
      .prepare('SELECT source, COUNT(*) AS count FROM scans GROUP BY source')
      .all()
      .map((row) => [row.source, row.count])
  );

  const recentScans = db
    .prepare(
      `SELECT s.*, c.name AS category_name, c.color AS category_color
         FROM scans s
         LEFT JOIN categories c ON c.id = s.category_id
        ORDER BY s.id DESC
        LIMIT ?`
    )
    .all(recentLimit)
    .map(toScan);

  const { avgConfidence } = db
    .prepare('SELECT AVG(confidence) AS avgConfidence FROM scans')
    .get();

  return {
    totalScans: total,
    byCategory,
    bySource: { live: 0, snap: 0, sample: 0, ...bySource },
    averageConfidence: avgConfidence ?? 0,
    lastScanAt: recentScans[0]?.createdAt ?? null,
    recentScans,
    generatedAt: new Date().toISOString()
  };
}
