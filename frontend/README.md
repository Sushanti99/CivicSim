# CivicSim frontend

Next.js 15 (App Router) + TypeScript + Tailwind 4 demo UI.

## Dev

```bash
npm install
npm run dev          # http://localhost:3000
```

The dev server proxies `/api/*` to `NEXT_PUBLIC_API_BASE_URL` (default
`http://localhost:8000`) so the browser sees same-origin requests for SSE.

## Build

```bash
npm run build && npm start
```
