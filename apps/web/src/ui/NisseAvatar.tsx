import { asPortrait, defaultPortrait, portraitSrc } from './portraits';

export interface AvatarLook {
  cap?: string;
  beard?: string;
  skin?: string;
}

// The player's portrait inside the carved wooden ring. With no chosen portrait (or an id this
// build has no art for) a player gets a default portrait picked from their member id (`seed`).
// Without a seed it is the drawn nisse (kit pages only), whose colours can come from a look
// through CSS variables on the sprite symbol, so only plain hex colours are passed on.
const HEX = /^#[0-9a-fA-F]{6}$/;

export function NisseAvatar({
  look,
  portrait,
  seed,
  size = 40,
}: {
  look?: AvatarLook;
  portrait?: string | null;
  /** The member id, for the default portrait when none is chosen. */
  seed?: string;
  size?: number;
}) {
  const id = asPortrait(portrait) ?? (seed ? defaultPortrait(seed) : null);
  const style: Record<string, string | number> = { width: size, height: size };
  if (look?.cap && HEX.test(look.cap)) style['--nisse-cap'] = look.cap;
  if (look?.beard && HEX.test(look.beard)) style['--nisse-beard'] = look.beard;
  if (look?.skin && HEX.test(look.skin)) style['--nisse-skin'] = look.skin;
  return (
    <span className="n-avatar" style={style} data-portrait={id ?? undefined}>
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <use href="#f-ring" />
        <circle className="n-avatar__disc" cx="32" cy="32" r="22" />
        <g clipPath="url(#c-disc)">
          {id ? (
            <image
              href={portraitSrc(id, size)}
              x="10"
              y="10"
              width="44"
              height="44"
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <use href="#i-nisse" x="7" y="7" width="50" height="50" />
          )}
        </g>
        <use href="#f-sheen" opacity="0.6" />
      </svg>
    </span>
  );
}
