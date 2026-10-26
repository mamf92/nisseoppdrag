// Players never use their own name: the generator offers a nisse name that has nothing to do
// with the e-mail address or anything else about the person.
export const NAME_PREFIXES = [
  'Grøt',
  'Lykte',
  'Fjøs',
  'Låve',
  'Høy',
  'Snø',
  'Bjelle',
  'Smør',
  'Kost',
  'Stjerne',
] as const;
export const NAME_SUFFIXES = ['nissen', 'nissa', 'tufsen'] as const;

export const NAME_MIN = 2;
export const NAME_MAX = 32;

export function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('Cannot pick from an empty list');
  return item;
}

export function generateNisseName(random: () => number = Math.random): string {
  return `${pick(NAME_PREFIXES, random)}${pick(NAME_SUFFIXES, random)}`;
}

const NUMERALS = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const;

/**
 * A nisse name that is not taken yet. Every combination of prefix and suffix is tried before
 * one gets a numeral (Grøtnissen II), so a big group still gets a name that reads like a nisse's.
 */
export function generateFreeNisseName(
  taken: ReadonlySet<string>,
  random: () => number = Math.random,
): string {
  const free = NAME_PREFIXES.flatMap((p) => NAME_SUFFIXES.map((s) => `${p}${s}`)).filter(
    (name) => !taken.has(name.toLowerCase()),
  );
  if (free.length > 0) return pick(free, random);
  const base = generateNisseName(random);
  const numeral = NUMERALS.find((n) => !taken.has(`${base} ${n}`.toLowerCase()));
  return numeral ? `${base} ${numeral}` : base;
}

// Mirrors the check constraint on members.nisse_name.
export function isValidNisseName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX && !/[<>@]/.test(trimmed);
}
