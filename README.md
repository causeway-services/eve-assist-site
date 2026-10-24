> **Data repository.** The executable code that used to live here was moved on 2026-10-24 to
> [`red-cup-engineering/eve-assist-site`](https://github.com/red-cup-engineering/eve-assist-site), which reads this data
> (point it here with `SECTION_DATA_ROOT`, default current working directory). This repository holds data only.

# eve-assist.561.group

<!-- 561-group-standards:badges:start -->
[![Causeway Services](https://img.shields.io/badge/561%20Group-Causeway%20Services-115e69)](https://github.com/causeway-services)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-115e69)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/causeway-services/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Deployable Cloudflare Worker site for `https://eve-assist.561.group`, the
public entry point of **EVE Assist**. This directory carries no application
logic — it wraps the engine package
(`@red-cup-engineering/eve-online-services-section`, developed at
`.../eve-online-services-section/`) for deployment, following the pattern
established by `sites/561.group` and `koios.news`. If you're looking for how
EVE Assist works, read that package's `ROADMAP.md`; this README only covers
*deploying it*.

## What deploys where

- `src/index.mjs` imports `createEveAssistWorker` from
  `@red-cup-engineering/eve-online-services-section/web` and exports the
  result as the Worker's default export. All routing, auth, ESI access, chat,
  and MCP logic lives in the engine package — this file must stay a
  one-line re-export.
- `public/` is **not** hand-authored here. It's overwritten before every
  deploy by `scripts/sync-public.mjs` (wired as `npm run predeploy`, which
  `npm run deploy` runs automatically via npm's lifecycle), which copies the
  engine package's own `public/` directory on top of this one. Only
  `public/404.html` and `public/.assetsignore` are owned by this site
  directly (see its `.gitignore`) — everything else in `public/` is
  regenerated, not durable source.
- `wrangler.jsonc` binds the Worker to the `eve-assist.561.group` custom
  domain, the `DB` D1 database, and the static asset directory (with
  `404-page` handling backed by `public/404.html`).

## Required secrets and vars

Secrets (set with `wrangler secret put <NAME>`, run from this directory —
never committed, never logged, never placed in `wrangler.jsonc`):

| Secret | Purpose |
| --- | --- |
| `SESSION_SECRET` | HMAC key for signing session cookies (`src/web/session.mjs` in the engine). Any high-entropy random string. |
| `SEAL_KEY` | AES-GCM key for encrypting ESI tokens and users' Gemini keys at rest (`src/crypto/seal.mjs`). Generate with that module's `generateKeyBase64()`. |
| `EVE_SSO_CLIENT_ID` | Client ID from the EVE SSO application registered at developers.eveonline.com. |
| `EVE_SSO_CLIENT_SECRET` | Secret Key from the same application. |

```sh
wrangler secret put SESSION_SECRET
wrangler secret put SEAL_KEY
wrangler secret put EVE_SSO_CLIENT_ID
wrangler secret put EVE_SSO_CLIENT_SECRET
```

Vars (plain, non-secret configuration — already set in `wrangler.jsonc`
under `vars`, listed here for reference; edit the file to change them rather
than `wrangler secret put`, since they're not sensitive):

| Var | Value | Purpose |
| --- | --- | --- |
| `PUBLIC_URL` | `https://eve-assist.561.group` | Canonical origin, used for building the SSO callback URL and any absolute links. |
| `EVE_USER_AGENT` | descriptive string with contact info | ESI etiquette requires a descriptive User-Agent identifying the app and a contact method; sent on every ESI request (`src/esi/esi-client.mjs`). |

The pinned cross-module contract in the engine's `ROADMAP.md` lists these
same four secrets plus `PUBLIC_URL`/`EVE_USER_AGENT` together as "env
bindings" without distinguishing secret vs. var. This site directory treats
`PUBLIC_URL` and `EVE_USER_AGENT` as plain `vars` (non-sensitive,
version-controlled) rather than `wrangler secret put` targets, per this
site's own build instructions — flagging this here since it's a place the
contract left room for either reading and another agent should not "fix" it
into a secret without checking with Morgan first.

See also: the downstream package's
`.../emsenn-eve-online-service/content/documents/articles/notes/2026/08/05/2026-08-05-note-on-eve-assist-first-user-setup.md`
for the human side of obtaining the SSO credentials and a Gemini API key —
this README is the authoritative reference for the deploy commands
themselves.

## D1 database: create and migrate

The engine package owns the schema migration file at
`.../eve-online-services-section/migrations/0001_init.sql`. `wrangler d1
migrations apply` requires a local `migrations/` directory relative to
where it's invoked, so this site keeps its own copy in sync rather than
pointing across the package boundary:

```sh
# One-time: create the D1 database, then paste the returned database_id into
# wrangler.jsonc's d1_databases[0].database_id (replacing the placeholder).
wrangler d1 create eve-assist

# Copy the engine's migrations into this site directory (mirrors the
# scripts/sync-public.mjs pattern for public/ — the engine is the source of
# truth, this directory is a deploy-time mirror).
mkdir -p migrations
cp ../../services/engineering-services-section/services/computer-services-section/services/web-services-section/services/web-game-services-section/services/eve-online-services-section/migrations/*.sql migrations/

# Apply against the remote (production) database.
wrangler d1 migrations apply eve-assist --remote

# Local dev database (used by `wrangler dev`):
wrangler d1 migrations apply eve-assist --local
```

Re-run the `cp` step whenever the engine adds a new migration file, before
applying.

## Headless deploy

Deploys run non-interactively using the scoped Cloudflare API tokens already
provisioned in this environment (see the engine's `ROADMAP.md`
"Decisions so far", 2026-08-05):

```sh
export CLOUDFLARE_API_TOKEN="$API_KEY_CLOUDFLARE_WORKERS_EDIT"
export CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID"   # already set in env
npm run deploy   # runs predeploy (sync-public.mjs) then `wrangler deploy`
```

`wrangler whoami` needs the OS keyring and should be avoided in headless
contexts; `wrangler deploy` with `CLOUDFLARE_API_TOKEN` set does not need it.

## Local commands

```sh
npm run check     # node --check src/index.mjs
npm run test      # no site-level tests; behavior is tested in the engine package
npm run verify    # check
npm run dev        # wrangler dev (local Worker, local D1 by default)
npm run deploy     # predeploy (sync public/) + wrangler deploy
```

There is no `pnpm`/`npm install` step documented here beyond what wrangler
itself requires — this package declares its one runtime dependency (the
engine package, resolved through the private registry per the root
`.npmrc`) and `wrangler` in `package.json`.

**Dev note — before the engine package's first publish:** `npm install` in
this directory will fail to resolve
`@red-cup-engineering/eve-online-services-section` until that package has
been published at least once to the private registry (it has not been as of
this writing — see the engine's `ROADMAP.md` status line). `src/index.mjs`
intentionally keeps the bare specifier import (`@red-cup-engineering/eve-online-services-section/web`)
rather than switching to a relative path across the package boundary — do
not "fix" this by changing it to a relative import; that would silently
re-couple this site to the engine's directory layout and defeat the point of
depending on the package by name. In the interim, `wrangler dev`/`wrangler
deploy` can resolve the same specifier via a workspace/local-path override
(e.g. an npm/pnpm workspace entry, or `npm install
../../services/engineering-services-section/services/computer-services-section/services/web-services-section/services/web-game-services-section/services/eve-online-services-section`
to link it locally) without touching this file — once the engine package is
published for real, drop the override and a plain `npm install` will work
unmodified.

## Operational notes

- This site directory has no tests of its own by design: behavioral
  guarantees (ESI client behavior, SSO flow, tool registry, chat loop,
  session cookies) are the engine package's responsibility and are tested
  there (`node --test` under `.../eve-online-services-section/test/`). This
  site only needs to prove its one file parses and wires the import
  correctly (`npm run check`).
- Secrets: never logged, never committed, never placed in `wrangler.jsonc`
  or any file under `public/`. If a secret is ever pasted somewhere by
  accident, rotate it — don't assume it's fine.
- `public/` is regenerated on every deploy; do not hand-edit files there
  expecting them to persist, except `404.html` and `.assetsignore` (see
  `.gitignore` in this directory, which tracks only those two).
