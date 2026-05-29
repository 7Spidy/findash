# Handoff: SpendDash UI Prototype → Main Website

## Overview
Replace the current spend-dash.vercel.app landing page with a fully interactive HTML prototype. The user has already downloaded the bundled file: **"Spend Dash Bundled.html"**.

## Goal
Push the bundled HTML prototype so it loads at the **root URL** `https://spend-dash.vercel.app/` — not a subdirectory. The repo is `7Spidy/findash` (Next.js + TypeScript + Tailwind, deployed on Vercel).

## Your task (3 steps)

### Step 1 — Clone the repo
```bash
git clone https://github.com/7Spidy/findash
cd findash
```

### Step 2 — Add the prototype file
Copy the downloaded file into `public/`:
```bash
cp ~/Downloads/Spend\ Dash\ Bundled.html public/index.html
```

> ⚠️ **Important:** Next.js's app router serves its own page at `/` and will take priority over `public/index.html`. You need to either:
>
> **Option A (Recommended — simplest):** Add a `vercel.json` at the repo root that rewrites `/` to the static file, AND rename the file to avoid clashing with Next.js internals:

```bash
cp ~/Downloads/Spend\ Dash\ Bundled.html public/app.html
```

Then create `vercel.json` at the repo root:
```json
{
  "rewrites": [
    { "source": "/", "destination": "/app.html" }
  ]
}
```

> **Option B:** Modify `app/page.tsx` to redirect to `/app.html`:
```tsx
// app/page.tsx
import { redirect } from 'next/navigation';
export default function Home() {
  redirect('/app.html');
}
```

### Step 3 — Commit and push
```bash
git add public/app.html vercel.json   # (or app/page.tsx for Option B)
git commit -m "feat: launch SpendDash UI prototype as main page"
git push origin main
```

Vercel auto-deploys on push. The prototype will be live at `https://spend-dash.vercel.app/` within ~60 seconds.

---

## About the prototype file
**"Spend Dash Bundled.html"** is a fully self-contained single-file HTML app (no external dependencies — all fonts, scripts, and styles are inlined). It includes:

- **Landing page** — hero, drag-and-drop PDF upload zone, "How it works" modal, "Privacy" modal, feature strip
- **Analyzing screen** — animated progress bar while "parsing" the statement
- **Dashboard** — 4 tabs: Overview (donut chart + AI insights + merchants), Transactions (filterable table), Cards (utilization bars), AI Insights (4-card grid)
- **Tweaks panel** — accent color switcher (Chocolate Brown default, Amber, Blue, Green)
- **Fully responsive** — desktop top-nav layout + mobile bottom-tab layout, bottom-sheet modals

## Design tokens used
| Token | Value |
|---|---|
| Background | `#FAF8F3` (warm off-white) |
| Surface | `#FFFFFF` |
| Surface 2 | `#F3F0E9` |
| Border | `#E6E0D4` |
| Text | `#0F172A` |
| Accent (default) | `#7B3F00` (chocolate brown) |
| Green | `#059669` |
| Red | `#DC2626` |
| Blue | `#2563EB` |
| Heading font | Playfair Display (serif) |
| Body font | DM Sans |

## Files in this handoff
- `README.md` — this file
- `Spend Dash Bundled.html` — the self-contained prototype (user has downloaded this separately)

## Fidelity
**High-fidelity.** The prototype is pixel-accurate with final colors, typography, spacing, and interactions. The bundled HTML IS the deliverable — no further conversion needed, just deploy it as described above.

---
*Design created in Claude Design. Questions? The source files (sd-shared.jsx, sd-landing.jsx, sd-dashboard.jsx) are in the Claude Design project.*
