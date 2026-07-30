/**
 * Capture + classify pipeline.
 *
 * Gemini is the primary engine; an on-device MobileNet model is kept only as
 * an offline safety net. It is never loaded up front — pulling 14 MB of weights
 * on a hotspot to sit unused would be wasteful — so it is imported lazily the
 * first time Gemini is genuinely unavailable.
 */
import { api } from './api.js';

/**
 * Downscales a frame before upload.
 *
 * A modern phone camera frame is 4000px wide and megabytes of JPEG. Gemini gains
 * nothing from that, and on a mobile hotspot it is the difference between a scan
 * that feels instant and one that stalls. 1024px on the long edge keeps small
 * text like a battery's label readable, which is exactly what Gemini needs.
 */
export function frameToBase64(source, { maxEdge = 1024, quality = 0.82 } = {}) {
  const width = source.videoWidth || source.naturalWidth || source.width;
  const height = source.videoHeight || source.naturalHeight || source.height;
  if (!width || !height) throw new Error('Nothing to capture yet');

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return {
    base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
    dataUrl,
    width: canvas.width,
    height: canvas.height
  };
}

/** Loads an image file at its natural size (not the CSS-scaled thumbnail). */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

export async function getVisionStatus() {
  try {
    return await api.getClassifyStatus();
  } catch {
    return { configured: false, keyCount: 0, keys: [] };
  }
}

/**
 * Classifies one captured frame. Exactly one Gemini request per call.
 *
 * On failure, falls back to the on-device model so a dead hotspot or an
 * exhausted quota degrades the demo instead of ending it. The result carries
 * `engine` so the UI can be honest about which one answered.
 */
export async function classifyFrame({ base64, mimeType = 'image/jpeg', source }) {
  try {
    const result = await api.classify({ image: base64, mimeType, source });
    return { ...result, engine: 'gemini' };
  } catch (err) {
    const fallback = await classifyOffline({ base64, source }).catch(() => null);
    if (fallback) {
      return { ...fallback, engine: 'offline', fallbackReason: err.message };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Offline fallback — the on-device engine, loaded on demand only.
// ---------------------------------------------------------------------------

let offlineModulesPromise = null;

function getOfflineModules() {
  if (!offlineModulesPromise) {
    offlineModulesPromise = Promise.all([
      import('./classifier.js'),
      api.getLabelMap(),
      api.getCategories()
    ]).then(([classifier, mappings, categories]) => ({ classifier, mappings, categories }));
  }
  return offlineModulesPromise;
}

async function classifyOffline({ base64, source }) {
  const { classifier, mappings, categories } = await getOfflineModules();
  const model = await classifier.loadModel();

  const img = await loadImage(`data:image/jpeg;base64,${base64}`);
  const predictions = await classifier.classify(model, img);
  const resolved = classifier.resolvePrediction(predictions, mappings, 0.25);

  if (resolved.status !== 'ok' || !resolved.mapping) {
    return {
      status: 'unmapped',
      isWasteItem: true,
      itemName: classifier.prettyLabel(resolved.label) || 'Unrecognised item',
      itemDescription: '',
      material: '',
      disposalInstructions: '',
      environmentalNote: '',
      confidence: resolved.confidence ?? 0,
      categoryId: null,
      categoryName: null,
      categoryColor: null,
      scan: null
    };
  }

  const category = categories.find((c) => c.id === resolved.mapping.categoryId) ?? null;

  // Log it so the dashboard still moves while offline. Best-effort: if the
  // backend is what's unreachable, the classification still shows on screen.
  let scan = null;
  try {
    scan = await api.createScan({
      categoryId: resolved.mapping.categoryId,
      confidence: resolved.confidence,
      source,
      label: classifier.prettyLabel(resolved.label)
    });
  } catch {
    /* offline logging is optional */
  }

  return {
    status: 'ok',
    isWasteItem: true,
    itemName: classifier.prettyLabel(resolved.label),
    itemDescription: '',
    material: '',
    // The offline model cannot describe a specific item, so fall back to the
    // category's own guidance rather than inventing detail.
    disposalInstructions: category?.disposalTip ?? '',
    environmentalNote: category?.impactText ?? '',
    confidence: resolved.confidence,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    categoryColor: category?.color ?? null,
    scan
  };
}
