import { useEffect, useState } from 'react';
import { useT } from '../i18n/I18nProvider';
import { THEMES } from '../themes/theme';
import type { Theme } from '../themes/theme';
import { Button, LanguageSwitch } from '../ui';

const STORY_ART: Record<Theme, string> = {
  gaarden: '/art/story/L-12-hayloft-feast',
  laaven: '/art/story/R-10-keeping-watch',
};

// True once the page has been scrolled a little. The heading then shrinks into a bar at the top,
// so both stories stay in reach on a phone without hiding what the page is about.
function useScrolled(threshold = 24): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [threshold]);
  return scrolled;
}

function StoryCards({ value, onChange }: { value: Theme; onChange: (story: Theme) => void }) {
  const t = useT();
  return (
    <fieldset className="n-stories">
      <legend className="sr-only">{t('onboard.story.legend')}</legend>
      {THEMES.map((story) => {
        const base = STORY_ART[story];
        return (
          <label key={story} className="n-story" data-story={story}>
            <input
              type="radio"
              name="story"
              value={story}
              checked={value === story}
              onChange={() => {
                onChange(story);
              }}
            />
            <picture>
              <source type="image/avif" srcSet={`${base}@1x.avif 1x, ${base}@2x.avif 2x`} />
              <img
                src={`${base}@1x.webp`}
                srcSet={`${base}@1x.webp 1x, ${base}@2x.webp 2x`}
                alt=""
                loading="lazy"
                decoding="async"
              />
            </picture>
            <strong className="n-story__title">{t(`story.${story}.title`)}</strong>
            <span className="n-story__pitch">{t(`story.${story}.pitch`)}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

// Choose a story: no gate painting, just the heading and the two stories (side by side from
// tablet width up). Picking one switches the theme with a fade.
export function StoryStep({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value: Theme;
  onChange: (story: Theme) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const scrolled = useScrolled();
  return (
    <main className="n-storypage">
      <header className="n-storyhead" data-compact={scrolled ? 'true' : undefined}>
        <div className="n-storyhead__top">
          <p className="n-eyebrow">{t('app.name')}</p>
          <LanguageSwitch />
        </div>
        <h1>{t('onboard.story.title')}</h1>
        <div className="n-storyhead__lead">
          <p>{t('onboard.story.lead')}</p>
        </div>
      </header>
      <StoryCards value={value} onChange={onChange} />
      <p className="n-storypage__note">{t('onboard.story.note')}</p>
      <div className="n-storypage__actions">
        <Button onClick={onNext}>{t('onboard.next')}</Button>
        <Button variant="ghost" onClick={onBack}>
          {t('onboard.back')}
        </Button>
      </div>
    </main>
  );
}
