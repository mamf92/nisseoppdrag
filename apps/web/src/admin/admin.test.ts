import { parseCsv, readChallengeCsv } from './csv';
import {
  defaultPoints,
  emptyDraft,
  isMonday,
  isSunday,
  validateAdjustment,
  validateChallenge,
  validateSeason,
} from './validation';
import { parseStats } from './api';

describe('validateChallenge', () => {
  const ok = { ...emptyDraft(), titleNb: 'Si hei', titleEn: 'Say hi' };

  it('accepts a complete mission', () => {
    expect(validateChallenge(ok)).toEqual({});
  });

  it('mirrors the database limits', () => {
    expect(validateChallenge({ ...ok, titleNb: 'ab' }).titleNb).toBeDefined();
    expect(validateChallenge({ ...ok, titleEn: 'x'.repeat(81) }).titleEn).toBeDefined();
    expect(validateChallenge({ ...ok, bodyNb: 'x'.repeat(401) }).bodyNb).toBeDefined();
    expect(validateChallenge({ ...ok, points: 4 }).points).toBeDefined();
    expect(validateChallenge({ ...ok, points: 51 }).points).toBeDefined();
    expect(validateChallenge({ ...ok, points: 12.5 }).points).toBeDefined();
    expect(validateChallenge({ ...ok, points: 5 })).toEqual({});
    expect(validateChallenge({ ...ok, points: 50 })).toEqual({});
  });

  it('suggests ten points per level', () => {
    expect([1, 2, 3].map((n) => defaultPoints(n as 1 | 2 | 3))).toEqual([10, 20, 30]);
  });
});

describe('validateSeason', () => {
  const ok = {
    name: 'Jul 2026',
    startsOn: '2026-11-30',
    endsOn: '2026-12-27',
    hour: 6,
    status: 'draft',
  } as const;

  it('knows Mondays and Sundays', () => {
    expect(isMonday('2026-11-30')).toBe(true);
    expect(isMonday('2026-12-01')).toBe(false);
    expect(isSunday('2026-12-27')).toBe(true);
    expect(isSunday('not a date')).toBe(false);
  });

  it('accepts Monday to Sunday', () => {
    expect(validateSeason(ok)).toEqual({});
  });

  it('explains each mistake', () => {
    expect(validateSeason({ ...ok, startsOn: '2026-12-01' }).startsOn).toBe('admin.error.monday');
    expect(validateSeason({ ...ok, endsOn: '2026-12-26' }).endsOn).toBe('admin.error.sunday');
    expect(validateSeason({ ...ok, startsOn: '2026-12-28', endsOn: '2026-12-27' }).endsOn).toBe(
      'admin.error.after_start',
    );
    expect(validateSeason({ ...ok, hour: 24 }).hour).toBeDefined();
    expect(validateSeason({ ...ok, name: 'x' }).name).toBeDefined();
  });
});

describe('validateAdjustment', () => {
  it('needs a non-zero amount up to 100 and a short reason', () => {
    expect(validateAdjustment(10, 'Takk for hjelpen')).toBeNull();
    expect(validateAdjustment(-100, 'Feil')).toBeNull();
    expect(validateAdjustment(0, 'x')).not.toBeNull();
    expect(validateAdjustment(101, 'x')).not.toBeNull();
    expect(validateAdjustment(5, '  ')).not.toBeNull();
    expect(validateAdjustment(5, 'x'.repeat(121))).not.toBeNull();
    expect(validateAdjustment(Number.NaN, 'x')).not.toBeNull();
  });
});

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, embedded commas and newlines', () => {
    expect(parseCsv('a,"b, c","say ""hi""","line\nbreak"\r\nd,e,f,g\n', ',')).toEqual([
      ['a', 'b, c', 'say "hi"', 'line\nbreak'],
      ['d', 'e', 'f', 'g'],
    ]);
  });
  it('skips blank lines and a byte order mark', () => {
    expect(parseCsv('﻿a;b\n\n;\nc;d', ';')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('readChallengeCsv', () => {
  const header = 'category,title_nb,title_en,body_nb,body_en,difficulty,points';

  it('checks every row on its own', () => {
    const { rows, headerError } = readChallengeCsv(
      [
        header,
        'social,Si hei,Say hi,,,2,',
        'nonsense,Ugyldig,Invalid,,,1,10',
        'kindness,ab,Too short,,,1,10',
        'learning,Lær noe,Learn something,,,4,10',
        'holiday_fun,Pepperkaker,Gingerbread,,,3,60',
      ].join('\n'),
    );
    expect(headerError).toBe(false);
    expect(rows.map((r) => r.line)).toEqual([2, 3, 4, 5, 6]);
    expect(rows[0]?.draft).toMatchObject({ category: 'social', difficulty: 2, points: 20 });
    expect(rows.slice(1).every((r) => r.draft === null && r.errors.length > 0)).toBe(true);
  });

  it('reads semicolon files and defaults difficulty and points', () => {
    const { rows } = readChallengeCsv('category;title_nb;title_en\nsocial;Si hei;Say hi');
    expect(rows[0]?.draft).toMatchObject({ difficulty: 1, points: 10 });
  });

  it('refuses a file without the needed columns', () => {
    expect(readChallengeCsv('foo,bar\n1,2').headerError).toBe(true);
  });
});

describe('parseStats', () => {
  it('reads admin_stats and tolerates missing parts', () => {
    expect(
      parseStats({
        members: 12,
        active_this_week: 7,
        skips: 2,
        rerolls: 1,
        by_category: { social: 3, kindness: 4 },
        catalog_low: ['learning', 'bogus'],
      }),
    ).toEqual({
      members: 12,
      activeThisWeek: 7,
      skips: 2,
      rerolls: 1,
      byCategory: { social: 3, kindness: 4, learning: 0, collaboration: 0, holiday_fun: 0 },
      catalogLow: ['learning'],
    });
    expect(parseStats(null).members).toBe(0);
  });
});
