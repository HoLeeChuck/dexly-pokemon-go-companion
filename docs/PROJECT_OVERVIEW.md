# CatchGrid project overview

CatchGrid is a local-first Pokémon GO collection companion at
[dex.cjdev.app](https://dex.cjdev.app/). It combines a visual Pokédex, form-aware
collection tracking, collection-aware Pokémon GO searches, safe import/export, and an
installable offline-capable web app.

## Product boundary

Public users do not create accounts. Their collection, saved searches, and appearance
settings are stored in a versioned browser profile. Portable JSON and CSV exports are
the supported way to move data between devices. Clearing browser site data without a
backup removes that browser's profile.

The unlisted `/cody` route is a separate owner-only D1 profile protected by a Worker
secret and rate limits. It is not a public account system, and knowing the route is not
an authentication boundary.

CatchGrid never requests Pokémon GO credentials or connects to a trainer's game
account. Collection updates are manual or import-assisted.

## Current public navigation

- **Home** — orientation, collection snapshot, and direct workflow shortcuts.
- **Dex** — category-aware species grid plus Mega/Primal and Gigantamax views.
- **Progress** — National Dex species and category-aware regional progress.
- **Search Lab** — missing, storage, trade, and Discord-ready Pokémon GO search tools.
- **Settings** — collection setup, themes, reviewed CSV import, portable backup/restore, and recovery
  snapshots.

The removed Trade page, Wanted tab, and For Trade tab are intentionally not part of the
public product. Trading boards, public profiles, Discord OAuth/bots, community accounts,
and shared multi-user storage are future work and must not be inferred from retained
legacy D1 tables.

## Collection model

National Dex progress counts one default representative per species. The catalog also
contains collector forms and transformations—regional forms, all 28 Unown forms,
gender differences, Rotom-style alternates, selected costumes, Mega/Primal forms,
Gigantamax forms, and fusions. Those records have stable application-owned form IDs and
never inflate species or regional medal totals.

Default forms can track Normal, Shiny, Lucky, Hundo, XXL, XXS, Shadow, and Purified when
their reviewed rule is released. Alternate forms track only Regular/Caught and Shiny.
Rules distinguish released, unreleased, ineligible, and unknown; the UI must not turn
an unknown assertion into a release fact.

Whole-card buttons are the collection control. Cards expose `aria-pressed`, textual
state, keyboard focus, and clear collected/missing styling. Opening a detail sheet,
using previous/next navigation, or swiping never mutates collection state.

## Data correctness

The catalog is a dated snapshot, not a live game feed. Its generated manifest records
hashes for each input and a structured, source-cited override file. A mined sprite is
evidence that an image exists, never evidence that a Pokémon, form, Shiny, or category
is released.

Important invariants include:

- unreleased National Dex species remain visible as unavailable placeholders;
- Platinum denominators use the full reviewed regional allocation, including
  unreleased species;
- forms do not add to National Dex or regional medal denominators;
- Mythical Pokémon are nontradeable and Lucky-ineligible except reviewed exceptions;
- Nickit and Thievul are Shiny-eligible after their August 16, 2026 Community Day debut;
- existing form IDs and retired collection history are preserved across updates.

See [the catalog guide](../catalog/README.md) and the generated catalog change report
for the exact snapshot, sources, hashes, and known asset-rights blocker.

## Search Lab tools

Search Lab provides personal and tradeable collection-gap strings using reviewed Pokémon GO
inventory terms. Missing-form output stays explicit when game syntax cannot identify an exact form
or depends on current game state.

An optional evolution-aware setting expands XXL/XXS missing searches with catchable earlier
family stages when evolving them could fill a later size gap. Cody's recommended strings are
kept separate from collection-gap output. Discord sharing supports the standard 2,000-character
limit and an explicit Nitro option for 4,000-character messages; every message remains safely
chunked and ends with the canonical CatchGrid link.

## Portability and recovery

The browser profile schema is versioned and migrates legacy data without erasing it.
Writes are durable-first: visible state changes only after storage succeeds. CatchGrid
preserves corrupt raw data, rotates local recovery snapshots, snapshots before imports,
and offers restore/reset workflows.

Portable JSON backups include catalog version, default and alternate-form collection
state, saved searches, settings, migration metadata, and retained legacy fields. CSV
imports use the same eligibility rules locally and in owner D1 mode. When Dex number or
name identifies multiple forms, imports require `form_id` instead of guessing.

Because browser storage is origin-specific, the legacy Workers hostname shows a data
migration notice and export action rather than silently redirecting a collection to the
canonical domain.

## Runtime architecture

Vite builds a React/TypeScript SPA and an ES-module Cloudflare Worker. Static assets are
served asset-first; `/api/*` runs through the Worker. A dedicated edge-cached catalog
path reads catalog tables only. Public collection state never reaches D1. Private owner
routes use prepared D1 statements, same-origin mutation checks, fail-closed token auth,
and rate limiting.

The PWA caches the shell and public catalog for recovery, but never caches private API
responses. A waiting service worker is applied only after an accessible user prompt.
Missing local artwork receives a neutral fallback. Named forms that intentionally use a species
representative are marked as such in catalog metadata and the UI.

See [Architecture](ARCHITECTURE.md) and [Deployment](DEPLOYMENT.md) for detailed runtime
and release boundaries.

## Launch gates and future work

The public-launch closure matrix is the source of truth for completed, open, deferred,
and externally blocked findings. Pokémon HOME artwork is now synchronized locally from
Bulbagarden Archives with per-file provenance and no runtime hotlinking. Archives' copyright
notice does not provide a blanket open redistribution license, so attribution and legal review
remain applicable.

Potential later work includes a richer CSV column-mapping wizard, an approved local
event-costume artwork with reviewed reuse terms, optional QR/share images, and separately
approved community features. None should weaken the local-first privacy boundary or
silently reinterpret existing collection records.
