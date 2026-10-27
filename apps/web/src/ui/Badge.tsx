import { useT } from '../i18n/I18nProvider';
import { cx } from './cx';

export type BadgeState = 'unlocked' | 'locked' | 'secret';

// `file` is the medallion's base name in public/art/badges, for example "L-20-first_spoon".
export function Badge({
  file,
  name,
  state = 'unlocked',
  isNew,
  onOpen,
}: {
  file: string;
  name: string;
  state?: BadgeState;
  isNew?: boolean;
  /** Makes the medallion a button that opens it in full view; gets the medallion element. */
  onOpen?: (medal: HTMLElement) => void;
}) {
  const t = useT();
  const base = `/art/badges/${file}-256`;
  const secret = state === 'secret';
  const medal = (
    <picture className="n-badge__medal">
      <source type="image/avif" srcSet={`${base}.avif`} />
      <img src={`${base}.webp`} alt="" width={84} height={84} loading="lazy" decoding="async" />
    </picture>
  );
  return (
    <figure
      className={cx('n-badge', state !== 'unlocked' && 'n-badge--locked', isNew && 'n-badge--new')}
      style={{ margin: 0 }}
    >
      {secret ? (
        <div className="n-badge__medal n-badge__secret" aria-hidden="true">
          ?
        </div>
      ) : onOpen ? (
        <button
          type="button"
          className="n-badge__open"
          aria-label={t('badge.open', { name })}
          onClick={(event) => {
            onOpen(event.currentTarget);
          }}
        >
          {medal}
        </button>
      ) : (
        medal
      )}
      <figcaption>
        <b>{secret ? t('badge.secret') : name}</b>
        {state === 'locked' ? <span className="sr-only"> ({t('badge.locked')})</span> : null}
      </figcaption>
      {isNew ? <span className="n-badge__new">{t('badge.new')}</span> : null}
    </figure>
  );
}
