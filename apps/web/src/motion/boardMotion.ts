import { useLayoutEffect, useRef, type RefObject } from 'react';

const settle = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const boardMotion = {
  shift: { duration: 260, easing: settle },
  drop: { duration: 240, easing: settle },
  exit: 180,
} as const;

export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type Point = { x: number; y: number };
function cancelReflow(active: Map<HTMLElement, Animation>) {
  active.forEach((animation, card) => {
    animation.cancel();
    // WAAPI cancel events are async; clean the marker before clearing ownership.
    delete card.dataset.reflowing;
  });
  active.clear();
}
/** Interruptible FLIP in board coordinates. dnd-kit exclusively owns drag transforms. */
export function useBoardReflow(
  root: RefObject<HTMLElement | null>,
  revision: string,
  suspended = false,
) {
  const previous = useRef(new Map<string, Point>());
  const animations = useRef(new Map<HTMLElement, Animation>());
  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-motion-id]'));
    // Read the in-flight visual offsets before cancellation; interruption must not snap back.
    const visual = new Map(cards.map((card) => [card, card.getBoundingClientRect()]));
    cancelReflow(animations.current);
    const board = container.getBoundingClientRect();
    const next = new Map<string, Point>();
    const measurements = cards.map((card) => {
      const rect = card.getBoundingClientRect();
      const id = card.dataset.motionId;
      const point = {
        x: rect.left - board.left + container.scrollLeft,
        y: rect.top - board.top + container.scrollTop,
      };
      if (id) next.set(id, point);
      const before = id ? previous.current.get(id) : undefined;
      const moving = visual.get(card)!;
      return {
        card,
        rect,
        before,
        point,
        offset: { x: moving.left - rect.left, y: moving.top - rect.top },
      };
    });
    previous.current = next;
    if (suspended) {
      previous.current.clear();
      return;
    }
    if (container.querySelector('[data-dragging="true"]') || prefersReducedMotion()) return;
    let count = 0;
    for (const { card, rect, before, point, offset } of measurements) {
      if (
        !before ||
        !rect.width ||
        typeof card.animate !== 'function' ||
        rect.bottom < 0 ||
        rect.top > innerHeight
      )
        continue;
      const x = before.x + offset.x - point.x;
      const y = before.y + offset.y - point.y;
      const distance = Math.hypot(x, y);
      if (distance < 1 || distance > Math.max(container.clientHeight, 700) || count++ >= 12)
        continue;
      const animation = card.animate(
        [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }],
        { ...boardMotion.shift, duration: Math.min(300, 180 + distance * 0.2) },
      );
      card.dataset.reflowing = 'true';
      animations.current.set(card, animation);
      const release = () => {
        if (animations.current.get(card) === animation) {
          animations.current.delete(card);
          delete card.dataset.reflowing;
        }
      };
      animation.onfinish = release;
      animation.oncancel = release;
    }
  }, [root, revision, suspended]);
  useLayoutEffect(() => {
    const active = animations.current;
    const cancel = () => cancelReflow(active);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => {
      if (media.matches) cancel();
    };
    media.addEventListener('change', preference);
    return () => {
      media.removeEventListener('change', preference);
      cancel();
    };
  }, []);
}
