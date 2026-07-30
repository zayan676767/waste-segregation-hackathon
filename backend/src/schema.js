import { db } from './db.js';

/**
 * Seeds default data the first time only, so a fresh clone always boots into a
 * working app instead of an empty one. The tables themselves are created in
 * db.js — see the comment there for why they cannot be created from here.
 */
export function seedDatabase() {
  seedCategories();
  seedSettings();
  seedLabelMap();
}

const DEFAULT_CATEGORIES = [
  {
    name: 'Biodegradable',
    color: '#22c55e',
    disposal_tip:
      'Put this in the green wet-waste bin. Keep it free of plastic wrappers so it can be composted. If you have a garden or a community compost pit, this is perfect for it.',
    impact_text:
      'Composting 1 kg of food waste avoids about 0.5 kg of CO₂e in methane emissions from landfill — and returns nutrients to the soil.',
    sort_order: 1
  },
  {
    name: 'Recyclable',
    color: '#3b82f6',
    disposal_tip:
      'Rinse it, let it dry, and place it in the blue dry-waste bin. Flatten bottles and boxes to save space. Food residue is what usually gets a whole batch rejected.',
    impact_text:
      'Recycling one plastic bottle saves roughly 0.08 kg CO₂e. One recycled aluminium can saves enough energy to run a TV for about 3 hours.',
    sort_order: 2
  },
  {
    name: 'Hazardous',
    color: '#ef4444',
    disposal_tip:
      'Do NOT put this in a household bin. Take batteries, bulbs, electronics and chemicals to an e-waste or hazardous-waste collection point. Never break or burn it.',
    impact_text:
      'A single AA battery can contaminate up to 20 litres of water and 1 m² of soil. Correct e-waste disposal also recovers scarce metals like gold and cobalt.',
    sort_order: 3
  }
];

function seedCategories() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM categories').get();
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO categories (name, color, disposal_tip, impact_text, sort_order)
    VALUES (@name, @color, @disposal_tip, @impact_text, @sort_order)
  `);

  db.transaction(() => {
    for (const category of DEFAULT_CATEGORIES) insert.run(category);
  })();

  console.log('[db] seeded default categories');
}

const DEFAULT_SETTINGS = [
  {
    // 0.25, not 0.6. The score compared against this is a category total summed
    // across the model's top labels, and measured values on real photos land
    // around 0.5-0.9 for clear items and 0.15-0.3 for genuinely ambiguous ones.
    // A 0.6 gate rejected an obvious plastic bottle, because MobileNet spread
    // its certainty across "water bottle" and "pop bottle".
    key: 'confidence_threshold',
    value: '0.25',
    type: 'number',
    label: 'Minimum confidence (0-1) before a result is trusted'
  },
  {
    key: 'inference_interval_ms',
    value: '1500',
    type: 'number',
    label: 'Milliseconds between predictions in live camera mode'
  },
  {
    key: 'app_title',
    value: 'Smart Waste Segregation Assistant',
    type: 'string',
    label: 'Title shown in the app header'
  },
  {
    key: 'unsure_message',
    value: 'Unsure — try again with better lighting',
    type: 'string',
    label: 'Message shown when confidence is below the threshold'
  }
];

function seedSettings() {
  // Insert-if-missing rather than all-or-nothing, so new settings added in a
  // later version still appear in an existing database.
  const insert = db.prepare(`
    INSERT INTO settings (key, value, type, label)
    VALUES (@key, @value, @type, @label)
    ON CONFLICT(key) DO NOTHING
  `);

  db.transaction(() => {
    for (const setting of DEFAULT_SETTINGS) insert.run(setting);
  })();
}

// Keywords matched against the classifier's output label, case-insensitively.
// Longer keywords win, so "plastic bag" beats "bag".
const DEFAULT_LABEL_MAP = {
  Biodegradable: [
    'banana', 'orange', 'lemon', 'apple', 'granny smith', 'pineapple',
    'strawberry', 'fig', 'pomegranate', 'jackfruit', 'custard apple',
    'corn', 'broccoli', 'cauliflower', 'cucumber', 'zucchini', 'squash',
    'bell pepper', 'mushroom', 'artichoke', 'cabbage', 'cardoon',
    'bagel', 'pretzel', 'loaf', 'bread', 'dough', 'pizza', 'hot dog',
    'hamburger', 'cheeseburger', 'burrito', 'guacamole', 'mashed potato',
    'carbonara', 'trifle', 'ice cream', 'espresso', 'eggnog',
    'leaf', 'flower', 'daisy', 'plant', 'petal', 'acorn', 'ear', 'hay',
    'wood', 'log', 'bamboo', 'coral fungus', 'earthstar'
  ],
  Recyclable: [
    'bottle', 'pop bottle', 'water bottle', 'beer bottle', 'wine bottle',
    'pill bottle', 'jug', 'flask', 'vase', 'jar', 'glass', 'goblet',
    'beer glass', 'cup', 'coffee mug', 'measuring cup', 'bowl',
    'can', 'tin', 'milk can', 'canister', 'foil', 'aluminium', 'aluminum',
    'carton', 'box', 'crate', 'cardboard', 'packet', 'paper', 'paper towel',
    'toilet tissue', 'envelope', 'notebook', 'binder', 'book', 'comic book',
    'book jacket', 'menu', 'newspaper', 'magazine', 'plastic bag', 'shopping bag',
    'tray', 'bucket', 'pail', 'basket', 'tub', 'lid', 'cap', 'straw',
    'spatula', 'ladle', 'strainer', 'wire', 'nail', 'screw', 'safety pin'
  ],
  Hazardous: [
    'battery', 'accumulator', 'cellular telephone', 'cellphone', 'telephone',
    'dial telephone', 'laptop', 'computer', 'desktop computer', 'notebook computer',
    'monitor', 'screen', 'television', 'crt', 'ipod', 'keyboard', 'typewriter keyboard',
    'mouse', 'printer', 'photocopier', 'hard disc', 'modem', 'radio', 'cassette',
    'cd player', 'tape player', 'remote control', 'joystick', 'digital clock',
    'digital watch', 'electric fan', 'switch', 'plug', 'power drill', 'soldering iron',
    'light bulb', 'bulb', 'lamp', 'lampshade', 'spotlight', 'candle', 'lighter',
    'matchstick', 'syringe', 'thermometer', 'medicine chest', 'pill', 'spray',
    'aerosol', 'paint', 'oil filter', 'gasmask', 'chain saw', 'lawn mower',
    // ImageNet has no "battery" class, so MobileNet cannot name one. A AA/AAA
    // cell is read as a small copper cylinder and scores "rubber eraser" first,
    // then lipstick. These two entries route that misread to Hazardous, which is
    // where a battery belongs. Remove them if erasers or cosmetics ever need to
    // classify correctly — this is a deliberate trade-off, not a taxonomy claim.
    'rubber eraser', 'lipstick'
  ]
};

function seedLabelMap() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM label_map').get();
  if (count > 0) return;

  const findCategory = db.prepare('SELECT id FROM categories WHERE name = ?');
  const insert = db.prepare(`
    INSERT INTO label_map (keyword, category_id)
    VALUES (?, ?)
    ON CONFLICT(keyword) DO NOTHING
  `);

  db.transaction(() => {
    for (const [categoryName, keywords] of Object.entries(DEFAULT_LABEL_MAP)) {
      const category = findCategory.get(categoryName);
      if (!category) continue;
      for (const keyword of keywords) insert.run(keyword.toLowerCase(), category.id);
    }
  })();

  const { count: seeded } = db.prepare('SELECT COUNT(*) AS count FROM label_map').get();
  console.log(`[db] seeded ${seeded} label keywords`);
}
