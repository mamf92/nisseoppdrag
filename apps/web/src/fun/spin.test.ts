import { REST, atRest, faceAhead, flip, release, showsBack, step } from './spin';
import type { Spin } from './spin';

function settle(spin: Spin, seconds = 6): Spin {
  let s = spin;
  for (let t = 0; t < seconds && !atRest(s); t += 1 / 60) s = step(s, 1 / 60);
  return s;
}

describe('spin', () => {
  it('picks the face ahead in the direction of travel', () => {
    expect(faceAhead(10, 1)).toBe(180);
    expect(faceAhead(10, -1)).toBe(0);
    expect(faceAhead(-10, -1)).toBe(-180);
    expect(faceAhead(100, 0)).toBe(180);
  });

  it('turns over to the back on a flip and to the front on the next', () => {
    const back = settle(flip(REST));
    expect(atRest(back)).toBe(true);
    expect(back.angle).toBeCloseTo(180, 0);
    expect(showsBack(back.angle)).toBe(true);
    const front = settle(flip(back));
    expect(front.angle).toBeCloseTo(360, 0);
    expect(showsBack(front.angle)).toBe(false);
  });

  it('lets a flick spin several turns and still land flat on a face', () => {
    const end = settle(release(REST, 3000));
    expect(end.angle).toBeGreaterThan(720);
    expect(end.angle % 180).toBeCloseTo(0, 0);
    expect(atRest(end)).toBe(true);
  });

  it('springs the tilt back to level', () => {
    const end = settle({ ...REST, tilt: 25, target: 0 });
    expect(Math.abs(end.tilt)).toBeLessThan(0.05);
  });

  it('stays stable when a frame takes far too long', () => {
    const s = step(flip(REST), 5);
    expect(Number.isFinite(s.angle)).toBe(true);
    expect(Math.abs(s.angle)).toBeLessThan(400);
  });

  it('knows which side faces the viewer for any angle', () => {
    expect(showsBack(-180)).toBe(true);
    expect(showsBack(-360)).toBe(false);
    expect(showsBack(540)).toBe(true);
    expect(showsBack(89)).toBe(false);
  });
});
