import { Check, LoaderCircle, Monitor, X } from 'lucide-react';
import { useCodexConnection } from './codexConnection';

export function CodexConnectionAction() {
  const codex = useCodexConnection();
  if (!codex.available) return null;
  return (
    <button
      className="button ghost codex-connect-action"
      disabled={codex.busy}
      aria-describedby={
        ['waiting', 'connecting', 'error'].includes(codex.phase)
          ? 'codex-connection-notice'
          : undefined
      }
      onClick={() => void codex.connect()}
    >
      {codex.busy ? <LoaderCircle className="spin" size={16} /> : <Monitor size={16} />}
      {codex.phase === 'waiting'
        ? '等待 Codex 退出…'
        : codex.busy
          ? '连接中…'
          : codex.phase === 'connected'
            ? '打开 Codex'
            : '连接 Codex'}
    </button>
  );
}
export function CodexConnectionNotice() {
  const codex = useCodexConnection();
  const needsRestart = codex.phase === 'idle' && codex.connection?.state === 'restart-required';
  if (
    !codex.available ||
    (!needsRestart && !['waiting', 'connecting', 'error'].includes(codex.phase))
  )
    return null;
  return (
    <div
      className="codex-connection-notice"
      id="codex-connection-notice"
      role={codex.phase === 'error' ? 'alert' : 'status'}
    >
      <div>
        <b>
          {needsRestart
            ? '首次连接需要正常重开 Codex'
            : codex.phase === 'waiting'
              ? '退出后自动接入'
              : codex.phase === 'error'
                ? 'Codex 尚未接入'
                : '正在接入 Codex'}
        </b>
        <p>{codex.diagnosis}</p>
      </div>
      {codex.phase === 'waiting' && (
        <button className="button ghost" onClick={codex.cancelWait}>
          <X size={15} />
          取消等待
        </button>
      )}
      {codex.phase === 'error' && (
        <button className="button ghost" onClick={() => void codex.connect()}>
          <Check size={15} />
          重新连接
        </button>
      )}
      {needsRestart && (
        <button className="button ghost" onClick={() => void codex.connect()}>
          退出后自动接入
        </button>
      )}
    </div>
  );
}
