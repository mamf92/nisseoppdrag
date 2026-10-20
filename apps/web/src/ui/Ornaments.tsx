import type { ReactNode } from 'react';
import { Icon } from './Icon';

// Rosemaling-style rule used between sections.
export function RosemalingDivider() {
  return (
    <svg className="n-divider" viewBox="0 0 240 18" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M0 9h86M154 9h86" />
        <path d="M92 9c6-8 14-8 18 0s12 8 18 0" />
        <circle cx="120" cy="9" r="3" fill="currentColor" />
        <path d="M128 9c6 8 14 8 18 0" />
      </g>
    </svg>
  );
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
