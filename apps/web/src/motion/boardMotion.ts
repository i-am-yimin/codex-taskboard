import { useLayoutEffect, useRef, type RefObject } from 'react';

export const boardMotion = {
  shift: { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  drop: { duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
} as const;

export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** FLIP stable cards; dnd-kit owns transforms throughout dragging. */
export function useBoardReflow(root: RefObject<HTMLElement | null>, revision: string) {
  const previous = useRef(new Map<string, DOMRect>());
  const animations = useRef(new Map<HTMLElement, Animation>());
  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-motion-id]'));
    const dragging = container.querySelector('[data-dragging="true"], .dragging');
    const next = new Map<string, DOMRect>();
    const measurements = cards.map((card) => {
      animations.current.get(card)?.cancel();
      const rect = card.getBoundingClientRect();
      const id = card.dataset.motionId;
      if (id) next.set(id, rect);
      return { card, rect, before: id ? previous.current.get(id) : undefined };
    });
    previous.current = next;
    if (dragging || prefersReducedMotion()) return;
    for (const { card, rect, before } of measurements) {
      if (!before || rect.width === 0 || typeof card.animate !== 'function') continue;
      const x = before.left - rect.left;
      const y = before.top - rect.top;
      if (Math.abs(x) < 1 && Math.abs(y) < 1) continue;
      const animation = card.animate(
        [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }],
        boardMotion.shift,
      );
      animations.current.set(card, animation);
      const release = () => {
        if (animations.current.get(card) === animation) animations.current.delete(card);
      };
      animation.onfinish = release;
      animation.oncancel = release;
    }
  }, [root, revision]);
  useLayoutEffect(() => {
    const active = animations.current;
    return () => {
      active.forEach((animation) => animation.cancel());
      active.clear();
    };
  }, []);
}
