# ARGUS: AI cash-desk discipline monitor

Web UI and API skeleton for **ForteBank Datathon 26**. You upload a `.mov` from the overhead cash-desk camera, and the service returns a verdict (`violation` / `no_violation`). For each event it gives the type, timecode, 1–3 evidence frames, a description and a link to the Kazakhstan regulation.

**Live UI:** https://martianyernar.github.io/argus-cashdesk/ (it runs in DEMO mode until a backend is connected)

```
argus/
├─ index.html, src/          ← frontend (Vite, no framework, black terminal UI with ForteBank accents)
│  ├─ src/main.js            ← landing + reviewer workspace (queue, review, CSV report)
│  ├─ src/store.js           ← review history in IndexedDB
│  ├─ src/api.js             ← API client (LIVE) + in-browser DEMO
│  ├─ src/data.js            ← violation classes + regulatory sources (EDIT ME)
│  └─ src/i18n.js            ← RU / EN strings
├─ backend/                  ← FastAPI implementing the jury API (section 10 of the case)
│  ├─ app.py                 ← jobs, X-API-Key, CORS, serves ../dist
│  └─ analyzer.py            ← 👉 PLUG THE MODEL IN HERE: analyze_video(path)
└─ .github/workflows/deploy.yml  ← auto-deploy UI to GitHub Pages on push to main
```

## Frontend

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/
```

The **DEMO / LIVE** pill in the navbar opens the settings drawer. Put the backend URL and the API key there. These settings are saved in the browser's localStorage.
You can also bake the URL in at build time with `VITE_API_URL` (`.env`, or the repo variable `VITE_API_URL` for the Pages workflow).

> GitHub Pages serves over HTTPS, so the backend must also be **HTTPS**, or the browser will block the request as mixed content.
> A tunnel such as `cloudflared tunnel --url http://localhost:8000` or ngrok works well for the demo.

## Backend (for the ML teammate)

```bash
cd backend
python -m venv .venv && .venv/Scripts/activate      # Windows; on Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
npm --prefix .. run build                            # optional: serve the UI from the same server
ARGUS_API_KEY=your-secret uvicorn app:app --host 0.0.0.0 --port 8000
```

Implement `analyze_video(path, progress)` in `backend/analyzer.py`. It returns a list of violations, and an empty list means `no_violation`. The `frame_at(path, t)` helper already produces `evidence_frames` items in the required format.
Optional fields the UI understands: `confidence` (0..1) and `rule: {document, clause, url}`. If `rule` is missing, the UI looks for a type with the same name in `src/data.js`.

### API contract (from the case)

| Method | Path | |
|---|---|---|
| POST | `/api/v1/analyze` | multipart `file` (.mov) → `{"job_id": "..."}` |
| GET | `/api/v1/jobs/{job_id}` | `processing` / `done` / `failed` + `verdict`, `violations[]` |

Every request needs the `X-API-Key` header. The server also reports `progress` (0–100) while a job is `processing`.

## TODO before submission
- [ ] Replace the example classes in `src/data.js` with the real ones the model outputs
- [ ] Check the regulatory sources and add the exact clauses (`clauseVerified: true` removes the DRAFT badge)
- [ ] Do not commit the dataset or the test videos (`.gitignore` already excludes `*.mov`/`*.zip`)
- [ ] Processing must finish in under 5 minutes, and everything runs locally with no cloud AI

## Workspace (for the daily reviewer)
- Drop several `.mov` files at once. They queue up and are processed one by one.
- Each video is marked **ЧИСТО** (clean), **К ПРОВЕРКЕ** (to review) or **ПРОВЕРЕНО** (reviewed). For every event the reviewer clicks **confirm** or **dismiss**, and can add a note.
- History and decisions are saved in the browser (IndexedDB). After a reload, drop the same file again to replay the video.
- **E** exports the day's report to CSV.
- Keys: `U` add · `J/K` next/prev video · `N` next to review · `1–9` / `[ ]` events · `C` confirm · `X` dismiss · `Space` play · `←/→` ±2s · `S` JSON · `Del` delete · `?` help
