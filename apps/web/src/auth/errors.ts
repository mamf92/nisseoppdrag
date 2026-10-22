import type { MessageKey } from '../i18n/messages';

// The database raises stable error codes (see the RPCs); PostgREST puts them in `message`.
const CODES: Record<string, MessageKey> = {
  invite_invalid: 'error.invite_invalid',
  domain_not_allowed: 'error.domain_not_allowed',
  name_taken: 'error.name_taken',
  already_member: 'error.already_member',
  not_signed_in: 'error.not_signed_in',
  invalid_input: 'error.generic',
};

export function errorKey(error: { message?: string; status?: number; code?: string }): MessageKey {
  const known = error.message ? CODES[error.message] : undefined;
  if (known) return known;
  if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
    return 'error.rate_limit';
  }
  return 'error.generic';
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}
