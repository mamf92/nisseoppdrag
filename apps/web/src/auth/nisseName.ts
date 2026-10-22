// Players never use their own name: the generator offers a nisse name that has nothing to do
// with the e-mail address or anything else about the person.
export const NAME_PREFIXES = ['Grøt', 'Lykte', 'Fjøs', 'Låve', 'Høy', 'Snø', 'Bjelle'] as const;
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

// Mirrors the check constraint on members.nisse_name.
export function isValidNisseName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX && !/[<>@]/.test(trimmed);
}

export const CAP_COLOURS = ['#b3262a', '#2f6b3a', '#2b4a8a', '#7a3b82', '#c9801f'] as const;
export const BEARD_COLOURS = ['#f4efe4', '#c9c3b5', '#d8a45a', '#8a5a33', '#4a3a2a'] as const;
