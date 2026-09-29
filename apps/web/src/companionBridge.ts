declare global {
  interface Window {
    __TAURI__?: { core?: { invoke<T>(command: string): Promise<T> } };
  }
}

export function embeddedCapability(): string | undefined {
  const location = typeof window === 'undefined' ? undefined : window.location;
  if (!location || location.protocol !== 'http:' || location.hostname !== '127.0.0.1')
    return undefined;
  return /^\/embedded\/([A-Za-z0-9_-]{43})\/$/.exec(location.pathname)?.[1];
}

export function companionOrigin(): string {
  return embeddedCapability() ? window.location.origin : 'http://127.0.0.1:47831';
}

export function hasLocalCompanion(): boolean {
  return (
    typeof window !== 'undefined' &&
    (Boolean(window.__TAURI__?.core?.invoke) || Boolean(embeddedCapability()))
  );
}

export async function companionKey(): Promise<string | undefined> {
  if (typeof window === 'undefined') return undefined;
  return embeddedCapability() ?? window.__TAURI__?.core?.invoke<string>('bridge_capability');
}
