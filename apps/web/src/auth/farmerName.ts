import { pick } from './nisseName';

// Låven: you play a farmhand, and the name is chosen from lists rather than typed, so it is
// always an old rural name and never someone's real one: a first name plus a farm name.
export const FEMALE_NAMES = [
  'Kari',
  'Marit',
  'Ingeborg',
  'Guri',
  'Sigrid',
  'Ragnhild',
  'Gudrun',
  'Anne',
  'Birgit',
  'Signe',
  'Astrid',
  'Randi',
  'Ingrid',
  'Gjertrud',
  'Margit',
  'Torbjørg',
  'Aslaug',
  'Live',
] as const;
export const MALE_NAMES = [
  'Ola',
  'Per',
  'Nils',
  'Lars',
  'Hans',
  'Knut',
  'Olav',
  'Anders',
  'Jon',
  'Halvor',
  'Torstein',
  'Gunnar',
  'Even',
  'Sjur',
  'Tore',
  'Amund',
  'Ivar',
  'Embret',
] as const;
export const FARM_NAMES = [
  'Haugen',
  'Bakken',
  'Lia',
  'Nordgard',
  'Sørgard',
  'Berg',
  'Moen',
  'Dalen',
  'Rud',
  'Vik',
  'Strand',
  'Brekke',
  'Holm',
  'Tveit',
  'Myra',
  'Øvrebø',
  'Nedrebø',
  'Kleiva',
] as const;

export type NameKind = 'female' | 'male';

export interface FarmerChoice {
  kind: NameKind;
  first: string;
  farm: string;
}

export function firstNames(kind: NameKind): readonly string[] {
  return kind === 'female' ? FEMALE_NAMES : MALE_NAMES;
}

export function farmerName({ first, farm }: Pick<FarmerChoice, 'first' | 'farm'>): string {
  return `${first} ${farm}`;
}

export function randomFarmer(random: () => number = Math.random): FarmerChoice {
  const kind: NameKind = random() < 0.5 ? 'female' : 'male';
  return { kind, first: pick(firstNames(kind), random), farm: pick(FARM_NAMES, random) };
}
