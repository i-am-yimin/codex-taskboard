import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { GitBranch, Plus, X } from 'lucide-react';
import { automationConfigSchema, type AutomationRule, type WorkflowMetrics } from '@taskboard/core';
import type { Board } from './types';
import { request } from './api';

const names = {
  dependency_reminder: '依赖完成提醒',
  overdue: '到期提醒',
  review_wait: '验收等待提醒',
  recurring: '固定间隔任务',
};
const localDateTime = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const duration = (seconds: number) =>
  seconds < 60
    ? `${Math.round(seconds)} 秒`
    : seconds < 3600
      ? `${Math.round(seconds / 60)} 分钟`
      : `${(seconds / 3600).toFixed(1)} 小时`;
export function AutomationPanel({
  userId,
  open,
  onClose,
  board,
  offline,
  demo,
  onChanged,
}: {
  userId: string;
  open: boolean;
  onClose: () => void;
  board: Board;
  offline: boolean;
  demo: boolean;
  onChanged: () => void;
}) {
  const admin = ['owner', 'admin'].includes(board.space.role) && !board.space.archived;
  const [editing, setEditing] = useState<AutomationRule | null | undefined>(undefined);
  const [type, setType] = useState<AutomationRule['type']>('dependency_reminder');
  const [threshold, setThreshold] = useState(60);
  const [intervalHours, setIntervalHours] = useState(24);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [acceptance, setAcceptance] = useState('');
  const [assignee, setAssignee] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [start, setStart] = useState(localDateTime(new Date().toISOString()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [rangeDraft, setRangeDraft] = useState({ from: '', to: '' });
  const rules = useQuery({
    queryKey: ['automation-rules', userId, board.space.id],
    enabled: open && !offline && !demo,
    queryFn: async () => {
      const value = await request<AutomationRule[]>(`/spaces/${board.space.id}/automation-rules`);
      if (!Array.isArray(value)) throw new Error('服务器未提供兼容的自动化规则接口');
      return value;
    },
    refetchInterval: open && !offline && !demo ? 15000 : false,
  });
  const metrics = useQuery({
    queryKey: ['workflow-metrics', userId, board.space.id, range],
    enabled: open && !offline && !demo,
    queryFn: async () => {
      const query = new URLSearchParams();
      if (range.from) query.set('from', new Date(range.from).toISOString());
      if (range.to) query.set('to', new Date(range.to).toISOString());
      const value = await request<WorkflowMetrics>(
        `/spaces/${board.space.id}/workflow-metrics${query.size ? `?${query}` : ''}`,
      );
      if (
        !value ||
        !Array.isArray(value.items) ||
        typeof value.from !== 'string' ||
        typeof value.to !== 'string'
      )
        throw new Error('服务器未提供兼容的统计接口');
      return value;
    },
    refetchInterval: open && !offline && !demo ? 30000 : false,
  });
  const select = (rule: AutomationRule | null) => {
    setEditing(rule);
    setError('');
    setMessage('');
    setType(rule?.type ?? 'dependency_reminder');
    setEnabled(rule?.enabled ?? true);
    setTimezone(rule?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    setStart(localDateTime(rule?.nextRunAt ?? new Date().toISOString()));
    setThreshold(
      rule?.type === 'overdue' || rule?.type === 'review_wait' ? rule.config.thresholdMinutes : 60,
    );
    setIntervalHours(rule?.type === 'recurring' ? rule.config.intervalHours : 24);
    setTitle(rule?.type === 'recurring' ? rule.config.title : '');
    setDescription(rule?.type === 'recurring' ? rule.config.description : '');
    setAcceptance(rule?.type === 'recurring' ? rule.config.acceptanceCriteria : '');
    setAssignee(rule?.type === 'recurring' ? (rule.config.assigneeId ?? '') : '');
    setReviewer(rule?.type === 'recurring' ? (rule.config.reviewerId ?? '') : '');
  };
  const save = async () => {
    if (!admin || offline || demo || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const parsed = automationConfigSchema.safeParse(
        type === 'recurring'
          ? {
              type,
              config: {
                title,
                description,
                acceptanceCriteria: acceptance,
                assigneeId: assignee || null,
                reviewerId: reviewer || null,
                intervalHours,
              },
            }
          : type === 'dependency_reminder'
            ? { type, config: {} }
            : { type, config: { thresholdMinutes: threshold } },
      );
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .map((issue) => `${issue.path.join('.')}：${issue.message}`)
            .join('；'),
        );
      if (!start || !Number.isFinite(Date.parse(start))) throw new Error('请选择有效起始时刻');
      new Intl.DateTimeFormat('zh-CN', { timeZone: timezone }).format();
      await request(
        `/spaces/${board.space.id}/automation-rules${editing ? `/${editing.id}` : ''}`,
        {
          method: editing ? 'PATCH' : 'POST',
          version: editing?.version,
          body: { ...parsed.data, enabled, timezone, nextRunAt: new Date(start).toISOString() },
        },
      );
      setMessage(editing ? '规则已保存' : '规则已创建；实际执行结果会由服务器生成');
      setEditing(undefined);
      await rules.refetch();
      await metrics.refetch();
      onChanged();
    } catch (error) {
      setError(error instanceof Error ? error.message : '规则保存失败');
    } finally {
      setBusy(false);
    }
  };
  const stale =
    editing && rules.data?.find((rule) => rule.id === editing.id)?.version !== editing.version;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="workflow-backdrop motion-scrim" />
        <Dialog.Content
          className="workflow-sheet workflow-sheet--wide motion-drawer"
          aria-describedby="automation-description"
        >
          <header className="workflow-header">
            <div>
              <Dialog.Title>
                <GitBranch size={22} />
                规则与统计
              </Dialog.Title>
              <Dialog.Description id="automation-description">
                {board.space.name} ·{' '}
                {admin
                  ? '管理员可配置，服务器执行并保留触发记录。'
                  : '只读查看；规则由空间管理员配置。'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="关闭规则与统计">
                <X />
              </button>
            </Dialog.Close>
          </header>
          <div className="workflow-body">
            {(offline || demo) && (
              <p className="workflow-warning">
                {demo
                  ? '演示模式不创建真实规则或展示模拟统计。'
                  : '离线显示本窗口已读取的数据，不能确认当前权限；配置操作已暂停。'}
              </p>
            )}
            <section className="automation-section">
              <div className="section-heading">
                <h2>空间规则</h2>
                <div className="workflow-actions">
                  <button
                    className="button ghost"
                    disabled={offline || demo || rules.isFetching}
                    onClick={() => rules.refetch()}
                  >
                    刷新规则
                  </button>
                  {admin && (
                    <button
                      className="button primary"
                      disabled={offline || demo || busy}
                      onClick={() => select(null)}
                    >
                      <Plus size={16} />
                      新建规则
                    </button>
                  )}
                </div>
              </div>
              {rules.isPending && !offline && !demo && <p role="status">正在读取规则…</p>}
              {rules.error && (
                <p className="form-error" role="alert">
                  读取失败：{rules.error.message}
                  <button
                    className="text-button"
                    disabled={offline}
                    onClick={() => rules.refetch()}
                  >
                    重试规则
                  </button>
                </p>
              )}
              {rules.data?.length === 0 && (
                <div className="workflow-empty">
                  <h3>还没有空间规则</h3>
                  <p>可按依赖、到期、验收等待设置提醒，或按固定小时间隔生成任务。</p>
                </div>
              )}
              <div className="automation-layout">
                <div className="rule-list">
                  {(rules.data ?? []).map((rule) => (
                    <article className="rule-item" key={rule.id}>
                      <div className="section-heading">
                        <h3>{names[rule.type]}</h3>
                        <span className="rule-state">{rule.enabled ? '已启用' : '已停用'}</span>
                      </div>
                      {rule.type === 'recurring' ? (
                        <>
                          <strong>{rule.config.title}</strong>
                          <p>
                            固定每 {rule.config.intervalHours}{' '}
                            小时；不会按本地每日时刻或夏令时自动对齐。
                          </p>
                        </>
                      ) : rule.type === 'dependency_reminder' ? (
                        <p>前置任务完成后提醒下游负责人；同一完成版本只触发一次。</p>
                      ) : (
                        <p>
                          {rule.type === 'overdue' ? '到期后' : '等待验收达到'}{' '}
                          {rule.config.thresholdMinutes} 分钟提醒。
                        </p>
                      )}
                      <p className="muted">
                        下次检查 / 执行：
                        <time dateTime={rule.nextRunAt}>
                          {new Date(rule.nextRunAt).toLocaleString()}
                        </time>
                        <br />
                        时区标注：{rule.timezone} · v{rule.version}
                      </p>
                      {rule.lastError && (
                        <p className="form-error">上次执行未完成：{rule.lastError}</p>
                      )}
                      {admin && (
                        <div className="workflow-actions">
                          <button
                            className="button ghost"
                            disabled={offline || demo || busy}
                            onClick={() => select(rule)}
                          >
                            编辑规则
                          </button>
                          <button
                            className="text-button"
                            disabled={offline || demo || busy}
                            onClick={async () => {
                              setBusy(true);
                              setError('');
                              try {
                                await request(
                                  `/spaces/${board.space.id}/automation-rules/${rule.id}`,
                                  {
                                    method: 'PATCH',
                                    version: rule.version,
                                    body: { enabled: !rule.enabled },
                                  },
                                );
                                await rules.refetch();
                              } catch (error) {
                                setError(error instanceof Error ? error.message : '更新规则失败');
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            {rule.enabled ? '停用规则' : '启用规则'}
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                {editing !== undefined && admin && (
                  <form
                    className="rule-editor"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void save();
                    }}
                  >
                    <h3>{editing ? '编辑规则' : '新建规则'}</h3>
                    {stale && (
                      <p className="workflow-warning">
                        服务器规则已更新，当前表单仍保留。
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            const latest = rules.data?.find((rule) => rule.id === editing?.id);
                            if (latest) select(latest);
                          }}
                        >
                          放弃本地修改，载入最新规则
                        </button>
                      </p>
                    )}
                    <label>
                      规则类型
                      <select
                        value={type}
                        disabled={busy || offline}
                        onChange={(event) => setType(event.target.value as typeof type)}
                      >
                        {Object.entries(names).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {type === 'overdue' || type === 'review_wait' ? (
                      <label>
                        阈值（分钟）
                        <input
                          type="number"
                          min={type === 'overdue' ? 0 : 1}
                          max={525600}
                          value={threshold}
                          disabled={busy || offline}
                          onChange={(event) => setThreshold(Number(event.target.value))}
                        />
                      </label>
                    ) : null}
                    {type === 'recurring' && (
                      <>
                        <label>
                          固定间隔（小时）
                          <input
                            type="number"
                            min={1}
                            max={8760}
                            value={intervalHours}
                            disabled={busy || offline}
                            onChange={(event) => setIntervalHours(Number(event.target.value))}
                          />
                        </label>
                        <p className="muted">
                          从起始时刻按绝对小时推进，非每日定时计划；服务中断后不会无限补建历史任务。
                        </p>
                        <label>
                          任务标题模板
                          <input
                            required
                            maxLength={240}
                            value={title}
                            disabled={busy || offline}
                            onChange={(event) => setTitle(event.target.value)}
                          />
                        </label>
                        <label>
                          描述模板
                          <textarea
                            value={description}
                            disabled={busy || offline}
                            onChange={(event) => setDescription(event.target.value)}
                          />
                        </label>
                        <label>
                          验收条件模板
                          <textarea
                            value={acceptance}
                            disabled={busy || offline}
                            onChange={(event) => setAcceptance(event.target.value)}
                          />
                        </label>
                        <label>
                          模板总负责人
                          <select
                            value={assignee}
                            disabled={busy || offline}
                            onChange={(event) => setAssignee(event.target.value)}
                          >
                            <option value="">使用规则创建者</option>
                            {board.members
                              .filter((member) => member.role !== 'viewer')
                              .map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          模板验收人
                          <select
                            value={reviewer}
                            disabled={busy || offline}
                            onChange={(event) => setReviewer(event.target.value)}
                          >
                            <option value="">稍后补派（不能直接提交验收）</option>
                            {board.members
                              .filter((member) => member.role !== 'viewer')
                              .map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      </>
                    )}
                    <label>
                      起始时刻（本机本地时间）
                      <input
                        required
                        type="datetime-local"
                        value={start}
                        disabled={busy || offline}
                        onChange={(event) => setStart(event.target.value)}
                      />
                    </label>
                    <label>
                      时区标注
                      <input
                        required
                        value={timezone}
                        disabled={busy || offline}
                        onChange={(event) => setTimezone(event.target.value)}
                        placeholder="Asia/Shanghai"
                      />
                    </label>
                    <label className="check-item">
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={busy || offline}
                        onChange={(event) => setEnabled(event.target.checked)}
                      />
                      启用此规则
                    </label>
                    <div className="workflow-actions">
                      <button
                        className="button primary"
                        type="submit"
                        disabled={busy || offline || !!stale}
                      >
                        {busy ? '正在保存…' : '保存规则'}
                      </button>
                      <button
                        className="button ghost"
                        type="button"
                        onClick={() => setEditing(undefined)}
                      >
                        保留现有规则并关闭编辑
                      </button>
                    </div>
                  </form>
                )}
              </div>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              {message && <p role="status">{message}</p>}
            </section>
            <section className="automation-section">
              <h2>工作流耗时</h2>
              <form
                className="workflow-toolbar"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (JSON.stringify(range) === JSON.stringify(rangeDraft)) void metrics.refetch();
                  else setRange(rangeDraft);
                }}
              >
                <label>
                  起始时间（本机本地时间）
                  <input
                    type="datetime-local"
                    value={rangeDraft.from}
                    onChange={(event) => setRangeDraft({ ...rangeDraft, from: event.target.value })}
                  />
                </label>
                <label>
                  结束时间（本机本地时间）
                  <input
                    type="datetime-local"
                    value={rangeDraft.to}
                    onChange={(event) => setRangeDraft({ ...rangeDraft, to: event.target.value })}
                  />
                </label>
                <button className="button ghost" disabled={offline || demo || metrics.isFetching}>
                  查询统计
                </button>
              </form>
              {metrics.isPending && !offline && !demo && <p role="status">正在读取真实区间统计…</p>}
              {metrics.error && (
                <p className="form-error" role="alert">
                  统计读取失败：{metrics.error.message}
                  <button
                    className="text-button"
                    disabled={offline}
                    onClick={() => metrics.refetch()}
                  >
                    重试统计
                  </button>
                </p>
              )}
              {metrics.data && (
                <>
                  <p className="muted">
                    {new Date(metrics.data.from).toLocaleString()} 至{' '}
                    {new Date(metrics.data.to).toLocaleString()} · 来源时间轴{' '}
                    {metrics.data.timezone}，上方按本机时区显示。最多查询一年。
                  </p>
                  {metrics.data.items.length === 0 ? (
                    <div className="workflow-empty">
                      <h3>此范围没有可精确计时的样本</h3>
                      <p>开始记录阻塞或等待验收区间后，统计会显示真实耗时。</p>
                    </div>
                  ) : (
                    <div className="metrics-scroll">
                      <table className="workflow-metrics">
                        <thead>
                          <tr>
                            <th>区间</th>
                            <th>样本数</th>
                            <th>累计耗时</th>
                            <th>样本中仍未结束</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.data.items.map((item) => (
                            <tr key={item.kind}>
                              <th>{item.kind === 'blocked' ? '阻塞' : '等待验收'}</th>
                              <td>{item.sampleCount}</td>
                              <td>{duration(item.totalSeconds)}</td>
                              <td>{item.currentCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="muted">
                    历史起点不明的 {metrics.data.legacyUnknownCount}{' '}
                    个区间已排除耗时计算，不能据此反推过去的完整工作量。
                  </p>
                </>
              )}
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
