import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type AnimationEvent,
} from 'react';
import { boardMotion, prefersReducedMotion } from './boardMotion';

/** Keep an aside mounted only for its exit; rapid close and unmount share one cleanup. */
export function useDrawerPresence(onClose: () => void, root: RefObject<HTMLElement | null>) {
  const [closing, setClosing] = useState(false);
  const callback = useRef(onClose);
  callback.current = onClose;
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finish = useCallback(() => {
    if (!pending.current) return;
    pending.current = false;
    if (timer.current) clearTimeout(timer.current);
    callback.current();
  }, []);
  const close = useCallback(() => {
    if (pending.current) return;
    pending.current = true;
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    if (root.current) {
      const current = getComputedStyle(root.current);
      root.current.style.setProperty('--drawer-exit-transform', current.transform);
      root.current.style.setProperty('--drawer-exit-opacity', current.opacity);
    }
    setClosing(true);
    // Covers blocked animations and a preference change during an already-started exit.
    timer.current = setTimeout(finish, boardMotion.exit + 80);
  }, [finish, root]);
  const onAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLElement>) => {
      if (event.target === event.currentTarget && event.animationName === 'relay-drawer-out')
        finish();
    },
    [finish],
  );
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => {
      if (media.matches) finish();
    };
    media.addEventListener('change', preference);
    return () => {
      media.removeEventListener('change', preference);
      pending.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [finish]);
  return { closing, close, onAnimationEnd };
}
