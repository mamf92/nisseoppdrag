import { useTheme } from '../themes/ThemeProvider';

const GATES = {
  gaarden: '/art/gate/L-11-login-gate',
  laaven: '/art/gate/R-11-gate',
} as const;

// The painting at the top of the sign-in pages: the farm gate in the story the visitor is in.
export function GateArt() {
  const { theme } = useTheme();
  const base = GATES[theme];
  return (
    <picture className="n-gate">
      <source type="image/avif" srcSet={`${base}@1x.avif 1x, ${base}@2x.avif 2x`} />
      <img
        src={`${base}@1x.webp`}
        srcSet={`${base}@1x.webp 1x, ${base}@2x.webp 2x`}
        alt=""
        decoding="async"
      />
    </picture>
  );
}
