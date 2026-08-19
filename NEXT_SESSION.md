# NEXT_SESSION.md

**Stale notice (2026-08-17): most of this file describes the state as of the
end of the Stage 2 session and is now outdated — Stage 3, a Phase 11
pre-release hardening pass, and a Phase 12 licensing implementation have all
since happened. See "Phase 11 update (2026-08-17)" and "Phase 12 update
(2026-08-17)" near the top, and the corresponding sections in `HANDOFF.md`,
for what's actually current. The rest of this file is kept for historical
context on Stage 0–2 reasoning.**

Read this file first when resuming work on Droguerie Manager (Pharma Manager). It is
current as of the end of the Stage 2 session. For full narrative context and exact
reproduction commands, also read `HANDOFF.md` in this same directory.

## Phase 11 update (2026-08-17) — read this first

- HEAD is commit `b5a3302` ("Bump version to 1.0.0"), not `6b2a796`. Stage 3
  (icon, backup/restore, portable-exe fix, hardening, Windows code signing)
  is done, not "not started." Branch and the `v1.0.0` tag are still unpushed
  to GitHub — ask before pushing.
- **Backup/restore is implemented** (`backend/src/backup/backup.service.ts`,
  `VACUUM INTO` snapshot + restore-pending marker + relaunch), contradicting
  the "Remaining tasks (Stage 3, not started)" list below.
- **Windows code signing is implemented** (self-signed dev certificate,
  `electron/scripts/make-dev-cert.ps1` + `pack-win.js`) — was in fact required
  just to get the packaged exe to launch at all (Windows Smart App Control
  blocked the unsigned build). As of Phase 11, the signing password is no
  longer hardcoded — it must be set via the `CSC_KEY_PASSWORD` environment
  variable before running either script. Still self-signed, not a purchased
  certificate — "unknown publisher" warnings remain for other machines.
- **Portable exe no longer exists as a build target** — replaced by `zip`
  (`electron/package.json` `build.win.target: ["nsis", "zip"]`); the "did not
  launch within several minutes" issue below was the reason and is resolved.
- **Default admin password is now enforced, not just documented**: seeded
  admin has `mustChangePassword: true`; the app forces a password change via
  the existing Account page before any other screen is usable.
- Silent mutation/query/export error handling gaps found in a Phase 10 audit
  were fixed in Phase 11 — see `HANDOFF.md`'s "Phase 11 — Pre-release
  hardening" section for the full list.
- Current version across all `package.json` files is `1.0.0`, not `0.1.0`.

## Phase 12 update (2026-08-17) — read this next

Phase 11 is committed at `5869cca` ("feat: complete Phase 11 hardening and
error handling"), on top of `b5a3302`. **Phase 12 (offline 7-day trial +
device-bound licensing) is now committed at `17e7ea5`** ("feat: add offline
7-day trial and device-bound licensing"), same branch
(`feature/sqlite-migration`), still unpushed. Real acceptance testing done
after that commit found two bugs, both fixed in the working tree on top of
`17e7ea5` — see "Phase 12 post-commit fixes and acceptance testing" below.
**Those two fixes are NOT YET COMMITTED.**

What Phase 12 adds, in one paragraph: the whole application (including the
login screen itself, not just the pages behind it) is now gated by a
`LicenseGuard` — a new, single global NestJS guard checked before auth on
every request. A fresh install gets a 7-day trial with no license needed.
After that (or on a device with no valid license at all), every screen
redirects to a new `/activate` page showing that device's ID and a
license-key paste box. **Zero network calls anywhere in this feature** —
verification is fully offline, using an Ed25519 signature (Node's built-in
`crypto`, no new dependency). The seller issues a license for one specific
customer device using a new, separate `license-tool/` directory at the repo
root — this directory (and especially its `private-key.pem`, generated
locally and gitignored) **never ships inside the packaged app**; only the
matching public key (`electron/resources/license-public-key.pem`) is bundled.
See `license-tool/README.md` for the seller workflow, and `HANDOFF.md`'s
"Phase 12" section for the full architecture writeup (new `AppLicense`
Prisma model/migration, `backend/src/license/`, the frontend `LicenseGate`/
`/activate` page, new `ar.ts`/`fr.ts` keys).

**Known limitations of the offline trial's tamper resistance (by design, not
oversight — read before assuming this is bulletproof)**: the trial's
protections (a forward-only clock anchor, a redundant marker file outside
`userData`, an HMAC integrity check on the trial database row) raise the
bar against *casual* reset (deleting the database, turning the clock back)
but cannot stop a technically capable user in a fully offline product with
no server to be the source of truth — and the HMAC specifically is keyed by
the device ID, which is *intentionally shown on-screen* to the user for the
activation workflow, so it only deters accidental/casual edits, not a
deliberate one. The **license** itself does not share this weakness — Ed25519
signature verification is solid regardless of what's edited on disk, because
the private key never leaves `license-tool/`. Also found and fixed during
review: a path-resolution bug in `license-crypto.util.ts`'s dev-only public-key
fallback (fixed with a directory-walk, `findRepoRoot()`, that works for both
the `backend/src/license` and `backend/dist/src/license` layouts — see its
tests). `LicenseGate` (frontend) fails open on a persistent status-check
error; this is intentional, since `LicenseGuard` (backend) remains the real
enforcement boundary on every actual API call regardless of what the frontend
gate does.

**Validation as of this update**: backend `nest build` clean; `npm test`
41/41 passing (17 license-specific: trial init, 7-day expiry, clock-rollback
detection, valid/invalid-signature/wrong-device/expired verification,
successful activation, persistence-across-restarts, wrong-device-license-in-DB
rejection, plus 3 new regression tests for the path-resolution fix). Frontend
`tsc --noEmit` clean (only the pre-existing, unrelated `button.test.tsx`
typing error) and `jest` 16/16 passing. `prisma validate`/`migrate status`
clean, migration additive only, `dev.db` MD5 checksum unchanged throughout
(no data loss, nothing reset). No `package.json`/lockfile changed anywhere —
no new npm dependency was needed. A read-only review of the full Phase 12
diff found no exposed secrets, no unrelated business-logic changes, and no
leakage of Phase 12 content into the still-uncommitted Phase 1–9
localization files.

## Phase 12 post-commit fixes and acceptance testing (2026-08-19) — read this too

Real acceptance testing (running an actual dev backend/frontend against the
real `backend/prisma/dev.db`, not just the automated suite) found two bugs
in the Phase 12 implementation committed at `17e7ea5`. Both are fixed in the
working tree on top of that commit, **but neither fix is committed yet**:

1. **`LicenseController` was unreachable without a JWT.** It carried
   `@LicensePublic()` (exempts `LicenseGuard`) but not `@Public()` (exempts
   `JwtAuthGuard`), so `GET /license/status` and `POST /license/activate`
   both returned `401` for anyone without a token. Since `LicenseGuard` also
   blocks `/auth/login` once the trial/license is invalid, a genuinely
   locked-out device could never obtain a JWT and therefore could never
   reach either endpoint to see its Device ID or activate a purchased
   license — a permanent lockout defeating the entire purpose of the
   `/activate` page. Fixed by adding `@Public()` alongside the existing
   `@LicensePublic()` on `LicenseController`
   (`backend/src/license/license.controller.ts`), scoped to exactly those
   two endpoints (that controller has no others).
2. **Device ID format mismatch made every real license fail with
   `WRONG_DEVICE`.** `getStatus()`/`activate()` in
   `backend/src/license/license.service.ts` signed and verified against the
   raw, internal 32-hex-char `getDeviceId()` output, but the *only* Device ID
   a customer (or the seller, per `license-tool/README.md`) ever sees is the
   16-hex-char dashed display format (`formatDeviceIdForDisplay()`). A
   license generated from the displayed ID could never activate. Fixed by
   introducing a `licenseDeviceId = formatDeviceIdForDisplay(deviceId)` used
   only for the two `verifyLicenseKey()` calls and the `deviceId` field
   returned to the client — the raw ID is still used, unchanged, for
   trial-integrity (`computeIntegrityHash`/`readOrInitTrialMarker`), so the
   pre-existing `AppLicense` row's stored integrity hash was not invalidated
   by this fix.

Both fixes are minimal and backend-only — no frontend file changed for
either one.

**Real end-to-end validation performed after both fixes** (against the
actual `backend/prisma/dev.db`, real device ID `BD5A-960C-E803-AE98`):
generated a real 30-day license via `license-tool/generate-license.js`
using the exact Device ID as displayed by the running app; `POST
/license/activate` returned `LICENSED`; `GET /license/status` confirmed
`LICENSED`; the backend dev process was fully killed and restarted (not
just a `--watch` hot-reload) and `LICENSED` persisted, with the same
`AppLicense` row (`id` unchanged, just updated — not recreated). Negative
tests: a license signed for a different, made-up Device ID was rejected
with `WRONG_DEVICE`; an already-expired license (signed with the real
private key, correct device, past `expiresAt`) was rejected with `EXPIRED`.
In both cases the existing valid `LICENSED` state and the row's
`licenseKey`/`activatedAt`/`integrityHash` were confirmed unchanged — a
rejected activation never writes to the database.

**Automated validation after both fixes**: backend `npm test` 43/43 passing
(was 41/41 — 2 new unit tests in `license.service.spec.ts` proving the
displayed Device ID round-trips through activation); a new
`backend/test/license-access.e2e-spec.ts` (7/7 passing) boots the real
`AppModule` with `LicenseService` mocked, proving against the real guard
wiring that `/license/status` and `/license/activate` are reachable with no
Authorization header both while trial-active and while trial-expired, that
`/api/products` still requires a token, and that `/auth/login` and
`/api/products` both still get blocked by `LicenseGuard` when the
trial/license is expired. `npx tsc --noEmit` clean.

**The next step is staging and committing these two fixes — not starting
Phase 13.** Nothing macOS-related, no CI/push, no auto-update, no
trial/licensing redesign should happen until Phase 12 (base commit + these
fixes) is fully committed.

## Current project status

Desktop migration is in progress, approved through Stage 2, on branch
`feature/sqlite-migration` (not merged to `main`). The app has moved from a
cloud-deployment target (Vercel + Render + Supabase, never completed) to a fully
offline Electron desktop app backed by SQLite. **Nothing about the application's
features, UI, or business logic changed** — only how it's packaged and where its
database lives.

Working tree is clean; everything described below is committed at:
```
6b2a796  Stage 2: Electron desktop packaging (Windows installer verified, macOS prepared)
```
**(Stale — see "Phase 11 update" above for the real current HEAD.)**

## Completed stages

- **Stage 0** — Full read-only technical audit of the original cloud-deployed app
  (NestJS + Postgres/Supabase backend, Next.js frontend). No code changed.
- **Stage 1** — PostgreSQL → SQLite migration. Approved and completed.
- **Stage 2** — Electron desktop packaging. Approved and completed for Windows
  (verified working end-to-end); macOS prepared but not built (needs your
  go-ahead to push and trigger CI — see "Important decisions" below).

## Completed tasks (this session)

1. Prisma datasource switched from PostgreSQL to SQLite.
2. All 10 Prisma enums converted to String columns (SQLite connector doesn't
   support schema-level enums at all) backed by `backend/src/common/enums.ts`.
3. Removed Postgres-only `@db.Decimal` annotations and `mode: 'insensitive'`
   search filters (both unsupported by SQLite); verified no behavior change.
4. Fixed a real SQLite-specific bug: audit-log write inside an open sale
   transaction was using a second, non-transactional connection → `P2028`
   deadlock on SQLite (silent on Postgres). Fixed by routing it through the
   same transaction.
5. Built `electron/` — a new Electron app wrapping the existing backend+frontend
   with zero functional changes, auto-creating its database on first launch.
6. Built and **verified** a Windows NSIS installer end-to-end (login, sales, PDF
   invoices, image uploads — tested from a clean install).
7. Built a Windows portable exe (did not verify it launches reliably — see
   Known Issues).
8. Prepared macOS `.dmg` config + a GitHub Actions workflow, not yet run.
9. Committed all of the above with a detailed message.

## Remaining tasks (Stage 3, not started — explicitly on hold)

- Professional/polished application icon (current one is a functional placeholder).
- Auto-update support (needs a hosting decision — see below).
- Backup/restore feature (the long-unused `Backup` Prisma model finally gets wired up).
- Production build hardening.
- Investigate why the portable single-exe doesn't launch reliably.
- Trigger and verify the macOS `.dmg` build via GitHub Actions.
- Decide on code signing for Windows/macOS (removes the "unknown publisher" warnings).

## Known issues

| Issue | Severity | Notes |
|---|---|---|
| Portable exe (`Pharma Manager 0.1.0.exe`) did not launch within several minutes in testing | Medium | NSIS self-extracts ~370 MB (hundreds of small Puppeteer Chromium files) on *every* launch. The installer-based build does not have this problem. Don't distribute the portable variant yet. |
| `backend/package.json`'s `"start:prod": "node dist/main"` has never actually worked | Low (pre-existing, unrelated to this work) | Real compiled entry point is `dist/src/main.js` — a stray root-level file (`scratch-test-report-gen.ts`) makes TypeScript infer the whole `backend/` folder as its compile root. Electron points at the correct real path directly; this script itself was intentionally left untouched (out of scope). |
| Windows build needs a one-time manual cache workaround on machines without Developer Mode | Low, environment-specific | electron-builder's `winCodeSign` download includes two macOS `.dylib` symlinks that Windows refuses to create without elevated privileges. See `HANDOFF.md` for the exact workaround, or just enable Windows Developer Mode first. |
| Installer is large (~370 MB) | Known trade-off, not a bug | Almost entirely Puppeteer's bundled Chromium (~420 MB cache), kept as-is deliberately to avoid changing PDF-generation functionality during packaging. Swapping to Electron's native `printToPDF()` would shrink this dramatically but is a functional-layer change, intentionally deferred. |
| `db-template.sqlite`, `icon.png`/`.ico`/`.icns`, and all `dist-builds/` output are gitignored | Not a bug | They're regenerated by build scripts (see `HANDOFF.md`) and were never meant to be committed — don't be alarmed they're missing from a fresh clone. |

## Important decisions made

- **Stage 2 scope was interpreted as "wrap in Electron + working Windows +
  macOS config," not "auto-continue into Stage 3."** The user's original Stage 2
  request also asked to auto-continue into Stage 3; that was intentionally paused
  at the Stage 2 report to get sign-off on three externally-gated decisions
  (below), consistent with the session's established "test everything, wait for
  approval" pattern.
- **macOS `.dmg` cannot be built on this Windows machine** — no Xcode/hdiutil/
  codesign available. User chose: prepare a GitHub Actions workflow
  (`.github/workflows/build-mac.yml`, macOS runner) rather than skip macOS
  entirely. **The workflow has NOT been pushed or triggered** — that requires
  pushing this branch to GitHub, which needs separate confirmation.
- **Shipped database ships with one admin account, zero demo data** — chosen so
  a real customer's first launch is a clean slate, not a store already full of
  demo products. Credentials: `admin@pharma.local` / `Admin@12345` (same values
  already used by the existing dev seed — reused deliberately rather than
  inventing new ones). **Must be changed after first login** via the app's
  existing change-password screen.
- **Puppeteer was kept as-is** (not swapped for Electron's native `printToPDF()`)
  for Stage 2, per the explicit "do not modify any functionality" instruction —
  even though this is the single largest lever for installer size/reliability.
  Flagged repeatedly as the top Stage 3 candidate, not yet actioned.
- **Backend spawned as a separate child process**, not run in-process inside
  Electron's main process — avoids all asar-packaging complexity for native
  modules (Prisma engine, bcrypt) since the entire `backend/node_modules` ships
  as plain unpacked files via `extraResources`, not inside the app's asar archive.

## Files modified (this session — see `HANDOFF.md` for the full annotated list)

53 files changed in commit `6b2a796`: Prisma schema/migrations, 17 backend files
(enum import fixups), 3 search-filter fixes, 1 transaction fix, 8 frontend dynamic
routes (each split into a server shell + unchanged client component), 1 new
`electron/` app (6 tracked files + lockfile), 1 new GitHub Actions workflow, 2 new
backend files (`enums.ts`, `seed.production.ts`).

## Build status

✅ Clean. `tsc --noEmit`, `nest build`, `next build` (both normal and
`BUILD_TARGET=electron`), and `electron-builder --win nsis portable` all
succeed as of this commit.

## Test status

✅ 24/24 backend unit tests passing. 16/16 frontend unit tests passing. Full
manual API smoke test passed against the SQLite-backed backend. Full manual
functional test (login, sale, PDF, upload) passed against the actual packaged
Windows build.

## Installer status

- **Windows NSIS installer**: ✅ built, ✅ verified working end-to-end.
- **Windows portable exe**: ✅ built, ⚠️ launch not verified — see Known Issues.
- **macOS dmg**: ⚙️ config + CI workflow ready, ❌ not built (needs your go-ahead
  to push + trigger).

Build outputs live at `electron/dist-builds/` on this machine only — gitignored,
not committed, not backed up anywhere else. If you're picking this up on a
different machine, you'll need to rebuild (see `HANDOFF.md`).

## Electron status

Fully functional dev mode (`electron .`) and packaged mode (win-unpacked),
verified. Main process: `electron/main.js`. Fixed port `34115` for the backend
(baked into the static frontend build — see `HANDOFF.md` before changing it).

## SQLite status

Fully migrated, fully working, fully tested. Datasource in
`backend/prisma/schema.prisma`. Local dev database at `backend/prisma/dev.db`
(gitignored). Production template at `electron/resources/db-template.sqlite`
(gitignored, regenerate via `electron/build-db-template.js`).

## Production readiness

Functionally ready for a real customer on Windows via the NSIS installer. Not
yet "production-polished": unsigned installer (OS warnings), placeholder icon,
no auto-update, no backup/restore, portable variant unverified, macOS not built.

## Stage 3 objectives (once resumed)

Per the original request: professional installer, auto-update support,
application icon, backup/restore, production build — plus resolving the three
decision points below.

## The exact first task when we continue

**Do not start writing code first.** Re-present the three open decisions from
the Stage 2 report and get explicit direction before touching anything:

1. Push `feature/sqlite-migration` to GitHub and trigger `build-mac.yml`? (yes/no/later)
2. Is code signing (Windows + macOS certificates) in scope for this round of
   Stage 3, or deferred?
3. Where should auto-update check for new releases — GitHub Releases on this
   repo (free, repo already exists), or something else?

Only after those are answered, begin Stage 3 work, starting with whichever item
the user prioritizes — the portable-exe investigation and backup/restore are the
two Stage 3 items that need no external decision and could reasonably go first
if the user has no preference.
