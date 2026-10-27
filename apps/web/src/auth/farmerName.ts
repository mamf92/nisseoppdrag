import { pick } from './nisseName';

// Låven: you play a farmhand, and the name is chosen from lists rather than typed, so it is
// always an old rural name and never someone's real one: a first name plus a farm name. The
// first names are from the old Norwegian name lists (SSB's name statistics and the Wikipedia
// list of Norwegian given names) for people born around 1850-1920; women's and men's names share
// one list, because the story does not need a gender.
export const FIRST_NAMES = [
  'Amund',
  'Anders',
  'Anna',
  'Aslaug',
  'Astrid',
  'Berit',
  'Birgit',
  'Eilif',
  'Eli',
  'Embret',
  'Even',
  'Gjertrud',
  'Gudbrand',
  'Gudrun',
  'Gunnar',
  'Guri',
  'Halvard',
  'Halvor',
  'Hans',
  'Helga',
  'Ingeborg',
  'Ingrid',
  'Ivar',
  'Johan',
  'Johanne',
  'Jon',
  'Karen',
  'Kari',
  'Karl',
  'Knut',
  'Kristian',
  'Kristine',
  'Lars',
  'Live',
  'Margit',
  'Marit',
  'Mikkel',
  'Nils',
  'Ola',
  'Olav',
  'Olga',
  'Peder',
  'Per',
  'Ragnhild',
  'Randi',
  'Rasmus',
  'Signe',
  'Sigrid',
  'Sivert',
  'Sjur',
  'Synnøve',
  'Tora',
  'Tore',
  'Torbjørg',
  'Torstein',
] as const;

export const FARM_NAMES = [
  'Aasen',
  'Bakke',
  'Bakken',
  'Berg',
  'Bjerke',
  'Brekke',
  'Dalen',
  'Eng',
  'Fjeld',
  'Fossum',
  'Hagen',
  'Haugen',
  'Haugland',
  'Holm',
  'Kleiva',
  'Li',
  'Lia',
  'Lund',
  'Mo',
  'Moen',
  'Myra',
  'Nedrebø',
  'Nes',
  'Nordgard',
  'Ruud',
  'Rønning',
  'Sletten',
  'Skaug',
  'Skog',
  'Solberg',
  'Strand',
  'Sund',
  'Sørgard',
  'Tangen',
  'Tveit',
  'Vik',
  'Voll',
  'Øvrebø',
] as const;

export interface FarmerChoice {
  first: string;
  farm: string;
}

/** The names already in use in the group, lower-cased, as taken_names() returns them. */
export type TakenNames = ReadonlySet<string>;

export function farmerName({ first, farm }: FarmerChoice): string {
  return `${first} ${farm}`;
}

export function isFree(name: string, taken: TakenNames): boolean {
  return !taken.has(name.trim().toLowerCase());
}

/** The farm names still free for a first name. */
export function freeFarms(first: string, taken: TakenNames): string[] {
  return FARM_NAMES.filter((farm) => isFree(farmerName({ first, farm }), taken));
}

/** The first names that still have at least one farm name free. */
export function freeFirstNames(taken: TakenNames): string[] {
  return FIRST_NAMES.filter((first) => freeFarms(first, taken).length > 0);
}

/** A free name drawn at random, or null when every combination is taken. */
export function randomFarmer(
  taken: TakenNames = new Set(),
  random: () => number = Math.random,
): FarmerChoice | null {
  const firsts = freeFirstNames(taken);
  if (firsts.length === 0) return null;
  const first = pick(firsts, random);
  return { first, farm: pick(freeFarms(first, taken), random) };
}

/** Keeps the choice if it is still free; otherwise the nearest free one (same first name first). */
export function settle(choice: FarmerChoice, taken: TakenNames): FarmerChoice | null {
  if (isFree(farmerName(choice), taken)) return choice;
  const farm = freeFarms(choice.first, taken)[0];
  if (farm) return { first: choice.first, farm };
  return randomFarmer(taken);
}
