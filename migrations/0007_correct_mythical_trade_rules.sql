PRAGMA foreign_keys = ON;

-- Mythical Pokémon cannot be traded in Pokémon GO and therefore cannot become
-- Lucky. Meltan and Melmetal are the documented gameplay exceptions. Cosmog
-- and its evolutions are Legendary, not Mythical, so they remain eligible.
-- Source: Pokémon GO Help Center, "Trading Pokémon" (reviewed 2026-08-12),
-- plus its Nintendo Switch article explicitly confirming Meltan can be traded.
INSERT INTO catalog_versions (
  id,
  version,
  upstream_ref,
  source_hash,
  imported_at
) VALUES (
  'catalog-2026-08-12-1',
  '2026-08-12.1',
  'PoGoAPI pokemon_rarity; Pokémon GO Help Center trade eligibility audit 2026-08-12',
  'bc71d7a5b15b509729cf7f21c4eaf33f2197756a5753ee05076a512fef06cf49',
  '2026-08-12T00:00:00.000Z'
);

UPDATE pokemon_forms
SET is_tradeable = 0
WHERE species_id IN (
  SELECT id
  FROM pokemon_species
  WHERE dex_number IN (
    151, 251, 385, 386, 489, 490, 491, 492, 493, 494, 647, 648,
    649, 719, 720, 721, 801, 802, 807, 893, 1025
  )
);

UPDATE form_category_rules
SET
  state = 'ineligible',
  source_note = 'Mythical Pokémon cannot be traded and cannot become Lucky; Pokémon GO Help Center audit 2026-08-12.',
  updated_at = '2026-08-12T00:00:00.000Z'
WHERE category_id = 'lucky'
  AND form_id IN (
    SELECT form.id
    FROM pokemon_forms AS form
    JOIN pokemon_species AS species ON species.id = form.species_id
    WHERE species.dex_number IN (
      151, 251, 385, 386, 489, 490, 491, 492, 493, 494, 647, 648,
      649, 719, 720, 721, 801, 802, 807, 893, 1025
    )
  );

-- Keep the two tradeable Mythical exceptions explicit even if an older catalog
-- snapshot previously classified every Mythical species as non-tradeable.
UPDATE pokemon_forms
SET is_tradeable = 1
WHERE species_id IN (
  SELECT id FROM pokemon_species WHERE dex_number IN (808, 809)
);

UPDATE form_category_rules
SET
  state = 'released',
  source_note = 'Meltan and Melmetal are tradeable Mythical exceptions; Pokémon GO Help Center audit 2026-08-12.',
  updated_at = '2026-08-12T00:00:00.000Z'
WHERE category_id = 'lucky'
  AND form_id IN (
    SELECT form.id
    FROM pokemon_forms AS form
    JOIN pokemon_species AS species ON species.id = form.species_id
    WHERE species.dex_number IN (808, 809)
  );
