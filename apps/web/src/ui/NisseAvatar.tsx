import { Icon } from './Icon';

export interface AvatarLook {
  cap?: string;
  beard?: string;
  skin?: string;
}

// The nisse avatar is coloured through CSS variables on the sprite symbol. Values come from the
// player's saved look, so only plain hex colours are passed on.
const HEX = /^#[0-9a-fA-F]{6}$/;

export function NisseAvatar({ look, size = 34 }: { look?: AvatarLook; size?: number }) {
  const style: Record<string, string | number> = { width: size, height: size };
  if (look?.cap && HEX.test(look.cap)) style['--nisse-cap'] = look.cap;
  if (look?.beard && HEX.test(look.beard)) style['--nisse-beard'] = look.beard;
  if (look?.skin && HEX.test(look.skin)) style['--nisse-skin'] = look.skin;
  return (
    <span className="n-avatar" style={style}>
      <Icon name="nisse" />
    </span>
  );
}
