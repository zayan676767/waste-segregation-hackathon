# ♻️ Smart Waste Segregation Assistant (v2)

Point a phone camera at a waste item and tap the shutter. **Google Gemini**
identifies the actual object — not just its bin — and returns a real name, a
description, and disposal steps written for that specific item, then pushes the
scan to a live dashboard that can be projected on a second screen.

- **v2 uses Gemini vision**, not the on-device model v1 used. MobileNet
  (ImageNet-based) has no concept of "battery" or "smartphone" and misidentified
  both; Gemini reads actual labels and brands. See "The classifier" below.
- **Nothing is hardcoded.** Category names, colours, disposal tips, impact text and the
  confidence threshold all live in SQLite and are editable from the admin panel —
  and the live category list is sent to Gemini on every scan, so an admin edit
  applies to the very next photo.
- **One Gemini request per scan, always.** There is no continuous/live mode in v2
  — every classification is a deliberate tap, which keeps well under the free
  tier's 15 requests/minute limit.
- **Multiple API keys pool automatically** to multiply the free daily quota
  (1500 requests/day per key). See "Gemini setup" below.
- **Falls back to the on-device model** if Gemini is unreachable (network down,
  quota exhausted), so a bad connection degrades the demo instead of breaking it.

---

## Quick start on a fresh machine

You need **Node.js 20 or newer** and **Git**. Check with:

```bash
node -v
```

### 1. Get the code

```bash
git clone https://github.com/zayan676767/waste-segregation-hackathon.git
```

```bash
cd waste-segregation-hackathon
```

### 2. Install everything (one command)

```bash
npm run install:all
```

> **If you see a warning about "install scripts not yet covered by allowScripts"**,
> the two packages that need them (`better-sqlite3` and `esbuild`) are already
> pre-approved in this repo's `package.json` files, so it should not appear.
> If it does, run `npm approve-scripts better-sqlite3` inside `backend/` and
> `npm approve-scripts esbuild` inside `frontend/`.

### 3. Gemini setup (required for real identification)

Create `backend/.env` (git-ignored — never commit this file):

```
GEMINI_API_KEY=your-key-here
```

Get a key at **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**
— use the **"Default Gemini Project"** option, not a Google Cloud Console
project (a Cloud project may not have the Generative Language API enabled).

**Add a second key to double your free quota** (1500 requests/day → 3000/day):

```
GEMINI_API_KEY_2=a-second-key-from-a-different-account
```

The backend round-robins between every key it finds (`GEMINI_API_KEY`,
`GEMINI_API_KEY_2` … `_9`) and automatically retries on the next key if one is
rate-limited.

Without any key, scans still work — they silently fall back to the same
on-device model v1 used, with generic per-category advice instead of Gemini's
per-item detail.

### 4. Run both servers (one command)

```bash
npm run dev
```

That starts:

| Service  | URL                          |
| -------- | ---------------------------- |
| Frontend | http://localhost:5173        |
| Backend  | http://localhost:4000        |
| Health   | http://localhost:4000/api/health |

Open **http://localhost:5173** — you should see the system check with all four
rows ticked green.

Press `Ctrl+C` in the terminal to stop both.

---

## Testing on a phone (important)

### The https rule

**`getUserMedia` — the browser API that opens the camera — only works in a
"secure context".** That means:

| URL the phone opens                | Camera works? |
| ---------------------------------- | ------------- |
| `http://localhost:5173`            | ✅ yes (localhost is exempt) |
| `http://192.168.1.x:5173` (LAN IP) | ❌ **no** — blocked as insecure |
| `https://something.ngrok-free.app` | ✅ yes |

So you **cannot** just type your PC's local IP into the phone and expect the
camera to open. You need real `https`.

### Getting an https URL for the phone

Use a tunnel. With [ngrok](https://ngrok.com) (free account required):

```bash
ngrok http 5173
```

Copy the `https://....ngrok-free.app` URL it prints and open that on the phone.

Because the frontend only ever calls **relative** paths (`/api/...`), and Vite
proxies those to the backend, the tunnel works with no configuration changes.

### Fallback if there is no camera at all

The app ships with a **sample image mode** — tap a pre-loaded thumbnail to
classify it. This needs **zero camera access**, so the demo always works even if
permission is denied, no camera exists, or the page is served over plain http.

---

## Project layout

```
waste-segregation-hackathon/
├── package.json          root scripts (install:all, dev, build)
├── backend/
│   ├── package.json
│   └── src/
│       ├── server.js     Express app, error handling, Socket.IO
│       ├── db.js         SQLite connection + table creation
│       ├── schema.js     first-run seed data
│       ├── stats.js      dashboard aggregation
│       ├── helpers.js    validation + camelCase shaping
│       └── routes/       categories, settings, scans, labelMap
└── frontend/
    ├── package.json
    ├── vite.config.js    dev server + /api proxy
    ├── index.html
    ├── public/
    │   ├── model/        MobileNet weights (self-hosted)
    │   └── samples/      camera-free fallback photos
    └── src/
        ├── main.jsx      router entry
        ├── App.jsx       layout shell + routes
        ├── index.css     Tailwind + design tokens
        ├── lib/
        │   ├── api.js         REST client (relative paths only)
        │   ├── socket.js      shared Socket.IO connection
        │   ├── classifier.js  MobileNet + keyword matching
        │   ├── useCamera.js   camera lifecycle + every error case
        │   └── useAppData.js  live categories/settings/mappings
        ├── components/   CameraView, ModeTabs, SampleGrid, Notice, …
        └── pages/        ScanPage, DashboardPage, AdminPage
```

### The database

SQLite file is created automatically at `backend/data/waste.db` on first run and
seeded with the three default categories, so **a fresh clone is never empty**.

`*.db` is git-ignored — the database is never committed. To reset it completely,
delete the file and restart the backend.

---

## The classifier

Classification is **MobileNet v2 running in the browser** through TensorFlow.js.
No image is ever uploaded — inference happens entirely on the device.

### The model is self-hosted, on purpose

The weights live in `frontend/public/model/` (about 14 MB, committed to the repo)
and are loaded from there rather than from a CDN. Two reasons:

1. **The package's built-in URLs are broken.** `@tensorflow-models/mobilenet`
   points at `tfhub.dev`, which now redirects to Kaggle and answers with
   HTTP 400 and an HTML error page. The default `mobilenet.load()` fails.
2. **No internet needed at demo time.** Once the page is open the app is fully
   self-contained, so flaky venue Wi-Fi cannot break the classifier.

### The input-range trap

`mobilenet.load()` only applies a model's declared input range when it builds the
URL itself. Pass a custom `modelUrl` and it silently falls back to `[-1, 1]`,
which produces **confidently wrong** predictions rather than an error. The
correct value is passed explicitly in `frontend/src/lib/classifier.js`:

```js
mobilenet.load({ version: 2, alpha: 1.0, modelUrl: '/model/model.json', inputRange: [0, 1] })
```

If classification ever starts returning nonsense, check this first.

### Confidence is summed per category, not read off the top guess

MobileNet routinely splits its certainty between sibling labels that mean the same
bin. Measured on the real sample photo of a plastic bottle:

```
water bottle  43.7%  -> Recyclable
pop bottle    41.3%  -> Recyclable
```

The model is ~85% sure it is *a bottle* and merely unsure which kind. Judging only
the top label reports 43.7%, which failed a 60% gate and produced a needless
"unsure" on an obvious item. So `resolvePrediction()` sums confidence across every
top-8 label that maps to the same category and compares **that** to the threshold.

Measured results on the four sample photos (threshold 0.25):

| Photo | Top single label | Category total | Verdict |
| ----- | ---------------- | -------------- | ------- |
| bottle | water bottle 44% | **87%** | Recyclable |
| banana | banana 76% | **77%** | Biodegradable |
| battery | rubber eraser 34% | **51%** | Hazardous |
| phone | remote control 21% | **51%** | Hazardous |

This is why the default threshold is **0.25**, not 0.6. Real-world photos simply do
not produce the 90% top-1 scores that clean studio images do.

### When the item name is only a rough match

The bin can be certain while the object name is not. ImageNet has **no battery
class**, so a AAA cell scores "rubber eraser" first; a phone reads as "remote
control". Both still sort correctly, because those labels map to Hazardous.

Rather than present a rough guess as a confident identification, the result card
switches its label from *Detected item* to **Closest visual match** and adds a line
saying the name is approximate but the category is confident. Threshold for that is
`LABEL_TRUST_THRESHOLD` in `lib/classifier.js`.

The `rubber eraser` and `lipstick` keywords are seeded into Hazardous for exactly
this reason. That is a deliberate trade-off for battery support, not a taxonomy
claim — remove them if erasers or cosmetics ever need to classify correctly.

### Sample photos are classified at full resolution

`tf.browser.fromPixels` reads an `<img>` at its **layout** size, so handing it the
grid's CSS thumbnail fed the model a downscaled, cropped image and produced
different predictions than the same file at full size. The grid passes only the
path; the page loads the photo at natural size before classifying.

### Three input modes

| Mode | Behaviour |
| ---- | --------- |
| **Live** (default) | Rear camera (`facingMode: environment`), inference on a throttled interval — never every frame |
| **Pause & Snap** | Freezes the frame to a canvas and classifies that single image. Full-width primary button, the on-stage fallback if live inference is jittery |
| **Samples** | Classifies pre-loaded photos from `public/samples/`. Needs **no camera at all** |

The live interval is `inference_interval_ms` in settings (default 1500 ms) and is
editable in admin. Overlapping inference is prevented, so a slow phone drops
frames instead of queueing work.

### The result card

Four states, all driven by database values:

| State | When | Shows |
| ----- | ---- | ----- |
| **Result** | confident and mapped | item name, category badge, confidence bar, disposal tip, environmental impact |
| **Unsure** | confidence below `confidence_threshold` | the configured message, the closest guess and its score, and three concrete tips — never a confident wrong answer |
| **Unmapped** | recognised but no keyword matches | the detected label and the exact keyword to add in admin |
| **Empty / busy** | nothing scanned yet | prompt, or an analysing indicator |

Category colour drives the badge, border, glow, tint and bar. Because colours are
free-text hex in admin, they run through `lib/color.js`, which normalises 3-digit
hex (`#fc0`) — appending an alpha suffix to those produces an invalid colour that
renders as nothing — and picks black or white badge text by WCAG luminance so a
pale colour stays readable.

**The confidence bar's width is never animated up from zero.** Two earlier
versions did (via `requestAnimationFrame`, then a CSS `scaleX` entrance) and both
rendered a 0-width bar whenever the frame clock did not advance, silently
misreporting confidence. The bar's resting style is now always the true value;
only its value *changes* transition, and the reveal animation sits on the card
around it where being decorative is harmless.

### Scan logging

Snap and sample results are always logged. Live results are logged only when the
detected category *changes*, with an 8-second cooldown — otherwise holding one
item in frame would flood the dashboard feed with duplicates.

### Error states

Every failure is shown on screen with a next step, never only in the console:
camera permission denied, no camera present, camera already in use by another
app, insecure (plain http) origin, browser without `getUserMedia`, model download
failure, and backend unreachable. When a camera is impossible on the device the
app switches itself to Samples mode instead of showing a dead end.

---

## UI conventions

The phone is the primary device, so the layout is built for a thumb first and a
laptop second.

| Concern | How it is handled |
| ------- | ----------------- |
| Notch / home bar | `viewport-fit=cover` plus `pt-safe` / `pb-safe`, which pad using `env(safe-area-inset-*)` |
| Tap targets | every button, link and tab is at least 44px tall — verified, none below |
| Horizontal scroll | none on any route at 375px |
| Tap feel | `touch-action: manipulation` removes the ~300ms delay; text selection off on controls |
| Keyboard | `:focus-visible` ring only, so taps stay clean |
| Motion | everything respects `prefers-reduced-motion` |
| Scrollbars | dark-themed, so they do not cut through panels on the projector |

**Typography** goes through one `eyebrow` utility for the small-caps labels. It
sets *only* case and letter-spacing — the two properties that had drifted into four
different values across the phases — leaving size, weight and colour to the caller
so it composes with Tailwind instead of fighting it for specificity.

**Loading states are skeletons, never placeholder values.** The dashboard shows a
shimmer where the total will be rather than a real-looking `0`, because a zero that
jumps to the true count reads as a glitch on a projected screen.

**Transitions** fade each route and each input surface in. The surface key is
`camera` vs `samples`, deliberately *not* the mode — `live` and `snap` share the
camera surface, and remounting the `<video>` between them would drop its
`srcObject` and leave a black preview.

---

## The admin panel (`/admin`)

No login, by design — it is the demo operator's console. Four tabs:

| Tab | What it does |
| --- | ------------ |
| **Categories** | Add, edit and delete categories: name, colour (native picker or hex), disposal tip, impact text |
| **Settings** | Confidence threshold slider, live inference interval, app title, "unsure" message |
| **Keywords** | Search all 164 mappings, add new ones, move a keyword to another category, delete |
| **Scan log** | Latest 50 scans in a table, live-updating, with a clear-all |

Every save broadcasts over Socket.IO, so the phone and the projected dashboard
update without a reload.

### Two editing rules that matter

**Open forms are never overwritten by live updates.** Category forms keep their own
draft state and are keyed by row; the settings form tracks a dirty flag and only
accepts incoming values while untouched. Without this, a broadcast triggered by
any other device would wipe out half-typed text mid-edit.

**Saving settings sends only the fields you actually edited.** The diff is against
the baseline the form opened with, *not* the current server state — diffing
against the latter treats an untouched field as an edit whenever someone changed
it elsewhere, and writes the stale value back over their change.

### Destructive actions are two-step

Deleting a category or clearing the log requires a second confirming click, and the
warning states the real consequence — deleting a category also removes its keyword
mappings and every scan recorded against it, because of the `ON DELETE CASCADE`
in the schema.

---

## The dashboard (`/dashboard`)

Built for a projector on a second screen: full viewport, no app chrome, large
type, and the page itself never scrolls — the activity list scrolls inside its own
panel.

| Region | Content |
| ------ | ------- |
| Hero | total items scanned, average confidence, most common category |
| Breakdown | horizontal bar per category, plus the live/snap/sample split |
| Live activity | newest-first feed — "Water bottle → Recyclable 92%" |
| Badge | Live / Reconnecting, driven by the real socket state |

Totals and the chart are rendered from the server's `stats` snapshot, so they can
never drift out of sync with the database. The feed is driven by individual `scan`
events, which is why only the newest row animates — a list where every row moves
at once is unreadable at a distance.

### Colour is never the only encoding

Category colours are database values that can be changed to anything in admin, so
a colourblind-safe palette cannot be guaranteed at runtime. Every bar therefore
carries its category name on the axis and its count as a direct label; colour is
reinforcement. There is no legend box because there is only one series.

For the record, the three seeded defaults were checked with a palette validator:
CVD separation, normal-vision separation and contrast against the dark surface all
pass. `#22c55e` sits slightly brighter than the ideal lightness band for a dark
background, which is cosmetic and adjustable in admin.

---

## API reference

Base URL `http://localhost:4000`. All bodies are JSON.

### Categories

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api/categories` | List all, ordered by `sortOrder` |
| `GET` | `/api/categories/:id` | Fetch one |
| `POST` | `/api/categories` | Create — `{ name, color, disposalTip, impactText }` |
| `PUT` | `/api/categories/:id` | Update — send only the fields you want changed |
| `DELETE` | `/api/categories/:id` | Delete — **also deletes that category's scans and keyword mappings** |

`color` must be a hex value like `#22c55e`. Names are unique.

### Settings

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api/settings` | Returns `{ values, meta }` — `values` is a flat key/value map, `meta` adds type + label for admin inputs |
| `PUT` | `/api/settings` | Update one or more — `{ confidence_threshold: 0.75 }` |

| Setting | Default | Range |
| ------- | ------- | ----- |
| `confidence_threshold` | `0.6` | 0–1 |
| `inference_interval_ms` | `1500` | 250–10000 |
| `app_title` | Smart Waste Segregation Assistant | text |
| `unsure_message` | Unsure — try again with better lighting | text |

### Scans

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api/scans?limit=100&offset=0` | Paginated log for the admin panel |
| `POST` | `/api/scans` | Log a scan — `{ categoryId, confidence, source, label?, timestamp? }` |
| `DELETE` | `/api/scans` | Clear the whole log (ids restart at 1) |
| `DELETE` | `/api/scans/:id` | Delete one entry |

`source` must be `live`, `snap` or `sample`. `confidence` is a fraction 0–1.

### Stats & label map

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api/stats` | Dashboard aggregates: totals, per-category counts + percentages, per-source split, average confidence, recent scans |
| `GET` | `/api/label-map` | Keyword → category mappings, **longest keyword first** |
| `POST` | `/api/label-map` | Create — `{ keyword, categoryId }` |
| `PUT` | `/api/label-map/:id` | Update |
| `DELETE` | `/api/label-map/:id` | Delete |

### Socket.IO events (server → client)

| Event | Payload | When |
| ----- | ------- | ---- |
| `stats` | full stats object | on connect, and after every scan or clear |
| `scan` | the new scan | a device logs a scan |
| `categories:changed` | — | a category was added/edited/deleted (a fresh `stats` is sent with it) |
| `settings:changed` | new values map | a setting was changed |
| `labelmap:changed` | — | a keyword mapping changed |
| `scans:cleared` | — | the log was cleared |

Because a `stats` snapshot is sent on connect, a dashboard opened mid-demo is
populated immediately instead of waiting for the next scan.

### How classification maps to a category

1. The browser model returns a label such as `"water bottle"` with a confidence.
2. The frontend matches that label against `/api/label-map`, longest keyword
   first — so `plastic bag` wins over `bag`.
3. The matched mapping gives a `categoryId`, which supplies the colour, tip and
   impact text from `/api/categories`.

Nothing in that chain is hardcoded in the frontend — fix a wrong guess by
editing a keyword in the admin panel, no redeploy needed.

### Validation

Invalid writes return `400` with per-field messages, so forms can show errors
inline:

```json
{ "error": "Validation failed",
  "errors": { "confidence": "Must be a number between 0 and 1" } }
```

---

## Tech stack

| Layer      | Choice |
| ---------- | ------ |
| Frontend   | React 19 + Vite 6 + Tailwind CSS 4 |
| Backend    | Node.js + Express + better-sqlite3 |
| Real-time  | Socket.IO |
| ML         | TensorFlow.js (MobileNet), client-side |
| Charts     | Recharts |

---

## Build progress

- [x] **Phase 1** — monorepo scaffold, health route, README
- [x] **Phase 2** — full schema, seed data, REST endpoints, Socket.IO
- [x] **Phase 3** — camera component (live / pause-and-snap / samples) + model loading
- [x] **Phase 4** — result display, tips, impact, threshold, animations
- [x] **Phase 5** — live dashboard
- [x] **Phase 6** — admin panel
- [x] **Phase 7** — mobile-first UI polish

---

## Troubleshooting

### About the `npm audit` warnings

A fresh install reports two high-severity advisories against `react-router`
(*RSC Mode CSRF Bypass*). They concern React Server Components mode with server
actions. This app is a purely client-side SPA — no RSC, no server actions — so
the advisory does not apply to how the library is used here. `npm audit fix
--force` would *downgrade* react-router-dom as a breaking change, so it is
deliberately not applied.

You may also see one `allow-scripts` warning for `core-js`; its postinstall only
prints a funding banner and is safe to leave unapproved. The two packages that
genuinely need install scripts (`better-sqlite3`, `esbuild`) are already
pre-approved in the committed `package.json` files.

| Symptom | Fix |
| ------- | --- |
| System check shows Backend ✕ | Backend is not running. Use `npm run dev` from the **root**, not from `frontend/`. |
| `EADDRINUSE` on 4000 or 5173 | Something else is on that port. Close it, or set `PORT=4001` for the backend. |
| Camera never prompts on phone | You opened an `http://` LAN URL. Use an https tunnel — see above. |
| Blank white page | Check the terminal running Vite for a build error. |
