# license-tool

Seller-side utility for issuing device-bound licenses for Pharma Manager
Desktop. **This directory is never packaged into the application** — it is
not referenced by `electron/package.json`'s `extraResources`, `backend/`, or
`frontend/`, and its generated key files are gitignored.

## One-time setup

```bash
node generate-keypair.js
```

Creates `private-key.pem` (keep this — and only this file — completely
private; it is what lets you issue valid licenses) and `public-key.pem`.
Copy `public-key.pem` to `electron/resources/license-public-key.pem` in the
repo (that file **is** committed and shipped — it can only verify licenses,
not create them) and rebuild the app so it ships with the matching key.

Run this exactly once. Re-running it after keys already exist is refused,
because generating a new keypair invalidates every license you've already
issued against the old one.

## Issuing a license

Ask the customer for their **Device ID**, shown on the app's activation
screen, then run:

```bash
node generate-license.js --device-id XXXX-XXXX-XXXX-XXXX --days 365
# or
node generate-license.js --device-id XXXX-XXXX-XXXX-XXXX --perpetual
```

This prints a license key string — send that to the customer to paste into
the activation screen. It is cryptographically bound to that one device;
pasting it into a different machine will be rejected.

## Security note

Back up `private-key.pem` somewhere safe and offline (it cannot be
recovered if lost, and losing it means you can never issue a valid license
again without shipping a new public key to every existing customer). Never
email it, commit it, or store it anywhere the application's source tree or
build pipeline can reach.
