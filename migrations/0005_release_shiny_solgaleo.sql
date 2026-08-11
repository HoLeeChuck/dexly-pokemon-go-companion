PRAGMA foreign_keys = ON;

-- Manual reviewed release correction. The upstream PoGoAPI snapshot used for
-- catalog 2026-08-11.2 has not yet incorporated Shiny Solgaleo.
UPDATE sprite_assets
SET shiny_path = 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets/pm791.s.icon.png',
    upstream_ref = 'PokeMiners/pogo_assets@1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90; manual reviewed Shiny Solgaleo release override 2026-08-11'
WHERE id = 'sprite-form-0791-standard';

UPDATE form_category_rules
SET state = 'released',
    source_note = 'Manual reviewed Shiny Solgaleo release override 2026-08-11; pinned PokeMiners sprite verified',
    updated_at = '2026-08-11T00:00:00.000Z'
WHERE form_id = 'form-0791-standard'
  AND category_id = 'shiny';
