import { errorKey, isEmail } from './errors';

describe('errorKey', () => {
  it.each([
    ['invite_invalid', 'error.invite_invalid'],
    ['domain_not_allowed', 'error.domain_not_allowed'],
    ['name_taken', 'error.name_taken'],
    ['already_member', 'error.already_member'],
    ['not_signed_in', 'error.not_signed_in'],
  ] as const)('maps %s', (message, key) => {
    expect(errorKey({ message })).toBe(key);
  });

  it('maps rate limits and falls back to a generic message', () => {
    expect(errorKey({ message: 'x', status: 429 })).toBe('error.rate_limit');
    expect(errorKey({ message: 'boom' })).toBe('error.generic');
    expect(errorKey({})).toBe('error.generic');
  });
});

describe('isEmail', () => {
  it('accepts plain addresses and rejects the rest', () => {
    expect(isEmail('nisse@firma.no')).toBe(true);
    expect(isEmail(' nisse@firma.no ')).toBe(true);
    expect(isEmail('nisse@firma')).toBe(false);
    expect(isEmail('nisse')).toBe(false);
    expect(isEmail('')).toBe(false);
  });
});
