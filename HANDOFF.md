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

**Updated 2026-09-15 — the project was renamed and genericized end-to-end
(pharma-specific POS → generic multi-business POS/inventory, "L7ssab
Manager") in a 5-phase session. See "Phase 13 — L7ssab Manager
genericization" near the end of this file for the full writeup. Everything
between this note and that section is historical narrative for Stage 0–2 and
Phases 11–12 and is still accurate as history, just no longer "current" —
the product is no longer pharma/electrical-hardware-specific as described
below, it's general-purpose now.**

Branch `feature/sqlite-migration`, HEAD at commit `1ad6cab` ("feat: barcode
support (EAN-13) — field, scan-to-cart, label printing"). Full commit chain
for Phase 13, oldest to newest: `0fd46bd` (pre-work checkpoint) →
`93fef5c` (genericize branding) → `81d11ad` (Categories/Units + invoice fix)
→ `1b642a9` (full i18n + language switcher + RTL/LTR) → `1ad6cab` (barcode).
Base was `a11cf3b` ("fix: Phase 12 post-commit license fixes"), which is
where the older parts of this file leave off. **Still not pushed to GitHub
— ask before pushing**, same standing rule as always in this file.

A Phase 10 audit and Phase 11 pre-release hardening pass ran on top of
`v1.0.0`; Phase 12 added offline trial/licensing. See their sections below
for exactly what changed. All of that predates and is unrelated to Phase 13.

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

## Phase 12 post-commit fixes and acceptance testing (2026-08-19)

Phase 12 above is committed at `17e7ea5`. Real acceptance testing performed
after that commit — running an actual dev backend (`npm run start:dev`) and
frontend (`npm run dev`) against the real `backend/prisma/dev.db`, not just
the automated test suite — found two bugs. Both are fixed in the working
tree on top of `17e7ea5`, **but neither fix is committed yet**; they exist
only as modified files (`backend/src/license/license.controller.ts`,
`backend/src/license/license.service.ts`, `backend/src/license/license.service.spec.ts`)
plus one new file (`backend/test/license-access.e2e-spec.ts`).

1. **`LicenseController` was unreachable without a JWT (found while
   verifying the Device ID actually displays on `/activate`).** The
   controller carried `@LicensePublic()` (exempts `LicenseGuard`, described
   above) but not the separate `@Public()` decorator (exempts
   `JwtAuthGuard`). Both `GET /license/status` and `POST /license/activate`
   therefore still hit `JwtAuthGuard` and returned `401` for any caller
   without a token — exactly the caller `/activate` exists to serve. Worse,
   because `LicenseGuard` also blocks `/auth/login` once the trial/license
   state is anything other than `TRIAL_ACTIVE`/`LICENSED`, a genuinely
   locked-out device could never obtain a JWT through any path, and so could
   never reach `/license/status` or `/license/activate` either — a
   **permanent lockout** with no way to see the Device ID or paste in a
   purchased license. This was completely masked during the original Phase
   12 validation because the trial was still active and login still worked
   in every test run. **Fix**: added `@Public()` alongside the existing
   `@LicensePublic()` on the `LicenseController` class
   (`backend/src/license/license.controller.ts`). Scoped correctly because
   that controller has exactly two routes, both of which are meant to be
   fully public; no other controller was touched.
2. **Device ID format mismatch made every real license fail with
   `WRONG_DEVICE` (found during the first real activation attempt with a
   license-tool-generated key).** `device-id.util.ts` has always had two
   different representations: `getDeviceId()` returns a raw, internal
   32-hex-char SHA-256-derived string (used nowhere in the UI), and
   `formatDeviceIdForDisplay()` derives a 16-hex-char dashed uppercase
   string from it (e.g. `BD5A-960C-E803-AE98`) — the *only* one ever shown
   on `/activate`, and the one `license-tool/README.md` explicitly instructs
   the seller to collect from the customer. `LicenseService.getStatus()`
   and `.activate()` were signing/verifying against the **raw** value, not
   the displayed one, so a license generated from the Device ID a real
   customer can actually see or copy was rejected with `WRONG_DEVICE` every
   time — the licensing feature was non-functional end-to-end for any real
   customer. **Fix**, scoped to `backend/src/license/license.service.ts`
   only: both `getStatus()` and `activate()` now compute
   `licenseDeviceId = formatDeviceIdForDisplay(deviceId)` and pass that (not
   the raw `deviceId`) into `verifyLicenseKey()`, and return it as the
   `deviceId` field in `LicenseStatus`. The raw `deviceId` is still used,
   completely unchanged, for `getOrCreateRow()`,
   `computeIntegrityHash()`, and `readOrInitTrialMarker()` — i.e. trial
   tamper-resistance keying was deliberately left alone, both because it was
   out of scope and because changing it would have invalidated the
   `integrityHash` already stored in the live `AppLicense` row (recomputing
   that hash under a new device-ID representation would have made an
   untouched, legitimate trial row look tampered). `device-id.util.ts`,
   `license-crypto.util.ts`, `trial-integrity.util.ts`,
   `trial-marker.util.ts`, and `license-tool/generate-license.js` were not
   changed at all — the mismatch was entirely in which of the two existing
   representations `license.service.ts` fed into signing/verification.

Both fixes are minimal, backend-only, and additive to the existing design —
no schema change, no new dependency, no change to the Ed25519 keypair or its
custody (`license-tool/private-key.pem` was reused as-is, not regenerated),
no frontend file needed to change for either fix.

**Real end-to-end validation performed after both fixes**, against the
actual development database (`backend/prisma/dev.db`) and the real Device ID
of this machine (`BD5A-960C-E803-AE98`):
- Generated a genuine 30-day license via
  `license-tool/generate-license.js --device-id BD5A-960C-E803-AE98 --days 30`,
  using the exact string the running app displayed on `/activate` — not an
  internal/raw ID obtained through any side channel.
- `POST /api/license/activate` with that license returned
  `{"state":"LICENSED",...}` (`201`).
- `GET /api/license/status` confirmed `LICENSED` immediately after.
- The backend dev process was killed outright (all of the `npm`/`nest`/
  `node` PIDs in the watch chain, not just a `--watch` hot-reload) and
  restarted fresh with `npm run start:dev`; `GET /api/license/status`
  still returned `LICENSED` afterward.
- The `AppLicense` row was inspected directly (read-only, via a throwaway
  Prisma query) before and after every step: it is the **same row**
  (`id: cmszni6680000t587xitkrd3h`) throughout this entire testing history —
  never recreated, never reset — with `licenseKey`/`activatedAt` populated
  once at activation and unchanged since.
- **Negative tests**: (a) a license signed with the real private key for a
  deliberately different, made-up Device ID was rejected with
  `{"code":"WRONG_DEVICE"}`; (b) an already-expired license — constructed
  with the same payload shape and the real private key, correct device ID,
  `expiresAt` one day in the past (necessary because
  `generate-license.js` only supports future `--days`/`--perpetual`, no
  past-dated option) — was rejected with `{"code":"EXPIRED"}`. In both
  cases, `GET /api/license/status` still reported the existing `LICENSED`
  state immediately after, and the `AppLicense` row's
  `licenseKey`/`activatedAt`/`integrityHash` were confirmed byte-for-byte
  unchanged — a rejected `activate()` call throws before any database write,
  so a failed attempt cannot disturb a valid, already-activated license.

**Automated validation after both fixes**: backend `npm test` 43/43 passing
(was 41/41 before this session — two new tests added to
`license.service.spec.ts`: one asserting `getStatus()`'s returned `deviceId`
equals the canonical formatted value, one proving a license signed with
exactly that returned value activates to `LICENSED`). A new file,
`backend/test/license-access.e2e-spec.ts` (7 tests, all passing), boots the
real `AppModule` — real `LicenseGuard`, real `JwtAuthGuard`, real decorators
on the real `LicenseController` — with only `LicenseService` overridden by a
controllable mock (so it never touches the real `AppLicense` row), and
proves: `/license/status` and `/license/activate` are reachable with no
`Authorization` header both while `TRIAL_ACTIVE` and while `TRIAL_EXPIRED`
(this is the exact bug from fix #1); an unrelated business endpoint
(`/api/products`) still requires a token in both states; and `/auth/login`
plus `/api/products` are both still correctly blocked by `LicenseGuard` with
`{"code":"LICENSE_REQUIRED"}` when the mocked state is `TRIAL_EXPIRED` (this
is the exact scenario fix #1 was written to unblock, now verified it still
gates correctly). `npx tsc --noEmit` clean.

**Next step**: stage and commit these two fixes on top of `17e7ea5` (file
list above) — not yet done as of this note. Nothing macOS-related, no
CI/push, no auto-update, no further trial/licensing redesign, and no Phase
13 work should start before that.

## Phase 13 — L7ssab Manager genericization (2026-09-15)

The user asked to turn the app from a pharma/electrical-hardware-specific POS
into a fully generic sales/inventory system for any business, with full
bilingual (Arabic/French) support end-to-end, and barcode support (which
didn't exist at all). Done as 5 sequential phases, each committed separately,
each confirmed with the user before moving to the next. Mandatory safety
steps done before any code changed: full backup to
`Desktop/pharma-manager-BACKUP-2026-09-15` (source + `.git` + both SQLite
files; `node_modules`/`.next`/`dist-builds` excluded as regenerable — ~4.6 GB
saved), and an initial checkpoint commit (`0fd46bd`) of whatever was already
uncommitted in the working tree, since the project turned out to already be
under git (contrary to the original instruction's assumption it might not be).

### Phase 1 — Audit (read-only, no code changed)

Found the app was already structurally generic — `Product`/`Sale`/`Customer`/
`Supplier` etc. have zero pharma-specific fields, and `frontend/src/i18n/`
was already a complete, type-safe two-language system (`fr.ts`'s
`: Dictionary` annotation makes any missing/extra key a compile error).
The actual problems:
- ~14 literal `pharma`/`العقاقير` occurrences in user-visible text and
  package/identifier names (branding only, see Phase 2).
- **No language switcher existed anywhere except the login screen.** This
  was the real cause of "French mode looks half-translated" — it's not a
  translation bug, there was simply no way to change language once logged
  in. Fixed in Phase 4.
- Backend had **zero** i18n — every thrown exception message, every report/
  Excel/PDF string, was a hardcoded Arabic literal. Fixed in Phase 4.
- Product categorization was 4 hardcoded tabs (`GROUP_1..4`, `common/
  enums.ts`), not a real user-manageable table. Fixed in Phase 3.
- No unit-of-measure concept existed at all (not "hardcoded to pharmacy
  units" as originally assumed — just absent). Added in Phase 3.
- Real bug found: the invoice PDF (`pdf.util.ts`'s `buildInvoiceHtml`)
  received the store's IF/ICE/RC/Patente tax-ID fields but never rendered
  them, unlike the on-screen receipt which did. Fixed in Phase 3.
- **Zero** barcode support anywhere — no field, no scan logic, no printing.
  `Product.internalCode` (already searched from POS) was the only thing
  resembling it. Built from scratch in Phase 5.

### Phase 2 — Genericize branding (commit `93fef5c`)

Replaced every user-visible pharma/electrical-hardware string with generic
wording, in both `ar.ts` and `fr.ts` (`fr.ts` had its own domain wording,
"quincaillerie électrique", not just an Arabic problem). App name became
"L7ssab Manager" everywhere (metadata, Swagger title, sidebar/login/activate
logo — the logo glyph was a bare Arabic letter `ع` hardcoded even in French
mode; replaced with a locale-neutral "L7" mark). `package.json` names,
`render.yaml`, `build-mac.yml`, `docker-compose.yml` renamed
`pharma-manager-* → l7ssab-manager-*`. Seeded admin email changed
`admin@pharma.local → admin@l7ssab.local` in `seed.ts`/`seed.production.ts`
— **new installs only**; the existing `dev.db` keeps its original
`admin@pharma.local` account untouched (verified via MD5 checksum, unchanged
by this phase).

**Four internal identifiers were deliberately left alone**, each with an
in-code comment explaining why (search `مُجمَّد عمداً` — "deliberately frozen"
— to find all four): `license/device-id.util.ts`'s `APP_SALT` (renaming
invalidates every already-issued license, no upside since it's invisible to
users), `electron/main.js`'s `pharma-manager.db` filename (renaming makes
the app copy a fresh empty template instead of opening a real customer's
existing data), and two `localStorage` keys — `store/auth-store.ts`'s
`'pharma-auth'` and `i18n/locale-provider.tsx`'s `'pharma-manager-locale'`
(renaming either logs out / resets the language for every existing user,
for zero benefit since neither is user-visible).

### Phase 3 — Categories, Units, invoice fix (commit `81d11ad`)

New `Category` and `Unit` Prisma models, both full CRUD (create/rename/
delete) via new `backend/src/categories/` and `backend/src/units/` modules,
managed from a new "الفئات / الوحدات" section in Settings
(`frontend/src/components/settings/named-list-manager.tsx`, a reusable
create/rename/delete list widget). `Product.group` (the old fixed enum)
removed entirely; `Product.categoryId`/`unitId` added, both optional with
`onDelete: SetNull` — **deleting a category or unit is always safe**, it
just un-sets the field on any product that had it, never blocks the delete
or touches the product otherwise. `ProductGroup` removed from
`common/enums.ts`. POS's 4 fixed group tabs became dynamic category tabs
sourced from the new table, defaulting to an "All" tab (previously one of
the 4 fixed groups was always force-selected, hiding anything uncategorized).

**Migration** (`20260915103500_add_categories_and_units`) needed hand-editing
after the raw `prisma migrate diff` output, which — as generated — silently
**dropped** the `group` column with no data-preservation step at all (a
plain `prisma migrate dev` would have destroyed every product's
categorization with no warning). The hand-edited version seeds 4 categories
named to match exactly what the UI already showed for `GROUP_1..4` (`الفئة
الأولى`..`الفئة الرابعة`) plus one default unit (`قطعة`), then backfills
every product's new `categoryId`/`unitId` from its old `group` value in the
same statement that rebuilds the table (SQLite requires a full table rebuild
to add a `UNIQUE`/FK column, there's no in-place `ALTER`). **Tested against
a throwaway copy of the real `dev.db` first** (all 15 tables, same row
counts, `PRAGMA foreign_key_check` empty) and the SQL was shown to the user
for approval before being applied to the real `dev.db` — required by the
session's standing migration-safety rule, followed for every schema change
in this phase and Phase 5's below.

Invoice fix: `buildInvoiceHtml` (`pdf.util.ts`) now actually renders the
IF/ICE/RC/Patente block it always received but silently dropped, and gained
a `locale` parameter (labels, `dir`/`lang`, date/currency formatting) —
scoped to just this one customer-facing document; the ~260 other backend
Arabic strings (error messages, the summary report, Excel exports) were
explicitly deferred to Phase 4 as a distinct, larger effort needing a real
i18n mechanism rather than one-off translation.

### Phase 4 — Full i18n, language switcher, RTL/LTR (commit `1b642a9`)

**The actual fix for the originally-reported bug**: new `LocaleToggle`
(`frontend/src/components/locale-toggle.tsx`) in the Topbar, same
icon-button pattern as the existing `ThemeToggle`. Before this, `setLocale`
was only ever called from the login screen — there was no way to change
language after signing in.

New backend i18n system, `backend/src/common/i18n/`:
- `messages.ts` — central `ERROR_CODE → {ar, fr}` dictionary.
- `locale.util.ts` — `resolveLocale(req)` reads `?locale=` then the
  `X-Locale` header.
- `http-exception.filter.ts` (new global filter) — translates any exception
  whose response body carries a known `code` (services now throw
  `new XException({ code: 'Y', params? })` instead of a literal string,
  across every service — auth, products, sales, purchases, customers,
  suppliers, categories, units, manufacturers, backup, uploads, license);
  replaces class-validator's English-by-default validation-error arrays with
  one translated generic message; passes through anything it doesn't
  recognize unchanged (e.g. `LicenseGuard`'s `{ code: 'LICENSE_REQUIRED' }`,
  which the frontend reads structurally, not as display text).
- `prisma-exception.filter.ts` updated to the same mechanism.
- `frontend/src/lib/api-client.ts` now attaches the current UI locale as
  `X-Locale` on **every** request — no per-call plumbing needed anywhere.

Reports/invoice extended to be fully bilingual (sheet titles, column
headers, period/payment-method/customer-type labels, RTL/LTR sheet
direction) — `pdf.util.ts`, `excel.util.ts`, `reports.service.ts`,
`period.util.ts`, new `reports/report-labels.ts`. Customer/product/seller
names are correctly left untranslated (user data, not UI chrome — same rule
already applied to store name). `reports-scheduler.service.ts` (unattended
cron, no HTTP request to read a locale from) keeps defaulting to Arabic,
unchanged.

RTL/LTR sweep: 18 of the audit's 22 flagged spots were real — hardcoded
`text-right`/`text-left` converted to logical `text-start`/`text-end` across
12 files. **The other 4 turned out to be false positives on re-inspection**:
2 were comments *documenting* an already-correct fix (matched by a naive
grep on the word, not actual usage), and 2 (the mobile sidebar drawer's
`translate-x` slide direction) were already handled correctly via an
explicit `isRtl` check, because Tailwind has no logical-property equivalent
for that one.

### Phase 5 — Barcode (EAN-13) (commit `1ad6cab`)

`Product.barcode String? @unique` — purely additive migration
(`20260915120000_add_product_barcode`, one nullable column + its unique
index, nothing else touched; SQLite allows multiple `NULL`s under a unique
index). Also shown to the user and approved before applying, same rule as
Phase 3.

- `backend/src/products/barcode.util.ts` — generates valid EAN-13 codes
  under the `20`/`21` prefix range GS1 reserves for internal/in-store use
  (won't collide with a real manufacturer's GTIN), standard mod-10 check
  digit. 7 unit tests, including a known-correct code straight from GS1's
  own documentation (`4006381333931`).
- `GET /products/generate-barcode` — checks for a DB collision before
  returning (retries up to 20×, effectively impossible to exhaust). DTO
  validation accepts a general alphanumeric shape, **not** EAN-13-only,
  since stock bought from outside suppliers may already carry UPC-A,
  EAN-8, or another format printed on the package.
- `jsbarcode` (zero runtime deps) renders barcodes client-side as SVG —
  used in the product form's live preview and the new
  `frontend/src/app/(app)/products/barcode-labels/page.tsx` label-printing
  page (pick products + copy count, print via the browser dialog — same
  print-only-content CSS pattern as the existing receipt page).
- POS scan-to-cart: the existing product search box doubles as the scan
  target (no new field). A scanner types the code and sends Enter fast; the
  `Enter` handler does a **fresh** API call with the just-scanned text
  (not the debounced list, which can still be stale at scanner speed) and
  looks for an **exact** barcode/`internalCode` match — `contains`
  wouldn't do, a partial match could add the wrong product — adding it
  straight to the cart and clearing the box.

### Validation performed (all 5 phases)

Every phase: `npx tsc --noEmit` clean (both frontend and backend), full test
suites passing (backend grew from 43 → 50 tests across the session, 7 new
for `barcode.util.ts`; frontend steady at 16), both production builds
(`next build`, `nest build`) succeeding. Every migration was tested against
a throwaway copy of the real `dev.db` before being shown to and approved by
the user, then applied and re-verified in place. Phases 3 through 5 each
included a **live smoke test** — actually starting the real backend against
the real (already-migrated) `dev.db` and exercising it over HTTP (login,
category/unit CRUD, bilingual invoice PDF generation checked by unzipping
the resulting `.xlsx`/rendering the HTML directly and grepping for the
expected French labels, barcode generate → assign → exact-match search →
duplicate-rejection) — with every piece of test data created during these
smoke tests cleaned back out afterward and the database's row counts
re-verified unchanged before moving on.

### What's stale as of Phase 13 and needs regenerating before the next package build

- **`electron/resources/db-template.sqlite` was NOT regenerated during
  Phase 13** — it still predates the `Category`/`Unit`/`barcode` schema
  changes and the `admin@l7ssab.local` seed email change. Must run
  `npm run build:db-template` (inside `electron/`) before the next Windows
  package/build, exactly like the same standing warning in the Phase 11
  section above for the `mustChangePassword` column.
- The signing certificate (`electron/resources/dev-signing-cert.pfx`) and
  its password are unchanged by Phase 13 — same `CSC_KEY_PASSWORD`-driven
  mechanism as Phase 11 established, nothing here needed a new certificate.

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
- Don't rename the 4 identifiers Phase 13 deliberately froze (`APP_SALT` in
  `license/device-id.util.ts`, the `pharma-manager.db` filename in
  `electron/main.js`, and the two `localStorage` keys `'pharma-auth'` /
  `'pharma-manager-locale'`) — each has an in-code comment explaining the
  real cost (invalidated licenses / apparently-lost customer data / logged-out
  users) for zero user-visible benefit, since none of the four are ever seen.
- Don't package/build without first running `npm run build:db-template` in
  `electron/` if `backend/prisma/schema.prisma` or `seed.production.ts` has
  changed since the last template build — it's a gitignored build artifact
  that does NOT regenerate itself, and shipping a stale one means real
  customer installs get a database missing whatever changed (see "What's
  stale as of Phase 13" above for the exact reason this matters right now).
