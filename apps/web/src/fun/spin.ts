// The physics of a spinning medallion, kept free of the DOM so it can be tested on its own.
// Angles are in degrees, velocities in degrees per second and time in seconds.

export interface Spin {
  /** Rotation around the vertical axis. 0 shows the front, 180 the back. */
  angle: number;
  vel: number;
  /** Tilt towards or away from the viewer while dragging, springs back to 0 on release. */
  tilt: number;
  tiltVel: number;
  /** A face the coin is settling on, or null while it still spins freely. */
  target: number | null;
}

export const REST: Spin = { angle: 0, vel: 0, tilt: 0, tiltVel: 0, target: null };

/** Degrees of turn per pixel of horizontal drag: one coin width is about half a turn. */
export const DRAG_GAIN = 0.65;
export const MAX_TILT = 28;
const MAX_VEL = 3200;
const FRICTION = 1.6; // per second, exponential
const SETTLE_BELOW = 220; // a free spin slower than this starts settling on a face
const STIFFNESS = 140;
const DAMPING = 2 * Math.sqrt(STIFFNESS) * 0.62; // a little under critical: one soft wobble

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** The face (a multiple of 180) a coin turning in the direction of `vel` comes to rest on. */
export function faceAhead(angle: number, vel: number): number {
  const half = angle / 180;
  if (vel > 0) return Math.ceil(half) * 180;
  if (vel < 0) return Math.floor(half) * 180;
  return Math.round(half) * 180;
}

export function release(spin: Spin, vel: number): Spin {
  return { ...spin, vel: clamp(vel, -MAX_VEL, MAX_VEL), target: null };
}

/** Half a turn onwards, the way a tap or the «Snu» button turns the coin. */
export function flip(spin: Spin, direction: 1 | -1 = 1): Spin {
  const from = spin.target ?? faceAhead(spin.angle, 0);
  return { ...spin, target: from + 180 * direction };
}

function spring(x: number, v: number, to: number, dt: number): [number, number] {
  const acc = -STIFFNESS * (x - to) - DAMPING * v;
  const nv = v + acc * dt;
  return [x + nv * dt, nv];
}

/** Advances the spin by `dt` seconds. Long frames are cut into small steps so the spring stays stable. */
export function step(spin: Spin, dt: number): Spin {
  let s = spin;
  let left = Math.min(dt, 0.1);
  while (left > 0) {
    const h = Math.min(left, 1 / 120);
    left -= h;
    let { angle, vel, target } = s;
    if (target === null) {
      angle += vel * h;
      vel *= Math.exp(-FRICTION * h);
      if (Math.abs(vel) < SETTLE_BELOW) target = faceAhead(angle, vel);
    } else {
      [angle, vel] = spring(angle, vel, target, h);
    }
    const [tilt, tiltVel] = spring(s.tilt, s.tiltVel, 0, h);
    s = { angle, vel, tilt, tiltVel, target };
  }
  return s;
}

export function atRest(spin: Spin): boolean {
  return (
    spin.target !== null &&
    Math.abs(spin.angle - spin.target) < 0.05 &&
    Math.abs(spin.vel) < 0.5 &&
    Math.abs(spin.tilt) < 0.05 &&
    Math.abs(spin.tiltVel) < 0.5
  );
}

/** True when the back of the coin faces the viewer. */
export function showsBack(angle: number): boolean {
  const a = ((angle % 360) + 360) % 360;
  return a > 90 && a < 270;
}
