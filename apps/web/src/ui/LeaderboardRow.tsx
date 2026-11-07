import { useT } from '../i18n/I18nProvider';
import { cx } from './cx';
import { NisseAvatar } from './NisseAvatar';
import type { AvatarLook } from './NisseAvatar';

export function LeaderboardRow({
  rank,
  name,
  points,
  me,
  look,
  portrait,
  seed,
}: {
  rank: number;
  name: string;
  points: number;
  me?: boolean;
  look?: AvatarLook;
  portrait?: string | null;
  seed?: string;
}) {
  const t = useT();
  return (
    <li className={cx('n-lb-row', me && 'n-lb-row--me')} aria-current={me ? 'true' : undefined}>
      <span className="n-lb-rank" aria-label={t('leaderboard.rank', { n: rank })}>
        {rank}
      </span>
      <NisseAvatar look={look} portrait={portrait} seed={seed} />
      <span>{me ? t('leaderboard.me', { name }) : name}</span>
      <span className="n-lb-points">{t('leaderboard.points', { n: points })}</span>
    </li>
  );
}
