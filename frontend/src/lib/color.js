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
 * Names the physical bin colour for a category swatch — "Green", "Blue",
 * "Yellow", "Grey"… — so a scan result can tell someone which coloured bin to
 * walk to, not just the abstract category.
 *
 * Category colours are admin-editable arbitrary hex, so this snaps the colour to
 * the nearest of a small set of named reference colours (simple RGB distance).
 * It is exact for the seeded palette and gives a sensible closest name for any
 * custom colour an admin might pick.
 */
const BIN_REFERENCES = [
  { name: 'Green', r: 0x22, g: 0xc5, b: 0x5e },
  { name: 'Blue', r: 0x3b, g: 0x82, b: 0xf6 },
  { name: 'Red', r: 0xef, g: 0x44, b: 0x44 },
  { name: 'Yellow', r: 0xea, g: 0xb3, b: 0x08 },
  { name: 'Orange', r: 0xf9, g: 0x73, b: 0x16 },
  { name: 'Brown', r: 0x92, g: 0x40, b: 0x0e },
  { name: 'Purple', r: 0xa8, g: 0x55, b: 0xf7 },
  { name: 'Pink', r: 0xec, g: 0x48, b: 0x99 },
  { name: 'Grey', r: 0x64, g: 0x74, b: 0x8b },
  { name: 'Grey', r: 0x80, g: 0x80, b: 0x80 },
  { name: 'White', r: 0xf5, g: 0xf5, b: 0xf5 },
  { name: 'Black', r: 0x14, g: 0x14, b: 0x14 }
];

export function binColorName(hex) {
  const { r, g, b } = parseHex(hex);
  let best = BIN_REFERENCES[0];
  let bestDist = Infinity;
  for (const ref of BIN_REFERENCES) {
    const dist = (r - ref.r) ** 2 + (g - ref.g) ** 2 + (b - ref.b) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = ref;
    }
  }
  return best.name;
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
