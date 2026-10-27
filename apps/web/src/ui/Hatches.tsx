import { useRef } from 'react';
import { useBoop } from '../fun/motion';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../themes/ThemeProvider';
import type { Theme } from '../themes/theme';
import { CATEGORIES } from './categories';
import type { Category } from './categories';
import { cx } from './cx';
import { hatchArt } from './hatchArt';
import { Icon } from './Icon';

export type HatchState = 'closed' | 'open' | 'done' | 'skipped';

function Portrait({ file }: { file: string }) {
  const base = `/art/family/${file}`;
  return (
    <picture>
      <source
        type="image/avif"
        srcSet={`${base}-128.avif 128w, ${base}-256.avif 256w`}
        sizes="(max-width: 520px) 20vw, 120px"
      />
      <img
        src={`${base}-128.webp`}
        srcSet={`${base}-128.webp 128w, ${base}-256.webp 256w`}
        sizes="(max-width: 520px) 20vw, 120px"
        alt=""
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}

function Hatch({
  category,
  index,
  state,
  theme,
}: {
  category: Category;
  index: number;
  state: HatchState;
  theme: Theme;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLLIElement>(null);
  // A tap on a hatch: the gift behind an opened one hops, a shut one rattles.
  useBoop(ref, state === 'done' ? 'n-boop' : 'n-rattle');
  const n = index + 1;
  const label = t(`hatch.${state}`, { n }) + ', ' + t(`category.${category}`);

  if (state === 'done') {
    const art = hatchArt(theme, category);
    return (
      <li
        ref={ref}
        className={cx('n-hatch', 'n-hatch--done', art.kind === 'portrait' && 'n-hatch--portrait')}
        data-cat={category}
        data-state="done"
        aria-label={label + ', ' + t(art.nameKey)}
      >
        {art.kind === 'icon' ? (
          <Icon name={art.icon} className="n-hatch__art" />
        ) : (
          <Portrait file={art.file} />
        )}
        <span className="n-hatch__lbl">{t(art.nameKey)}</span>
      </li>
    );
  }

  return (
    <li
      ref={ref}
      className={cx(
        'n-hatch',
        state === 'open' && 'n-hatch--open',
        state === 'skipped' && 'n-hatch--skipped',
      )}
      data-cat={category}
      data-state={state}
      aria-label={label}
    >
      <Icon name="tulip" className="n-hatch__corner n-hatch__corner--tl" />
      <Icon name="tulip" className="n-hatch__corner n-hatch__corner--tr" />
      <div className="n-hatch__stack">
        <span className="n-hatch__num">{n}</span>
        <Icon name="tulip" className="n-hatch__orn" />
      </div>
      <span className="n-hatch__lbl">{t(`category.${category}`)}</span>
    </li>
  );
}

// Luker: the week's five missions as calendar hatches. Slot n is always category n.
export function Hatches({
  states,
  mini,
  theme,
}: {
  states: readonly HatchState[];
  mini?: boolean;
  /** Overrides the active theme, for showing both themes side by side. */
  theme?: Theme;
}) {
  const t = useI18n().t;
  const active = useTheme().theme;
  return (
    <ul className={cx('n-hatches', mini && 'n-hatches--mini')} aria-label={t('hatch.row')}>
      {CATEGORIES.map((category, i) => (
        <Hatch
          key={category}
          category={category}
          index={i}
          state={states[i] ?? 'closed'}
          theme={theme ?? active}
        />
      ))}
    </ul>
  );
}
