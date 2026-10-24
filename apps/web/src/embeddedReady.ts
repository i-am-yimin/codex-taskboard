import { useLayoutEffect } from 'react';

export const BOARD_READY_CHALLENGE = 'taskboard:ready-challenge';
export const BOARD_READY_RESPONSE = 'taskboard:ready-response';

/** A sidebar iframe may stay display:none until the host receives readiness.
 * Register after React commits, without waiting for that iframe to paint. */
export function useEmbeddedReadyResponder(): void {
  useLayoutEffect(() => installEmbeddedReadyResponder(), []);
}

/** Installs the narrow, readiness-only bridge after React has committed. */
export function installEmbeddedReadyResponder(): () => void {
  const onMessage = (event: MessageEvent) => {
    if (window.parent === window || event.source !== window.parent) return;
    const data = event.data;
    if (
      !data ||
      typeof data !== 'object' ||
      data.type !== BOARD_READY_CHALLENGE ||
      typeof data.nonce !== 'string' ||
      data.nonce.length < 16 ||
      data.nonce.length > 256
    )
      return;
    // An opaque parent origin (for example app://) cannot be named as a target
    // origin. The source was still checked against this frame's parent.
    const targetOrigin = event.origin === 'null' ? '*' : event.origin;
    window.parent.postMessage({ type: BOARD_READY_RESPONSE, nonce: data.nonce }, targetOrigin);
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
