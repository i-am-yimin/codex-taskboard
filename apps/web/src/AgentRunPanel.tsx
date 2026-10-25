import { useEffect, useRef, useState } from 'react';
import type { RunnerKind, RunnerProbe, Task, TaskClaim, TaskRun } from '@taskboard/core';
import { companionKey, companionOrigin, hasLocalCompanion, request } from './api';
import './agent-runs.css';

interface Props {
  task: Task;
  claims: TaskClaim[];
  runs: TaskRun[];
  canWrite: boolean;
  userId: string;
  onChanged: () => void;
}
const phases: Record<TaskRun['phase'], string> = {
  starting: '正在启动',
  running: '进程运行中',
  cancel_requested: '正在请求取消，等待退出确认',
  cancelled: '进程已取消',
  succeeded: 'CLI执行成功，尚未提交验收',
  failed: 'CLI执行失败',
  unknown: '运行状态未知',
};
async function local<T>(path: string, body?: unknown): Promise<T> {
  const key = await companionKey();
  if (!key) throw new Error('本机伴随服务尚未授权');
  const response = await fetch(`${companionOrigin()}/v1/browser/runners${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', 'x-taskboard-companion-key': key },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? '本机运行请求失败');
  return payload.data as T;
}
export default function AgentRunPanel({ task, claims, runs, canWrite, userId, onChanged }: Props) {
  const [probes, setProbes] = useState<RunnerProbe[]>([]);
  const [runner, setRunner] = useState<RunnerKind>('codex-cli');
  const [permissionMode, setPermissionMode] = useState<'read-only' | 'workspace-write'>(
    'read-only',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [observed, setObserved] = useState<Record<string, TaskRun>>({});
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const pending = useRef<{ signature: string; key: string } | null>(null);
  const available = hasLocalCompanion();
  useEffect(() => {
    let live = true;
    if (!available) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void local<RunnerProbe[]>('/probe')
      .then((value) => {
        if (live) setProbes(value);
      })
      .catch((value: unknown) => {
        if (live) setError(value instanceof Error ? value.message : '能力探测失败');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [available, task.id]);
  const claim = claims.find((value) => !value.releasedAt && value.actorId === userId);
  const capability = probes.find((value) => value.runner === runner);
  const currentRuns = runs.map((value) =>
    observed[value.id] && !value.resolvedAt ? observed[value.id] : value,
  );
  const blocked = currentRuns.some(
    (value) =>
      ['starting', 'running', 'cancel_requested'].includes(value.phase) ||
      (value.phase === 'unknown' && !value.resolvedAt),
  );
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      onChanged();
    } catch (value) {
      setError(value instanceof Error ? value.message : '操作失败；请先查询原运行，不要重复启动');
    } finally {
      setBusy(false);
    }
  }
  async function start(resumeFrom?: string) {
    if (!claim) return;
    const body = {
      taskId: task.id,
      claimId: claim.id,
      runner,
      permissionMode,
      version: task.version,
      ...(resumeFrom ? { resumeFrom } : {}),
    };
    const signature = JSON.stringify(body);
    if (pending.current && pending.current.signature !== signature)
      throw new Error('上次启动尚未确认，请先查询运行记录后重试');
    pending.current ??= { signature, key: crypto.randomUUID() };
    const result = await local<{ run: TaskRun }>('/start', {
      ...body,
      idempotencyKey: pending.current.key,
    });
    pending.current = null;
    setObserved((value) => ({ ...value, [result.run.id]: result.run }));
  }
  return (
    <section className="agent-run-panel" aria-label="Agent本机运行">
      <h3>Agent 本机运行</h3>
      <p>领取取得实施权；启动才创建进程。执行结束后仍需提交成果，由人类验收。</p>
      <p>本机每个仓库只映射一个目录。同目录不能并行运行；团队并行需各设备使用独立目录。</p>
      {!available ? (
        <p role="status">连接本机伴随服务后可启动 Codex CLI 或 Claude Code。</p>
      ) : loading ? (
        <p role="status">正在探测本机运行能力…</p>
      ) : (
        <>
          <label>
            运行器{' '}
            <select
              value={runner}
              onChange={(event) => setRunner(event.target.value as RunnerKind)}
              disabled={busy}
            >
              <option value="codex-cli">Codex CLI</option>
              <option value="claude-code">Claude Code</option>
            </select>
          </label>
          <label>
            权限模式{' '}
            <select
              value={permissionMode}
              onChange={(event) =>
                setPermissionMode(
                  event.target.value === 'workspace-write' ? 'workspace-write' : 'read-only',
                )
              }
              disabled={busy}
            >
              <option value="read-only">只读分析</option>
              <option value="workspace-write">工作区开发</option>
            </select>
          </label>
          <p>
            {permissionMode === 'read-only'
              ? '只分析任务与代码，不允许修改文件。'
              : '明确允许CLI修改映射仓库。Claude测试命令仍受本机白名单限制。'}
          </p>
          <p>
            {capability
              ? `${capability.version ?? capability.state} · ${capability.start.reason}`
              : '运行器状态不可用'}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                setProbes(await local<RunnerProbe[]>('/probe'));
              })
            }
          >
            重新探测能力
          </button>
          <button
            type="button"
            disabled={busy || !canWrite || !claim || blocked || !capability?.start.supported}
            onClick={() => void perform(() => start())}
          >
            启动真实运行
          </button>
          {!claim && <p>请先在当前设备领取任务，再启动运行。</p>}
        </>
      )}
      {currentRuns.length === 0 && <p>尚无运行记录。已领取不代表进程已运行。</p>}
      <ul>
        {currentRuns.map((run) => (
          <li key={run.id}>
            <strong>
              {run.runner} · {phases[run.phase]} ·{' '}
              {run.permissionMode === 'workspace-write' ? '工作区开发' : '只读分析'}
            </strong>
            {run.failureReason && <p>{run.failureReason}</p>}
            {run.resolvedAt && (
              <p>
                运行状态仍未知，已由 {run.resolvedBy} 人工解除阻塞。理由：{run.resolutionReason}
              </p>
            )}
            {available && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    const result = await local<{ run: TaskRun; synchronized: boolean }>(
                      `/${task.id}/${run.id}`,
                    );
                    setObserved((value) => ({ ...value, [run.id]: result.run }));
                    pending.current = null;
                    if (!result.synchronized)
                      setError('本机运行事实尚未同步到服务器；请重试同步或处理版本冲突。');
                  })
                }
              >
                查询运行
              </button>
            )}
            {available && canWrite && run.actorId === userId && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    const result = await local<{ run: TaskRun }>(`/${task.id}/${run.id}/sync`, {});
                    setObserved((value) => ({ ...value, [run.id]: result.run }));
                  })
                }
              >
                同步运行事实
              </button>
            )}
            {available &&
              canWrite &&
              run.actorId === userId &&
              ['starting', 'running', 'cancel_requested'].includes(run.phase) && (
                <button
                  type="button"
                  disabled={
                    busy || !probes.find((value) => value.runner === run.runner)?.cancel.supported
                  }
                  onClick={() =>
                    void perform(async () => {
                      const result = await local<{ run: TaskRun }>(
                        `/${task.id}/${run.id}/cancel`,
                        {},
                      );
                      setObserved((value) => ({ ...value, [run.id]: result.run }));
                    })
                  }
                >
                  请求取消
                </button>
              )}
            {available &&
              claim &&
              canWrite &&
              !blocked &&
              run.externalSessionId &&
              ['succeeded', 'failed', 'cancelled'].includes(run.phase) && (
                <button
                  type="button"
                  disabled={busy || run.runner !== runner || !capability?.resume.supported}
                  onClick={() => void perform(() => start(run.id))}
                >
                  通过原会话续接
                </button>
              )}
            {canWrite && run.phase === 'unknown' && !run.resolvedAt && (
              <div className="agent-run-recovery">
                <label>
                  人工核查说明
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={2000}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  我已在原设备核查旧进程不再运行
                </label>
                <button
                  type="button"
                  disabled={busy || !confirmed || !reason.trim()}
                  onClick={() =>
                    void perform(async () => {
                      await request(`/tasks/${task.id}/runs/${run.id}/resolve`, {
                        method: 'POST',
                        version: task.version,
                        body: { reason, confirmedProcessStopped: true },
                      });
                      setReason('');
                      setConfirmed(false);
                    })
                  }
                >
                  人工解除未知运行阻塞
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
