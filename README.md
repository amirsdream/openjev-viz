# OpenJEV Viz

Visual playground for [OpenJEV](https://openjev.sh) decisions against a homelab model (`openjev-4b`).

## Features

- **Decision studio** — Yes/No (noul), Choice, and Score against live `/classify`
- **Live examples** — three System One shapes refreshed from the lab
- **Session history** — recent decisions with latency
- **Status bar** — model id, vLLM version, online/offline

Without `/v1/systemone`, Choice and Score are built from parallel classify calls and normalized entailment scores.

## Run

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

Vite proxies `/lab` → `http://192.168.1.20:8000` (edit `vite.config.ts` if needed).

## License

MIT
