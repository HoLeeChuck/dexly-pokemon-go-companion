const DEFAULT_BASE_URL = 'https://dex.cjdev.app';
const DEFAULT_TIMEOUT_MS = 15_000;
const EXPECTED_ENVIRONMENT = 'production';
const FORBIDDEN_CATALOG_KEYS = new Set([
  'profileId',
  'collectionEntries',
  'wantedEntries',
  'tradeSpecimens',
]);

function assertion(condition, message) {
  if (!condition) throw new Error(message);
}

function parseTimeout(value) {
  const timeout = Number(value ?? DEFAULT_TIMEOUT_MS);
  assertion(
    Number.isSafeInteger(timeout) && timeout >= 1_000 && timeout <= 120_000,
    'SMOKE_TIMEOUT_MS must be an integer between 1000 and 120000.',
  );
  return timeout;
}

function parseBaseUrl(value) {
  const url = new URL(value ?? DEFAULT_BASE_URL);
  assertion(['http:', 'https:'].includes(url.protocol), 'Smoke base URL must use HTTP or HTTPS.');
  assertion(!url.username && !url.password, 'Smoke base URL must not include credentials.');
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/*$/, '/');
  return url;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} did not return valid JSON.`);
  }
}

function findForbiddenCatalogKey(payload) {
  const pending = [{ path: '$', value: payload }];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || current.value === null || typeof current.value !== 'object') continue;

    for (const [key, value] of Object.entries(current.value)) {
      const path = `${current.path}.${key}`;
      if (FORBIDDEN_CATALOG_KEYS.has(key)) return path;
      pending.push({ path, value });
    }
  }

  return null;
}

const baseUrl = parseBaseUrl(process.argv[2]);
const timeoutMs = parseTimeout(process.env.SMOKE_TIMEOUT_MS);
let completedChecks = 0;

async function request(path, { method = 'GET', expectedStatus = 200, json = false } = {}) {
  const url = new URL(path.replace(/^\//, ''), baseUrl);
  const label = `${method} ${url.pathname}`;
  console.log(`[smoke] checking ${label}`);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: { Accept: json ? 'application/json' : '*/*' },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} request failed: ${detail}`, { cause: error });
  }

  let body;
  try {
    if (method === 'HEAD') {
      await response.arrayBuffer();
      body = '';
    } else {
      body = await response.text();
    }
  } finally {
    if (response.body && !response.bodyUsed) await response.body.cancel().catch(() => undefined);
  }

  console.log(`[smoke] ${label} -> ${response.status}`);
  assertion(
    response.status === expectedStatus,
    `${label} returned ${response.status}; expected ${expectedStatus}.`,
  );
  if (expectedStatus >= 200 && expectedStatus < 300) {
    assertion(response.ok, `${label} was not successful.`);
  }

  completedChecks += 1;
  return json ? parseJson(body, label) : body;
}

try {
  const health = await request('/api/health', { json: true });
  await request('/api/health', { method: 'HEAD' });

  const ready = await request('/api/ready', { json: true });
  await request('/api/ready', { method: 'HEAD' });

  const catalogVersion = await request('/api/v1/catalog/version', { json: true });
  await request('/api/v1/catalog/version', { method: 'HEAD' });

  const publicCatalog = await request('/api/v1/catalog', { json: true });
  await request('/api/v1/catalog', { method: 'HEAD' });

  await request('/manifest.webmanifest');
  await request('/robots.txt');
  await request('/api/v1/bootstrap', { expectedStatus: 401 });

  assertion(
    health && typeof health === 'object' && health.ok === true,
    'Health probe is not healthy.',
  );
  assertion(
    typeof health.gitSha === 'string' &&
      health.gitSha.trim().length > 0 &&
      !/^(unknown|development|dev|local|placeholder|unset|none|null)$/i.test(health.gitSha.trim()),
    'Health probe is missing a production Git SHA.',
  );
  assertion(
    health.environment === EXPECTED_ENVIRONMENT,
    `Health probe environment is ${String(health.environment)}; expected ${EXPECTED_ENVIRONMENT}.`,
  );

  assertion(
    ready && typeof ready === 'object' && ready.ok === true,
    'Readiness probe is not ready.',
  );
  assertion(
    typeof ready.catalogVersion === 'string' && ready.catalogVersion !== 'unknown',
    'Readiness probe is missing its catalog version.',
  );
  assertion(
    catalogVersion && typeof catalogVersion.catalogVersion === 'string',
    'Catalog version endpoint is missing its catalog version.',
  );
  assertion(
    ready.catalogVersion === catalogVersion.catalogVersion,
    'Readiness and catalog-version endpoints disagree.',
  );

  assertion(
    publicCatalog && typeof publicCatalog === 'object',
    'Public catalog payload is not an object.',
  );
  assertion(
    Array.isArray(publicCatalog.catalog),
    'Public catalog payload is missing its catalog array.',
  );
  assertion(publicCatalog.catalog.length > 0, 'Public catalog payload has an empty catalog array.');
  assertion(
    publicCatalog.catalogVersion === ready.catalogVersion,
    'Public catalog and readiness versions disagree.',
  );
  const forbiddenPath = findForbiddenCatalogKey(publicCatalog);
  assertion(!forbiddenPath, `Public catalog leaked private data at ${forbiddenPath}.`);

  console.log(
    JSON.stringify({
      ok: true,
      baseUrl: baseUrl.origin,
      checks: completedChecks,
      timeoutMs,
      environment: health.environment,
      gitSha: health.gitSha,
      workerVersionId: health.workerVersionId,
      catalogVersion: ready.catalogVersion,
      catalogEntries: publicCatalog.catalog.length,
      privateBootstrapStatus: 401,
    }),
  );
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[smoke] failed after ${completedChecks} checks: ${detail}`);
  process.exitCode = 1;
}
