import {
  FARM_NAMES,
  FEMALE_NAMES,
  MALE_NAMES,
  farmerName,
  firstNames,
  randomFarmer,
} from './farmerName';
import { isValidNisseName } from './nisseName';

describe('farmer names', () => {
  it('joins a first name and a farm name', () => {
    expect(farmerName({ first: 'Kari', farm: 'Haugen' })).toBe('Kari Haugen');
  });

  it('offers the right list for each kind', () => {
    expect(firstNames('female')).toBe(FEMALE_NAMES);
    expect(firstNames('male')).toBe(MALE_NAMES);
  });

  it('draws a first name from the list of the kind it draws', () => {
    for (let i = 0; i < 100; i++) {
      const choice = randomFarmer();
      expect(firstNames(choice.kind)).toContain(choice.first);
      expect(FARM_NAMES).toContain(choice.farm);
    }
  });

  it('can draw both kinds', () => {
    expect(randomFarmer(() => 0).kind).toBe('female');
    expect(randomFarmer(() => 0.99).kind).toBe('male');
  });

  it('only builds names the database accepts', () => {
    for (const first of [...FEMALE_NAMES, ...MALE_NAMES]) {
      for (const farm of FARM_NAMES)
        expect(isValidNisseName(farmerName({ first, farm }))).toBe(true);
    }
  });
});
