// The owner-approved contact destination; opening/copying a report never contacts it.
export const DISCORD_PROFILE_URL = 'https://discord.com/users/198246186371514368';

/** Catalog dates are ISO calendar dates. Compare whole UTC days, not local time zones. */
export function catalogFreshness(catalogDate, ledgerDate, now = new Date()) {
  const date = ledgerDate && ledgerDate > catalogDate ? ledgerDate : catalogDate;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return {
    date,
    stale: today - Date.parse(`${date}T00:00:00Z`) > 21 * 86400000,
  };
}

export function entryReport(pokemon, category) {
  return [
    'CatchGrid — report a wrong entry',
    `Pokémon: ${pokemon ? `#${pokemon.n} ${pokemon.speciesName}` : '[Pokémon name or Dex number]'}`,
    `Form: ${pokemon ? (pokemon.isDefault ? 'Default' : pokemon.name) : '[Default or form name]'}`,
    `Category: ${category || '[Normal, Shiny, Shadow, etc.]'}`,
    "What's wrong: [Describe the correction]",
    'Source link (optional): ',
  ].join('\n');
}

/** One editable draft for the whole review, retaining every skipped cell and reason. */
export function skippedEntryReport(skipped, categories) {
  return [
    'CatchGrid — report skipped spreadsheet cells',
    ...categories.flatMap(([id, name]) => {
      const cells = skipped.filter((cell) => cell.categoryId === id);
      return cells.length
        ? [
            '',
            `${name} (${cells.length}):`,
            ...cells.map(
              (cell) =>
                `- #${cell.n} ${cell.name} (${cell.reason === 'notTracked' ? 'form category not tracked' : 'not available'})`,
            ),
          ]
        : [];
    }),
    '',
    "What's wrong: [Describe the correction]",
    'Source link (optional): ',
  ].join('\n');
}
