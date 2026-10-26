import {
  FARM_NAMES,
  FIRST_NAMES,
  farmerName,
  freeFarms,
  freeFirstNames,
  isFree,
  randomFarmer,
  settle,
} from './farmerName';
import { isValidNisseName } from './nisseName';

const none = new Set<string>();

describe('farmer names', () => {
  it('joins a first name and a farm name', () => {
    expect(farmerName({ first: 'Ivar', farm: 'Ruud' })).toBe('Ivar Ruud');
  });

  it('only builds names the database accepts', () => {
    for (const first of FIRST_NAMES) {
      for (const farm of FARM_NAMES)
        expect(isValidNisseName(farmerName({ first, farm }))).toBe(true);
    }
  });

  it('has no duplicates in the lists', () => {
    expect(new Set(FIRST_NAMES).size).toBe(FIRST_NAMES.length);
    expect(new Set(FARM_NAMES).size).toBe(FARM_NAMES.length);
  });

  it('draws from the lists', () => {
    for (let i = 0; i < 100; i++) {
      const choice = randomFarmer();
      expect(FIRST_NAMES).toContain(choice?.first);
      expect(FARM_NAMES).toContain(choice?.farm);
    }
  });

  it('takes taken names off the lists, case-insensitively', () => {
    const taken = new Set(['ivar ruud']);
    expect(isFree('Ivar Ruud', taken)).toBe(false);
    expect(isFree('IVAR RUUD', taken)).toBe(false);
    expect(freeFarms('Ivar', taken)).not.toContain('Ruud');
    expect(freeFarms('Ola', taken)).toContain('Ruud');
  });

  it('drops a first name from the list once all its farm names are taken', () => {
    const taken = new Set(FARM_NAMES.map((farm) => `ivar ${farm.toLowerCase()}`));
    expect(freeFirstNames(taken)).not.toContain('Ivar');
    expect(freeFirstNames(taken)).toContain('Ola');
  });

  it('never shuffles to a taken name', () => {
    const taken = new Set(
      FIRST_NAMES.flatMap((first) =>
        FARM_NAMES.map((farm) => farmerName({ first, farm }).toLowerCase()),
      ),
    );
    taken.delete('sigrid vik');
    for (let i = 0; i < 20; i++)
      expect(randomFarmer(taken)).toEqual({ first: 'Sigrid', farm: 'Vik' });
  });

  it('returns null when every name is taken', () => {
    const all = new Set(
      FIRST_NAMES.flatMap((first) =>
        FARM_NAMES.map((farm) => farmerName({ first, farm }).toLowerCase()),
      ),
    );
    expect(randomFarmer(all)).toBeNull();
  });

  it('moves a choice that was taken in the meantime to a free one', () => {
    const taken = new Set(['ivar ruud']);
    expect(settle({ first: 'Ivar', farm: 'Ruud' }, taken)).toEqual({
      first: 'Ivar',
      farm: 'Aasen',
    });
    expect(settle({ first: 'Ivar', farm: 'Vik' }, taken)).toEqual({ first: 'Ivar', farm: 'Vik' });
    expect(settle({ first: 'Ivar', farm: 'Ruud' }, none)).toEqual({ first: 'Ivar', farm: 'Ruud' });
  });
});
