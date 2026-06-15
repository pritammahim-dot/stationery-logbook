# স্টেশনারি স্টক রেজিস্টার — Stationery Inventory Logbook

A bilingual (Bengali/English) web app that replaces the office stationery Excel
logbook. It records **stock in** and **stock out**, keeps a **live balance** per
item, flags **low stock**, prints **issue slips**, and produces **monthly** and
**user-wise** reports — for several people at once, from any device.

- **Frontend:** a static website (plain HTML/CSS/JS, no build step) → host on **GitHub Pages**.
- **Database:** a **Google Sheet** you own.
- **API:** a small **Google Apps Script** Web App that the site reads/writes through.

No Supabase, no Netlify, no server to run, no monthly cost.

> **Why it's better than the Excel:** items/users are tracked by a hidden stable
> **ID**, so renaming an item or moving a user never breaks history (the Excel
> matched by name and silently broke). Balances can't go negative (checked on the
> server), every change is audited, nothing is hard-deleted (void instead), and
> the dashboard/reports are always live.

---

## Try it now (Demo mode)

Open `index.html` through any static server (not `file://`) and it runs in **DEMO
mode** with bundled sample data — every screen works, nothing is saved.
The demo editing **PIN is `1234`**.

```bash
# from this folder
python -m http.server 5560
# then open http://localhost:5560
```

To go live, connect a Google Sheet (below) and put the URL in `config.js`.

---

## Connect the real backend (one-time, ~10 minutes)

Do these **in order**. Steps 1–6 are on Google; 7–8 are on GitHub.

1. **Create the Google Sheet.** Go to <https://sheets.new>, name it e.g.
   `Stationery Logbook DB`.
2. **Open Apps Script.** In the sheet: **Extensions → Apps Script**. Delete the
   default code, paste the entire contents of [`apps-script/Code.gs`](apps-script/Code.gs), and **Save**.
3. **Build the tabs + seed the data.** In the Apps Script editor toolbar, choose
   the function **`setupSheets`** and click **Run** (approve the permission prompt
   the first time — it's your own script). Then choose **`seedMasters`** and **Run**.
   Your sheet now has all 9 tabs (incl. `Cycles` + `Requirements`), the 54 items,
   23 users and 4 sections.
   *(Alternative to `seedMasters`: import the CSVs in [`seed/`](seed/) into the
   Sections/Items/Users tabs instead.)*
   *(Re-running `setupSheets` is safe — it also adds any new columns from a later
   version, e.g. `cycle_id` on `StockOut`.)*
4. **Set the editing PIN.** In Apps Script: **Project Settings (⚙)** →
   **Script Properties** → **Add script property**: name `WRITE_SECRET`, value =
   a strong passphrase. **This is the PIN staff type to edit.**
5. **Deploy as a Web App.** **Deploy → New deployment → ⚙ → Web app**.
   Set **Execute as: Me** and **Who has access: Anyone**, then **Deploy**.
   ⚠️ It must be **"Anyone"** (not "Anyone with Google account") so the public
   site can read without a Google login.
6. **Copy the Web App URL** — the one ending in **`/exec`**.
7. **Configure the site.** Edit [`config.js`](config.js): set `API_URL` to that
   `/exec` URL. Leave the office names as you like. **Never put the PIN in here.**
8. **Publish.** Push this folder to a GitHub repo, then **Settings → Pages →
   Build from branch → `main` / root**. Share the Pages URL with staff; give the
   PIN to whoever records stock (in person / over the phone — not in the repo).

### Changing `Code.gs` later
Editing the script does nothing until you redeploy: **Deploy → Manage deployments
→ ✎ Edit → Version: New version → Deploy.** This keeps the **same `/exec` URL**,
so you don't touch `config.js`. (Creating a brand-new deployment gives a new URL.)

---

## How editing is protected

- **Reading is open** — anyone with the link sees balances and reports.
- **Editing requires the PIN.** The first time someone records stock or edits a
  master record, the app asks for the PIN, validates it against the server, and
  keeps it in memory for that session (🔓 chip turns green). The PIN lives only in
  the Apps Script Script Properties — never in this public repo. Rotate it anytime
  by changing `WRITE_SECRET` (no redeploy of the website needed).

This is an internal office tool, not a bank. If you later want stronger access
control, switch the deployment to "Anyone with Google account" and add an email
allowlist in `Code.gs`.

---

## Features

| Screen | What it does |
|---|---|
| **ড্যাশবোর্ড / Dashboard** | KPIs, low-stock list, 12-month in/out trend, top consumers |
| **স্টক ইন / Stock In** | record receipts (date, item, qty, remarks); **📄 Import from file** — upload an Excel/CSV or digital PDF, auto-match item names (exact when the file has `item_id`, else fuzzy), **review & correct**, then bulk-save. **⬇ Template** downloads a ready-to-fill CSV of your items. |
| **স্টক আউট / Stock Out** | issue to a user — auto-fills their section, shows live balance, **blocks over-issue**, then offers a printable **issue slip** |
| **স্টক / Balances** | live In / Out / Balance per item; search, category filter, low-stock filter; CSV + print |
| **আইটেম / Items** | add items, **rename safely**, set unit/category/reorder level/opening balance, activate/deactivate; **⚙ Units** button to add/edit measurement units |
| **কর্মী / Users** | add/edit staff and their section; **⚙ Sections** button to add/edit/rename sections |
| **চাহিদা / Requirements** | open a **purchase cycle** (every 3–4 months); enter each **section's** (and optionally each **user's**) requirement list = their **usage quota**; see the **consolidated estimate** (required vs on-hand vs to-buy) for purchasing; **track usage vs limit** per section/user. Stock Out warns (but allows) when an issue would exceed a quota. |
| **রিপোর্ট / Reports** | Monthly In, Monthly Out, User-wise, and **Detailed (line-item)** — filter by **date range**, **single section**, and **single user**; print / Save-as-PDF / CSV export (respects filters) |

Dropdowns are not fixed: **units** and **sections** are managed in-app (⚙ buttons on the Items / Users tabs), and **category** is a free-text field with suggestions — type a new one anytime.

Other niceties: bilingual UI with Bengali numerals, installable PWA with offline
**read**, audit trail (`AuditLog` tab), undo via **void** (never deletes),
idempotent writes (a double-tap can't duplicate a transaction).

---

## Develop & test locally

```bash
python -m http.server 5560        # serve the site (DEMO mode unless config.js has API_URL)
node compute.test.mjs             # run the inventory-math unit tests (no Google needed)
```

`compute.js` holds all the inventory math as pure functions and is unit-tested in
`compute.test.mjs`. To test against a **real** backend without risking production,
create a throwaway sheet + deployment and point a local-only `config.js` at it.

### End-to-end checklist (against a test sheet)
- Wrong PIN is rejected; right PIN unlocks.
- In DevTools **Network**, a write POST shows **no `OPTIONS` preflight** (this is
  why writes are sent as `text/plain` — see `api.js`).
- Over-issue is refused (`insufficient_stock`) and **no row is written**.
- Rename an item, reload → all history and reports still resolve (ID-keyed).
- Void a transaction → the balance corrects and the row stays (marked void).
- Numbers match the old Excel for a known month.

---

## File structure

```
index.html              app shell (tabs + containers)
styles.css              teal theme + print styles
config.js               YOUR settings (API_URL, office names) — no secret
config.example.js       template
compute.js              pure inventory math (balances, pivots, low-stock)
compute.test.mjs        unit tests for compute.js
api.js                  CORS-safe backend client (+ in-memory DEMO mode)
demo-data.js            sample data for DEMO mode
app.js                  UI: state, rendering, PIN gate, write flows
apps-script/Code.gs     the Google Apps Script backend (paste into the editor)
seed/                   sections.csv, items.csv, users.csv (import alternative)
manifest.webmanifest    PWA manifest
sw.js                   service worker (offline read of the app shell)
assets/                 app icons
.github/workflows/      optional nightly backup of the sheet to data/snapshot.json
```

---

## Troubleshooting

- **Writes fail with a CORS error** → the POST must be `Content-Type: text/plain`
  with no custom headers (already the case in `api.js`); and the deployment's
  *Who has access* must be **Anyone**.
- **Reads return HTML / "non-JSON"** → the deployment access isn't **Anyone**, or
  `API_URL` isn't the `/exec` URL.
- **Edits to `Code.gs` don't take effect** → redeploy a **New version** (see above).
- **Dates look off by a day** → the script stores the date string you send and the
  project timezone is set to Asia/Dhaka by `setupSheets()`.
