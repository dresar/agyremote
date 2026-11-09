# Project Map: AgyRemote

Dashboard kendali jarak jauh Antigravity & editor IDE terintegrasi.

## Struktur Repositori & Navigasi Slug
- **Frontend**: `/opt/data/home/agyremote` (React 18 + Vite + Tailwind CSS + TypeScript)
  - `soul.md`: File identitas & arsitektur komprehensif AI Brain (konteks VPS, klaster AGY01-AGY15, multi-provider, direktori proyek).
  - `src/App.tsx`: Router URL slug berbasis HTML5 History API (`/overview`, `/workers`, `/worker/:id`, `/chat/:id/:folder/:cid`, `/logs`, `/settings`). Redirect otomatis slug lama `/discuss` ke `/overview`.
  - `src/components/Pages/PromptPage.tsx`: Halaman utama eksekusi chat & prompt AGY Remote (action badges real-time dropdown: Worked for Xs, Ran commands, code block stdout, auto-load conversation by folder slug).
  - `src/components/Pages/MarkdownMessageView.tsx`: Renderer pesan Markdown AI terstruktur (code block dengan salin kode, heading rapi, list item, tanpa asterisk mentah).
  - `src/components/Pages/TurnFileChanges.tsx`: Komponen ringkasan perubahan berkas per-turn dinamis (collapsible badge `X files changed +A -B`, list berkas M* / +, klik berkas langsung buka editor preview).
  - `src/components/Pages/CodeViewerPanel.tsx`: Panel pratinjau kode & editor kanan (nama berkas bersih tanpa path panjang, menu titik tiga untuk Salin Path & Salin Konten).
  - `src/components/Pages/ProjectMetadataModal.tsx`: Modal metadata folder proyek (terintegrasi API Go `/api/project/meta`).
  - `src/components/Pages/WorkerWorkspacePage.tsx`: Workspace worker & daftar berkas (pembuat folder otomatis dengan slug unik `safeSlug`, kontrol daya minimalis).
  - `src/components/Pages/ModelUsagePopover.tsx`: Popover kuota & seleksi model aktif.
  - `src/components/Tabs/OverviewTab.tsx`: Tab ringkasan kluster & sub-task aktif dengan indikator kotak kecil kedip hijau emerald (`w-1.5 h-1.5 rounded-[2px] animate-pulse`), tombol akses cepat Skill & Chat.
  - `src/components/Tabs/SettingsTab.tsx`: Tab pengaturan sistem, kontrol daya worker (1-2 kata per `simpel-text`), kartu Manajemen Skill.
  - `src/components/Settings/SkillManagerModal.tsx`: Modal manajemen skill modular (Daftar, Buat custom, NPX/Git install, Unggah file, seleksi target worker AGY01-AGY15 atau Semua).
  - `src/components/Settings/PromptEnhancerSettings.tsx`: Pengaturan multi-provider (ByNara, Gemini 47 keys pre-seeded, OpenAI, Custom), auto-rotasi, popover tooltip non-intrusif.
  - `src/services/promptEnhancer.ts`: Layanan rotasi API key pool v3 (47 Gemini keys auto-merge, ByNara default), query chat AI via endpoint backend Go.
  - `src/services/transcript.ts`: Parser turn transcript `.jsonl` untuk backfill langkah eksekusi, stdout, dan agregasi statistik perubahan baris file (+additions / -deletions).
- **Backend**: `/opt/data/home/agyremote-backend` (Golang Standalone Go 1.22 stdlib `net/http.ServeMux`)
  - `cmd/server/main.go`: Entrypoint server & HTTP routing.
  - `internal/workers/workers.go`: Worker management, SSE prompt streaming, file reader, quick folder creator, deteksi sub-task aktif via `/proc`, `POST /api/ai/chat`, `GET /api/project/meta`, dan ByNara multi-key pool di `POST /api/prompt/enhance`.
  - `internal/workers/skills.go`: Service manajemen skill multi-worker (list skill, deploy skill, delete skill, install git/npx, endpoints `/api/skills`).
  - `internal/auth/bearer.go`: Bearer token auth (`REPLACE_WITH_LIVE_BEARER_TOKEN`) dengan proteksi prefix `/api/ai`, `/api/project`, dan `/api/skills`.
  - `internal/static/dist`: Embedded static assets dengan fallback SPA `serveSPAIndex`.

## Port & Jaringan
- Port Server: `8787` (lokal: `http://127.0.0.1:8787`).
- Public Ingress: `https://remote.agentai.my.id` (Cloudflare Tunnel).
- Health Check: `GET /api/health`.

## Build & Deployment Workflow
1. Frontend build: `cd /opt/data/home/agyremote && npm run build:frontend`
2. Sync static dist: `rm -rf /opt/data/home/agyremote-backend/internal/static/dist && cp -r /opt/data/home/agyremote/dist /opt/data/home/agyremote-backend/internal/static/dist`
3. Run Golang server: `cd /opt/data/home/agyremote-backend && go run ./cmd/server`
4. E2E Testing: `cd /opt/data/home/agyremote && npm test` (target 123/123 pass).

## Aturan & Standar
- **simpel-text**: Desain UI senior developer, teks 1-2 kata, tanpa paragraf deskripsi, popover ikon non-intrusif.
- **NOKOMEN**: Dilarang menyertakan komentar dalam kode (Go, TS, TSX, CSS).
- **Hemat Token**: Ikuti protokol wajib hemat token, gunakan line slicing dan pencarian simbol terarah.
- **Responsif Mobile**: Layout 100% full-width pada mobile (360px-412px), drawer overlay.
