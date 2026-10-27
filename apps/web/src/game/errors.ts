import type { MessageKey } from '../i18n/messages';

// Stable error codes raised by the game RPCs; PostgREST puts them in `message`.
const CODES: Record<string, MessageKey> = {
  skip_used: 'game.error.skip_used',
  reroll_used: 'game.error.reroll_used',
  week_closed: 'game.error.week_closed',
  no_alternative: 'game.error.no_alternative',
  not_open: 'game.error.not_open',
  not_found: 'game.error.not_open',
  forbidden: 'game.error.forbidden',
  last_admin: 'admin.error.last_admin',
  cannot_remove_self: 'admin.error.cannot_remove_self',
  season_already_active: 'admin.error.season_already_active',
  invalid_input: 'admin.error.invalid_input',
  name_taken: 'error.name_taken',
  name_required: 'error.generic',
};

export function gameErrorKey(error: { message?: string }): MessageKey {
  return (error.message ? CODES[error.message] : undefined) ?? 'error.generic';
}

/** Errors after which the week on screen is stale and should be loaded again. */
export function shouldRefetch(error: { message?: string }): boolean {
  return ['skip_used', 'reroll_used', 'week_closed', 'not_open', 'not_found'].includes(
    error.message ?? '',
  );
}
