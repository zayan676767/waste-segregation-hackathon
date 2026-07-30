/**
 * Category colours come from the database and are edited by hand in the admin
 * panel, so they may be 3-digit (#fff) or 6-digit (#22c55e). Appending an alpha
 * suffix to a 3-digit hex produces an invalid colour that silently renders as
 * nothing, so every tint goes through here instead.
 */

const FALLBACK = { r: 148, g: 163, b: 184 }; // slate-400, used if a colour is unparseable

function parseHex(hex) {
  if (typeof hex !== 'string') return FALLBACK;
  const clean = hex.trim().replace(/^#/, '');

  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16)
    };
  }

  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }

  return FALLBACK;
}

/** Semi-transparent version of a category colour, safe for any hex length. */
export function tint(hex, alpha) {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Solid version, normalised to a valid 6-digit hex. */
export function solid(hex) {
  const { r, g, b } = parseHex(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Picks black or white text for a filled swatch of this colour, using the
 * WCAG relative-luminance formula — so a pale category colour chosen in admin
 * still yields readable text instead of white-on-yellow.
 */
export function readableTextOn(hex) {
  const { r, g, b } = parseHex(hex);
  const channel = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance > 0.45 ? '#0b1120' : '#ffffff';
}
