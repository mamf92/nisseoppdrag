import type { ReactNode } from 'react';
import { Button } from '../ui';
import { useT } from '../i18n/I18nProvider';
import { Sheet } from '../ui';

// A celebration (full week, new badge) as a modal sheet with a painting or medallion on top.
export function Moment({
  open,
  title,
  onClose,
  art,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  art?: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="n-moment">
        {art}
        <div className="n-moment__text">{children}</div>
        <Button onClick={onClose}>{t('moment.close')}</Button>
      </div>
    </Sheet>
  );
}

export function StoryPainting({ file, alt = '' }: { file: string; alt?: string }) {
  const base = `/art/story/${file}`;
  return (
    <picture>
      <source type="image/avif" srcSet={`${base}@1x.avif 1x, ${base}@2x.avif 2x`} />
      <img
        className="n-moment__painting"
        src={`${base}@1x.webp`}
        srcSet={`${base}@1x.webp 1x, ${base}@2x.webp 2x`}
        alt={alt}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}
