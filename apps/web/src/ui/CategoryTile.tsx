import { useState } from 'react';
import { cx } from './cx';
import type { Category } from './categories';

// A painted category medallion (public/art/categories/<category>-128|256), in the same wooden coin
// ring as the badges. If the painting fails to load, the drawn medallion (SVG ring, category colour
// from data-cat, carved glyph) takes its place.
export function CategoryTile({ category, className }: { category: Category; className?: string }) {
  const [failed, setFailed] = useState(false);
  const base = `/art/categories/${category}`;
  return (
    <span className={cx('n-tile', className)} data-cat={category}>
      {failed ? (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <use href="#f-ring" />
          <circle cx="32" cy="32" r="22" fill="var(--c)" />
          <use href="#f-dots" />
          <use href="#f-sheen" />
          <use
            className="n-tile__glyph"
            href={`#i-${category}`}
            x="16"
            y="16"
            width="32"
            height="32"
          />
        </svg>
      ) : (
        <picture>
          <source
            type="image/avif"
            srcSet={`${base}-128.avif 128w, ${base}-256.avif 256w`}
            sizes="56px"
          />
          <img
            src={`${base}-128.webp`}
            srcSet={`${base}-128.webp 128w, ${base}-256.webp 256w`}
            sizes="56px"
            alt=""
            width={56}
            height={56}
            loading="lazy"
            decoding="async"
            onError={() => {
              setFailed(true);
            }}
          />
        </picture>
      )}
    </span>
  );
}
