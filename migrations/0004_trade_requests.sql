PRAGMA foreign_keys = ON;

-- Trading goals intentionally use a smaller vocabulary than collection categories.
-- Costume remains a candidate species-level request until costume forms join the catalog.
CREATE TABLE trade_wanted_entries (
  profile_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  trait_id TEXT NOT NULL CHECK (trait_id IN ('normal', 'shiny', 'xxl', 'xxs', 'costume')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (profile_id, form_id, trait_id),
  FOREIGN KEY (profile_id) REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (form_id) REFERENCES pokemon_forms(id) ON DELETE CASCADE
);

CREATE INDEX idx_trade_wanted_profile_trait
  ON trade_wanted_entries(profile_id, trait_id, form_id);

-- Preserve only historically valid trade goals. Hundo/Lucky/Shadow/Purified
-- collection goals are deliberately not copied into the trade-specific model.
-- An already-owned size is also skipped so the migration cannot create a stale
-- XXL/XXS request that the API would reject if submitted today.
INSERT OR IGNORE INTO trade_wanted_entries
  (profile_id, form_id, trait_id, created_at, updated_at)
SELECT
  wanted.profile_id,
  wanted.form_id,
  wanted.category_id,
  wanted.created_at,
  wanted.updated_at
FROM wanted_entries AS wanted
WHERE wanted.category_id IN ('normal', 'shiny', 'xxl', 'xxs')
  AND NOT (
    wanted.category_id IN ('xxl', 'xxs')
    AND EXISTS (
      SELECT 1
      FROM collection_entries AS owned
      WHERE owned.profile_id = wanted.profile_id
        AND owned.form_id = wanted.form_id
        AND owned.category_id = wanted.category_id
    )
  );
