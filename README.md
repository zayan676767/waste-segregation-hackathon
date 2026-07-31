# ♻️ Smart Waste Segregation Assistant

Point a phone camera at a waste item and tap to identify it. **Google Gemini**
recognises the actual object — not just its bin — and returns a real name, a
short description, the material, and disposal steps written for that specific
item. Every scan is pushed live to a dashboard you can project on a second
screen.

## Highlights

- **Gemini vision on every scan.** One deliberate tap is one request, so it
  stays well under the free tier's rate limit and every result is worth reading.
- **Every classification justifies itself.** Alongside the bin, each result
  explains *why* the item belongs in that category, *why it does not* go in the
  other bins, and gives *one environmental fact* — so a result is an argument
  you can check, not a black-box label.
- **Scan-to-join QR code** on the dashboard. A judge points their own phone at
  the projected screen and lands straight on the scanner — no typing the
  self-signed https LAN address by hand.
- **Nothing is hardcoded.** Category names, colours, disposal tips, impact text
  and the confidence threshold all live in SQLite and are editable from the
  admin panel — and the live category list is sent to Gemini on every scan, so
  an admin edit applies to the very next photo.
- **Multiple API keys pool automatically** to multiply the free daily quota.
  See "Gemini setup" below.
- **Device-aware.** A phone gets the scanner and the dashboard; a laptop gets
  the dashboard and the admin console.
- **Always-works fallback.** A built-in Samples mode classifies pre-loaded
  photos with no camera and no special network, so the demo never dead-ends.

---

## What you need

**Node.js 20 or newer.** Get the LTS installer from
[nodejs.org](https://nodejs.org). Check it is installed with:

```bash
node -v
```

## Setup on a fresh machine

### 1. Get the code

Download the repository as a ZIP from GitHub (green **Code** button →
**Download ZIP**) and extract it. If you use Git, you can clone it instead.

### 2. Install everything (one command)

```bash
npm run install:all
```

Do this on a real internet connection — it downloads the dependencies once.

### 3. Gemini setup (required for real identification)

Create a file named `.env` inside the `backend` folder containing your key:

```
GEMINI_API_KEY=your-key-here
```

Get a key at
**[aistudio.google.com/apikey](https://aistudio.google.com/apikey)** using the
**"Default Gemini Project"** option.

Add a second key from a different account to **double** the free daily quota:

```
GEMINI_API_KEY_2=a-second-key-from-a-different-account
```

The backend rotates between every key it finds (`GEMINI_API_KEY`,
`GEMINI_API_KEY_2` … `_9`) and automatically retries on the next key if one is
rate-limited. The `.env` file is git-ignored and is never committed.

### 4. Run it

```bash
npm run dev
```

| Service   | URL                              |
| --------- | -------------------------------- |
| App       | http://localhost:5173            |
| Dashboard | http://localhost:5173/dashboard  |
| Backend   | http://localhost:4000            |

Press `Ctrl+C` in the terminal to stop.

---

## Running it on a phone (camera)

A phone will only open its camera on a **secure (https)** address — a plain
`http://<laptop-ip>` address is blocked by the browser as insecure. The project
serves itself over https with a self-signed certificate for exactly this
reason, so no external tunnel or internet is needed.

1. Connect the laptop and the phone to the same network (a phone hotspot is
   fine).
2. Start it in https mode:

```bash
npm run dev:https
```

3. In a second terminal, print the address to open on the phone:

```bash
npm run ip
```

4. Open that `https://…:5173` address on the phone. The phone will warn that
   the connection is "not private" — that is expected, it is your own
   self-signed certificate. Tap **Advanced → Proceed** (Android) or
   **Show details → visit website** (iPhone), then allow camera access.

No camera, or a locked-down network? Use the **Samples** tab — it needs neither.

---

## Project layout

```
├── package.json          root scripts (install:all, dev, dev:https, build)
├── backend/
│   └── src/
│       ├── server.js     Express app + Socket.IO
│       ├── db.js         SQLite connection + table creation
│       ├── schema.js     first-run seed data
│       ├── gemini.js     Gemini client + API key pooling
│       ├── stats.js      dashboard aggregation
│       ├── helpers.js    validation + camelCase shaping
│       └── routes/       classify, categories, settings, scans, labelMap
└── frontend/
    └── src/
        ├── App.jsx       device-gated routing + layout shell
        ├── index.css     Tailwind + design tokens
        ├── pages/        ScanPage, DashboardPage, AdminPage
        ├── components/   scanner, result sheet, dashboard, admin panels
        └── lib/          api, socket, camera, device + capture helpers
```

### The database

SQLite is created automatically at `backend/data/waste.db` on first run and
seeded with the three default categories, so a fresh copy is **never empty**.
The file is git-ignored and never committed. To reset it completely, delete the
file and restart the backend.

---

## The admin panel (`/admin`, laptop only)

Four tabs:

| Tab            | What it does                                                         |
| -------------- | ------------------------------------------------------------------- |
| **Categories** | Add, edit and delete categories: name, colour, disposal tip, impact |
| **Settings**   | Confidence threshold, app title, "unsure" message                   |
| **Keywords**   | Search and edit the keyword → category mappings                     |
| **Scan log**   | Latest scans in a live-updating table, with a clear-all             |

Every save broadcasts over Socket.IO, so the phone and the projected dashboard
update without a reload.

**Two rules that matter:** open forms are protected from live updates, so a
broadcast from another device can't wipe half-typed text mid-edit; and
destructive actions are two-step — deleting a category also removes its keyword
mappings and every scan recorded against it, so the warning says so before you
confirm.

---

## The dashboard (`/dashboard`)

Built for a projector on a second screen: full viewport, large type, and the
page itself never scrolls — the activity feed scrolls inside its own panel.

| Region        | Content                                                     |
| ------------- | ---------------------------------------------------------- |
| Hero          | total items scanned, average confidence, most common bin   |
| Breakdown     | a bar per category, plus where the scans came from         |
| Live activity | newest-first feed — "Plastic Bottle → Recyclable 100%"     |
| Badge         | Live / Reconnecting, driven by the real socket state       |

Totals and the chart are rendered from the server's `stats` snapshot, so they
can never drift out of sync with the database. The feed is driven by individual
`scan` events, which is why only the newest row animates. A dashboard opened
mid-demo is populated immediately from the snapshot sent on connect.

---

## API reference

Base URL `http://localhost:4000`. All bodies are JSON.

### Classify

| Method | Path                    | Purpose                                          |
| ------ | ----------------------- | ------------------------------------------------ |
| `POST` | `/api/classify`         | Send `{ image, mimeType, source }` — Gemini identifies the item, logs the scan, and broadcasts it |
| `GET`  | `/api/classify/status`  | Whether a key is configured, and the model chain in use |

### Categories

| Method   | Path                  | Purpose                                                    |
| -------- | --------------------- | --------------------------------------------------------- |
| `GET`    | `/api/categories`     | List all, ordered by `sortOrder`                          |
| `POST`   | `/api/categories`     | Create — `{ name, color, disposalTip, impactText }`       |
| `PUT`    | `/api/categories/:id` | Update — send only the fields you want changed            |
| `DELETE` | `/api/categories/:id` | Delete — **also deletes that category's scans and keywords** |

`color` must be a hex value like `#22c55e`. Names are unique.

### Settings

| Method | Path            | Purpose                                     |
| ------ | --------------- | ------------------------------------------- |
| `GET`  | `/api/settings` | Returns `{ values, meta }`                  |
| `PUT`  | `/api/settings` | Update one or more — `{ confidence_threshold: 0.6 }` |

| Setting                | Default                                 | Range |
| ---------------------- | --------------------------------------- | ----- |
| `confidence_threshold` | `0.5`                                   | 0–1   |
| `app_title`            | Smart Waste Segregation Assistant       | text  |
| `unsure_message`       | Unsure — try again with better lighting | text  |

### Scans, stats & keywords

| Method   | Path              | Purpose                                            |
| -------- | ----------------- | -------------------------------------------------- |
| `GET`    | `/api/scans`      | Paginated log (`?limit=100&offset=0`)              |
| `DELETE` | `/api/scans`      | Clear the whole log                                |
| `GET`    | `/api/stats`      | Dashboard aggregates                               |
| `GET`    | `/api/label-map`  | Keyword → category mappings, longest keyword first |
| `POST`   | `/api/label-map`  | Create — `{ keyword, categoryId }`                 |
| `PUT`    | `/api/label-map/:id` | Update                                          |
| `DELETE` | `/api/label-map/:id` | Delete                                          |

### Socket.IO events (server → client)

| Event                | When                                              |
| -------------------- | ------------------------------------------------- |
| `stats`              | on connect, and after every scan or clear         |
| `scan`               | a device logs a scan                              |
| `categories:changed` | a category was added/edited/deleted               |
| `settings:changed`   | a setting was changed                             |
| `labelmap:changed`   | a keyword mapping changed                         |
| `scans:cleared`      | the log was cleared                               |

---

## Tech stack

| Layer     | Choice                             |
| --------- | ---------------------------------- |
| Frontend  | React 19 + Vite 6 + Tailwind CSS 4 |
| Backend   | Node.js + Express + better-sqlite3 |
| Real-time | Socket.IO                          |
| Vision    | Google Gemini                      |
| Charts    | Recharts                           |

---

## Troubleshooting

| Symptom                          | Fix                                                                        |
| -------------------------------- | ------------------------------------------------------------------------- |
| System check shows Backend ✕     | Backend is not running. Use `npm run dev` from the **root**, not `frontend/`. |
| `EADDRINUSE` on 4000 or 5173     | Something else is on that port. Close it, or set `PORT=4001` for the backend. |
| Camera never prompts on phone    | You opened an `http://` address. Use `npm run dev:https` and the `https://…` URL. |
| Blank white page                 | Check the terminal running Vite for a build error.                        |
| Phone can't reach the laptop     | Allow Node.js through the firewall (tick Private **and** Public networks). |
