PRAGMA foreign_keys = ON;

-- Phase B expands form metadata without rebuilding pokemon_forms or changing any
-- existing application-owned IDs. The legacy variant_kind column remains intact
-- for compatibility; collector_kind is the generalized collector-facing model.
ALTER TABLE pokemon_forms ADD COLUMN collector_kind TEXT NOT NULL DEFAULT 'standard'
  CHECK (collector_kind IN (
    'standard', 'regional', 'costume', 'gender', 'alternate',
    'mega', 'primal', 'gigantamax', 'fusion', 'other'
  ));
ALTER TABLE pokemon_forms ADD COLUMN collector_group_id TEXT NOT NULL DEFAULT '';
ALTER TABLE pokemon_forms ADD COLUMN regional_origin TEXT;
ALTER TABLE pokemon_forms ADD COLUMN costume_family TEXT;
ALTER TABLE pokemon_forms ADD COLUMN transformation_group TEXT;
ALTER TABLE pokemon_forms ADD COLUMN form_sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pokemon_forms ADD COLUMN search_exact INTEGER NOT NULL DEFAULT 1
  CHECK (search_exact IN (0, 1));

UPDATE pokemon_forms
SET collector_kind = CASE
      WHEN variant_kind = 'regional' THEN 'regional'
      WHEN variant_kind = 'costume' THEN 'costume'
      WHEN variant_kind = 'gender' THEN 'gender'
      WHEN variant_kind = 'alternate' THEN 'alternate'
      WHEN variant_kind = 'mega' THEN 'mega'
      WHEN variant_kind = 'other' THEN 'other'
      ELSE 'standard'
    END,
    collector_group_id = species_id,
    form_sort_order = CASE WHEN is_default = 1 THEN 0 ELSE 100 END,
    search_exact = CASE WHEN is_default = 1 THEN 1 ELSE 0 END
WHERE collector_group_id = '';

CREATE INDEX idx_forms_collector_kind
  ON pokemon_forms(collector_kind, is_released, form_sort_order, species_id);
CREATE INDEX idx_forms_collector_group
  ON pokemon_forms(collector_group_id, form_sort_order, id);

-- A form may have types that differ from its National Dex representative.
-- Absence means the repository falls back to the species-level type mapping.
CREATE TABLE pokemon_form_types (
  form_id TEXT NOT NULL,
  type TEXT NOT NULL,
  PRIMARY KEY (form_id, type),
  FOREIGN KEY (form_id) REFERENCES pokemon_forms(id) ON DELETE CASCADE
);

CREATE INDEX idx_form_types_form ON pokemon_form_types(form_id, type);

-- Store every input hash separately. catalog_versions.source_hash remains the
-- hash of the complete generated manifest, while this table makes the snapshot
-- reproducible and reviewable one source at a time.
CREATE TABLE catalog_source_inputs (
  catalog_version_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  source_kind TEXT NOT NULL
    CHECK (source_kind IN ('official', 'secondary', 'asset', 'manual')),
  source_url TEXT NOT NULL,
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  effective_at TEXT NOT NULL,
  reviewer_note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (catalog_version_id, source_key),
  FOREIGN KEY (catalog_version_id) REFERENCES catalog_versions(id) ON DELETE CASCADE
);

CREATE INDEX idx_catalog_source_inputs_kind
  ON catalog_source_inputs(source_kind, effective_at, source_key);
