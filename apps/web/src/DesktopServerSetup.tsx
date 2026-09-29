import { CheckCircle2, Cloud, LoaderCircle, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { companionKey, companionOrigin } from './companionBridge';

type UpstreamState = {
  upstream: string;
  locked: boolean;
  authenticated: boolean;
};

type Envelope = { data?: UpstreamState; error?: { message?: string } };

async function bridge(method: 'GET' | 'POST', upstream?: string): Promise<UpstreamState> {
  const capability = await companionKey();
  if (!capability) throw new Error('桌面连接尚未准备好，请稍后重试。');
  const response = await fetch(`${companionOrigin()}/v1/browser/upstream`, {
    method,
    headers: {
      'x-taskboard-companion-key': capability,
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
    },
    body: method === 'POST' ? JSON.stringify({ upstream }) : undefined,
    signal: AbortSignal.timeout(12_000),
  });
  const payload = (await response.json().catch(() => ({}))) as Envelope;
  if (!response.ok || !payload.data)
    throw new Error(payload.error?.message ?? '无法连接本机桌面服务。');
  return payload.data;
}

export function DesktopServerSetup({
  onReadyChange,
  onSaved,
  disabled = false,
}: {
  onReadyChange: (ready: boolean) => void;
  onSaved: () => void;
  disabled?: boolean;
}) {
  const [saved, setSaved] = useState<UpstreamState | null>(null);
  const [upstream, setUpstream] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'error' | 'success' | null>(null);

  const changed = saved !== null && upstream.trim() !== saved.upstream;
  const editable = !disabled && saved !== null && !saved.locked && !saved.authenticated;
  const ready = Boolean(saved) && !loading && !saving && !changed;
  const status = saved?.authenticated
    ? '此设备已有登录会话。退出当前设备后才能更改服务器。'
    : saved?.locked
      ? '启动配置已锁定，当前设备会使用启动时指定的服务器。'
      : message;

  useEffect(() => {
    onReadyChange(ready);
  }, [onReadyChange, ready]);

  useEffect(() => {
    let active = true;
    void bridge('GET')
      .then((state) => {
        if (!active) return;
        setSaved(state);
        setUpstream(state.upstream);
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : '无法读取服务器设置。');
          setMessageKind('error');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const readServer = async () => {
    setLoading(true);
    setMessage('');
    setMessageKind(null);
    try {
      const state = await bridge('GET');
      setSaved(state);
      setUpstream(state.upstream);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法读取服务器设置。');
      setMessageKind('error');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!editable || !upstream.trim()) return;
    onReadyChange(false);
    setSaving(true);
    setMessage('');
    setMessageKind(null);
    try {
      const state = await bridge('POST', upstream.trim());
      setSaved(state);
      setUpstream(state.upstream);
      setMessage('服务器地址已保存。现在可以登录。');
      setMessageKind('success');
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存服务器地址失败。');
      setMessageKind('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="desktop-server-setup" aria-labelledby="desktop-server-title">
      <div className="desktop-server-heading">
        <div>
          <p className="eyebrow">桌面连接</p>
          <h3 id="desktop-server-title">任务看板服务器</h3>
        </div>
        {loading ? (
          <LoaderCircle className="spin" size={17} aria-label="正在读取设置" />
        ) : (
          <Cloud size={17} />
        )}
      </div>
      <p className="muted">选择这台设备要连接的共享看板地址。保存前不会尝试登录。</p>
      <label className="form-label" htmlFor="desktop-server-url">
        服务器 URL
        <input
          id="desktop-server-url"
          type="url"
          inputMode="url"
          autoComplete="url"
          value={upstream}
          disabled={!editable || loading || saving}
          onChange={(event) => {
            const nextUpstream = event.target.value;
            const unchanged = saved !== null && nextUpstream.trim() === saved.upstream;
            setUpstream(nextUpstream);
            setMessage('');
            setMessageKind(null);
            onReadyChange(unchanged && !loading && !saving);
          }}
          placeholder="https://taskboard.example.com"
          aria-describedby="desktop-server-status"
        />
      </label>
      {!saved?.locked && !saved?.authenticated && (
        <button
          type="button"
          className="button ghost desktop-server-save"
          disabled={disabled || loading || saving || !upstream.trim() || !changed}
          onClick={save}
        >
          {saving && <LoaderCircle className="spin" size={15} />}
          保存服务器
        </button>
      )}
      {status && (
        <div
          id="desktop-server-status"
          className={
            saved?.locked || saved?.authenticated
              ? 'desktop-server-note'
              : messageKind === 'success'
                ? 'desktop-server-ok'
                : 'form-error'
          }
        >
          {(saved?.locked || saved?.authenticated) && <LockKeyhole size={14} />}
          {messageKind === 'success' && !saved?.locked && !saved?.authenticated && (
            <CheckCircle2 size={14} />
          )}
          <span>{status}</span>
          {!saved && !loading && (
            <button
              type="button"
              className="button ghost desktop-server-retry"
              onClick={readServer}
            >
              重试
            </button>
          )}
        </div>
      )}
    </section>
  );
}
