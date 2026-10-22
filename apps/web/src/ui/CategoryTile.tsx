import { cx } from './cx';
import { Icon } from './Icon';
import type { Category } from './categories';

export function CategoryTile({ category, className }: { category: Category; className?: string }) {
  return (
    <span className={cx('n-tile', className)} data-cat={category}>
      <Icon name={category} />
    </span>
  );
}
