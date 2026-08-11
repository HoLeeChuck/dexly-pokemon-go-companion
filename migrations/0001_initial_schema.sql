PRAGMA foreign_keys = ON;

CREATE TABLE catalog_versions (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  upstream_ref TEXT NOT NULL,
  source_hash TEXT,
  imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sprite_assets (
  id TEXT PRIMARY KEY,
  normal_path TEXT NOT NULL,
  shiny_path TEXT,
  upstream_ref TEXT NOT NULL,
  manifest_version TEXT NOT NULL,
  FOREIGN KEY (manifest_version) REFERENCES catalog_versions(version)
);

CREATE TABLE pokemon_species (
  id TEXT PRIMARY KEY,
  dex_number INTEGER NOT NULL UNIQUE CHECK (dex_number > 0),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK (generation BETWEEN 1 AND 20),
  region_code TEXT NOT NULL,
  catalog_version_id TEXT NOT NULL,
  FOREIGN KEY (catalog_version_id) REFERENCES catalog_versions(id)
);

CREATE INDEX idx_species_normalized_name ON pokemon_species(normalized_name);
CREATE INDEX idx_species_generation_region ON pokemon_species(generation, region_code, dex_number);

CREATE TABLE pokemon_types (
  species_id TEXT NOT NULL,
  type TEXT NOT NULL,
  PRIMARY KEY (species_id, type),
  FOREIGN KEY (species_id) REFERENCES pokemon_species(id) ON DELETE CASCADE
);

CREATE INDEX idx_pokemon_types_type ON pokemon_types(type, species_id);

CREATE TABLE pokemon_forms (
  id TEXT PRIMARY KEY,
  species_id TEXT NOT NULL,
  form_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  variant_kind TEXT NOT NULL DEFAULT 'standard'
    CHECK (variant_kind IN ('standard', 'regional', 'costume', 'gender', 'alternate', 'mega', 'other')),
  costume_key TEXT,
  gender_code TEXT,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  is_released INTEGER NOT NULL DEFAULT 0 CHECK (is_released IN (0, 1)),
  is_tradeable INTEGER NOT NULL DEFAULT 1 CHECK (is_tradeable IN (0, 1)),
  sprite_asset_id TEXT NOT NULL,
  catalog_version_id TEXT NOT NULL,
  retired_at TEXT,
  UNIQUE (species_id, form_key),
  FOREIGN KEY (species_id) REFERENCES pokemon_species(id) ON DELETE CASCADE,
  FOREIGN KEY (sprite_asset_id) REFERENCES sprite_assets(id),
  FOREIGN KEY (catalog_version_id) REFERENCES catalog_versions(id)
);

CREATE INDEX idx_forms_species ON pokemon_forms(species_id, is_default DESC, form_key);

CREATE TABLE form_aliases (
  form_id TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  PRIMARY KEY (form_id, normalized_alias),
  FOREIGN KEY (form_id) REFERENCES pokemon_forms(id) ON DELETE CASCADE
);

CREATE INDEX idx_form_aliases_alias ON form_aliases(normalized_alias, form_id);

CREATE TABLE collection_categories (
  id TEXT PRIMARY KEY,
  owner_profile_id TEXT,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  short_label TEXT NOT NULL,
  search_keyword TEXT,
  sort_order INTEGER NOT NULL,
  trade_semantics TEXT NOT NULL DEFAULT 'candidate'
    CHECK (trade_semantics IN ('exact', 'candidate', 'unsupported', 'forbidden')),
  UNIQUE (owner_profile_id, slug)
);

CREATE TABLE form_category_rules (
  form_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('released', 'unreleased', 'ineligible', 'unknown')),
  source_note TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (form_id, category_id),
  FOREIGN KEY (form_id) REFERENCES pokemon_forms(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES collection_categories(id) ON DELETE CASCADE
);

CREATE INDEX idx_rules_category_state ON form_category_rules(category_id, state, form_id);

CREATE TABLE app_users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE trainer_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  collection_revision INTEGER NOT NULL DEFAULT 0 CHECK (collection_revision >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES app_users(id)
);

CREATE TABLE collection_entries (
  profile_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (profile_id, form_id, category_id),
  FOREIGN KEY (profile_id) REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (form_id, category_id) REFERENCES form_category_rules(form_id, category_id)
);

CREATE INDEX idx_collection_profile_category ON collection_entries(profile_id, category_id, form_id);

CREATE TABLE wanted_entries (
  profile_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (profile_id, form_id, category_id),
  FOREIGN KEY (profile_id) REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (form_id, category_id) REFERENCES form_category_rules(form_id, category_id)
);

CREATE INDEX idx_wanted_profile_category ON wanted_entries(profile_id, category_id, form_id);

CREATE TABLE trade_specimens (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  traits_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(traits_json)),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 999),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 1000),
  verified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (profile_id) REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (form_id) REFERENCES pokemon_forms(id)
);

CREATE INDEX idx_trade_specimens_profile_form ON trade_specimens(profile_id, form_id);

CREATE TABLE mutation_batches (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  client_operation_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('collection', 'wanted', 'trade', 'bulk', 'import', 'restore')),
  base_revision INTEGER NOT NULL,
  result_revision INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  undone_at TEXT,
  UNIQUE (profile_id, client_operation_id),
  FOREIGN KEY (profile_id) REFERENCES trainer_profiles(id) ON DELETE CASCADE
);

CREATE TABLE mutation_items (
  batch_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  before_value INTEGER NOT NULL CHECK (before_value IN (0, 1)),
  after_value INTEGER NOT NULL CHECK (after_value IN (0, 1)),
  PRIMARY KEY (batch_id, form_id, category_id),
  FOREIGN KEY (batch_id) REFERENCES mutation_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (form_id, category_id) REFERENCES form_category_rules(form_id, category_id)
);

CREATE TABLE backup_snapshots (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  catalog_version TEXT NOT NULL,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (profile_id) REFERENCES trainer_profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_backups_profile_created ON backup_snapshots(profile_id, created_at DESC);

CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('previewed', 'applied', 'rejected', 'rolled_back')),
  source_name TEXT NOT NULL CHECK (length(source_name) <= 255),
  source_hash TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('wide', 'long')),
  policy TEXT NOT NULL CHECK (policy IN ('merge', 'update', 'replace')),
  base_revision INTEGER NOT NULL,
  catalog_version TEXT NOT NULL,
  summary_json TEXT NOT NULL CHECK (json_valid(summary_json)),
  preview_json TEXT NOT NULL CHECK (json_valid(preview_json)),
  backup_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  applied_at TEXT,
  FOREIGN KEY (profile_id) REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (backup_id) REFERENCES backup_snapshots(id)
);

CREATE INDEX idx_import_jobs_profile_created ON import_jobs(profile_id, created_at DESC);

CREATE TABLE saved_searches (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  search_string TEXT NOT NULL CHECK (length(search_string) BETWEEN 1 AND 5000),
  explanation TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (profile_id) REFERENCES trainer_profiles(id) ON DELETE CASCADE
);

INSERT INTO app_users (id) VALUES ('user:local-development');
INSERT INTO trainer_profiles (id, user_id, display_name)
VALUES ('profile:local-development', 'user:local-development', 'Local Trainer');

INSERT INTO collection_categories
  (id, owner_profile_id, slug, display_name, short_label, search_keyword, sort_order, trade_semantics)
VALUES
  ('normal', NULL, 'normal', 'Normal', 'Normal', NULL, 10, 'exact'),
  ('shiny', NULL, 'shiny', 'Shiny', 'Shiny', 'shiny', 20, 'candidate'),
  ('lucky', NULL, 'lucky', 'Lucky', 'Lucky', 'lucky', 30, 'unsupported'),
  ('hundo', NULL, 'hundo', 'Hundo', 'Hundo', '4*', 40, 'unsupported'),
  ('xxl', NULL, 'xxl', 'XXL', 'XXL', 'xxl', 50, 'exact'),
  ('xxs', NULL, 'xxs', 'XXS', 'XXS', 'xxs', 60, 'exact'),
  ('shadow', NULL, 'shadow', 'Shadow', 'Shadow', 'shadow', 70, 'forbidden'),
  ('purified', NULL, 'purified', 'Purified', 'Purified', 'purified', 80, 'candidate');
