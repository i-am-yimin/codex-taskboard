import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TakeoverGrant } from '@taskboard/core';
import { request as apiRequest, type RequestOptions } from './api';
import './accountCenter.css';

export type GovernanceTab = 'users' | 'spaces' | 'mail' | 'audit';
type ManagedUser = {
  id: string;
  name: string;
  email: string;
  instanceAdmin: boolean;
  disabled: boolean;
  emailVerified: boolean;
  spaces: { id: string; name: string; role: string }[];
};
type ManagedSpace = {
  id: string;
  name: string;
  owner_id: string;
  owner_name: string;
  member_count: string;
  archived_at: string | null;
};
type Invitation = {
  id: string;
  email: string;
  role: string;
  space_name: string | null;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
};
type MailRow = {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  created_at: string;
  last_error: string | null;
};
type AuditRow = {
  id: string;
  actor_name: string;
  action: string;
  target_id: string;
  reason: string;
  outcome: string;
  created_at: string;
};
type SmtpStatus = {
  configured: boolean;
  locked: boolean;
  keyReady: boolean;
  host?: string;
  port?: number;
  security?: string;
  username?: string;
  fromAddress?: string;
  fromName?: string;
  passwordConfigured?: boolean;
};
const labels: Record<string, string> = {
  pending: '待发送',
  accepted: 'SMTP 已接受',
  failed: '发送失败',
};
const time = (value: string) => new Date(value).toLocaleString();

export function ServerGovernance({
  userId,
  tab,
  onOpenSpace,
}: {
  userId: string;
  tab: GovernanceTab;
  onOpenSpace: (grant: TakeoverGrant) => void;
}) {
  const request = <T,>(path: string, options: RequestOptions = {}) =>
    apiRequest<T>(path, { ...options, expectedIdentity: { origin: location.origin, userId } });
  const client = useQueryClient();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [takeover, setTakeover] = useState<ManagedSpace | null>(null);
  const [transfer, setTransfer] = useState<ManagedSpace | null>(null);
  const users = useQuery({
    queryKey: ['server-users', location.origin, userId, search],
    queryFn: () => request<ManagedUser[]>(`/admin/users?search=${encodeURIComponent(search)}`),
    enabled: tab === 'users' || !!transfer,
    gcTime: 0,
  });
  const invitations = useQuery({
    queryKey: ['server-invitations', location.origin, userId],
    queryFn: () => request<Invitation[]>('/admin/invitations'),
    enabled: tab === 'users',
    gcTime: 0,
  });
  const spaces = useQuery({
    queryKey: ['server-spaces', location.origin, userId],
    queryFn: () => request<ManagedSpace[]>('/admin/spaces'),
    enabled: tab === 'spaces' || tab === 'users',
    gcTime: 0,
  });
  const smtp = useQuery({
    queryKey: ['server-smtp', location.origin, userId],
    queryFn: () => request<SmtpStatus>('/admin/smtp'),
    enabled: tab === 'mail',
    gcTime: 0,
  });
  const mails = useQuery({
    queryKey: ['server-mail', location.origin, userId],
    queryFn: () => request<MailRow[]>('/admin/mail'),
    enabled: tab === 'mail',
    refetchInterval: tab === 'mail' ? 10000 : false,
    gcTime: 0,
  });
  const audit = useQuery({
    queryKey: ['server-audit', location.origin, userId, auditSearch],
    queryFn: () => request<AuditRow[]>(`/admin/audit?action=${encodeURIComponent(auditSearch)}`),
    enabled: tab === 'audit',
    gcTime: 0,
  });
  const run = async (operation: () => Promise<void>, success: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await operation();
      setMessage(success);
      for (const queryKey of [
        ['server-users'],
        ['server-invitations'],
        ['server-spaces'],
        ['server-smtp'],
        ['server-mail'],
        ['server-audit'],
      ])
        await client.invalidateQueries({ queryKey });
    } catch (error) {
      setError(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };
  const submit =
    (operation: (fields: FormData) => Promise<void>, success: string) =>
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fields = new FormData(form);
      void run(async () => {
        await operation(fields);
        form
          .querySelectorAll<HTMLInputElement>('input[type=password]')
          .forEach((input) => (input.value = ''));
      }, success);
    };
  const password = (
    <label className="form-label">
      当前管理员密码
      <input
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        minLength={12}
        maxLength={256}
        required
      />
    </label>
  );
  const reason = (
    <label className="form-label">
      操作原因
      <input name="reason" maxLength={500} required />
    </label>
  );
  const errors = [users, spaces, invitations, smtp, mails, audit]
    .filter((query) => query.isEnabled && query.error)
    .map((query) => (query.error as Error).message);
  return (
    <div className="governance">
      {(error || errors.length > 0) && (
        <p className="form-error" role="alert">
          {error || errors[0]}
        </p>
      )}
      {message && (
        <p className="account-success" role="status">
          {message}
        </p>
      )}
      {tab === 'users' && (
        <>
          <h2>用户与邀请</h2>
          <p className="muted">账号始终通过邀请加入。最高管理员权限独立于空间权限。</p>
          <label className="form-label">
            搜索用户
            <input
              type="search"
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {users.isPending ? (
            <p role="status">正在读取用户…</p>
          ) : (
            <ul className="governance-list">
              {users.data?.map((user) => (
                <li key={user.id}>
                  <div>
                    <strong>{user.name}</strong>
                    <span className="account-status">
                      {user.disabled ? '已停用' : user.instanceAdmin ? '最高管理员' : '用户'}
                    </span>
                    <p>
                      {user.email} · {user.emailVerified ? '已验证' : '待验证'}
                    </p>
                    <p className="muted">
                      {user.spaces.map((space) => `${space.name}（${space.role}）`).join('、') ||
                        '尚未加入空间'}
                    </p>
                  </div>
                  <button className="button ghost" onClick={() => setEditing(user)}>
                    管理
                  </button>
                </li>
              ))}
            </ul>
          )}
          {editing && (
            <section className="account-section">
              <h3>管理 {editing.name}</h3>
              <form
                onSubmit={submit(async (fields) => {
                  await request(`/admin/users/${editing.id}`, {
                    method: 'PATCH',
                    body: {
                      currentPassword: String(fields.get('currentPassword')),
                      reason: String(fields.get('reason')),
                      disabled: fields.get('disabled') === 'true',
                      instanceAdmin: fields.get('instanceAdmin') === 'true',
                    },
                  });
                  setEditing(null);
                }, '账号设置已保存。')}
              >
                <label className="form-label">
                  账号状态
                  <select name="disabled" defaultValue={String(editing.disabled)}>
                    <option value="false">正常</option>
                    <option value="true">停用</option>
                  </select>
                </label>
                <label className="form-label">
                  服务器权限
                  <select name="instanceAdmin" defaultValue={String(editing.instanceAdmin)}>
                    <option value="false">普通用户</option>
                    <option value="true">最高管理员</option>
                  </select>
                </label>
                {reason}
                {password}
                <div className="account-actions">
                  <button className="button primary" disabled={busy}>
                    保存账号设置
                  </button>
                  <button
                    type="button"
                    className="button ghost"
                    disabled={busy}
                    onClick={() => setEditing(null)}
                  >
                    取消
                  </button>
                </div>
              </form>
              <form
                onSubmit={submit(async (fields) => {
                  await request(`/admin/users/${editing.id}/recovery`, {
                    method: 'POST',
                    body: { currentPassword: String(fields.get('currentPassword')) },
                  });
                }, '恢复邮件已加入发送队列。')}
              >
                {password}
                <button className="button ghost" disabled={busy}>
                  发送密码恢复邮件
                </button>
              </form>
            </section>
          )}
          <section className="account-section">
            <h3>邀请新用户</h3>
            <form
              onSubmit={submit(async (fields) => {
                await request('/admin/invitations', {
                  method: 'POST',
                  body: {
                    email: String(fields.get('email')),
                    spaceId: String(fields.get('spaceId')) || null,
                    role: String(fields.get('role')),
                  },
                });
              }, '邀请邮件已加入发送队列。')}
            >
              <label className="form-label">
                受邀邮箱
                <input name="email" type="email" maxLength={254} required />
              </label>
              <label className="form-label">
                加入空间
                <select name="spaceId">
                  <option value="">仅创建账号，暂不加入空间</option>
                  {spaces.data
                    ?.filter((space) => !space.archived_at)
                    .map((space) => (
                      <option key={space.id} value={space.id}>
                        {space.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="form-label">
                空间权限
                <select name="role" defaultValue="editor">
                  <option value="viewer">只读成员</option>
                  <option value="editor">编辑成员</option>
                  <option value="admin">空间管理员</option>
                </select>
              </label>
              <button className="button primary" disabled={busy}>
                发送邀请
              </button>
            </form>
            <ul className="governance-list">
              {invitations.data?.map((invite) => (
                <li key={invite.id}>
                  <div>
                    <strong>{invite.email || '未绑定邮箱的旧邀请'}</strong>
                    <p className="muted">
                      {invite.space_name || '账号邀请'} ·{' '}
                      {invite.used_at
                        ? '已使用'
                        : invite.revoked_at
                          ? '已撤销'
                          : new Date(invite.expires_at) < new Date()
                            ? '已过期'
                            : '待接受'}{' '}
                      · 到期 {time(invite.expires_at)}
                    </p>
                  </div>
                  {!invite.used_at && !invite.revoked_at && (
                    <div className="account-actions">
                      <button
                        className="button ghost"
                        disabled={busy || !invite.email}
                        onClick={() =>
                          run(async () => {
                            await request(`/admin/invitations/${invite.id}/resend`, {
                              method: 'POST',
                            });
                          }, '已生成新邀请，原链接已失效。')
                        }
                      >
                        重发
                      </button>
                      <button
                        className="button ghost"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await request(`/admin/invitations/${invite.id}`, { method: 'DELETE' });
                          }, '邀请已撤销。')
                        }
                      >
                        撤销
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {tab === 'spaces' && (
        <>
          <h2>空间治理</h2>
          <p className="muted">
            此处显示治理信息。进入空间内容前，必须验证密码、填写原因并取得 30 分钟接管授权。
          </p>
          <ul className="governance-list">
            {spaces.data?.map((space) => (
              <li key={space.id}>
                <div>
                  <strong>{space.name}</strong>
                  {space.archived_at && <span className="account-status">已归档</span>}
                  <p className="muted">
                    所有者：{space.owner_name || '未设置'} · {space.member_count} 位成员
                  </p>
                </div>
                <div className="account-actions">
                  <button
                    className="button ghost"
                    onClick={() => {
                      setTakeover(space);
                      setTransfer(null);
                    }}
                  >
                    接管空间
                  </button>
                  <button
                    className="button ghost"
                    onClick={() => {
                      setTransfer(space);
                      setTakeover(null);
                    }}
                  >
                    转移所有权
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {takeover && (
            <section className="account-section">
              <h3>接管 {takeover.name}</h3>
              <form
                onSubmit={submit(async (fields) => {
                  const grant = await request<TakeoverGrant>(
                    `/admin/spaces/${takeover.id}/takeover`,
                    {
                      method: 'POST',
                      body: {
                        currentPassword: String(fields.get('currentPassword')),
                        reason: String(fields.get('reason')),
                      },
                    },
                  );
                  setTakeover(null);
                  onOpenSpace(grant);
                }, '已取得临时接管授权。')}
              >
                {reason}
                {password}
                <div className="account-actions">
                  <button className="button primary" disabled={busy}>
                    接管并打开空间
                  </button>
                  <button type="button" className="button ghost" onClick={() => setTakeover(null)}>
                    取消
                  </button>
                </div>
              </form>
            </section>
          )}
          {transfer && (
            <section className="account-section">
              <h3>转移 {transfer.name} 的所有权</h3>
              <p className="muted">
                此操作会先建立接管授权，再将所有权转交给所选的当前有效空间成员。
              </p>
              <form
                onSubmit={submit(async (fields) => {
                  const body = {
                    currentPassword: String(fields.get('currentPassword')),
                    reason: String(fields.get('reason')),
                  };
                  await request(`/admin/spaces/${transfer.id}/takeover`, { method: 'POST', body });
                  await request(`/admin/spaces/${transfer.id}/transfer-owner`, {
                    method: 'POST',
                    body: { ...body, userId: String(fields.get('userId')) },
                  });
                  await request(`/admin/spaces/${transfer.id}/takeover`, { method: 'DELETE' });
                  setTransfer(null);
                }, '空间所有权已转移。')}
              >
                <label className="form-label">
                  新所有者
                  <select name="userId" required>
                    <option value="">选择当前有效成员</option>
                    {users.data
                      ?.filter(
                        (user) =>
                          !user.disabled &&
                          user.id !== transfer.owner_id &&
                          user.spaces.some((space) => space.id === transfer.id),
                      )
                      .map((user) => (
                        <option value={user.id} key={user.id}>
                          {user.name}（{user.email}）
                        </option>
                      ))}
                  </select>
                </label>
                {reason}
                {password}
                <div className="account-actions">
                  <button className="button primary" disabled={busy}>
                    确认转移所有权
                  </button>
                  <button type="button" className="button ghost" onClick={() => setTransfer(null)}>
                    取消
                  </button>
                </div>
              </form>
            </section>
          )}
        </>
      )}
      {tab === 'mail' && (
        <>
          <h2>邮件服务</h2>
          <p className="muted">
            用于邀请、邮箱验证和密码恢复。状态“SMTP 已接受”表示邮件服务器已接受，不保证进入收件箱。
          </p>
          {smtp.data && !smtp.data.keyReady && (
            <p className="form-error" role="alert">
              邮件加密密钥尚未配置。请按部署说明配置后再保存 SMTP。
            </p>
          )}
          {smtp.data && (
            <>
              <p role="status">
                {smtp.data.configured ? '已配置' : '尚未配置'}
                {smtp.data.locked ? ' · 由部署环境变量锁定' : ''}
                {smtp.data.passwordConfigured ? ' · 已保存 SMTP 密码' : ''}
              </p>
              <form
                key={JSON.stringify(smtp.data)}
                onSubmit={submit(async (fields) => {
                  await request('/admin/smtp', {
                    method: 'PUT',
                    body: {
                      host: String(fields.get('host')),
                      port: Number(fields.get('port')),
                      security: String(fields.get('security')),
                      username: String(fields.get('username')),
                      password: String(fields.get('password')),
                      clearPassword: fields.get('clearPassword') === 'on',
                      fromAddress: String(fields.get('fromAddress')),
                      fromName: String(fields.get('fromName')),
                      currentPassword: String(fields.get('currentPassword')),
                    },
                  });
                }, 'SMTP 配置已保存。')}
              >
                <fieldset
                  disabled={busy || smtp.data.locked || !smtp.data.keyReady}
                  className="governance-fields"
                >
                  <label className="form-label">
                    SMTP 主机
                    <input name="host" defaultValue={smtp.data.host} maxLength={253} required />
                  </label>
                  <div className="account-contact-row">
                    <label className="form-label">
                      端口
                      <input
                        name="port"
                        type="number"
                        min={1}
                        max={65535}
                        defaultValue={smtp.data.port ?? 587}
                        required
                      />
                    </label>
                    <label className="form-label">
                      传输加密
                      <select name="security" defaultValue={smtp.data.security ?? 'starttls'}>
                        <option value="starttls">STARTTLS</option>
                        <option value="tls">TLS</option>
                      </select>
                    </label>
                  </div>
                  <label className="form-label">
                    SMTP 用户名
                    <input
                      name="username"
                      maxLength={254}
                      defaultValue={smtp.data.username}
                      autoComplete="off"
                    />
                  </label>
                  <label className="form-label">
                    替换 SMTP 密码
                    <input
                      name="password"
                      type="password"
                      maxLength={1024}
                      autoComplete="new-password"
                      placeholder="留空保留现有密码"
                    />
                  </label>
                  <label>
                    <input type="checkbox" name="clearPassword" /> 清除已保存的 SMTP 密码
                  </label>
                  <label className="form-label">
                    发件人邮箱
                    <input
                      name="fromAddress"
                      type="email"
                      defaultValue={smtp.data.fromAddress}
                      maxLength={254}
                      required
                    />
                  </label>
                  <label className="form-label">
                    发件人名称
                    <input
                      name="fromName"
                      maxLength={80}
                      defaultValue={smtp.data.fromName ?? 'Taskboard'}
                    />
                  </label>
                  {password}
                  <button className="button primary">保存 SMTP 配置</button>
                </fieldset>
              </form>
              <form
                onSubmit={submit(async (fields) => {
                  await request('/admin/smtp/test', {
                    method: 'POST',
                    body: { currentPassword: String(fields.get('currentPassword')) },
                  });
                }, '测试邮件已加入发送队列，将发送到当前管理员邮箱。')}
              >
                {password}
                <button
                  className="button ghost"
                  disabled={busy || !smtp.data.configured || !smtp.data.keyReady}
                >
                  发送测试邮件
                </button>
              </form>
            </>
          )}
          <section className="account-section">
            <h3>最近邮件</h3>
            <ul className="governance-list">
              {mails.data?.length ? (
                mails.data.map((mail) => (
                  <li key={mail.id}>
                    <div>
                      <strong>{mail.kind}</strong>
                      <p>
                        {labels[mail.status] ?? mail.status} · 已尝试 {mail.attempts} 次
                      </p>
                      <p className="muted">
                        {time(mail.created_at)}
                        {mail.last_error ? ' · 请检查 SMTP 配置或稍后重试' : ''}
                      </p>
                    </div>
                    {mail.status === 'failed' && (
                      <button
                        className="button ghost"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await request(`/admin/mail/${mail.id}/retry`, { method: 'POST' });
                          }, '邮件已重新加入队列。已过期的验证链接需要重新申请。')
                        }
                      >
                        重试
                      </button>
                    )}
                  </li>
                ))
              ) : (
                <li>暂无发送记录。</li>
              )}
            </ul>
          </section>
        </>
      )}
      {tab === 'audit' && (
        <>
          <h2>审计日志</h2>
          <p className="muted">最近 200 条治理记录。日志不包含密码、令牌或联系方式正文。</p>
          <label className="form-label">
            按动作筛选
            <input
              type="search"
              value={auditSearch}
              maxLength={100}
              onChange={(event) => setAuditSearch(event.target.value)}
              placeholder="例如 takeover、password、smtp"
            />
          </label>
          <ul className="governance-list">
            {audit.data?.length ? (
              audit.data.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{row.action}</strong>
                    <p>
                      {row.actor_name || '系统'} ·{' '}
                      {row.outcome === 'success' ? '成功' : row.outcome} · {time(row.created_at)}
                    </p>
                    <p className="muted">
                      目标：{row.target_id || '—'}
                      {row.reason ? ` · ${row.reason}` : ''}
                    </p>
                  </div>
                </li>
              ))
            ) : (
              <li>暂无匹配的审计记录。</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
