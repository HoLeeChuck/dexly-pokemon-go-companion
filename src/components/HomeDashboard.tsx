import { progressForCategory } from '../../shared/domain';
import type { CatalogItem, Category, CollectionEntry } from '../../shared/types';

export function HomeDashboard({
  catalog,
  categories,
  entries,
}: {
  catalog: readonly CatalogItem[];
  categories: readonly Category[];
  entries: readonly CollectionEntry[];
}) {
  const defaultCatalog = catalog.filter((item) => item.isDefault);
  const regions = [...new Set(defaultCatalog.map((item) => item.region))];
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
            const regionCatalog = defaultCatalog.filter((item) => item.region === region);
            return (
              <article className="region-progress-card" key={region}>
                <header>
                  <div>
                    <span className="eyebrow">Region</span>
                    <h3>{region.charAt(0).toUpperCase() + region.slice(1).toLowerCase()}</h3>
                  </div>
                  <strong>{regionCatalog.length}</strong>
                </header>
                <div className="region-category-grid">
                  {categories.map((category) => {
                    const progress = progressForCategory(regionCatalog, entries, category.id);
                    return (
                      <div className="region-category-progress" key={category.id}>
                        <span>
                          <strong>{category.shortLabel ?? category.label}</strong>
                          <small>{progress.percentage}%</small>
                        </span>
                        <div aria-hidden="true">
                          <i style={{ width: `${progress.percentage}%` }} />
                        </div>
                        <p>
                          {progress.collected}/{progress.total}
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
