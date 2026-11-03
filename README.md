# Splitter frontend

The Next.js interface for **Splitter**, a college team project combining a federated social feed, browser-managed identity and encrypted messaging. The existing peach light theme and dark theme are preserved across desktop and mobile.

**[Live demo](https://splitter-social.vercel.app)** · [Backend repository](https://github.com/EliteGamer007/splitter)

The November repair branch is local until deployed. The former `splitter-red-phi.vercel.app` demo address is obsolete.

## Features

- Feed, photo posts, likes, reposts, bookmarks, nested threads, hashtags and search.
- Profiles, follow approval, circle visibility and expiring stories.
- Password and Ed25519 challenge-response login.
- Browser-encrypted DMs, account/origin-scoped keys, and passphrase-encrypted key recovery exports.
- Configurable instance selection, federation inspection, and role-guarded moderation/admin pages.
- Shareable query-based page URLs with browser back/forward support; responsive light/dark layouts.
- Loading, empty and error states, bounded requests, and unread polling that pauses while hidden or offline.

These screens use the real Go/Echo API. A second peer and an AI provider are optional; they are not required for the main social workflow.

## Run

Use Node.js **22.13+ and below 25**, and npm with the checked-in lockfile.

```sh
npm ci
```

Create `.env.local` for your backend:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_INSTANCE_1_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_INSTANCE_2_URL=
```

```sh
npm run dev
```

Open [localhost:3000](http://localhost:3000). Browser cryptography requires HTTPS or localhost. Configure the backend CORS allowlist for the frontend origin. For the hosted primary, use `https://splitter-m0kv.onrender.com/api/v1` for both primary API variables and rebuild.

## Checks and release

```sh
npm run check
```

This runs ESLint, TypeScript, Jest and the optimized Next.js build. Playwright browser flows are separate: `npm run test:e2e`. Full API browser checks require `LOCAL_API_E2E=1` and an explicitly started disposable backend at `127.0.0.1:18000`; they must not target the public demo.

Vercel builds with `npm run build`. Public environment variables are embedded at build time. Confirm the intended repository, revision and production alias when releasing; a local build does not update the live site.

## Security and recovery

Private message keys remain in the browser and are scoped to the selected API origin and account. Logout clears session/private caches and queued messages while retaining recovery material needed to read historical messages. Export an encrypted recovery backup from Security before clearing browser storage or moving devices. Password login cannot recover an encryption private key that was never backed up.

Ed25519 is used for signing identity; message encryption uses separate P-256 key material. Encrypted sends and edits omit plaintext. Recovery imports verify the key pairs and the authenticated account before use.

## Layout

`app/page.tsx` controls page navigation. `components/pages` holds feature views, `components/ui` shared UI, and `lib` the API client, scoped browser state and cryptography. URL state selects pages such as `/?page=home`, `/?page=profile&userId=...` and `/?page=thread&postId=...`.

This is a team course project. Credit the team and identify your own contributions when presenting it. See the backend repository's deployment guide and demo walkthrough for the complete system.
