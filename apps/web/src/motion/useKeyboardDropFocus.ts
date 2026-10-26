import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';

/** Focus belongs to this keyboard move until its request/query refresh settles or the user leaves. */
export function useKeyboardDropFocus(root: RefObject<HTMLElement | null>) {
  const pending = useRef<(() => void) | null>(null);
  const cancel = useCallback(() => {
    pending.current?.();
  }, []);
  useEffect(() => cancel, [cancel]);
  const begin = (event: Pick<DragEndEvent, 'activatorEvent' | 'active'>) => {
    cancel();
    if (!(event.activatorEvent instanceof KeyboardEvent) || document.visibilityState !== 'visible')
      return () => {};
    const id = String(event.active.id);
    const find = () =>
      Array.from(root.current?.querySelectorAll<HTMLElement>('[data-motion-id]') ?? []).find(
        (card) => card.dataset.motionId === id,
      );
    const source = find();
    const controller = new AbortController();
    let frame: number | undefined;
    const release = () => {
      controller.abort();
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (pending.current === release) pending.current = null;
    };
    pending.current = release;
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState !== 'visible') release();
      },
      { signal: controller.signal },
    );
    window.addEventListener('pagehide', release, { signal: controller.signal });
    document.addEventListener('pointerdown', release, { capture: true, signal: controller.signal });
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.isTrusted) release();
      },
      { capture: true, signal: controller.signal },
    );
    document.addEventListener(
      'focusin',
      (event) => {
        if (event.target !== source && event.target !== find()) release();
      },
      { capture: true, signal: controller.signal },
    );
    return () => {
      if (controller.signal.aborted) return;
      frame = requestAnimationFrame(() => {
        const card = find();
        const active = document.activeElement;
        const dialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).some(
          (element) => element.getClientRects().length > 0,
        );
        if (!dialog && card && (active === document.body || active === source || active === card)) {
          card.focus({ preventScroll: true });
        }
        release();
      });
    };
  };
  return { begin, cancel };
}
