# CatchGrid folder guide

CatchGrid is the website project. Keep its canonical repository and build paths stable.

| Purpose                                         | Location                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| Public collection website                       | `app/`, `index.html`, `public/`                                  |
| Private owner website                           | `cody/`, `src/`                                                  |
| Shared storage, import and search contracts     | `shared/` and shared helpers in `src/`                           |
| Website backend and immutable database history  | `worker/`, `migrations/`, `wrangler.jsonc`                       |
| Catalog, provenance and reviewed release data   | `catalog/`                                                       |
| Reviewed catalog generation                     | `scripts/catalog/`                                               |
| Artwork utilities                               | `scripts/artwork/`                                               |
| Offline validation                              | `scripts/validation/`                                            |
| Local-preview capture utilities                 | `scripts/captures/`                                              |
| Bundle and release smoke utilities              | `scripts/release/`                                               |
| Historical catalog generator                    | `scripts/legacy/`; reference only                                |
| Automated verification                          | `tests/`                                                         |
| Current continuity and selected assignment      | `HANDOFF.md`, `CODEX-PLAN.md`                                    |
| Release records and screenshots                 | `docs/releases/`, `docs/shots/`                                  |
| Full prior handoff and documentation navigation | `docs/history/`, `docs/README.md`                                |
| Official-source research evidence               | `evidence/L1-2026-09-30/`                                        |
| Private local configuration/database            | `.dev.vars`, `.wrangler/`; preserve                              |
| Retired code holding area                       | `archive/legacy-code-2026-09-25/`; historical, not active source |
| Previous generated test reports                 | `archive/test-runs/2026-09-30/`                                  |

The public and private sites share code. Keep `src/` and the shared helpers in the active repository. Root package commands select the relocated tools; run them from this directory. Generated SQL provenance comments and historical release reports retain their original tool names so immutable artifacts remain reproducible.

Current entry points: [handoff](HANDOFF.md), [documentation](docs/README.md), [internal tools](scripts/README.md), [organization record](docs/organization/2026-09-30.md). Archive contents and moved tools were hash-verified before any path repairs. The canonical checkout, website source, assets, catalog, local data and evidence remain in place.
