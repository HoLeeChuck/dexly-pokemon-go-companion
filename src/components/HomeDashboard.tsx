import { useMemo } from 'react';
import { progressForCategory } from '../../shared/domain';
import type { CatalogItem, Category, CollectionEntry } from '../../shared/types';
import { createCatalogIndex } from '../catalog/catalogIndex';
import { defaultRegionCatalog, regionMedalProgress } from '../catalog/regionMedals';

export function HomeDashboard({
  catalog,
  categories,
  entries,
}: {
  catalog: readonly CatalogItem[];
  categories: readonly Category[];
  entries: readonly CollectionEntry[];
}) {
  const catalogIndex = useMemo(() => createCatalogIndex(catalog), [catalog]);
  const defaultCatalog = catalogIndex.defaultForms;
  const regions = catalogIndex.regions;
  const normalProgress = progressForCategory(defaultCatalog, entries, 'normal');
  const unavailable =
    normalProgress.unreleased + normalProgress.ineligible + normalProgress.unknown;
  const completePercentage =
    defaultCatalog.length === 0
      ? 0
      : Math.round((normalProgress.collected / defaultCatalog.length) * 100);
  const overview = [
    { label: 'All Pok\u00e9mon', value: defaultCatalog.length, detail: 'Complete Dex' },
    {
      label: 'Collected',
      value: normalProgress.collected,
      detail: `${completePercentage}% complete`,
    },
    { label: 'Missing', value: normalProgress.missing, detail: 'Available now' },
    { label: 'Unavailable', value: unavailable, detail: 'Not currently obtainable' },
  ];
  const collectedKeys = new Set(
    entries
      .filter((entry) => entry.collected)
      .map((entry) => `${entry.formId}:${entry.categoryId}`),
  );

  return (
    <section className="page page--dashboard">
      <header className="dashboard-hero">
        <div>
          <span className="eyebrow eyebrow--light">Complete collection overview</span>
          <h1>Your Dex at a glance.</h1>
          <p>Review every regional collection, then turn the gaps into Pokémon GO searches.</p>
        </div>
        <div className="dashboard-overview" aria-label="All Pokemon collection overview">
          {overview.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      </header>

      <section className="regional-progress" aria-labelledby="regional-progress-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Regional collections</span>
            <h2 id="regional-progress-title">Progress across every category</h2>
          </div>
          <p>Totals use each region's complete Dex, including Pokémon not released yet.</p>
        </div>
        <div className="region-progress-grid">
          {regions.map((region) => {
            const regionCatalog = defaultRegionCatalog(catalogIndex, region);
            return (
              <article className="region-progress-card" key={region}>
                <header>
                  <div>
                    <span className="eyebrow">Region</span>
                    <h3>{region.charAt(0).toUpperCase() + region.slice(1).toLowerCase()}</h3>
                  </div>
                  <strong>
                    {regionMedalProgress(catalogIndex, entries, region, 'normal').total}
                  </strong>
                </header>
                <div className="region-category-grid">
                  {categories.map((category) => {
                    const progress = progressForCategory(regionCatalog, entries, category.id);
                    const collected = regionCatalog.filter((item) =>
                      collectedKeys.has(`${item.id}:${category.id}`),
                    ).length;
                    const medal = regionMedalProgress(catalogIndex, entries, region, category.id);
                    const fullDexTotal = medal.total;
                    const percentage =
                      fullDexTotal === 0 ? 0 : Math.round((collected / fullDexTotal) * 100);
                    const tier = medal.tier;
                    return (
                      <div className="region-category-progress" key={category.id}>
                        <span>
                          <strong>{category.shortLabel ?? category.label}</strong>
                          <small>
                            {tier.charAt(0).toUpperCase() + tier.slice(1)} · {percentage}%
                          </small>
                        </span>
                        <progress
                          aria-label={`${category.label} progress in ${region}`}
                          value={collected}
                          max={fullDexTotal || 1}
                        />
                        <p>
                          {collected}/{fullDexTotal}
                          {progress.total < fullDexTotal && ` · ${progress.total} available`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
