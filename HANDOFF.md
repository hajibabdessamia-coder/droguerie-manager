# HANDOFF.md — Droguerie Manager desktop migration

Detailed session handoff. Read `NEXT_SESSION.md` first for the quick-reference
summary; this file has the full narrative, exact commands, and reasoning behind
every non-obvious decision, so a fresh session can continue without
re-investigating the codebase from scratch.

## Project in one paragraph

"Pharma Manager" (folder/package name) is actually a POS + inventory management
app for a Moroccan electrical-hardware wholesale/retail shop ("droguerie", not a
pharmacy — the name is a historical artifact). Backend: NestJS + Prisma. Frontend:
Next.js 14 App Router, but pure client-side rendering (no server components,
route handlers, or server actions anywhere — confirmed during the Stage 0 audit).
It was originally built for Vercel (frontend) + Render (backend) + Supabase
(Postgres + storage), but that deployment was never completed (payment card
declined at Render). The owner decided to pivot entirely to an offline Electron
desktop app instead of resuming the cloud deployment. That pivot is what Stages
1–3 implement.

## Where things stand right now

**Updated 2026-08-17 — corrected during the Phase 11 pre-release hardening
session; everything below this note in the rest of the file is historical
narrative for Stage 0–2 and is still accurate as history, just no longer
"current."**

Branch `feature/sqlite-migration`, HEAD at commit `b5a3302` ("Bump version to
1.0.0 for first public release"), tag `v1.0.0` points at the same commit.
Stage 1, Stage 2, and Stage 3 (icon, backup/restore, portable-exe fix via
`nsis`+`zip` win targets instead of the broken `portable` target, production
hardening, Windows code signing with a self-signed dev certificate) are all
done and were part of the `v1.0.0` tag. This branch has **not** been pushed to
GitHub and the `v1.0.0` tag has not been pushed either — both remain local
only, deliberately deferred, ask before pushing.

A Phase 10 audit and Phase 11 pre-release hardening pass have since run on top
of `v1.0.0` (uncommitted as of this note) — see "Phase 11 — Pre-release
hardening" near the end of this file for exactly what changed. Frontend
localization (Arabic/French, `frontend/src/i18n/`) is also in progress and
uncommitted, predating and independent of Phase 11.

## Stage 1 — PostgreSQL → SQLite (full detail)

### What changed and why

`backend/prisma/schema.prisma`:
- `datasource db { provider = "sqlite" }`, single `DATABASE_URL` (no more
  `DIRECT_URL` — that split only existed for Supabase's connection pooler).
- Removed `@db.Decimal(10,2)` / `@db.Decimal(5,2)` from all 19 money fields —
  Postgres-only native-type annotations, not valid under the sqlite connector.
- **The big surprise**: Prisma's SQLite connector does not support
  schema-level `enum` **at all** — not gated behind a flag, an outright
  validation error (`P1012`). This wasn't in the original migration plan. All
  10 enums (`Role`, `ProductGroup`, `StockMovementType`, `CustomerType`,
  `InvoiceType`, `PaymentMethod`, `PriceType`, `AuditAction`, `BackupStatus`,
  `AlertType`) became plain `String` columns with quoted string defaults.
- `binaryTargets` in the `generator client` block later gained
  `["native", "windows", "darwin", "darwin-arm64"]` in Stage 2 for
  cross-platform Electron packaging.

`backend/src/common/enums.ts` (new file) — replaces what Prisma used to
generate. Each enum became a `const` object + type mirroring Prisma's own
generated pattern exactly:
```ts
export const Role = { ADMIN: 'ADMIN', SELLER: 'SELLER' } as const;
export type Role = (typeof Role)[keyof typeof Role];
```
17 files across controllers/guards/decorators/DTOs were repointed from
`import { Role } from '@prisma/client'` to `import { Role } from '../common/enums'`
(or the appropriate relative path). `Prisma` and `PrismaClient` namespace
imports were untouched — only the enum-specific imports moved.

Search filters: `mode: 'insensitive'` removed from `contains` filters in
`products.service.ts`, `customers.service.ts`, `suppliers.service.ts` — this
Prisma option is Postgres/MySQL-only and is rejected by the sqlite connector.
**Verified this doesn't change real behavior**: SQLite's default `LIKE` is
already case-insensitive for ASCII (tested `demo-001` matching `DEMO-001`), and
this app's real content is primarily Arabic script, which has no case
distinction to begin with.

Migrations: old Postgres-flavored SQL (`CREATE TYPE`, etc.) doesn't translate to
SQLite. Deleted the two old migration folders, ran `prisma migrate dev` fresh
against the sqlite provider, producing `20260719095503_init_sqlite`.

### The one real bug found in Stage 1

`SalesService.create()` builds a sale inside `prisma.$transaction(async (tx) =>
{...})`, and at the end called `this.audit.log(...)`. `AuditService.log()` wrote
through `this.prisma` — the **outer**, non-transactional Prisma client — not
`tx`. On Postgres this silently "worked" (separate MVCC connection, no
contention). SQLite allows only one writer at a time: the outer write blocked
waiting for the lock the still-open transaction held, and after 5 seconds Prisma
gave up with `P2028: Transaction already closed`, which the app's generic
exception filter turned into an unhelpful `400 "خطأ في قاعدة البيانات"`.

Fix: `AuditService.log()` now takes an optional last parameter — the Prisma
client to write through, defaulting to `this.prisma` — and
`SalesService.create()` passes `tx`. The other two callers (`AuthService.login`,
`AuthService.changePassword`) don't run inside a transaction and were left
unchanged.

**If you ever see a `P2028` error again**, check for a write happening through
`this.prisma` (not `tx`) inside an active `$transaction` callback anywhere else
in the codebase — this exact pattern is what to look for.

## Stage 2 — Electron packaging (full detail)

### Architecture decision

The backend runs as a **separate child process**, not in-process inside
Electron's main process. `electron/main.js` does:
```
child_process.fork(backendMainPath, [], {
  cwd: userDataPath,
  env: { ELECTRON_RUN_AS_NODE: '1', DATABASE_URL, PORT, JWT_SECRET, ... },
})
```
This was a deliberate choice: because the entire `backend/node_modules`
(including Prisma's native query engine and `bcrypt`'s native binding) ships as
plain unpacked files via electron-builder's `extraResources` — **not** inside
the app's `asar` archive — there is zero need to deal with `asarUnpack` rules
for native modules. The backend genuinely doesn't know or care it's running
inside Electron; it's the exact same `node dist/src/main.js` process it always
was, just with different environment variables.

### Why the frontend needed changes at all

Confirmed in Stage 0 that the entire frontend is client-rendered (no SSR, no
API routes, no server actions). That means Next.js **static export**
(`output: 'export'`) is viable with no rewrite of business logic — but static
export requires `generateStaticParams()` on every dynamic `[id]` route, because
there's no server left at runtime to render an arbitrary id on demand.

The 8 affected files (`customers/[id]/page.tsx` and `.../edit/page.tsx`,
`pos/receipt/[id]/page.tsx`, `products/[id]/edit/page.tsx`,
`purchases/[id]/page.tsx`, `sales/[id]/page.tsx`, `suppliers/[id]/page.tsx` and
`.../edit/page.tsx`) were each split into:
- `page.tsx` — new, tiny, **not** `'use client'`:
  ```tsx
  import PageClient from './page-client';
  export function generateStaticParams() { return [{ id: 'placeholder' }]; }
  export default function Page() { return <PageClient />; }
  ```
- `page-client.tsx` — the **exact original file content**, unchanged, just
  moved. Still reads the real id via `useParams()` at runtime in the browser.

This works because all real navigation to these routes happens via Next's
client-side router from within the already-loaded SPA (clicking a `<Link>` or
calling `router.push()`), which doesn't need a pre-rendered HTML file for the
specific id — only a hard page-load/refresh would need that, and this app never
does one once inside the authenticated shell. Same URLs, same behavior, same UI.

`next.config.mjs` — `output: 'export'` is gated behind
`process.env.BUILD_TARGET === 'electron'`, so plain `next dev` / `next build`
(what a normal developer or a future Vercel deploy would use) is **completely
unaffected**. Also added `images.unoptimized: true` (required for static export;
harmless since this app never uses `next/image`, only plain `<img>` tags).

### The fixed backend port

`electron/main.js` originally picked a random free port for the backend at
every launch. **This is wrong and was caught before shipping**: the frontend's
`NEXT_PUBLIC_API_URL` is baked into the static HTML/JS at `next build` time —
there's no server left to inject a different value at runtime. Fixed to a
constant, `BACKEND_PORT = 34115`, matching what the Electron-targeted frontend
build must be compiled against.

**If this port ever needs to change**: update `BACKEND_PORT` in
`electron/main.js` AND rebuild the frontend static export with the matching
`NEXT_PUBLIC_API_URL` (see rebuild commands below) — they must stay in sync, or
the packaged app's UI will fail to reach its own backend with no obvious error.

The frontend's **local static file server** port (serving `frontend/out/` inside
Electron) is chosen dynamically and safely, since `main.js` controls both ends
of that connection at runtime (it picks the port, then immediately loads that
exact URL into the `BrowserWindow` — no build-time baking involved).

### Database auto-creation

`electron/build-db-template.js` (build-time only, never runs at app runtime):
applies all migrations to a fresh SQLite file, then runs
`backend/prisma/seed.production.ts` (new, minimal seed: one admin user + default
`StoreSettings` row, **zero** demo products/customers/sales) against it, and
writes the result to `electron/resources/db-template.sqlite`. This file is
bundled into the installer via `extraResources`.

At runtime, `main.js`'s `ensureDatabase()` checks
`app.getPath('userData')/pharma-manager.db` — if it doesn't exist (first
launch), copies the bundled template there. That's the entire "auto-create
database on first launch" mechanism — no migration-running code ships in the
packaged app at all, which sidesteps needing to bundle the Prisma CLI.

Credentials in the template: `admin@pharma.local` / `Admin@12345` — same values
already used by the pre-existing dev seed (`backend/prisma/seed.ts`, untouched),
reused deliberately rather than inventing new ones. **As of Phase 11, this is
now enforced, not just documented**: the seeded admin has `mustChangePassword:
true` (new `User.mustChangePassword` column), and `AuthGuard` on the frontend
redirects to `/account` until the password is changed — see "Phase 11 —
Pre-release hardening" below.

### Puppeteer / PDF generation

**Kept exactly as-is** — still Puppeteer launching a full headless Chromium per
PDF, per the explicit "do not modify any functionality" instruction for this
stage. This is the single largest contributor to installer size (~420 MB
Chromium cache) and was flagged repeatedly as the top candidate for a future,
explicitly-scoped change (swap to Electron's own `webContents.printToPDF()`,
eliminating a redundant second Chromium entirely) — **not done**, needs an
explicit go-ahead since it changes how PDFs are generated internally even
though the output would look identical.

Puppeteer 25.x downloads its Chromium **outside** `node_modules` (to an OS
cache dir by default), which would NOT be picked up by `extraResources`
bundling `backend/node_modules`. Fixed by installing it into a project-local,
packageable path instead:
```
cd backend && npx puppeteer browsers install chrome --path .puppeteer-cache
```
`electron/main.js` sets `PUPPETEER_CACHE_DIR` in the spawned backend's
environment to point at the bundled copy of this folder
(`resources/backend/.puppeteer-cache` when packaged).

### Real bugs found in Stage 2 (all fixed)

1. **`ERR_REQUIRE_ESM` crash on startup.** Puppeteer 25 ships as an ES module.
   Electron 33 (the initial choice) bundles Node 20.18, which doesn't support
   `require()`-ing an ES module the way Node 24 does (used everywhere else in
   this project via plain `node`). Fixed by bumping the `electron` devDependency
   to `^43.1.1` (bundles Node 24.18) — a pure build-tooling version change, zero
   application code touched. Verified via:
   ```
   ELECTRON_RUN_AS_NODE=1 npx electron -e "console.log(process.version)"
   ```
2. **`fork()` from Electron's main process needs `ELECTRON_RUN_AS_NODE=1`** in
   the child's env, or it re-launches the Electron binary itself instead of
   running the target file as plain Node. Standard, well-known Electron gotcha;
   now set explicitly.
3. **Pre-existing, unrelated bug discovered**: `backend/package.json`'s
   `"start:prod": "node dist/main"` has apparently never worked. `nest build`'s
   actual output is `dist/src/main.js`, not `dist/main.js` — a stray root-level
   file (`backend/scratch-test-report-gen.ts`, present before this work began)
   makes TypeScript infer the whole `backend/` folder as the compile root
   (`rootDir`), so `src/` stays nested under `dist/`. Plausible explanation:
   this script would only ever run via the Render deployment, which was never
   completed, so it was never actually exercised. **Electron points at the real
   path directly** (`dist/src/main.js`); the `start:prod` script itself and the
   tsconfig were intentionally **not** touched — out of scope for this stage.
4. **`winCodeSign` extraction failure on Windows** — electron-builder downloads
   a helper package containing two macOS `.dylib` **symlinks**, and Windows
   refuses to create symlinks without Administrator rights or Developer Mode
   (neither available in this session — confirmed via a failed registry-write
   test). The extraction otherwise succeeds (83 of 85 files); only those two
   irrelevant-to-Windows files fail. **Workaround applied** (see exact steps
   below) rather than blocked; **this is a one-time fix to this machine's
   local build cache**, not something in the repository. A different machine
   (or this one after enabling Developer Mode) will need to redo it, or won't
   need it at all if Developer Mode is on.

### Exact winCodeSign workaround (only needed if you hit the same error)

If `electron-builder --win ...` fails with `Cannot create symbolic link` /
`ERROR: Le client ne dispose pas d'un privilège nécessaire`:
```bash
# Easiest real fix: Settings → Privacy & Security → For developers → Developer Mode → On
# Then just retry the build. If you can't enable Developer Mode, manually patch the cache:

CACHE_DIR="$LOCALAPPDATA/electron-builder/Cache/winCodeSign"   # adjust for your shell
# Let the build fail once first so a partial extraction exists, then:
TARGET="$CACHE_DIR/winCodeSign-2.6.0"
rm -rf "$TARGET"
cp -r "$CACHE_DIR"/<any-random-numbered-folder-that-has-83-files> "$TARGET"
mkdir -p "$TARGET/darwin/10.12/lib"
touch "$TARGET/darwin/10.12/lib/libcrypto.dylib"
touch "$TARGET/darwin/10.12/lib/libssl.dylib"
# clean up the random scratch folders and stale .7z downloads, then retry the build
```
These two files are mac-only signing tool dependencies, never touched by an
unsigned Windows build — the placeholder empty files are sufficient.

### Testing performed (exact steps, for reproducing or extending)

**Dev mode** (`cd electron && npx electron .`): full functional pass — login,
manufacturer/product creation, a sale, invoice PDF (the exact thing bug #1 broke),
report PDF + Excel export, product image upload (landed correctly under
`%APPDATA%\Pharma Manager\uploads`), frontend static server reachable.

**Packaged build** (`electron/dist-builds/win-unpacked/Pharma Manager.exe`, run via
`Start-Process` in PowerShell — **not** via git-bash `nohup ... &`, which does not
reliably launch native Windows GUI executables in this environment and produced
false "it crashed" signals during testing before this was figured out): from a
freshly deleted `%APPDATA%\Pharma Manager` folder, confirmed first-launch database
creation, login, full sale, invoice PDF via the bundled (not system) Chromium,
image upload, frontend UI reachable — all correct.

**Portable exe** — this was a real Stage 2 finding, but is now historical only:
Stage 3 diagnosed the root cause (NSIS's portable target unconditionally
re-extracts its entire payload on every launch, with no caching option) and
replaced the `portable` win target with `zip` (`electron/package.json`
`build.win.target` is now `["nsis", "zip"]`). The zip requires one manual
one-time extraction but is fast on every launch after that, same as the
already-verified `win-unpacked` folder. There is no more "portable exe" build
target in this repo.

## Full rebuild procedure (from a clean checkout, or after resetting deps)

```bash
# Backend
cd backend
npm install
npx prisma generate                              # needs network access for darwin engine binaries
npm run build                                      # → dist/src/main.js
npx puppeteer browsers install chrome --path .puppeteer-cache   # ~420 MB download

# Frontend
cd ../frontend
npm install
BUILD_TARGET=electron npx next build                # → out/

# Electron
cd ../electron
npm install
node scripts/make-icon.js                           # → resources/icon.png, icon.ico
node build-db-template.js                            # → resources/db-template.sqlite

# Dev-mode smoke test (fast iteration)
npx electron .

# Full Windows build (see winCodeSign workaround above if this fails on Windows)
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win nsis portable
# → dist-builds/Pharma Manager Setup 0.1.0.exe   (installer — verified working)
# → dist-builds/Pharma Manager 0.1.0.exe          (portable — unverified)
# → dist-builds/win-unpacked/                     (raw unpacked build — verified working)
```

macOS build (only from an actual Mac, or via the prepared GitHub Actions
workflow — not run yet):
```bash
# On a real Mac, after the backend/frontend/electron steps above:
cd electron
# generate icon.icns via iconutil — see .github/workflows/build-mac.yml for the exact sips/iconutil steps
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac dmg
```
Or trigger `.github/workflows/build-mac.yml` (workflow_dispatch) once this
branch is pushed to GitHub — not done yet, needs separate confirmation since it's
a visible action on the remote repository.

## Files changed this session (annotated)

**Prisma / backend core**
- `backend/prisma/schema.prisma` — sqlite datasource, no Decimal native types, no enums, binaryTargets for win/mac.
- `backend/prisma/migrations/` — old Postgres migrations deleted, one fresh sqlite migration added.
- `backend/prisma/seed.production.ts` — **new**, admin-only seed for the shipped db template.
- `backend/src/common/enums.ts` — **new**, replaces Prisma's removed enum exports.
- `backend/.env.example`, `backend/.gitignore` — sqlite file path, ignore `*.db`/`.puppeteer-cache`.

**Backend — enum import fixups (behavior unchanged, 17 files)**
`audit/audit.service.ts` (also gained the transaction-client parameter — see bug fix above),
`auth/decorators/roles.decorator.ts`, `auth/guards/roles.guard.ts`,
`customers/customers.controller.ts`, `customers/dto/create-customer.dto.ts`,
`manufacturers/manufacturers.controller.ts`, `products/dto/create-product.dto.ts`,
`products/dto/query-product.dto.ts`, `products/products.controller.ts`,
`purchases/purchases.controller.ts`, `sales/dto/create-sale.dto.ts`,
`sales/dto/update-sale.dto.ts`, `sales/sales.controller.ts`, `sales/sales.service.ts`
(the actual `tx` fix), `store-settings/store-settings.controller.ts`,
`suppliers/suppliers.controller.ts`, `uploads/uploads.controller.ts`.

**Backend — search fix (3 files)**
`customers/customers.service.ts`, `products/products.service.ts`,
`suppliers/suppliers.service.ts` — removed `mode: 'insensitive'`.

**Frontend**
- `next.config.mjs` — `output: 'export'` gated behind `BUILD_TARGET=electron`.
- 8 dynamic route pairs split into `page.tsx` (server shell) + `page-client.tsx`
  (original content, unchanged) — see the Stage 2 section above for the list.

**New: Electron app**
- `electron/main.js`, `electron/build-db-template.js`, `electron/scripts/make-icon.js`,
  `electron/package.json` (+ lockfile), `electron/.gitignore`.

**New: CI**
- `.github/workflows/build-mac.yml` — `workflow_dispatch` only, not triggered.

## Phase 11 — Pre-release hardening (2026-08-17)

A Phase 10 read-only QA audit (8 findings) was followed by a Phase 11
implementation pass addressing the confirmed findings. Scope was explicitly
Windows-only hardening — no macOS packaging changes, no trial/licensing system,
no business-logic changes, no UI redesign, no new dependencies installed.

1. **Default admin password (release blocker)** — `User.mustChangePassword`
   (new Prisma column, migration `20260817054721_add_must_change_password`,
   additive, non-destructive, applied via `prisma migrate deploy`). Only the
   production-seeded admin (`backend/prisma/seed.production.ts`) is created
   with it `true`; the dev seed (`seed.ts`) and any pre-existing user are
   unaffected. `AuthService.login`/`changeEmail` now return the flag,
   `changePassword` clears it on success. `AuthGuard` redirects any
   authenticated user with the flag set to `/account`, on every route, until
   they change their password via the existing change-password form (no new
   page). **`electron/resources/db-template.sqlite` (the packaged app's
   first-launch database template) is a gitignored build artifact and was
   NOT regenerated this session** — it still predates this change and must be
   rebuilt via `node electron/build-db-template.js` before the next Windows
   package/build, or new installs will ship a template missing this column.
2. **Signing password (release blocker)** — the literal signing certificate
   password, previously hardcoded in `electron/scripts/pack-win.js` and
   `electron/scripts/make-dev-cert.ps1`, is now read from the
   `CSC_KEY_PASSWORD` environment variable in both places, with a clear
   startup error (not a silent failure) if it's unset. Confirmed via
   repository-wide grep that the old literal password string no longer exists
   in any tracked file. Anyone rebuilding/re-signing must now set
   `CSC_KEY_PASSWORD` themselves before running `pack-win.js` or
   `make-dev-cert.ps1`.
3. **Silent mutation errors** — 7 mutations (delete product, add/delete
   customer payment/customer, add supplier payment, delete sale, delete
   backup, stock adjustment) now surface failures via the existing
   `isError`/`onError` + translated inline-message pattern already used
   elsewhere (e.g. `dashboard/page.tsx`, `settings/page.tsx`'s backup
   mutations). No toast library added.
4. **Missing query error states** — the five list pages (products, customers,
   suppliers, purchases, sales) now render a translated error row instead of a
   silent empty table when their query fails, while preserving the existing
   skeleton and empty-state behavior.
5. **Export error handling** — PDF generation (`backend/src/reports/pdf.util.ts`)
   and Excel generation (`backend/src/reports/excel.util.ts`) now catch
   generation failures (including Puppeteer launch failures, relevant to the
   packaged app's bundled-Chromium dependency) at their single choke point,
   log the real error server-side via `Logger`, and throw a generic
   `InternalServerErrorException` with no stack trace/paths/Puppeteer
   internals in the response — this covers all 5 report exports and the sale
   invoice PDF automatically. On the frontend, the 4 Excel-export buttons
   (previously bare, unawaited `onClick` calls) and the sale invoice PDF
   download are now `useMutation`-backed with visible translated error
   feedback, matching the summary-PDF export's existing pattern.
6. **i18n** — all new user-facing strings added to both
   `frontend/src/i18n/dictionaries/ar.ts` and `fr.ts` in matching positions;
   `fr.ts`'s `: Dictionary` type annotation makes any structural mismatch a
   compile error, and `npx tsc --noEmit` was run to confirm parity.
7. **Not done, flagged for awareness**: while auditing, discovered that
   `backend/.gitignore`'s unanchored `Reports/` pattern (line 7) matches the
   `backend/src/reports/` **source** directory too (case-insensitive on
   Windows/git) — `git ls-files backend/src/reports/` returns zero files.
   The entire reports/export module's source, including the files touched in
   item 5 above, has **never been tracked by git**, since Stage 2. This is
   pre-existing (not caused by Phase 11) and was left untouched per the
   "don't fix things outside the stated scope" instruction for this session,
   but it means a plain `git add -A` / `git status` will silently omit this
   module. Needs a deliberate `.gitignore` fix (e.g. anchor the ignore to
   `/Reports/` at the backend root) before the next commit.

Validation performed: `npx tsc --noEmit` (frontend), `npx jest` (frontend,
16/16 passing), `nest build` (backend, clean), `npm test` (backend, 24/24
passing, including an updated `auth.service.spec.ts`), `prisma validate` +
`prisma migrate status` (schema valid, migration applied, no drift), a
row-count check across all major tables before/after the migration (no data
loss), and a repo-wide grep confirming the old signing password is gone from
tracked files. No packages were installed; no `package.json`/lockfile changed.

## Phase 12 — Offline 7-day trial & device-bound licensing (2026-08-17)

Gates the whole application (including the login screen itself, not just the
authenticated pages) behind a 7-day trial and, after that, a device-bound
license — with **zero network dependency**, matching the app's fully offline
architecture. No business logic touched; gating is centralized in one
backend guard, not scattered across feature modules. No new npm dependency
(Node's built-in `crypto` covers Ed25519 signing/verification; the device ID
is read via `reg query` against the Windows registry, no `node-machine-id`
package needed).

- **New backend module** `backend/src/license/` — `AppLicense` Prisma model
  (single row per install, additive migration
  `20260817064205_add_app_license`), `LicenseService` (trial/license status,
  activation), `device-id.util.ts` (Windows `MachineGuid` → SHA-256 → 16-hex
  device ID), `license-crypto.util.ts` (Ed25519 verify), `trial-marker.util.ts`
  + `trial-integrity.util.ts` (tamper-resistance, see below).
- **Central gate**: a new `LicenseGuard` (`backend/src/auth/guards/`),
  registered as the *first* global `APP_GUARD` in `app.module.ts` — runs
  before `JwtAuthGuard`/`RolesGuard`, so a blocked device can't reach
  `/auth/login` either. A separate `@LicensePublic()` decorator (distinct
  from the existing `@Public()`, which only exempts JWT auth) exempts just
  `/license/*` and `/health` (the latter needed so Electron's own startup
  health-check in `electron/main.js` isn't blocked by an expired license).
- **Crypto key custody**: Ed25519 keypair. The **public** key
  (`electron/resources/license-public-key.pem`, committed, bundled via a new
  `extraResources` entry) is the *only* key that ships in the app. The
  **private** key lives only in the new top-level `license-tool/` directory
  (never referenced by any packaging config, so it never ships;
  `license-tool/.gitignore` keeps the generated key files out of git).
  `license-tool/generate-keypair.js` is a one-time setup script;
  `license-tool/generate-license.js --device-id <id> --days N` (or
  `--perpetual`) is what the seller runs to issue a license for a specific
  customer device — see `license-tool/README.md`.
- **Frontend**: new root-level `frontend/src/app/activate/page.tsx` (device
  ID display+copy, trial/expired status, license-key paste+activate), a new
  `LicenseGate` component wrapping the entire app in `layout.tsx` (above
  `AuthGuard`, same `usePathname()`-redirect pattern as the Phase 11
  `mustChangePassword` gate), a trial-remaining-days badge in `topbar.tsx`,
  and a `LICENSE_REQUIRED` branch in `api-client.ts`'s response interceptor
  parallel to the existing 401 handling. New `activate.*` / `licenseGate.*` /
  `topbar.trialRemaining*` keys in both `ar.ts` and `fr.ts`.
- **Tamper resistance — and its honest limits**: (1) a persisted, forward-only
  `trialHighWaterMark` defeats simple clock-rollback (rolling the clock back
  cannot buy trial time — the last known time is used instead); (2) a
  redundant marker file outside `userData` (under `%LOCALAPPDATA%\.pmts`)
  means deleting/reinstalling to reset the SQLite database alone doesn't
  reset the trial start date; (3) an HMAC over the trial row (keyed off the
  device ID) catches casual edits made with a SQLite browser. **What this
  does NOT protect against**: this is a fully offline product with no server
  to be the source of truth — a sufficiently determined user who edits both
  the database and the marker file, or reinstalls into a fresh OS profile,
  can reset the trial. The **license** itself has real cryptographic
  protection (a forged license is not possible without the private key,
  regardless of what's edited on disk) — that boundary is solid. The
  trial's protection is best-effort friction, not a guarantee, and is
  documented as such rather than oversold.
- **`db-template.sqlite` regenerated** this session (same procedure as
  Phase 11's loose-end fix) and verified to contain zero `AppLicense` rows —
  every new install starts its own independent 7-day clock.
- **Post-review fix**: `license-crypto.util.ts`'s dev-only public-key fallback
  (used only when `LICENSE_PUBLIC_KEY_PATH` isn't set) originally assumed a
  fixed `../../../` depth from `__dirname`, which was correct for the
  `backend/src/license` source layout but wrong for the compiled
  `backend/dist/src/license` layout. Fixed with a `findRepoRoot()` directory
  walk that works for both; covered by 3 new regression tests in
  `license-crypto.util.spec.ts`.

Validation performed: `nest build` + `npm test` (backend, 41/41 passing,
17 license tests: trial init, 7-day expiration, clock-rollback
detection, valid/invalid-signature/wrong-device/expired license
verification, successful activation, persistence-across-restarts,
wrong-device-license-in-DB rejection, plus 3 public-key path-resolution
regression tests), `npx tsc --noEmit` + `npx jest`
(frontend, 16/16 passing, i18n parity enforced by `fr.ts`'s `: Dictionary`
annotation), `prisma validate` + `prisma migrate status`, a data-preservation
row-count check across all tables before/after the migration (no data
loss, confirmed via `dev.db` MD5 checksum unchanged across the template
regeneration step), and confirmation that no `package.json`/lockfile
changed anywhere in the repo (no new npm dependency was needed).

## What NOT to do without asking first

- Don't push this branch or trigger the mac CI workflow — needs explicit confirmation.
- Don't touch `backend/package.json`'s `start:prod` script — the pre-existing
  bug there is documented, not silently fixed; fixing it is a separate,
  out-of-scope decision.
- Don't swap Puppeteer for Electron's native PDF printing without confirming
  scope — it's the obvious next optimization but is a functional-layer change.
- Don't assume the portable exe works — it's unverified, say so.
- Don't lose `license-tool/private-key.pem` — it cannot be regenerated, and
  losing it means no new licenses can ever be issued without shipping a new
  public key (and thus invalidating every previously-issued license) to
  every existing customer. It is gitignored by design; back it up offline.
