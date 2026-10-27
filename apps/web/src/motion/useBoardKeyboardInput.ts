import { useEffect, type RefObject } from 'react';

const logicalCodes = new Map([
  [' ', 'Space'],
  ['Enter', 'Enter'],
  ['Escape', 'Escape'],
  ['Tab', 'Tab'],
  ['ArrowLeft', 'ArrowLeft'],
  ['ArrowRight', 'ArrowRight'],
  ['ArrowUp', 'ArrowUp'],
  ['ArrowDown', 'ArrowDown'],
]);

/** Keep logical accessibility input usable by the public, code-based dnd-kit sensor. */
export function useBoardKeyboardInput(root: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const doc = root.current?.ownerDocument;
    if (!doc || !enabled) return;
    const normalize = (event: KeyboardEvent) => {
      if (
        (event.code !== '' && event.code !== 'Unidentified') ||
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const target = event.target;
      if (
        !(target instanceof HTMLElement) ||
        !target.matches('button.task-card[data-motion-id]') ||
        !root.current?.contains(target)
      )
        return;
      const code = logicalCodes.get(event.key);
      if (
        !code ||
        !Object.isExtensible(event) ||
        Object.getOwnPropertyDescriptor(event, 'code')?.configurable === false
      )
        return;
      // Some accessibility drivers send a virtual key without a hardware scan code.
      // Preserve the original event, target, trust, and cancellation; fill only its missing code.
      Object.defineProperty(event, 'code', { configurable: true, value: code });
    };
    // Register before an interaction installs the sensor's document capture listener.
    doc.addEventListener('keydown', normalize, true);
    return () => doc.removeEventListener('keydown', normalize, true);
  }, [root, enabled]);
}
