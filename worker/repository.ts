import type {
  BootstrapPayload,
  CatalogItem,
  Category,
  CategoryId,
  CollectionEntry,
  PublicCatalogPayload,
  RuleState,
  TradeOfferTrait,
  TradeRequestTrait,
  TradeSpecimen,
  WantedEntry,
} from '../shared/types';
import { CATEGORY_IDS, TRADE_OFFER_TRAIT_IDS } from '../shared/types';
import { ApiError } from './http';

interface CatalogRow {
  id: string;
  species_id: string;
  dex_number: number;
  species_name: string;
  form_name: string;
  form_key: string;
  generation: number;
  region_code: string;
  is_default: number;
  collector_kind: CatalogItem['variantKind'];
  collector_group_id: string;
  is_released: number;
  is_tradeable: number;
  regional_origin: string | null;
  costume_family: string | null;
  gender_code: string | null;
  transformation_group: string | null;
  form_sort_order: number;
  search_exact: number;
  retired_at: string | null;
  normal_path: string;
  shiny_path: string | null;
  types: string | null;
}

interface RuleRow {
  form_id: string;
  category_id: CategoryId;
  state: RuleState;
}

interface CategoryRow {
  id: CategoryId;
  display_name: string;
  short_label: string;
  search_keyword: string | null;
  sort_order: number;
  trade_semantics: 'exact' | 'candidate' | 'unsupported' | 'forbidden';
}

interface EntryRow {
  profile_id: string;
  form_id: string;
  category_id: CategoryId;
  updated_at: string;
}

interface WantedRow {
  profile_id: string;
  form_id: string;
  trait_id: TradeRequestTrait;
  updated_at: string;
}

interface TradeRow {
  id: string;
  profile_id: string;
  form_id: string;
  traits_json: string;
  quantity: number;
  notes: string;
  verified_at: string;
}

export interface MutationResult {
  formId: string;
  categoryId: CategoryId;
  collected: boolean;
  previous: boolean;
  batchId: string | null;
  revision: number;
}

export interface UndoResult {
  batchId: string;
  revision: number;
  changes: Array<{ formId: string; categoryId: CategoryId; collected: boolean }>;
}

function isCategoryId(value: string): value is CategoryId {
  return CATEGORY_IDS.includes(value as CategoryId);
}

function parseTraits(value: string): TradeOfferTrait[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TradeOfferTrait =>
        typeof item === 'string' && TRADE_OFFER_TRAIT_IDS.includes(item as TradeOfferTrait),
    );
  } catch {
    return [];
  }
}

const VERSION_QUERY = 'SELECT version FROM catalog_versions ORDER BY imported_at DESC LIMIT 1';
const PUBLIC_CATEGORY_QUERY = `SELECT id, display_name, short_label, search_keyword, sort_order, trade_semantics
  FROM collection_categories
  WHERE owner_profile_id IS NULL
  ORDER BY sort_order, display_name`;
const CATALOG_QUERY = `SELECT
    f.id,
    f.species_id,
    s.dex_number,
    s.display_name AS species_name,
    f.display_name AS form_name,
    f.form_key,
    s.generation,
    s.region_code,
    f.is_default,
    f.collector_kind,
    f.collector_group_id,
    f.is_released,
    f.is_tradeable,
    f.regional_origin,
    f.costume_family,
    f.gender_code,
    f.transformation_group,
    f.form_sort_order,
    f.search_exact,
    f.retired_at,
    a.normal_path,
    a.shiny_path,
    COALESCE(
      (SELECT group_concat(ft.type, '|') FROM pokemon_form_types ft WHERE ft.form_id = f.id),
      (SELECT group_concat(pt.type, '|') FROM pokemon_types pt WHERE pt.species_id = s.id)
    ) AS types
  FROM pokemon_forms f
  JOIN pokemon_species s ON s.id = f.species_id
  JOIN sprite_assets a ON a.id = f.sprite_asset_id
  ORDER BY s.dex_number, f.is_default DESC, f.form_sort_order, f.form_key`;
const RULE_QUERY = `SELECT form_id, category_id, state
  FROM form_category_rules
  ORDER BY form_id, category_id`;

function mapCoreCatalog(
  versionResult: D1Result<unknown>,
  categoryResult: D1Result<unknown>,
  catalogResult: D1Result<unknown>,
  ruleResult: D1Result<unknown>,
): Pick<BootstrapPayload, 'catalogVersion' | 'categories' | 'catalog'> {
  const catalogVersion =
    (versionResult.results[0] as { version?: string } | undefined)?.version ?? 'unknown';
  const categories = (categoryResult.results as unknown as CategoryRow[]).map((row): Category => ({
    id: row.id,
    label: row.display_name,
    shortLabel: row.short_label,
    sortOrder: row.sort_order,
    searchKeyword: row.search_keyword,
    tradeSearchSupported: row.trade_semantics === 'exact' || row.trade_semantics === 'candidate',
  }));

  const rulesByForm = new Map<string, Partial<Record<CategoryId, RuleState>>>();
  for (const row of ruleResult.results as unknown as RuleRow[]) {
    const rules = rulesByForm.get(row.form_id) ?? {};
    rules[row.category_id] = row.state;
    rulesByForm.set(row.form_id, rules);
  }

  const catalog = (catalogResult.results as unknown as CatalogRow[]).map((row): CatalogItem => ({
    id: row.id,
    speciesId: row.species_id,
    dexNumber: row.dex_number,
    name: row.species_name,
    formName: row.form_name === row.species_name ? undefined : row.form_name,
    formKey: row.form_key,
    generation: row.generation,
    region: row.region_code,
    types: row.types?.split('|').filter(Boolean) ?? [],
    isDefault: row.is_default === 1,
    variantKind: row.collector_kind,
    collectorGroupId: row.collector_group_id,
    isReleased: row.is_released === 1,
    isTradeable: row.is_tradeable === 1,
    formSortOrder: row.form_sort_order,
    regionalOrigin: row.regional_origin ?? undefined,
    costumeFamily: row.costume_family ?? undefined,
    genderCode: row.gender_code ?? undefined,
    transformationGroup: row.transformation_group ?? undefined,
    retiredAt: row.retired_at ?? undefined,
    searchExact: row.search_exact === 1,
    spriteUrl: row.normal_path || undefined,
    shinySpriteUrl: row.shiny_path ?? undefined,
    rules: rulesByForm.get(row.id) ?? {},
  }));

  return { catalogVersion, categories, catalog };
}

/** Public bootstrap data. This deliberately never queries profile-owned tables. */
export async function getPublicCatalog(db: D1Database): Promise<PublicCatalogPayload> {
  const [versionResult, categoryResult, catalogResult, ruleResult] = await db.batch([
    db.prepare(VERSION_QUERY),
    db.prepare(PUBLIC_CATEGORY_QUERY),
    db.prepare(CATALOG_QUERY),
    db.prepare(RULE_QUERY),
  ]);
  return mapCoreCatalog(versionResult, categoryResult, catalogResult, ruleResult);
}

export async function getBootstrap(db: D1Database, profileId: string): Promise<BootstrapPayload> {
  const [
    versionResult,
    categoryResult,
    catalogResult,
    ruleResult,
    collectionResult,
    wantedResult,
    tradeResult,
  ] = await db.batch([
    db.prepare(VERSION_QUERY),
    db
      .prepare(
        `SELECT id, display_name, short_label, search_keyword, sort_order, trade_semantics
         FROM collection_categories
         WHERE owner_profile_id IS NULL OR owner_profile_id = ?
         ORDER BY sort_order, display_name`,
      )
      .bind(profileId),
    db.prepare(CATALOG_QUERY),
    db.prepare(RULE_QUERY),
    db
      .prepare(
        `SELECT profile_id, form_id, category_id, updated_at
         FROM collection_entries
         WHERE profile_id = ?
         ORDER BY form_id, category_id`,
      )
      .bind(profileId),
    db
      .prepare(
        `SELECT profile_id, form_id, trait_id, updated_at
         FROM trade_wanted_entries
         WHERE profile_id = ?
         ORDER BY form_id, trait_id`,
      )
      .bind(profileId),
    db
      .prepare(
        `SELECT id, profile_id, form_id, traits_json, quantity, notes, verified_at
         FROM trade_specimens
         WHERE profile_id = ?
         ORDER BY created_at DESC`,
      )
      .bind(profileId),
  ]);

  const core = mapCoreCatalog(versionResult, categoryResult, catalogResult, ruleResult);

  const collectionEntries = (collectionResult.results as unknown as EntryRow[]).map(
    (row): CollectionEntry => ({
      profileId: row.profile_id,
      formId: row.form_id,
      categoryId: row.category_id,
      collected: true,
      updatedAt: row.updated_at,
    }),
  );
  const wantedEntries = (wantedResult.results as unknown as WantedRow[]).map(
    (row): WantedEntry => ({
      profileId: row.profile_id,
      formId: row.form_id,
      categoryId: row.trait_id,
      wanted: true,
      updatedAt: row.updated_at,
    }),
  );
  const tradeSpecimens = (tradeResult.results as unknown as TradeRow[]).map(
    (row): TradeSpecimen => ({
      id: row.id,
      profileId: row.profile_id,
      formId: row.form_id,
      traits: parseTraits(row.traits_json),
      quantity: row.quantity,
      notes: row.notes,
      verifiedAt: row.verified_at,
    }),
  );

  return {
    ...core,
    profileId,
    collectionEntries,
    wantedEntries,
    tradeSpecimens,
  };
}

interface RuleAndStateRow {
  state: RuleState;
  revision: number;
  collected: number;
}

interface CollectionOperationMetadata {
  formId: string;
  categoryId: CategoryId;
  collected: boolean;
  previous: boolean;
  noop: boolean;
}

function parseCollectionOperationMetadata(value: string): CollectionOperationMetadata | null {
  try {
    const parsed = JSON.parse(value) as Partial<CollectionOperationMetadata>;
    if (
      typeof parsed.formId !== 'string' ||
      typeof parsed.categoryId !== 'string' ||
      !isCategoryId(parsed.categoryId) ||
      typeof parsed.collected !== 'boolean' ||
      typeof parsed.previous !== 'boolean' ||
      typeof parsed.noop !== 'boolean'
    ) {
      return null;
    }
    return parsed as CollectionOperationMetadata;
  } catch {
    return null;
  }
}

async function replayCollectionOperation(
  db: D1Database,
  profileId: string,
  input: {
    formId: string;
    categoryId: CategoryId;
    collected: boolean;
    operationId: string;
  },
): Promise<MutationResult | null> {
  const existing = await db
    .prepare(
      `SELECT mb.id,
              mb.metadata_json,
              mb.undone_at,
              p.collection_revision AS current_revision,
              EXISTS(
                SELECT 1 FROM collection_entries ce
                WHERE ce.profile_id = p.id AND ce.form_id = ? AND ce.category_id = ?
              ) AS current_collected
       FROM mutation_batches mb
       JOIN trainer_profiles p ON p.id = mb.profile_id
       WHERE mb.profile_id = ? AND mb.client_operation_id = ? AND mb.kind = 'collection'`,
    )
    .bind(input.formId, input.categoryId, profileId, input.operationId)
    .first<{
      id: string;
      metadata_json: string;
      undone_at: string | null;
      current_revision: number;
      current_collected: number;
    }>();
  if (!existing) return null;

  const metadata = parseCollectionOperationMetadata(existing.metadata_json);
  if (
    !metadata ||
    metadata.formId !== input.formId ||
    metadata.categoryId !== input.categoryId ||
    metadata.collected !== input.collected
  ) {
    throw new ApiError(
      409,
      'OPERATION_ID_REUSED',
      'That operation ID was already used for a different collection change.',
    );
  }
  if (existing.undone_at) {
    throw new ApiError(
      409,
      'OPERATION_ALREADY_UNDONE',
      'That collection operation was already undone. Start a new change instead.',
    );
  }
  if ((existing.current_collected === 1) !== input.collected) {
    throw new ApiError(
      409,
      'OPERATION_SUPERSEDED',
      'That operation succeeded earlier, but a newer change has replaced its result.',
      { currentRevision: existing.current_revision },
    );
  }

  return {
    formId: input.formId,
    categoryId: input.categoryId,
    collected: input.collected,
    previous: metadata.previous,
    batchId: metadata.noop ? null : existing.id,
    revision: existing.current_revision,
  };
}

export async function setCollectionEntry(
  db: D1Database,
  profileId: string,
  input: {
    formId: string;
    categoryId: CategoryId;
    collected: boolean;
    operationId: string;
    expectedRevision?: number;
  },
): Promise<MutationResult> {
  const replay = await replayCollectionOperation(db, profileId, input);
  if (replay) return replay;

  const state = await db
    .prepare(
      `SELECT
         r.state,
         p.collection_revision AS revision,
         EXISTS(
           SELECT 1 FROM collection_entries ce
           WHERE ce.profile_id = p.id AND ce.form_id = r.form_id AND ce.category_id = r.category_id
         ) AS collected
       FROM form_category_rules r
       JOIN trainer_profiles p ON p.id = ?
       WHERE r.form_id = ? AND r.category_id = ?`,
    )
    .bind(profileId, input.formId, input.categoryId)
    .first<RuleAndStateRow>();

  if (!state) {
    throw new ApiError(
      404,
      'CATALOG_ENTRY_NOT_FOUND',
      'That Pokémon or category is not in this catalog.',
    );
  }
  if (state.state !== 'released') {
    throw new ApiError(
      422,
      'CATEGORY_NOT_COLLECTIBLE',
      `This entry is ${state.state} for the selected category.`,
      { ruleState: state.state },
    );
  }
  if (input.expectedRevision !== undefined && input.expectedRevision !== state.revision) {
    throw new ApiError(
      409,
      'REVISION_CONFLICT',
      'The collection changed on another request. Refresh and try again.',
      {
        expectedRevision: input.expectedRevision,
        currentRevision: state.revision,
      },
    );
  }

  const previous = state.collected === 1;
  const batchId = `mutation:${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    formId: input.formId,
    categoryId: input.categoryId,
    collected: input.collected,
    previous,
    noop: previous === input.collected,
  } satisfies CollectionOperationMetadata);
  if (previous === input.collected) {
    try {
      const recorded = await db
        .prepare(
          `INSERT INTO mutation_batches
             (id, profile_id, client_operation_id, kind, base_revision, result_revision, metadata_json)
           SELECT ?, ?, ?, 'collection', ?, ?, ?
           FROM trainer_profiles
           WHERE id = ? AND collection_revision = ?`,
        )
        .bind(
          batchId,
          profileId,
          input.operationId,
          state.revision,
          state.revision,
          metadata,
          profileId,
          state.revision,
        )
        .run();
      if ((recorded.meta.changes ?? 0) !== 1) {
        throw new Error('The collection revision changed before the no-op was recorded.');
      }
    } catch {
      const concurrentReplay = await replayCollectionOperation(db, profileId, input);
      if (concurrentReplay) return concurrentReplay;
      throw new ApiError(
        409,
        'REVISION_CONFLICT',
        'The collection changed before this operation could be recorded.',
      );
    }
    return {
      formId: input.formId,
      categoryId: input.categoryId,
      collected: input.collected,
      previous,
      batchId: null,
      revision: state.revision,
    };
  }

  const revision = state.revision + 1;
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO mutation_batches
           (id, profile_id, client_operation_id, kind, base_revision, result_revision, metadata_json)
           SELECT ?, ?, ?, 'collection', ?, ?, ?
           FROM trainer_profiles
           WHERE id = ? AND collection_revision = ?`,
      )
      .bind(
        batchId,
        profileId,
        input.operationId,
        state.revision,
        revision,
        metadata,
        profileId,
        state.revision,
      ),
    db
      .prepare(
        `INSERT INTO mutation_items
           (batch_id, form_id, category_id, before_value, after_value)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(batchId, input.formId, input.categoryId, previous ? 1 : 0, input.collected ? 1 : 0),
  ];

  if (input.collected) {
    statements.push(
      db
        .prepare(
          `INSERT INTO collection_entries (profile_id, form_id, category_id)
           VALUES (?, ?, ?)
           ON CONFLICT (profile_id, form_id, category_id)
           DO UPDATE SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .bind(profileId, input.formId, input.categoryId),
    );

    if (input.categoryId === 'xxl' || input.categoryId === 'xxs') {
      statements.push(
        db
          .prepare(
            `DELETE FROM trade_wanted_entries
             WHERE profile_id = ? AND form_id = ? AND trait_id = ?`,
          )
          .bind(profileId, input.formId, input.categoryId),
      );
    }
  } else {
    statements.push(
      db
        .prepare(
          `DELETE FROM collection_entries
           WHERE profile_id = ? AND form_id = ? AND category_id = ?`,
        )
        .bind(profileId, input.formId, input.categoryId),
    );
  }

  statements.push(
    db
      .prepare(
        `UPDATE trainer_profiles
         SET collection_revision = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND collection_revision = ?`,
      )
      .bind(revision, profileId, state.revision),
  );

  try {
    await db.batch(statements);
  } catch (error) {
    const concurrentReplay = await replayCollectionOperation(db, profileId, input);
    if (concurrentReplay) return concurrentReplay;
    console.warn('Collection mutation rejected', {
      profileId,
      operationId: input.operationId,
      error,
    });
    throw new ApiError(
      409,
      'REVISION_CONFLICT',
      'The collection changed before this update could be saved.',
    );
  }

  return {
    formId: input.formId,
    categoryId: input.categoryId,
    collected: input.collected,
    previous,
    batchId,
    revision,
  };
}

export async function undoMutation(
  db: D1Database,
  profileId: string,
  batchId: string,
): Promise<UndoResult> {
  const batch = await db
    .prepare(
      `SELECT mb.kind, mb.result_revision, mb.undone_at, p.collection_revision AS current_revision
       FROM mutation_batches mb
       JOIN trainer_profiles p ON p.id = mb.profile_id
       WHERE mb.id = ? AND mb.profile_id = ?`,
    )
    .bind(batchId, profileId)
    .first<{
      kind: string;
      result_revision: number;
      undone_at: string | null;
      current_revision: number;
    }>();

  if (!batch) throw new ApiError(404, 'MUTATION_NOT_FOUND', 'That change is no longer available.');
  if (batch.undone_at) throw new ApiError(409, 'ALREADY_UNDONE', 'That change was already undone.');
  if (!['collection', 'bulk', 'import'].includes(batch.kind)) {
    throw new ApiError(422, 'MUTATION_NOT_UNDOABLE', 'This kind of change cannot be undone here.');
  }
  if (batch.current_revision !== batch.result_revision) {
    throw new ApiError(
      409,
      'UNDO_CONFLICT',
      'A newer change exists. Refresh before restoring older state.',
    );
  }

  const itemResult = await db
    .prepare(
      `SELECT form_id, category_id, before_value, after_value
       FROM mutation_items
       WHERE batch_id = ?`,
    )
    .bind(batchId)
    .all<{
      form_id: string;
      category_id: CategoryId;
      before_value: number;
      after_value: number;
    }>();
  if (!itemResult.results.length) {
    throw new ApiError(409, 'UNDO_EMPTY', 'No restorable changes were recorded.');
  }

  const undoBatchId = `mutation:${crypto.randomUUID()}`;
  const revision = batch.current_revision + 1;
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO mutation_batches
           (id, profile_id, client_operation_id, kind, base_revision, result_revision, metadata_json)
         SELECT ?, ?, ?, 'restore', ?, ?, json_object('restores', ?)
         FROM trainer_profiles
         WHERE id = ? AND collection_revision = ?`,
      )
      .bind(
        undoBatchId,
        profileId,
        `undo:${batchId}`,
        batch.current_revision,
        revision,
        batchId,
        profileId,
        batch.current_revision,
      ),
  ];

  const changes: UndoResult['changes'] = [];
  for (const item of itemResult.results) {
    statements.push(
      db
        .prepare(
          `INSERT INTO mutation_items
             (batch_id, form_id, category_id, before_value, after_value)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(undoBatchId, item.form_id, item.category_id, item.after_value, item.before_value),
    );
    if (item.before_value === 1) {
      statements.push(
        db
          .prepare(
            `INSERT INTO collection_entries (profile_id, form_id, category_id)
             VALUES (?, ?, ?)
             ON CONFLICT (profile_id, form_id, category_id)
             DO UPDATE SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
          )
          .bind(profileId, item.form_id, item.category_id),
      );
    } else {
      statements.push(
        db
          .prepare(
            `DELETE FROM collection_entries
             WHERE profile_id = ? AND form_id = ? AND category_id = ?`,
          )
          .bind(profileId, item.form_id, item.category_id),
      );
    }
    changes.push({
      formId: item.form_id,
      categoryId: item.category_id,
      collected: item.before_value === 1,
    });
  }

  statements.push(
    db
      .prepare(
        `UPDATE mutation_batches SET undone_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
      )
      .bind(batchId),
    db
      .prepare(
        `UPDATE trainer_profiles
         SET collection_revision = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND collection_revision = ?`,
      )
      .bind(revision, profileId, batch.current_revision),
  );

  try {
    await db.batch(statements);
  } catch (error) {
    console.warn('Undo mutation rejected', { profileId, batchId, error });
    throw new ApiError(409, 'UNDO_CONFLICT', 'A newer change prevented this undo.');
  }

  return { batchId: undoBatchId, revision, changes };
}

export async function setWantedEntry(
  db: D1Database,
  profileId: string,
  formId: string,
  traitId: TradeRequestTrait,
  wanted: boolean,
): Promise<WantedEntry> {
  const form = await db
    .prepare('SELECT is_tradeable FROM pokemon_forms WHERE id = ? AND retired_at IS NULL')
    .bind(formId)
    .first<{ is_tradeable: number }>();
  if (!form) throw new ApiError(404, 'FORM_NOT_FOUND', 'That Pokémon form was not found.');
  if (wanted && form.is_tradeable !== 1)
    throw new ApiError(422, 'NOT_TRADEABLE', 'That Pokémon form cannot be traded.');

  if (wanted && traitId !== 'costume') {
    const rule = await db
      .prepare('SELECT state FROM form_category_rules WHERE form_id = ? AND category_id = ?')
      .bind(formId, traitId)
      .first<{ state: RuleState }>();
    if (rule?.state !== 'released') {
      throw new ApiError(
        422,
        'TRAIT_NOT_AVAILABLE',
        `This ${traitId} request is not currently available for that Pokémon.`,
      );
    }
  }

  if (wanted && (traitId === 'xxl' || traitId === 'xxs')) {
    const owned = await db
      .prepare(
        `SELECT 1 AS owned FROM collection_entries
         WHERE profile_id = ? AND form_id = ? AND category_id = ?`,
      )
      .bind(profileId, formId, traitId)
      .first<{ owned: number }>();
    if (owned)
      throw new ApiError(
        409,
        'SIZE_ALREADY_OWNED',
        `This ${traitId.toUpperCase()} is already in your collection.`,
      );
  }

  if (wanted) {
    await db
      .prepare(
        `INSERT INTO trade_wanted_entries (profile_id, form_id, trait_id)
         VALUES (?, ?, ?)
         ON CONFLICT (profile_id, form_id, trait_id)
         DO UPDATE SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(profileId, formId, traitId)
      .run();
  } else {
    await db
      .prepare(
        'DELETE FROM trade_wanted_entries WHERE profile_id = ? AND form_id = ? AND trait_id = ?',
      )
      .bind(profileId, formId, traitId)
      .run();
  }
  return { profileId, formId, categoryId: traitId, wanted };
}

export async function addTradeSpecimen(
  db: D1Database,
  profileId: string,
  input: { formId: string; traits: TradeOfferTrait[]; quantity: number; notes: string },
): Promise<TradeSpecimen> {
  const form = await db
    .prepare('SELECT is_tradeable FROM pokemon_forms WHERE id = ? AND retired_at IS NULL')
    .bind(input.formId)
    .first<{ is_tradeable: number }>();
  if (!form) throw new ApiError(404, 'FORM_NOT_FOUND', 'That Pokémon form was not found.');
  if (form.is_tradeable !== 1) {
    throw new ApiError(422, 'NOT_TRADEABLE', 'That Pokémon form cannot be offered for trade.');
  }

  const ruleTraits = input.traits.filter(
    (trait): trait is Exclude<TradeOfferTrait, 'costume'> => trait !== 'costume',
  );
  if (ruleTraits.length > 0) {
    const ruleResult = await db
      .prepare(
        `SELECT category_id, state
         FROM form_category_rules
         WHERE form_id = ? AND category_id IN ('shiny', 'xxl', 'xxs')`,
      )
      .bind(input.formId)
      .all<{ category_id: Exclude<TradeOfferTrait, 'costume'>; state: RuleState }>();
    const available = new Set(
      ruleResult.results
        .filter((rule) => rule.state === 'released')
        .map((rule) => rule.category_id),
    );
    const unavailable = ruleTraits.filter((trait) => !available.has(trait));
    if (unavailable.length > 0) {
      throw new ApiError(
        422,
        'TRAIT_NOT_AVAILABLE',
        `These trade traits are not currently available for that Pokémon: ${unavailable.join(', ')}.`,
      );
    }
  }

  const id = `trade:${crypto.randomUUID()}`;
  const verifiedAt = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO trade_specimens
         (id, profile_id, form_id, traits_json, quantity, notes, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      profileId,
      input.formId,
      JSON.stringify(input.traits),
      input.quantity,
      input.notes,
      verifiedAt,
    )
    .run();
  return {
    id,
    profileId,
    formId: input.formId,
    traits: input.traits,
    quantity: input.quantity,
    notes: input.notes,
    verifiedAt,
  };
}

export async function deleteTradeSpecimen(
  db: D1Database,
  profileId: string,
  tradeId: string,
): Promise<void> {
  const result = await db
    .prepare('DELETE FROM trade_specimens WHERE id = ? AND profile_id = ?')
    .bind(tradeId, profileId)
    .run();
  if ((result.meta.changes ?? 0) === 0) {
    throw new ApiError(404, 'TRADE_NOT_FOUND', 'That trade specimen was not found.');
  }
}

export async function getCollectionRevision(db: D1Database, profileId: string): Promise<number> {
  const row = await db
    .prepare('SELECT collection_revision FROM trainer_profiles WHERE id = ?')
    .bind(profileId)
    .first<{ collection_revision: number }>();
  if (!row)
    throw new ApiError(404, 'PROFILE_NOT_FOUND', 'The local trainer profile was not found.');
  return row.collection_revision;
}
