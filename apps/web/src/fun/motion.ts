import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(QUERY);
    const update = () => {
      setReduced(list.matches);
    };
    list.addEventListener('change', update);
    return () => {
      list.removeEventListener('change', update);
    };
  }, []);
  return reduced;
}

/** Plays a CSS animation class again from the start, even if it is already running. */
export function replay(el: Element, className: string) {
  el.classList.remove(className);
  // Reading layout here makes the browser drop the old animation before the class comes back.
  el.getBoundingClientRect();
  el.classList.add(className);
}

// A little reaction to a tap on something that is not a control (a hatch, the lantern). It is a
// listener rather than an onClick because the element stays what it is for assistive technology:
// the flourish carries no information and adds no tab stop.
export function useBoop<T extends HTMLElement>(
  ref: RefObject<T | null>,
  className: string,
  onBoop?: (el: T) => void,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = () => {
      replay(el, className);
      onBoop?.(el);
    };
    const clear = (event: AnimationEvent) => {
      if (event.target === el) el.classList.remove(className);
    };
    el.addEventListener('pointerdown', handle);
    el.addEventListener('animationend', clear);
    return () => {
      el.removeEventListener('pointerdown', handle);
      el.removeEventListener('animationend', clear);
    };
  }, [ref, className, onBoop]);
}
