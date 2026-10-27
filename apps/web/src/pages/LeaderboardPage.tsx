import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useLeaderboard } from '../game/queries';
import type { LeaderboardScope } from '../game/queries';
import { useT } from '../i18n/I18nProvider';
import { Button, LeaderboardRow } from '../ui';

const SCOPES: readonly LeaderboardScope[] = ['week', 'season'];

export function LeaderboardPage() {
  const t = useT();
  const { state } = useAuth();
  const [scope, setScope] = useState<LeaderboardScope>('season');
  const board = useLeaderboard(scope);
  const me = state.status === 'member' ? state.me.memberId : '';
  const rows = board.data ?? [];
  const podium = rows.filter((row) => row.rank <= 3 && row.points > 0).slice(0, 3);
  const mine = rows.find((row) => row.memberId === me);
  // The own row stays in view at the bottom when it is below the fold of a long list.
  const mineVisibleInList = mine !== undefined && rows.indexOf(mine) < 10;

  return (
    <main className="n-page">
      <header>
        <h1>{t('leaderboard.title')}</h1>
        <p className="n-page__lead">{t('leaderboard.lead')}</p>
      </header>

      <div className="n-segmented" role="group" aria-label={t('leaderboard.scope')}>
        {SCOPES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={scope === value}
            onClick={() => {
              setScope(value);
            }}
          >
            {t(`leaderboard.scope.${value}`)}
          </button>
        ))}
      </div>

      {board.isPending ? <p role="status">{t('app.loading')}</p> : null}
      {board.isError ? (
        <div role="alert" className="n-note">
          <p>{t('error.load')}</p>
          <Button
            variant="ghost"
            onClick={() => {
              void board.refetch();
            }}
          >
            {t('error.retry')}
          </Button>
        </div>
      ) : null}
      {board.isSuccess && rows.length === 0 ? <p>{t('leaderboard.empty')}</p> : null}
      {board.isSuccess && rows.length > 0 && podium.length === 0 ? (
        <p>{t('leaderboard.nobody')}</p>
      ) : null}

      {podium.length > 0 ? (
        <ol className="n-podium" aria-label={t('leaderboard.podium')}>
          {podium.map((row) => (
            <li key={row.memberId}>
              <b aria-label={t('leaderboard.rank', { n: row.rank })}>{row.rank}</b>
              <span>
                {row.memberId === me ? t('leaderboard.me', { name: row.name }) : row.name}
              </span>
              <small>{t('leaderboard.points', { n: row.points })}</small>
            </li>
          ))}
        </ol>
      ) : null}

      {rows.length > 0 ? (
        <ol className="n-lb-list" aria-label={t('leaderboard.title')}>
          {rows.map((row) => (
            <LeaderboardRow
              key={row.memberId}
              rank={row.rank}
              name={row.name}
              points={row.points}
              me={row.memberId === me}
            />
          ))}
        </ol>
      ) : null}

      {mine && !mineVisibleInList ? (
        <ol className="n-lb-list n-lb-sticky" aria-label={t('leaderboard.yours')}>
          <LeaderboardRow rank={mine.rank} name={mine.name} points={mine.points} me />
        </ol>
      ) : null}
    </main>
  );
}
