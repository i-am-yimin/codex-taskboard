import { KeyboardSensor, type KeyboardSensorOptions, type SensorProps } from '@dnd-kit/core';
import { flushSync } from 'react-dom';

/** A board owns its pending instances, including ones whose base listener has not attached yet. */
export class KeyboardSensorScope {
  private readonly instances = new Set<() => void>();
  register(dispose: () => void) {
    this.instances.add(dispose);
    return () => {
      this.instances.delete(dispose);
    };
  }
  // Reusable after StrictMode effect cleanup; each disposed instance stays terminal.
  dispose() {
    for (const dispose of [...this.instances]) dispose();
  }
}

type Options = KeyboardSensorOptions & { scope: KeyboardSensorScope };
const standardCodes = {
  start: ['Space', 'Enter'],
  end: ['Space', 'Enter', 'Tab'],
  cancel: ['Escape'],
};

/** Serialize keyboard input so each move commits before a following move or drop reads it. */
export class BufferedKeyboardSensor {
  static activators = KeyboardSensor.activators;
  readonly autoScrollEnabled: boolean;

  constructor(props: SensorProps<Options>) {
    const doc = props.activeNode.node.current?.ownerDocument ?? document;
    const codes = props.options.keyboardCodes ?? standardCodes;
    // A late cleanup must address this instance, never Escape-cancel a newer drag or drawer.
    const cleanupCode = `TaskboardKeyboardCleanup:${crypto.randomUUID()}`;
    const supported = new Set([
      ...codes.end,
      ...codes.cancel,
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
    ]);
    const queue: KeyboardEventInit[] = [];
    const replayed = new WeakSet<KeyboardEvent>();
    let draining = false;
    let attached = false;
    let completed = false;
    let overflowed = false;
    let unregister = () => {};
    const stopCapture = () => doc.removeEventListener('keydown', capture, true);
    const cleanupBase = () =>
      doc.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: cleanupCode,
          code: cleanupCode,
          bubbles: true,
          cancelable: true,
        }),
      );
    const release = () => {
      stopCapture();
      queue.length = 0;
      unregister();
    };
    const finish = (callback: () => void) => {
      if (completed) return;
      completed = true;
      release();
      callback();
    };
    const replay = (init: KeyboardEventInit) => {
      const event = new KeyboardEvent('keydown', init);
      replayed.add(event);
      flushSync(() => doc.dispatchEvent(event));
    };
    const capture = (event: KeyboardEvent) => {
      if (event === props.event || replayed.has(event) || completed || !supported.has(event.code))
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      // Cancellation has no destination to commit and must remain immediate once attached.
      if (attached && codes.cancel.includes(event.code)) {
        replay({ key: event.key, code: event.code, bubbles: true, cancelable: true });
        return;
      }
      if (overflowed) return;
      if (queue.length >= 64) {
        // A stalled registration must not retain unbounded repeated keys or replay stale intent.
        overflowed = true;
        queue.length = 0;
        queue.push({ key: cleanupCode, code: cleanupCode, bubbles: true, cancelable: true });
        return;
      }
      queue.push({
        key: event.key,
        code: event.code,
        location: event.location,
        repeat: event.repeat,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        bubbles: true,
        cancelable: true,
      });
      if (attached && !draining) {
        draining = true;
        setTimeout(replayNext, 0);
      }
    };
    unregister = props.options.scope.register(() => {
      if (completed) return;
      completed = true;
      release();
      // No callback into an unmounted board. The base still needs its own detach path.
      if (attached) cleanupBase();
    });
    doc.addEventListener('keydown', capture, true);
    const base = new KeyboardSensor({
      ...props,
      options: {
        ...props.options,
        keyboardCodes: { ...codes, cancel: [...codes.cancel, cleanupCode] },
      },
      onCancel: () => finish(props.onCancel),
      onEnd: () => finish(props.onEnd),
    });
    this.autoScrollEnabled = base.autoScrollEnabled;
    // dnd-kit 6.3.1 attaches with a zero-delay timer. This task is queued after that task
    // in the same window. Deterministic clock tests guard this public adapter on upgrades.
    // Keep it even after early cancel/unmount: the base's untracked timer can attach late.
    const replayNext = () => {
      if (completed) return;
      const init = queue.shift();
      if (!init) {
        draining = false;
        return;
      }
      replay(init);
      // Let dnd-kit commit collision/over effects before the next key reads the destination.
      // Keep capture for the whole drag: fast keys after registration need the same ordering.
      if (!completed) setTimeout(replayNext, 0);
    };
    setTimeout(() => {
      attached = true;
      if (completed) {
        cleanupBase();
        return;
      }
      draining = true;
      replayNext();
    }, 0);
  }
}
