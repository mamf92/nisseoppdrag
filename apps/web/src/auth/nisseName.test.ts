import {
  generateFreeNisseName,
  generateNisseName,
  isValidNisseName,
  NAME_MAX,
  NAME_PREFIXES,
  NAME_SUFFIXES,
} from './nisseName';

describe('nisse names', () => {
  it('combines a prefix and a suffix', () => {
    const pattern = new RegExp(`^(${NAME_PREFIXES.join('|')})(${NAME_SUFFIXES.join('|')})$`);
    for (let i = 0; i < 50; i++) expect(generateNisseName()).toMatch(pattern);
  });

  it('can produce every combination and each one is a valid name', () => {
    const seen = new Set<string>();
    for (const prefix of NAME_PREFIXES) {
      for (const suffix of NAME_SUFFIXES) {
        const p = NAME_PREFIXES.indexOf(prefix);
        const s = NAME_SUFFIXES.indexOf(suffix);
        const values = [(p + 0.5) / NAME_PREFIXES.length, (s + 0.5) / NAME_SUFFIXES.length];
        const name = generateNisseName(() => values.shift() ?? 0);
        expect(name).toBe(`${prefix}${suffix}`);
        expect(isValidNisseName(name)).toBe(true);
        seen.add(name);
      }
    }
    expect(seen.size).toBe(NAME_PREFIXES.length * NAME_SUFFIXES.length);
  });

  it('applies the same rules as the database constraint', () => {
    expect(isValidNisseName('Gu')).toBe(true);
    expect(isValidNisseName('G')).toBe(false);
    expect(isValidNisseName('  ')).toBe(false);
    expect(isValidNisseName('a'.repeat(NAME_MAX))).toBe(true);
    expect(isValidNisseName('a'.repeat(NAME_MAX + 1))).toBe(false);
    expect(isValidNisseName('ola@firma.no')).toBe(false);
    expect(isValidNisseName('<b>nisse')).toBe(false);
  });

  it('leaves taken names out when it suggests one', () => {
    const all = NAME_PREFIXES.flatMap((p) => NAME_SUFFIXES.map((s) => `${p}${s}`.toLowerCase()));
    const taken = new Set(all);
    taken.delete('grøtnissen');
    for (let i = 0; i < 20; i++) expect(generateFreeNisseName(taken)).toBe('Grøtnissen');
  });

  it('adds a numeral only when every combination is taken, and skips taken numerals', () => {
    const all = new Set(
      NAME_PREFIXES.flatMap((p) => NAME_SUFFIXES.map((s) => `${p}${s}`.toLowerCase())),
    );
    const name = generateFreeNisseName(all, () => 0);
    expect(name).toBe('Grøtnissen II');
    all.add('grøtnissen ii');
    expect(generateFreeNisseName(all, () => 0)).toBe('Grøtnissen III');
    expect(isValidNisseName(name)).toBe(true);
  });
});
