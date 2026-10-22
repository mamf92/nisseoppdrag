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

// Låven: you play a farmhand, so the suggestion is an old Norwegian farm name.
export const FARM_FIRST_NAMES = [
  'Ola',
  'Per',
  'Kari',
  'Anne',
  'Lars',
  'Ingrid',
  'Olav',
  'Berit',
  'Knut',
  'Marit',
  'Hans',
  'Sigrid',
  'Jon',
  'Astrid',
  'Nils',
  'Solveig',
] as const;
export const FARM_SURNAMES = [
  'Haugen',
  'Bakken',
  'Nordgård',
  'Moen',
  'Lie',
  'Dahl',
  'Haugland',
  'Solberg',
  'Bråten',
  'Rud',
  'Aasen',
  'Fjeld',
  'Berg',
  'Lund',
] as const;

export function generateFarmName(random: () => number = Math.random): string {
  return `${pick(FARM_FIRST_NAMES, random)} ${pick(FARM_SURNAMES, random)}`;
}

export function generateCharacterName(
  story: 'gaarden' | 'laaven',
  random: () => number = Math.random,
): string {
  return story === 'laaven' ? generateFarmName(random) : generateNisseName(random);
}

// Mirrors the check constraint on members.nisse_name.
export function isValidNisseName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX && !/[<>@]/.test(trimmed);
}
