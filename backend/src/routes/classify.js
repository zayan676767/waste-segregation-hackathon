import { Router } from 'express';
import { db } from '../db.js';
import { toCategory, toScan, VALID_SOURCES, ValidationError } from '../helpers.js';
import { classifyImage, describeKeys, GeminiError, isConfigured } from '../gemini.js';
import { getStats } from '../stats.js';

export const classifyRouter = Router();

// A phone photo downscaled to ~1024px lands around 150-400KB of base64. This cap
// is generous enough for that and small enough to reject a full-resolution
// upload that would waste hotspot data and Gemini tokens.
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const selectCategories = db.prepare(
  'SELECT * FROM categories ORDER BY sort_order ASC, id ASC'
);
const selectScan = db.prepare(
  `SELECT s.*, c.name AS category_name, c.color AS category_color
     FROM scans s
     LEFT JOIN categories c ON c.id = s.category_id
    WHERE s.id = ?`
);

/** Whether the server can classify at all — the frontend checks this on load. */
classifyRouter.get('/status', (req, res) => {
  const keys = describeKeys();
  res.json({
    configured: isConfigured(),
    keyCount: keys.length,
    keys,
    // Two keys double the free daily quota; surfacing it makes the pooling
    // visible in admin instead of being a silent backend detail.
    dailyQuotaEstimate: keys.length * 1500,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  });
});

classifyRouter.post('/', async (req, res, next) => {
  try {
    const { image, mimeType, source } = req.body ?? {};
    const errors = {};

    if (typeof image !== 'string' || image.length < 100) {
      errors.image = 'Base64 image data is required';
    } else if (image.length > MAX_IMAGE_BYTES) {
      errors.image = 'Image is too large — resize before sending';
    }
    if (!VALID_SOURCES.includes(source)) {
      errors.source = `Must be one of: ${VALID_SOURCES.join(', ')}`;
    }
    if (Object.keys(errors).length) throw new ValidationError(errors);

    // Strip a data: URL prefix if the client sent one.
    const base64 = image.includes(',') ? image.slice(image.indexOf(',') + 1) : image;

    const categories = selectCategories.all().map(toCategory);
    if (categories.length === 0) {
      throw new ValidationError({ _: 'No categories exist. Add one in the admin panel first.' });
    }

    const result = await classifyImage({
      imageBase64: base64,
      mimeType: typeof mimeType === 'string' ? mimeType : 'image/jpeg',
      categories
    });

    // Nothing recognisable, or nothing that maps to a real category: report it
    // without writing a scan, so the dashboard is never padded with non-results.
    if (!result.isWasteItem || !result.categoryId) {
      return res.json({
        ...result,
        status: result.isWasteItem ? 'unmapped' : 'no-item',
        scan: null
      });
    }

    const insert = db.prepare(
      `INSERT INTO scans
         (category_id, label, item_description, material, disposal_instructions,
          environmental_note, engine, confidence, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const inserted = insert.run(
      result.categoryId,
      result.itemName,
      result.itemDescription,
      result.material,
      result.disposalInstructions,
      result.environmentalNote,
      result.engine,
      result.confidence,
      source
    );

    const scan = toScan(selectScan.get(inserted.lastInsertRowid));

    const io = req.app.get('io');
    if (io) {
      io.emit('scan', scan);
      io.emit('stats', getStats());
    }

    res.json({ ...result, status: 'ok', scan });
  } catch (err) {
    if (err instanceof GeminiError) {
      // 502 rather than 500: the failure is upstream, and the frontend uses this
      // to decide whether falling back to the on-device model makes sense.
      return res.status(502).json({
        error: err.message,
        reason: err.reason,
        retryable: err.retryable,
        upstreamStatus: err.status
      });
    }
    next(err);
  }
});
