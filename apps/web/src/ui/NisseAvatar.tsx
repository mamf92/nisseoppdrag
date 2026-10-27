export interface AvatarLook {
  cap?: string;
  beard?: string;
  skin?: string;
}

// The nisse portrait inside the carved wooden ring. Colours come from the player's saved look
// through CSS variables on the sprite symbol, so only plain hex colours are passed on.
const HEX = /^#[0-9a-fA-F]{6}$/;

export function NisseAvatar({ look, size = 40 }: { look?: AvatarLook; size?: number }) {
  const style: Record<string, string | number> = { width: size, height: size };
  if (look?.cap && HEX.test(look.cap)) style['--nisse-cap'] = look.cap;
  if (look?.beard && HEX.test(look.beard)) style['--nisse-beard'] = look.beard;
  if (look?.skin && HEX.test(look.skin)) style['--nisse-skin'] = look.skin;
  return (
    <span className="n-avatar" style={style}>
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <use href="#f-ring" />
        <circle className="n-avatar__disc" cx="32" cy="32" r="22" />
        <g clipPath="url(#c-disc)">
          <use href="#i-nisse" x="7" y="7" width="50" height="50" />
        </g>
        <use href="#f-sheen" opacity="0.6" />
      </svg>
    </span>
  );
}
