PRAGMA foreign_keys = ON;

-- Generation 8 spans both Galar and Hisui. These species originated in
-- Pokémon Legends: Arceus and must not inherit the generation-wide Galar label.
UPDATE pokemon_species
SET region_code = 'hisui'
WHERE dex_number IN (899, 900, 901, 902, 903, 904, 905);
