# CatchGrid — Claude Code context

Read these before doing anything:

@AGENTS.md
@HANDOFF.md

## Quick orientation

- Public site: plain ES modules in `app/` (entry `index.html` → `app/main.js`). No framework.
- Private `/cody` route: React app in `src/` (entry `cody/index.html`). `src/lib` and `shared/` also hold the storage, backup, CSV and search code the public app reuses.
- Worker and D1: `worker/`, `migrations/` (immutable), `wrangler.jsonc`.
- Data: `catalog/` (catalog, medals, evolution families, legacy move windows).
- Tests: `tests/unit` (Vitest), `tests/worker` (Vitest + Workers pool), `tests/e2e` (Playwright).
- `_legacy-backup/` is a git-ignored holding folder of removed files. Never read it as current source.

## Windows shell notes

- This machine blocks PowerShell scripts by default, which breaks `pnpm.ps1` and `npx.ps1`. Prefer `pnpm.cmd` / `npx.cmd`, or ask the user to run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.
- If `pnpm` is missing, `corepack enable pnpm` (may need an Administrator shell) or `npm install -g pnpm`.
- Dev server: `pnpm exec vite --host 127.0.0.1 --port 5191 --strictPort` (or `npx.cmd vite …`). Browser storage is per origin, so `127.0.0.1:5191` has its own collection, separate from dex.cjdev.app.

## Working rules

- Work on branch `prism-forward` until the user approves merging.
- Ask before committing, pushing, running production migrations, or deploying.
- Update `HANDOFF.md` with real results after each piece of work.
