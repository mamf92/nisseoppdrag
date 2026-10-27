import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../themes/ThemeProvider';
import { prefersReducedMotion } from './motion';

const EVENT = 'nisse:snow';
const DURATION_MS = 9000;

/** Lets it snow over the app for a few seconds. Does nothing with reduced motion. */
export function letItSnow() {
  window.dispatchEvent(new Event(EVENT));
}

interface Flake {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  phase: number;
}

// A short snowfall on a canvas over the whole app, started by letItSnow(). In Låven the snow is
// sparse and dim, a quiet night; in Gården it is a thick, bright Christmas-card fall.
export function Snowfall() {
  const { theme } = useTheme();
  const [falling, setFalling] = useState(0);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const start = () => {
      if (!prefersReducedMotion()) setFalling((n) => n + 1);
    };
    window.addEventListener(EVENT, start);
    return () => {
      window.removeEventListener(EVENT, start);
    };
  }, []);

  useEffect(() => {
    if (!falling) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const quiet = theme === 'laaven';
    const count = Math.round(((quiet ? 50 : 110) * Math.min(w, 1400)) / 800);
    const flakes: Flake[] = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: -Math.random() * h,
      r: 1 + Math.random() * (quiet ? 2 : 3.2),
      speed: 30 + Math.random() * 60,
      drift: 10 + Math.random() * 25,
      phase: Math.random() * Math.PI * 2,
    }));
    // On Gården's cream paper white would vanish, so its snow is an icy blue, like a printed card.
    const colour = quiet ? '226 232 245' : '150 176 210';
    const began = performance.now();
    let last = began;
    let frame = 0;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const age = now - began;
      // The last two seconds fade out instead of stopping dead.
      const fade = Math.min(1, Math.max(0, (DURATION_MS - age) / 2000));
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgb(${colour} / ${String((quiet ? 0.7 : 0.95) * fade)})`;
      for (const f of flakes) {
        f.y += f.speed * dt;
        f.x += Math.sin(now / 900 + f.phase) * f.drift * dt;
        if (f.y > h + 5 && age < DURATION_MS - 2500) {
          f.y = -5;
          f.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (age < DURATION_MS) frame = requestAnimationFrame(draw);
      else setFalling(0);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [falling, theme]);

  if (!falling) return null;
  return <canvas ref={ref} className="n-snow" aria-hidden="true" />;
}
