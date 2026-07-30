/**
 * MobileNet wrapper.
 *
 * Two things here are deliberate and easy to get wrong:
 *
 * 1. `inputRange: [0, 1]`. The mobilenet package only applies each model's
 *    declared input range when it builds the URL itself; pass a custom
 *    `modelUrl` and it silently falls back to [-1, 1], which produces
 *    confidently WRONG predictions. It must be stated explicitly.
 *
 * 2. The model is served from our own /model folder. The package's built-in URLs
 *    point at tfhub.dev, which now redirects to Kaggle and returns HTTP 400 —
 *    the default load path is broken. Self-hosting also means the demo needs no
 *    internet at all once loaded.
 */
const LOCAL_MODEL_URL = '/model/model.json';
const FALLBACK_MODEL_URL =
  'https://storage.googleapis.com/tfjs-models/savedmodel/mobilenet_v2_1.0_224/model.json';

let modelPromise = null;
let libsPromise = null;
let loadedFrom = null;

export function getModelSource() {
  return loadedFrom;
}

/**
 * TensorFlow.js is ~2 MB of JavaScript. Importing it dynamically keeps it out of
 * the initial bundle so the UI paints immediately on a phone and the library
 * downloads in the background while the user reads the screen.
 */
function getLibs() {
  if (!libsPromise) {
    libsPromise = Promise.all([
      import('@tensorflow/tfjs'),
      import('@tensorflow-models/mobilenet')
    ]).then(([tf, mobilenet]) => ({ tf, mobilenet }));
  }
  return libsPromise;
}

/** Loads once per tab; repeat calls share the same promise. */
export function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const { tf, mobilenet } = await getLibs();
      await tf.ready();

      const attempt = async (url, source) => {
        const model = await mobilenet.load({
          version: 2,
          alpha: 1.0,
          modelUrl: url,
          inputRange: [0, 1]
        });
        loadedFrom = source;
        return model;
      };

      try {
        return await attempt(LOCAL_MODEL_URL, 'local');
      } catch (localError) {
        console.warn('[classifier] local model failed, trying CDN:', localError.message);
        try {
          return await attempt(FALLBACK_MODEL_URL, 'cdn');
        } catch {
          // Reset so a Retry button can genuinely try again, and surface the
          // local error — that is the one the developer can fix.
          modelPromise = null;
          throw localError;
        }
      }
    })();
  }
  return modelPromise;
}

/**
 * Classifies a video, canvas or image element.
 * Returns the top predictions as { label, confidence } with confidence as a
 * 0-1 fraction, matching the unit convention used by the database.
 *
 * topK is 8 rather than 3 because resolvePrediction() sums confidence across
 * every returned label that maps to the same category, and the useful evidence
 * is often spread down the list (a phone scores remote control + modem + …).
 */
export async function classify(model, element, topK = 8) {
  const raw = await model.classify(element, topK);
  return raw.map((p) => ({ label: p.className, confidence: p.probability }));
}

/**
 * Resolves a model label such as "water bottle" to a category using the
 * keyword mappings from the API.
 *
 * The API returns mappings ordered longest-keyword-first, so the first match is
 * the most specific one — "plastic bag" wins over "bag". Nothing about the
 * mapping lives in this file; it is all database-driven and admin-editable.
 */
export function matchCategory(label, mappings) {
  if (!label || !Array.isArray(mappings)) return null;
  const text = label.toLowerCase();
  for (const mapping of mappings) {
    if (text.includes(mapping.keyword)) return mapping;
  }
  return null;
}

/**
 * Turns raw predictions into the decision the UI renders.
 *
 * Confidence is summed PER CATEGORY rather than judged on the single top label,
 * because MobileNet routinely splits its certainty between sibling labels that
 * mean the same bin. A real photo of a plastic bottle scores "water bottle" 44%
 * and "pop bottle" 41%: the model is ~85% sure it is a bottle and merely unsure
 * which kind. Reading only the top label throws that away and reports 44%, which
 * fell under the threshold and produced a needless "unsure" on an obvious item.
 *
 * What matters for this app is the bin, not the exact object — so the score that
 * gets compared against the threshold is the category's total.
 *
 * `status` is one of:
 *   'ok'       - a category cleared the threshold
 *   'unsure'   - the best category was below the threshold
 *   'unmapped' - something was recognised but no keyword matches any of it
 */
export function resolvePrediction(predictions, mappings, threshold) {
  if (!predictions?.length) {
    return { status: 'unmapped', label: null, confidence: 0, mapping: null };
  }

  const totals = new Map(); // categoryId -> accumulated evidence
  for (const prediction of predictions) {
    const mapping = matchCategory(prediction.label, mappings);
    if (!mapping) continue;

    const existing = totals.get(mapping.categoryId);
    if (existing) {
      existing.score += prediction.confidence;
      // Keep the strongest label so the card names the actual object.
      if (prediction.confidence > existing.bestConfidence) {
        existing.bestConfidence = prediction.confidence;
        existing.bestLabel = prediction.label;
        existing.mapping = mapping;
      }
    } else {
      totals.set(mapping.categoryId, {
        score: prediction.confidence,
        bestConfidence: prediction.confidence,
        bestLabel: prediction.label,
        mapping
      });
    }
  }

  if (totals.size === 0) {
    const top = predictions[0];
    return { status: 'unmapped', label: top.label, confidence: top.confidence, mapping: null };
  }

  const winner = [...totals.values()].sort((a, b) => b.score - a.score)[0];
  // Summing can exceed 1 when many labels map to one category; clamp so the
  // progress bar and the stored value stay a valid 0-1 fraction.
  const confidence = Math.min(1, winner.score);

  // How sure the model is of the specific OBJECT, as opposed to the bin. These
  // diverge a lot: a battery lands in Hazardous with high category confidence
  // while its best object guess is "rubber eraser" at 34%, because ImageNet has
  // no battery class. The UI uses this to caveat the displayed item name instead
  // of presenting a rough guess as fact.
  const labelConfidence = winner.bestConfidence;

  if (confidence < threshold) {
    // Report the same category and score that were compared against the
    // threshold, so the "closest guess … at only N%" line is consistent with
    // why it was rejected.
    return { status: 'unsure', label: winner.bestLabel, confidence, labelConfidence, mapping: null };
  }

  return {
    status: 'ok',
    label: winner.bestLabel,
    confidence,
    labelConfidence,
    mapping: winner.mapping
  };
}

/**
 * Below this, the specific object name is treated as a rough match and the UI
 * says so. The bin can still be trusted — that is what `confidence` measures.
 */
export const LABEL_TRUST_THRESHOLD = 0.4;

/** Tidies a model label: "pop bottle, soda bottle" -> "Pop bottle". */
export function prettyLabel(label) {
  if (!label) return '';
  const first = label.split(',')[0].trim();
  return first.charAt(0).toUpperCase() + first.slice(1);
}
