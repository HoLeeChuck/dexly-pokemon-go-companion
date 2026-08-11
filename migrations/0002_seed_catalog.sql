PRAGMA foreign_keys = ON;

-- Seed generated from catalog/catalog.v1.json (catalog 2026-08-11.1).
-- PokeMiners paths are pinned to an immutable upstream commit; application IDs
-- below are independent of those upstream filenames.

INSERT INTO catalog_versions
  (id, version, upstream_ref, source_hash, imported_at)
VALUES
  (
    'catalog-2026-08-11-1',
    '2026-08-11.1',
    'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90',
    '926ab53155d93889df672835c7bdac4a1f6deea28e88a330416c629220c0fcea',
    '2026-08-11T00:00:00.000Z'
  );

INSERT INTO sprite_assets
  (id, normal_path, shiny_path, upstream_ref, manifest_version)
VALUES
  ('sprite-form-0001-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm1.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm1.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0004-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm4.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm4.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0007-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm7.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm7.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0025-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm25.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm25.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0133-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm133.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm133.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0152-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm152.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm152.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0155-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm155.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm155.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0158-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm158.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm158.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0252-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm252.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm252.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0255-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm255.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm255.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0258-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm258.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm258.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0387-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm387.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm387.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0390-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm390.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm390.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0393-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm393.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm393.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0495-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm495.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm495.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0498-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm498.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm498.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0501-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm501.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm501.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0650-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm650.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm650.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0653-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm653.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm653.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0656-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm656.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm656.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0722-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm722.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm722.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0725-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm725.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm725.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1'),
  ('sprite-form-0728-standard', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm728.icon.png', 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm728.s.icon.png', 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90', '2026-08-11.1');

INSERT INTO pokemon_species
  (id, dex_number, slug, display_name, normalized_name, generation, region_code, catalog_version_id)
VALUES
  ('species-0001', 1, 'bulbasaur', 'Bulbasaur', 'bulbasaur', 1, 'kanto', 'catalog-2026-08-11-1'),
  ('species-0004', 4, 'charmander', 'Charmander', 'charmander', 1, 'kanto', 'catalog-2026-08-11-1'),
  ('species-0007', 7, 'squirtle', 'Squirtle', 'squirtle', 1, 'kanto', 'catalog-2026-08-11-1'),
  ('species-0025', 25, 'pikachu', 'Pikachu', 'pikachu', 1, 'kanto', 'catalog-2026-08-11-1'),
  ('species-0133', 133, 'eevee', 'Eevee', 'eevee', 1, 'kanto', 'catalog-2026-08-11-1'),
  ('species-0152', 152, 'chikorita', 'Chikorita', 'chikorita', 2, 'johto', 'catalog-2026-08-11-1'),
  ('species-0155', 155, 'cyndaquil', 'Cyndaquil', 'cyndaquil', 2, 'johto', 'catalog-2026-08-11-1'),
  ('species-0158', 158, 'totodile', 'Totodile', 'totodile', 2, 'johto', 'catalog-2026-08-11-1'),
  ('species-0252', 252, 'treecko', 'Treecko', 'treecko', 3, 'hoenn', 'catalog-2026-08-11-1'),
  ('species-0255', 255, 'torchic', 'Torchic', 'torchic', 3, 'hoenn', 'catalog-2026-08-11-1'),
  ('species-0258', 258, 'mudkip', 'Mudkip', 'mudkip', 3, 'hoenn', 'catalog-2026-08-11-1'),
  ('species-0387', 387, 'turtwig', 'Turtwig', 'turtwig', 4, 'sinnoh', 'catalog-2026-08-11-1'),
  ('species-0390', 390, 'chimchar', 'Chimchar', 'chimchar', 4, 'sinnoh', 'catalog-2026-08-11-1'),
  ('species-0393', 393, 'piplup', 'Piplup', 'piplup', 4, 'sinnoh', 'catalog-2026-08-11-1'),
  ('species-0495', 495, 'snivy', 'Snivy', 'snivy', 5, 'unova', 'catalog-2026-08-11-1'),
  ('species-0498', 498, 'tepig', 'Tepig', 'tepig', 5, 'unova', 'catalog-2026-08-11-1'),
  ('species-0501', 501, 'oshawott', 'Oshawott', 'oshawott', 5, 'unova', 'catalog-2026-08-11-1'),
  ('species-0650', 650, 'chespin', 'Chespin', 'chespin', 6, 'kalos', 'catalog-2026-08-11-1'),
  ('species-0653', 653, 'fennekin', 'Fennekin', 'fennekin', 6, 'kalos', 'catalog-2026-08-11-1'),
  ('species-0656', 656, 'froakie', 'Froakie', 'froakie', 6, 'kalos', 'catalog-2026-08-11-1'),
  ('species-0722', 722, 'rowlet', 'Rowlet', 'rowlet', 7, 'alola', 'catalog-2026-08-11-1'),
  ('species-0725', 725, 'litten', 'Litten', 'litten', 7, 'alola', 'catalog-2026-08-11-1'),
  ('species-0728', 728, 'popplio', 'Popplio', 'popplio', 7, 'alola', 'catalog-2026-08-11-1');

INSERT INTO pokemon_types (species_id, type)
VALUES
  ('species-0001', 'grass'),
  ('species-0001', 'poison'),
  ('species-0004', 'fire'),
  ('species-0007', 'water'),
  ('species-0025', 'electric'),
  ('species-0133', 'normal'),
  ('species-0152', 'grass'),
  ('species-0155', 'fire'),
  ('species-0158', 'water'),
  ('species-0252', 'grass'),
  ('species-0255', 'fire'),
  ('species-0258', 'water'),
  ('species-0387', 'grass'),
  ('species-0390', 'fire'),
  ('species-0393', 'water'),
  ('species-0495', 'grass'),
  ('species-0498', 'fire'),
  ('species-0501', 'water'),
  ('species-0650', 'grass'),
  ('species-0653', 'fire'),
  ('species-0656', 'water'),
  ('species-0722', 'grass'),
  ('species-0722', 'flying'),
  ('species-0725', 'fire'),
  ('species-0728', 'water');

INSERT INTO pokemon_forms
  (
    id,
    species_id,
    form_key,
    display_name,
    normalized_name,
    variant_kind,
    is_default,
    is_released,
    is_tradeable,
    sprite_asset_id,
    catalog_version_id
  )
VALUES
  ('form-0001-standard', 'species-0001', 'standard', 'Bulbasaur', 'bulbasaur', 'standard', 1, 1, 1, 'sprite-form-0001-standard', 'catalog-2026-08-11-1'),
  ('form-0004-standard', 'species-0004', 'standard', 'Charmander', 'charmander', 'standard', 1, 1, 1, 'sprite-form-0004-standard', 'catalog-2026-08-11-1'),
  ('form-0007-standard', 'species-0007', 'standard', 'Squirtle', 'squirtle', 'standard', 1, 1, 1, 'sprite-form-0007-standard', 'catalog-2026-08-11-1'),
  ('form-0025-standard', 'species-0025', 'standard', 'Pikachu', 'pikachu', 'standard', 1, 1, 1, 'sprite-form-0025-standard', 'catalog-2026-08-11-1'),
  ('form-0133-standard', 'species-0133', 'standard', 'Eevee', 'eevee', 'standard', 1, 1, 1, 'sprite-form-0133-standard', 'catalog-2026-08-11-1'),
  ('form-0152-standard', 'species-0152', 'standard', 'Chikorita', 'chikorita', 'standard', 1, 1, 1, 'sprite-form-0152-standard', 'catalog-2026-08-11-1'),
  ('form-0155-standard', 'species-0155', 'standard', 'Cyndaquil', 'cyndaquil', 'standard', 1, 1, 1, 'sprite-form-0155-standard', 'catalog-2026-08-11-1'),
  ('form-0158-standard', 'species-0158', 'standard', 'Totodile', 'totodile', 'standard', 1, 1, 1, 'sprite-form-0158-standard', 'catalog-2026-08-11-1'),
  ('form-0252-standard', 'species-0252', 'standard', 'Treecko', 'treecko', 'standard', 1, 1, 1, 'sprite-form-0252-standard', 'catalog-2026-08-11-1'),
  ('form-0255-standard', 'species-0255', 'standard', 'Torchic', 'torchic', 'standard', 1, 1, 1, 'sprite-form-0255-standard', 'catalog-2026-08-11-1'),
  ('form-0258-standard', 'species-0258', 'standard', 'Mudkip', 'mudkip', 'standard', 1, 1, 1, 'sprite-form-0258-standard', 'catalog-2026-08-11-1'),
  ('form-0387-standard', 'species-0387', 'standard', 'Turtwig', 'turtwig', 'standard', 1, 1, 1, 'sprite-form-0387-standard', 'catalog-2026-08-11-1'),
  ('form-0390-standard', 'species-0390', 'standard', 'Chimchar', 'chimchar', 'standard', 1, 1, 1, 'sprite-form-0390-standard', 'catalog-2026-08-11-1'),
  ('form-0393-standard', 'species-0393', 'standard', 'Piplup', 'piplup', 'standard', 1, 1, 1, 'sprite-form-0393-standard', 'catalog-2026-08-11-1'),
  ('form-0495-standard', 'species-0495', 'standard', 'Snivy', 'snivy', 'standard', 1, 1, 1, 'sprite-form-0495-standard', 'catalog-2026-08-11-1'),
  ('form-0498-standard', 'species-0498', 'standard', 'Tepig', 'tepig', 'standard', 1, 1, 1, 'sprite-form-0498-standard', 'catalog-2026-08-11-1'),
  ('form-0501-standard', 'species-0501', 'standard', 'Oshawott', 'oshawott', 'standard', 1, 1, 1, 'sprite-form-0501-standard', 'catalog-2026-08-11-1'),
  ('form-0650-standard', 'species-0650', 'standard', 'Chespin', 'chespin', 'standard', 1, 1, 1, 'sprite-form-0650-standard', 'catalog-2026-08-11-1'),
  ('form-0653-standard', 'species-0653', 'standard', 'Fennekin', 'fennekin', 'standard', 1, 1, 1, 'sprite-form-0653-standard', 'catalog-2026-08-11-1'),
  ('form-0656-standard', 'species-0656', 'standard', 'Froakie', 'froakie', 'standard', 1, 1, 1, 'sprite-form-0656-standard', 'catalog-2026-08-11-1'),
  ('form-0722-standard', 'species-0722', 'standard', 'Rowlet', 'rowlet', 'standard', 1, 1, 1, 'sprite-form-0722-standard', 'catalog-2026-08-11-1'),
  ('form-0725-standard', 'species-0725', 'standard', 'Litten', 'litten', 'standard', 1, 1, 1, 'sprite-form-0725-standard', 'catalog-2026-08-11-1'),
  ('form-0728-standard', 'species-0728', 'standard', 'Popplio', 'popplio', 'standard', 1, 1, 1, 'sprite-form-0728-standard', 'catalog-2026-08-11-1');

INSERT INTO form_aliases (form_id, normalized_alias)
VALUES
  ('form-0001-standard', 'bulbasaur'),
  ('form-0004-standard', 'charmander'),
  ('form-0007-standard', 'squirtle'),
  ('form-0025-standard', 'pikachu'),
  ('form-0133-standard', 'eevee'),
  ('form-0152-standard', 'chikorita'),
  ('form-0155-standard', 'cyndaquil'),
  ('form-0158-standard', 'totodile'),
  ('form-0252-standard', 'treecko'),
  ('form-0255-standard', 'torchic'),
  ('form-0258-standard', 'mudkip'),
  ('form-0387-standard', 'turtwig'),
  ('form-0390-standard', 'chimchar'),
  ('form-0393-standard', 'piplup'),
  ('form-0495-standard', 'snivy'),
  ('form-0498-standard', 'tepig'),
  ('form-0501-standard', 'oshawott'),
  ('form-0650-standard', 'chespin'),
  ('form-0653-standard', 'fennekin'),
  ('form-0656-standard', 'froakie'),
  ('form-0722-standard', 'rowlet'),
  ('form-0725-standard', 'litten'),
  ('form-0728-standard', 'popplio');

-- Rule derivation from catalog.v1:
--   eligibility false -> ineligible
--   eligibility null -> unknown
--   eligibility true + release false -> unreleased
--   eligibility true + explicit release true -> released
--   eligibility true + no category-specific release field -> released
-- This seed has no audited false eligibility/release claims. Shadow and Purified
-- are audited as released only for the three Kanto starters; all other nulls
-- remain unknown. No fictional demo species/forms are inserted.
INSERT INTO form_category_rules
  (form_id, category_id, state, source_note, updated_at)
SELECT
  form.id,
  category.id,
  CASE
    WHEN category.id IN ('normal', 'shiny', 'lucky', 'hundo', 'xxl', 'xxs') THEN 'released'
    WHEN form.id IN ('form-0001-standard', 'form-0004-standard', 'form-0007-standard')
      AND category.id IN ('shadow', 'purified') THEN 'released'
    ELSE 'unknown'
  END,
  CASE
    WHEN category.id IN ('normal', 'shiny')
      THEN 'catalog.v1 2026-08-11 audit: eligibility=true and category release=true.'
    WHEN category.id IN ('lucky', 'hundo', 'xxl', 'xxs')
      THEN 'catalog.v1 2026-08-11 audit: eligibility=true; no category-specific release field, so state is released.'
    WHEN form.id IN ('form-0001-standard', 'form-0004-standard', 'form-0007-standard')
      AND category.id IN ('shadow', 'purified')
      THEN 'catalog.v1 2026-08-11 audit: Kanto starter Shadow/Purified eligibility and release are confirmed.'
    ELSE 'catalog.v1 2026-08-11: eligibility and category release are unasserted (null); sprite presence is not release evidence.'
  END,
  '2026-08-11T00:00:00.000Z'
FROM pokemon_forms AS form
CROSS JOIN collection_categories AS category
WHERE form.catalog_version_id = 'catalog-2026-08-11-1'
  AND category.id IN ('normal', 'shiny', 'lucky', 'hundo', 'xxl', 'xxs', 'shadow', 'purified');
