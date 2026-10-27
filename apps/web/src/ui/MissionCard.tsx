import { useId } from 'react';
import type { ReactNode } from 'react';
import { useT } from '../i18n/I18nProvider';
import { Button } from './Button';
import { CategoryTile } from './CategoryTile';
import { cx } from './cx';
import { Icon } from './Icon';
import type { Category } from './categories';

export type MissionStatus = 'open' | 'done' | 'skipped';

export interface MissionCardProps {
  category: Category;
  title: string;
  body?: string;
  points: number;
  difficulty: 1 | 2 | 3;
  status: MissionStatus;
  /** Story line under the text, for example what this mission brings home. */
  gift?: ReactNode;
  /** Plays the sack shake once; set it when a reroll has just happened. */
  shake?: boolean;
  skipDisabled?: boolean;
  rerollDisabled?: boolean;
  busy?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
  onReroll?: () => void;
  /** Takes the mission back: shown under a done or skipped stamp while the week is open. */
  onUndo?: () => void;
  /** Says why the undo is there, for example the seconds left before a completion is sent. */
  undoNote?: string;
}

export function MissionCard({
  category,
  title,
  body,
  points,
  difficulty,
  status,
  gift,
  shake,
  skipDisabled,
  rerollDisabled,
  busy,
  onComplete,
  onSkip,
  onReroll,
  onUndo,
  undoNote,
}: MissionCardProps) {
  const t = useT();
  const titleId = useId();
  return (
    <article
      className={cx(
        'n-mission',
        status === 'done' && 'n-mission--done',
        status === 'skipped' && 'n-mission--skipped',
        shake && 'n-mission--shake',
      )}
      data-cat={category}
      data-status={status}
      aria-labelledby={titleId}
    >
      <CategoryTile category={category} />
      <div>
        <p className="n-m-cat">{t(`category.${category}`)}</p>
        <h3 id={titleId}>{title}</h3>
        {body ? <p className="n-m-text">{body}</p> : null}
        {gift ? <p className="n-m-gift">{gift}</p> : null}
      </div>
      <div className="n-m-pts">
        <div className="n-bowls" role="img" aria-label={t('mission.difficulty', { n: difficulty })}>
          {[1, 2, 3].map((n) => (
            <Icon key={n} name="bowl" className={cx(n > difficulty && 'n-icon--off')} />
          ))}
        </div>
        {t('mission.points', { n: points })}
      </div>
      {status === 'open' ? (
        <div className="n-m-actions">
          <Button disabled={busy} onClick={onComplete}>
            {t('mission.complete')}
          </Button>
          <Button variant="ghost" disabled={busy || skipDisabled} onClick={onSkip}>
            <Icon name="skip" className="n-icon--sm" />
            {t('mission.skip')}
          </Button>
          <Button variant="ghost" disabled={busy || rerollDisabled} onClick={onReroll}>
            <Icon name="sack" className="n-icon--sm" />
            {t('mission.reroll')}
          </Button>
        </div>
      ) : (
        <div className="n-m-stamped">
          <p className="n-stamp">{status === 'done' ? t('mission.done') : t('mission.skipped')}</p>
          {onUndo ? (
            <p className="n-undo" role="status">
              {undoNote ? <span>{undoNote}</span> : null}
              <Button variant="ghost" onClick={onUndo}>
                {t('home.undo')}
              </Button>
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}
