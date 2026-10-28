import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { Button, Icon } from '../ui';
import { cx } from '../ui/cx';
import { prefersReducedMotion } from './motion';
import { DRAG_GAIN, MAX_TILT, REST, atRest, clamp, flip, release, showsBack, step } from './spin';
import type { Spin } from './spin';

export interface ViewedBadge {
  file: string;
  name: string;
  how: string;
  bonusPoints: number;
  unlockedAt: string | null;
}

const TAP_SLOP = 6; // px a pointer may wander and still count as a tap
const DIZZY_TURNS = 10;
const EDGE_LAYERS = 8;

function formatDate(iso: string, lang: 'nb' | 'en') {
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// A medallion in full view, as a wooden coin that can be dragged, flicked and spun. Tapping turns
// it over to the carved back, which says when it was won (or how to win it). With reduced motion
// the coin turns over at once and never spins.
export function BadgeViewer({
  badge,
  origin,
  onClose,
}: {
  badge: ViewedBadge | null;
  /** The medallion that was tapped, so the coin can fly out of it. */
  origin: HTMLElement | null;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);
  const spin = useRef<Spin>(REST);
  const frame = useRef(0);
  const turns = useRef(0);
  const drag = useRef<{
    sx: number;
    x: number;
    y: number;
    t: number;
    moved: number;
    vel: number;
  } | null>(null);
  const [back, setBack] = useState(false);
  const [dizzy, setDizzy] = useState(false);
  const open = badge !== null;

  const paint = useCallback(() => {
    const coin = coinRef.current;
    if (!coin) return;
    const { angle, tilt } = spin.current;
    coin.style.transform = `rotateX(${tilt.toFixed(2)}deg) rotateY(${angle.toFixed(2)}deg)`;
    // The sheen slides across the face as it turns.
    coin.style.setProperty('--sheen', (((angle % 360) + 360) % 360).toFixed(1));
    setBack(showsBack(angle));
  }, []);

  const run = useCallback(() => {
    if (frame.current) return;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? (now - last) / 1000 : 1 / 60;
      last = now;
      const before = spin.current.angle;
      spin.current = step(spin.current, dt);
      turns.current += Math.abs(spin.current.angle - before) / 360;
      if (turns.current >= DIZZY_TURNS) setDizzy(true);
      if (atRest(spin.current)) {
        const face = spin.current.target ?? 0;
        spin.current = { ...REST, angle: face, target: face };
        paint();
        frame.current = 0;
        return;
      }
      paint();
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [paint]);

  const stop = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);

  const turnOver = useCallback(
    (direction: 1 | -1 = 1) => {
      if (prefersReducedMotion()) {
        stop();
        const angle = (spin.current.target ?? spin.current.angle) + 180 * direction;
        spin.current = { ...REST, angle, target: angle };
        paint();
        return;
      }
      spin.current = flip(spin.current, direction);
      run();
    },
    [paint, run, stop],
  );

  // Open and close the native dialog; on open the coin flies out of the tapped medallion.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      turns.current = 0;
      setDizzy(false);
      const reduced = prefersReducedMotion();
      // The coin arrives with a full turn and settles on its front.
      spin.current = reduced ? { ...REST, target: 0 } : { ...REST, angle: -360, target: 0 };
      paint();
      if (!reduced) {
        run();
        const stage = stageRef.current;
        const from = origin?.getBoundingClientRect();
        if (stage && from && from.width > 0 && typeof stage.animate === 'function') {
          const to = stage.getBoundingClientRect();
          const dx = from.left + from.width / 2 - (to.left + to.width / 2);
          const dy = from.top + from.height / 2 - (to.top + to.height / 2);
          const scale = from.width / to.width;
          stage.animate(
            [
              { transform: `translate(${String(dx)}px, ${String(dy)}px) scale(${String(scale)})` },
              { transform: 'none' },
            ],
            { duration: 520, easing: 'cubic-bezier(.2,.9,.25,1.15)' },
          );
        }
      }
    } else if (!open && dialog.open) {
      stop();
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open, origin, paint, run, stop]);

  useEffect(() => stop, [stop]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    stop();
    drag.current = {
      sx: event.clientX,
      x: event.clientX,
      y: event.clientY,
      t: event.timeStamp,
      moved: 0,
      vel: 0,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    const dt = Math.max(1, event.timeStamp - d.t) / 1000;
    d.moved += Math.hypot(dx, dy);
    if (prefersReducedMotion()) {
      d.x = event.clientX;
      d.y = event.clientY;
      return;
    }
    const turn = dx * DRAG_GAIN;
    // Smoothed velocity of the last few moves, which is what a flick hands over on release.
    d.vel = d.vel * 0.6 + (turn / dt) * 0.4;
    const s = spin.current;
    spin.current = {
      ...s,
      angle: s.angle + turn,
      tilt: clamp(s.tilt - dy * 0.35, -MAX_TILT, MAX_TILT),
      vel: 0,
      tiltVel: 0,
      target: null,
    };
    turns.current += Math.abs(turn) / 360;
    d.x = event.clientX;
    d.y = event.clientY;
    d.t = event.timeStamp;
    paint();
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved < TAP_SLOP) {
      turnOver(1);
      return;
    }
    if (prefersReducedMotion()) {
      // A swipe still turns the coin over, in the swipe's direction, without spinning.
      turnOver(event.clientX < d.sx ? -1 : 1);
      return;
    }
    // A pause before letting go means no flick.
    const held = event.timeStamp - d.t > 90;
    spin.current = release(spin.current, held ? 0 : d.vel);
    run();
  };

  const name = badge?.name ?? '';
  const base = badge ? `/art/badges/${badge.file}-512` : '';
  const locked = badge?.unlockedAt === null;

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      className="n-viewer"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') turnOver(1);
        else if (event.key === 'ArrowLeft') turnOver(-1);
      }}
    >
      {badge ? (
        <div className="n-viewer__inner">
          <h2 id={titleId} className="n-viewer__title">
            {name}
          </h2>
          <div
            ref={stageRef}
            className="n-viewer__stage"
            role="img"
            aria-label={
              back
                ? `${name}. ${locked ? t('viewer.locked') : t('viewer.earned', { date: formatDate(badge.unlockedAt ?? '', lang) })}`
                : name
            }
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div ref={coinRef} className={cx('n-coin', locked && 'n-coin--locked')}>
              {Array.from({ length: EDGE_LAYERS }, (_, i) => (
                <i
                  key={i}
                  className="n-coin__edge"
                  style={{ transform: `translateZ(${String(i - (EDGE_LAYERS - 1) / 2)}px)` }}
                />
              ))}
              <div className="n-coin__face n-coin__front">
                <picture>
                  <source type="image/avif" srcSet={`${base}.avif`} />
                  <img src={`${base}.webp`} alt="" width={512} height={512} draggable={false} />
                </picture>
                <span className="n-coin__sheen" />
              </div>
              <div className="n-coin__face n-coin__back" aria-hidden="true">
                <Icon name="tulip" className="n-coin__rose" />
                <b>{name}</b>
                {locked ? (
                  <span>{t('viewer.locked')}</span>
                ) : (
                  <>
                    <span>
                      {t('viewer.earned', { date: formatDate(badge.unlockedAt ?? '', lang) })}
                    </span>
                    {badge.bonusPoints > 0 ? (
                      <small>{t('viewer.bonus', { n: badge.bonusPoints })}</small>
                    ) : null}
                  </>
                )}
                <Icon name="tulip" className="n-coin__rose n-coin__rose--down" />
              </div>
            </div>
          </div>
          <p className="n-viewer__how">{badge.how}</p>
          <p className="n-viewer__hint" aria-live="polite">
            {dizzy ? t('viewer.dizzy') : t('viewer.hint')}
          </p>
          <div className="n-viewer__actions">
            <Button
              variant="ghost"
              onClick={() => {
                turnOver(1);
              }}
            >
              {t('viewer.flip')}
            </Button>
            <Button onClick={onClose}>{t('sheet.close')}</Button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
