import { Check, LoaderCircle, Monitor, X } from 'lucide-react';
import { useCodexConnection } from './codexConnection';
import { codexConnectionView } from './codexConnectionView';

export function CodexConnectionAction() {
  const codex = useCodexConnection();
  const view = codexConnectionView(codex);
  if (!codex.available) return null;
  return (
    <button
      className="button ghost codex-connect-action"
      data-connection-tone={view.tone}
      disabled={codex.busy}
      aria-describedby={
        view.notice || codex.preferenceError ? 'codex-connection-notice' : undefined
      }
      onClick={() => void codex[view.action]()}
    >
      {codex.busy ? (
        <LoaderCircle className="spin" size={16} />
      ) : view.tone === 'connected' ? (
        <Check size={16} />
      ) : (
        <Monitor size={16} />
      )}
      <span>{view.label}</span>
    </button>
  );
}
export function CodexRestartSteps() {
  return (
    <ol className="codex-restart-steps" aria-label="接入步骤">
      <li>保存工作并正常退出 Codex</li>
      <li>自动打开原环境，保留登录与会话</li>
      <li>检查侧栏并接入任务看板</li>
    </ol>
  );
}
export function CodexConnectionNotice({
  onOpenSettings,
}: {
  onOpenSettings: (trigger: HTMLButtonElement) => void;
}) {
  const codex = useCodexConnection();
  const view = codexConnectionView(codex);
  if (!codex.available) return null;
  if (!view.notice) return codex.phase === 'checking' ? null : <CodexPreferenceWarning />;
  return (
    <div
      className="codex-connection-notice"
      id="codex-connection-notice"
      data-connection-tone={view.tone}
      role={view.tone === 'error' ? 'alert' : 'status'}
    >
      <div>
        <b>{view.title}</b>
        <p>{view.summary}</p>
        {view.restart && <CodexRestartSteps />}
      </div>
      <div className="codex-notice-actions">
        {codex.phase === 'waiting' ? (
          <button className="button ghost" onClick={codex.cancelWait}>
            <X size={15} />
            取消等待
          </button>
        ) : (
          !codex.busy && (
            <button className="button ghost" onClick={() => void codex[view.action]()}>
              {view.restart ? '退出后自动接入' : view.label}
            </button>
          )
        )}
        <button className="button ghost" onClick={(event) => onOpenSettings(event.currentTarget)}>
          连接详情
        </button>
      </div>
    </div>
  );
}

export function CodexPreferenceWarning({ id = 'codex-connection-notice' }: { id?: string }) {
  const codex = useCodexConnection();
  if (!codex.preferenceError) return null;
  return (
    <div className="codex-connection-notice" id={id} role="alert">
      <div>
        <b>{codex.phase === 'connected' ? 'Codex 已接入，设置未保存' : '自动连接设置未保存'}</b>
        <p className="codex-preference-message">{codex.preferenceError}</p>
      </div>
      <button className="button ghost" onClick={codex.retryPreference}>
        重试保存
      </button>
    </div>
  );
}
