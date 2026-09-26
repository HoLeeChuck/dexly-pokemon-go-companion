export interface SearchSpecies {
  id: string;
  n: number;
  isDefault: boolean;
  rules: Record<string, string>;
}
export function missingSearch({
  items,
  universe,
  owned,
  category,
  evolution = false,
  mode = 'none',
  families,
}: {
  items: readonly SearchSpecies[];
  universe: readonly SearchSpecies[];
  owned: ReadonlySet<string>;
  category: string;
  evolution?: boolean;
  mode?: string;
  families: Record<string, readonly number[]>;
}) {
  const missing = items.filter(
    (p) => p.rules[category] === 'released' && !owned.has(`${p.id}:${category}`),
  );
  let ids = [...new Set(missing.map((p) => p.n))];
  if (evolution)
    ids = [
      ...new Set(
        missing
          .filter((p) => p.isDefault)
          .flatMap((p) => (families[String(p.n)] || []).filter((n) => n !== p.n)),
      ),
    ].filter((n) =>
      universe.some((p) => p.n === n && p.isDefault && p.rules[category] === 'released'),
    );
  if (!ids.length) return '';
  const terms = [ids.sort((a, b) => a - b).join(',')];
  if (['shiny', 'xxl', 'xxs', 'shadow', 'purified', 'lucky', 'male', 'female'].includes(category))
    terms.push(category);
  if (category === 'hundo') terms.push('4*');
  if (evolution) terms.push('evolve');
  if (mode === 'personal') terms.unshift('!#');
  if (mode === 'tradeable') terms.unshift('!traded');
  return terms.join('&');
}
