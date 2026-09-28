# OpenJEV Viz

Visual playground for [OpenJEV](https://openjev.sh) decisions — Choice, Noul, Score — plus a live ask box against a homelab `/classify` endpoint.

## Run

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

Vite proxies `/lab` → `http://192.168.1.20:8000` (change the target in `vite.config.ts` if your lab host differs).

## License

MIT
