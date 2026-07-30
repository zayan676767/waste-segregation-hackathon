/**
 * Gemini vision classification.
 *
 * Why this exists: MobileNet only knows 1000 fixed ImageNet classes and has no
 * concept of "battery" or "sheet of paper" at all — it scored a real AAA cell as
 * "rubber eraser" at 34%. Gemini reads the actual label and returns a real name,
 * a description, and disposal steps specific to that object.
 *
 * Two hard constraints shape this file:
 *
 * 1. ONE image per request, always. The free tier allows 15 requests/minute per
 *    key, so nothing here retries speculatively or fans out.
 * 2. Categories are never hardcoded. The live category list is injected into the
 *    prompt AND into the response schema's enum on every call, so Gemini can only
 *    answer with a category that currently exists in the database. Rename one in
 *    admin and the next scan follows automatically.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Models are tried in order until one answers. This is not premature
 * engineering — free-tier quotas here are small, per-model, and wildly
 * uneven, and every one of these facts was measured against the live API
 * rather than assumed:
 *
 *   gemini-3.1-flash-lite     ~1.3s, 100% on the battery test  <- primary
 *   gemini-3.5-flash-lite     ~1.3s, 99%
 *   gemini-flash-lite-latest  ~4.1s, 98%   (maintained alias, slower)
 *   gemini-flash-latest       resolves to gemini-3.6-flash: only 20 req/DAY
 *   gemini-2.0-flash / -lite  limit 0 — not on the free tier at all
 *   gemini-2.5-flash          404, "no longer available to new users"
 *   gemini-3-flash-preview    ~26s — far too slow to sit behind a camera
 *
 * A single quota-exhausted model therefore degrades to the next one instead
 * of ending the scan. Ordered fastest-and-most-accurate first; the maintained
 * alias sits last as the future-proof backstop if the pinned ids ever retire.
 */
const MODEL_CHAIN = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];
const REQUEST_TIMEOUT_MS = 25000;

/**
 * Keys are pooled to multiply the free daily quota: 1500 requests/day each, so
 * two keys give 3000. Reads GEMINI_API_KEY plus GEMINI_API_KEY_2..9.
 */
export function getApiKeys() {
  const keys = [];
  const primary = process.env.GEMINI_API_KEY?.trim();
  if (primary) keys.push(primary);
  for (let i = 2; i <= 9; i++) {
    const extra = process.env[`GEMINI_API_KEY_${i}`]?.trim();
    if (extra) keys.push(extra);
  }
  return keys;
}

export function isConfigured() {
  return getApiKeys().length > 0;
}

/**
 * Never log or return a whole key — only enough to tell two apart.
 *
 * Deliberately does NOT validate the key's prefix. Google AI Studio issues
 * "AQ."-prefixed keys as well as the older "AIzaSy" ones, so prefix-matching
 * produced a false "wrong key type" warning on a perfectly valid key. The only
 * reliable check is whether the API accepts it.
 */
export function describeKeys() {
  return getApiKeys().map((k, i) => ({
    index: i + 1,
    hint: `${k.slice(0, 6)}…${k.slice(-4)}`
  }));
}

/** The model fallback chain, for display in admin/status. */
export function getModelChain() {
  const override = process.env.GEMINI_MODEL;
  return override ? [override] : [...MODEL_CHAIN];
}

// Rotates across calls so load spreads evenly instead of hammering key 1 until
// it hits the per-minute limit.
let nextKeyIndex = 0;

/** A failure the caller can act on, carrying whether a retry could ever help. */
export class GeminiError extends Error {
  constructor(message, { status = 0, reason = '', retryable = false } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.reason = reason;
    this.retryable = retryable;
  }
}

function buildResponseSchema(categoryNames) {
  return {
    type: 'object',
    properties: {
      isWasteItem: {
        type: 'boolean',
        description: 'False if the image shows no identifiable object, or only a hand, background or empty surface.'
      },
      itemName: {
        type: 'string',
        description:
          'The general TYPE of object, in Title Case, as a common noun phrase — e.g. "Plastic Water Bottle", "AAA Alkaline Battery", "Banana Peel", "Smartphone", "Cardboard Box". Never a brand, manufacturer or model name, even if printed on the object. A specific type is fine ("AAA Alkaline Battery"); a brand is not ("Duracell Battery").'
      },
      itemDescription: {
        type: 'string',
        description:
          'One or two sentences describing what the object is and what it is made of. Describe it generically — do not name the brand even if visible.'
      },
      category: {
        type: 'string',
        enum: [...categoryNames, 'Unknown'],
        description: 'Which waste stream this belongs in. Must be one of the listed values.'
      },
      confidence: {
        type: 'number',
        description: 'How certain you are of the identification, from 0 to 1.'
      },
      disposalInstructions: {
        type: 'string',
        description:
          'Two or three short, concrete sentences for disposing of this TYPE of object. Plain flowing prose only — do not number or bullet the steps yourself (no "1.", "2.", "Step 1:"); the app numbers them for display.'
      },
      environmentalNote: {
        type: 'string',
        description: 'One interesting, specific fact about the environmental impact of this particular object being disposed of correctly or incorrectly. Include a number where you can.'
      },
      material: {
        type: 'string',
        description: 'The primary material, e.g. "PET plastic", "alkaline / steel", "organic matter", "cardboard". No brand names.'
      }
    },
    required: [
      'isWasteItem',
      'itemName',
      'itemDescription',
      'category',
      'confidence',
      'disposalInstructions',
      'environmentalNote',
      'material'
    ]
  };
}

function buildPrompt(categories) {
  const lines = categories.map(
    (c) => `- ${c.name}: ${c.disposalTip || 'no guidance recorded'}`
  );

  return `You are the vision system for a waste segregation assistant. A person has photographed a single item and needs to know which bin it goes in.

Identify the item in the image and assign it to exactly one of these waste categories:

${lines.join('\n')}

Rules:
- Name the TYPE of object, not the category and not the brand. "AAA Alkaline Battery", not "hazardous waste" and not "Duracell Battery". Use Title Case.
- Never use a brand, manufacturer or model name anywhere in your answer, even if it is printed on the object or clearly visible. Describe what the object generically IS, not whose product it is.
- Write disposalInstructions for this TYPE of object specifically. If it is a battery, say where batteries go; do not repeat generic category advice. Write it as plain sentences — do not add your own numbering or bullets.
- If the image shows no clear object — only a hand, a bare surface, or a blurred scene — set isWasteItem to false and set category to "Unknown".
- If the object genuinely does not fit any listed category, use "Unknown".
- Be honest in confidence. Use a low value when the image is unclear.
- Keep every text field short enough to read on a phone screen.`;
}

/**
 * Classifies one image.
 *
 * @param {object} args
 * @param {string} args.imageBase64  Raw base64, no data: URL prefix.
 * @param {string} args.mimeType
 * @param {Array}  args.categories   Live rows from the database.
 * @param {string} [args.model]
 */
export async function classifyImage({ imageBase64, mimeType = 'image/jpeg', categories, model }) {
  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new GeminiError('No Gemini API key configured. Add GEMINI_API_KEY to backend/.env', {
      reason: 'NOT_CONFIGURED'
    });
  }
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new GeminiError('No categories exist to classify into', { reason: 'NO_CATEGORIES' });
  }

  // An explicit override (arg or env) wins; otherwise walk the chain.
  const override = model || process.env.GEMINI_MODEL;
  const models = override ? [override] : MODEL_CHAIN;
  const categoryNames = categories.map((c) => c.name);

  const body = {
    contents: [
      {
        parts: [
          { text: buildPrompt(categories) },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema(categoryNames),
      temperature: 0
    }
  };

  // Walk models, and within each model walk keys. Quota is tracked per key AND
  // per model, so an exhausted combination is worth retrying on either axis
  // before giving up on the scan entirely.
  let lastError = null;

  for (const modelName of models) {
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const key = keys[(nextKeyIndex + attempt) % keys.length];
      const startedAt = Date.now();

      try {
        const result = await callGemini({ key, modelName, body });
        nextKeyIndex = (nextKeyIndex + attempt + 1) % keys.length;
        return {
          ...normalise(result, categories),
          engine: 'gemini',
          model: modelName,
          latencyMs: Date.now() - startedAt
        };
      } catch (err) {
        lastError = err;
        // A rejected request (bad key, malformed body) fails identically on
        // every key, so stop cycling keys — but a model that is exhausted or
        // missing may still work on the next model, so keep walking those.
        if (!err.retryable) break;
      }
    }

    // Out of keys for this model. Only move to the next model when the failure
    // was quota- or availability-related; anything else will fail there too.
    if (lastError && !isModelSpecific(lastError)) break;
  }

  throw lastError ?? new GeminiError('Gemini request failed', { reason: 'UNKNOWN' });
}

/** Whether a failure is worth retrying on a different model. */
function isModelSpecific(err) {
  return (
    err.status === 429 ||
    err.status === 404 ||
    err.reason === 'RESOURCE_EXHAUSTED' ||
    err.reason === 'NOT_FOUND' ||
    err.status >= 500
  );
}

async function callGemini({ key, modelName, body }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${API_BASE}/${modelName}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new GeminiError(`Gemini did not respond within ${REQUEST_TIMEOUT_MS / 1000}s`, {
        reason: 'TIMEOUT',
        retryable: true
      });
    }
    throw new GeminiError(`Could not reach Gemini: ${err.message}`, {
      reason: 'NETWORK',
      retryable: true
    });
  } finally {
    clearTimeout(timer);
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const reason = json?.error?.details?.[0]?.reason || json?.error?.status || 'HTTP_ERROR';
    const message = json?.error?.message || `Gemini returned HTTP ${res.status}`;
    throw new GeminiError(message, {
      status: res.status,
      reason,
      // 429 = quota; 5xx = transient. Both are worth another key or another go.
      retryable: res.status === 429 || res.status >= 500
    });
  }

  const candidate = json.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  if (!text) {
    const blocked = json.promptFeedback?.blockReason || candidate?.finishReason;
    throw new GeminiError(
      blocked ? `Gemini returned no answer (${blocked})` : 'Gemini returned an empty response',
      { reason: blocked || 'EMPTY', retryable: false }
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError('Gemini returned malformed JSON', { reason: 'BAD_JSON', retryable: true });
  }
}

/**
 * Maps Gemini's category NAME back onto a real database row.
 *
 * Matching by name is what keeps the "nothing hardcoded" rule intact: the names
 * came out of the database moments earlier, went into the schema enum, and come
 * back here to be resolved into an id.
 */
function normalise(raw, categories) {
  const name = String(raw.category ?? '').trim();
  const match = categories.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? null;

  const confidence = Number(raw.confidence);

  return {
    isWasteItem: raw.isWasteItem !== false,
    // toTitleCase and stripSelfNumbering are deterministic backstops, not a
    // substitute for the prompt rules above. An LLM instruction is a strong
    // steer, not a guarantee — capitalisation and self-numbering are cheap to
    // enforce in code, so the demo does not depend on the model complying
    // every single time.
    itemName: toTitleCase(text(raw.itemName, 120)),
    itemDescription: text(raw.itemDescription, 400),
    material: text(raw.material, 80),
    disposalInstructions: stripSelfNumbering(text(raw.disposalInstructions, 600)),
    environmentalNote: text(raw.environmentalNote, 400),
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    categoryId: match?.id ?? null,
    categoryName: match?.name ?? null,
    categoryColor: match?.color ?? null
  };
}

function text(value, max) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

// Lower-cased in the middle of a title unless they are the first/last word —
// standard Title Case convention (e.g. "Bag of Chips", not "Bag Of Chips").
const TITLE_CASE_MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'via'
]);

/**
 * "banana peel" -> "Banana Peel". Preserves existing acronyms like "AAA" or
 * "PET" instead of mangling them into "Aaa" / "Pet".
 */
function toTitleCase(value) {
  if (!value) return value;
  const words = value.split(/\s+/);
  return words
    .map((word, i) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word; // e.g. AAA, PET, USB
      const lower = word.toLowerCase();
      const isEdge = i === 0 || i === words.length - 1;
      if (!isEdge && TITLE_CASE_MINOR_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * Removes any "1. ", "2)" style numbering Gemini adds despite being told not
 * to, so a self-numbered response can never collide with the app's own
 * numbered steps (which produced a blank "1." row followed by unnumbered text
 * — the bug this exists to prevent).
 */
function stripSelfNumbering(value) {
  if (!value) return value;
  return value
    .replace(/(^|\s)\d{1,2}[.)]\s+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
