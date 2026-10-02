# Internal tools

Run tools from the CatchGrid repository root. Prefer package commands where available; they select the current paths. Tool relocation did not authorize data synchronization, artwork downloads or publication.

| Folder        | Purpose                                                          | Entry points                                                                                                         |
| ------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `catalog/`    | Reviewed catalog generation and evolution families               | `pnpm.cmd catalog:sync`, `pnpm.cmd catalog:sync:evolutions`                                                          |
| `artwork/`    | Artwork synchronization, hash refresh and resizing               | `pnpm.cmd catalog:sync:artwork`; `node scripts/artwork/sync-form-artwork.mjs --refresh-hashes`; `resize-artwork.ps1` |
| `validation/` | Offline source, artwork and immutable-generation checks          | `pnpm.cmd catalog:verify`, `pnpm.cmd validate:pokemon-data`                                                          |
| `captures/`   | Disposable local-preview screenshots and social-card rendering   | `shots.mjs`, `shots-f1.mjs`, `shots-f2.mjs`, `render-social-card.mjs`                                                |
| `release/`    | Local bundle reporting and explicitly requested production smoke | `pnpm.cmd bundle:report`; production smoke is a separate operation                                                   |
| `legacy/`     | Historical catalog generator, retained for provenance            | `sync-catalog.mjs`; not the current sync path                                                                        |

Screenshot tools use disposable fixture contexts and loopback preview URLs. Read [capture instructions](../docs/shots/README.md) before using them. Social-card rendering writes the public PNG; it was not rerun during organization.

Catalog generation refuses an existing immutable migration. Its Generated-by SQL comment intentionally retains the original pre-organization script name, ensuring historical catalog/migration/report reproducibility. Historical release evidence can also cite old paths; use the folder names above for current tool locations.

Artwork synchronization can download and write assets; evolution synchronization writes its catalog file. Release smoke contacts production. These are not passive listing commands. Use the documented validation commands for offline verification.
