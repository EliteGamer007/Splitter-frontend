# Frontend setup

Use the current [README](README.md) for installation and environment variables. Prerequisites are Node.js 22.13+ (below 25), npm and the Go/Echo backend; real social data requires that backend.

```sh
npm ci
npm run dev
```

Set `.env.local` before starting:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_INSTANCE_1_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_INSTANCE_2_URL=
```

Open http://localhost:3000. Allow this origin in the backend's `CORS_ORIGINS`. For Vercel, use the primary Render API URL and rebuild. Use `npm run check` before release.

The app uses Next.js App Router with query-based navigation managed by `app/page.tsx`. The URL, browser history and selected page stay in sync. Core pages connect to the real API; an additional peer is optional.

Do not use the public Neon database for local tests. API browser checks use the dedicated local backend described in the backend repository's deployment and verification docs.
