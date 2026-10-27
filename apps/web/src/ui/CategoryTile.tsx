import { cx } from './cx';
import type { Category } from './categories';

// A painted category medallion in the same chip-carved wooden ring as the badges. The disc takes
// the category colour (--c from data-cat), the carved glyph sits on top in cream.
export function CategoryTile({ category, className }: { category: Category; className?: string }) {
  return (
    <span className={cx('n-tile', className)} data-cat={category}>
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
    </span>
  );
}
