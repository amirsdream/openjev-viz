# OpenJEV Viz

Visual playground for [OpenJEV](https://openjev.sh)-style decisions against a homelab model (`openjev-4b` via vLLM).

Ask a claim, pick options, or score a scale — then see calibrated probabilities land in the UI.

<p align="center">
  <img src="docs/screenshots/01-hero.png" alt="OpenJEV Viz hero with lab status" width="920" />
</p>

## Screenshots

### Decision studio — Choice

Route a support ticket live. Bars are normalized entailment scores from parallel `/classify` calls.

<img src="docs/screenshots/02-studio-choice.png" alt="Choice decision studio" width="920" />

### Decision studio — Yes / No

Noul-style judgment with a yes probability and raw contradiction / entailment / neutral readout.

<img src="docs/screenshots/03-studio-noul.png" alt="Yes/No noul studio" width="920" />

### Decision studio — Score

Ordered scale (urgency, risk, effort, …) with a highlighted winner.

<img src="docs/screenshots/04-studio-score.png" alt="Score decision studio" width="920" />

### Live examples

Three System One shapes refreshed together from the lab.

<img src="docs/screenshots/05-live-examples.png" alt="Live examples grid" width="920" />

## Features

- **Status bar** — lab online/offline, model id (`openjev-4b`), vLLM version
- **Decision studio** — Yes/No, Choice, and Score with editable context and presets
- **Session history** — recent decisions with latency
- **Live examples** — Choice / Noul / Score cards refreshed in parallel
- **Vite proxy** — browser talks to `/lab`, forwarded to your Proxmox host

## How it works

The lab currently exposes vLLM **`/classify`** (not `/v1/systemone`). OpenJEV Viz approximates System One shapes like this:

| Shape | What you provide | What we call |
| --- | --- | --- |
| **Yes / No** | Context + claim | One classify → yes = entailment / (entailment + contradiction) |
| **Choice** | Context + options | One classify per option → normalize yes-weights |
| **Score** | Context + ordered steps | One classify per step → pick the highest weight |

Default proxy target: `http://192.168.1.20:8000`.

## Quick start

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

Point the proxy at another host in `vite.config.ts` if needed:

```ts
server: {
  proxy: {
    '/lab': {
      target: 'http://192.168.1.20:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/lab/, ''),
    },
  },
}
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview the build |
| `npm run screenshots` | Capture README screenshots (lab must be reachable) |

## Stack

React 19 · Vite 8 · TypeScript · Framer Motion · Playwright (screenshots only)

## License

[MIT](LICENSE)
