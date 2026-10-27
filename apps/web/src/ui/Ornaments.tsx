import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

// Rosemaling and chip carving (karveskurd) used as decoration. The painted ornaments take their
// colours from the theme (--rose-flower, --rose-leaf, --rose-line, --rose-dot).

// Rosemaling scroll between sections: C-scrolls, leaves and a tulip in the middle.
export function RosemalingDivider({ className }: { className?: string }) {
  return (
    <svg
      className={cx('n-divider', className)}
      viewBox="0 0 240 32"
      aria-hidden="true"
      focusable="false"
    >
      <use href="#o-divider" />
    </svg>
  );
}

// A painted scroll for one corner of a card or sheet. The parent must be position: relative;
// `corner` mirrors the flourish so it hugs that corner.
export function RosemalingCorner({
  corner = 'top-left',
}: {
  corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}) {
  return (
    <svg
      className={cx('n-rose-corner', `n-rose-corner--${corner}`)}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <use href="#o-corner" />
    </svg>
  );
}

// A small tulip sprig for headings and empty states.
export function RosemalingSprig({ className }: { className?: string }) {
  return (
    <svg
      className={cx('n-rose-sprig', className)}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <use href="#o-sprig" />
    </svg>
  );
}

// A chip-carved six-petal rosette (seksbladrose), the classic carving on stabbur doors and boxes.
export function CarvedRosette({ className }: { className?: string }) {
  return <Icon name="rosette" className={cx('n-rosette', className)} />;
}

// A band of chip-carved triangles, for the edge of headers and bars.
export function CarvedBand({ className }: { className?: string }) {
  return <span className={cx('n-carved-band', className)} aria-hidden="true" />;
}

// Four tulips in the corners of the parent, which must be position: relative.
export function TulipCorners(): ReactNode {
  return (
    <span className="n-corners" aria-hidden="true">
      <Icon name="tulip" />
      <Icon name="tulip" />
      <Icon name="tulip" />
      <Icon name="tulip" />
    </span>
  );
}
