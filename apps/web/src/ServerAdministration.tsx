import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Database, LoaderCircle, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { api, ApiError, request } from './api';
import type { User } from './types';
import './serverAdministration.css';

const failure = (error: unknown) => (error instanceof Error ? error.message : '操作未完成，请重试');

export function ServerSetupGate({ children }: { children: ReactNode }) {
  const setup = useQuery({
    queryKey: ['server-setup'],
    queryFn: () => request<{ required: boolean }>('/setup'),
  });
  if (setup.isPending)
    return (
      <main className="server-loading" role="status">
        <LoaderCircle className="spin" />
        正在检查服务器…
      </main>
    );
  // Older servers and offline clients retain their existing login experience.
  if (!setup.data?.required) return children;
  return <FirstRunSetup />;
}

function FirstRunSetup() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    if (fields.get('password') !== fields.get('confirmPassword'))
      return setError('两次输入的密码不一致');
    setBusy(true);
    setError('');
    const email = String(fields.get('email'));
    const password = String(fields.get('password'));
    try {
      await request('/setup', {
        method: 'POST',
        body: {
          token: String(fields.get('token')),
          name: String(fields.get('name')),
          email,
          password,
          publicOrigin: String(fields.get('publicOrigin')),
        },
      });
      setInitialized(true);
      await api.login({ email, password, deviceName: '管理员浏览器' });
      location.reload();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ALREADY_INITIALIZED') setInitialized(true);
      setError(failure(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="server-first-run">
      <div className="server-setup-intro">
        <ShieldCheck size={32} aria-hidden="true" />
        <h1>设置你的 Taskboard</h1>
        <p>创建首个管理员，即可开始管理任务空间。</p>
        <dl className="server-facts">
          <div>
            <dt>数据库</dt>
            <dd>自动初始化</dd>
          </div>
          <div>
            <dt>数据库密码与会话密钥</dt>
            <dd>自动生成并持久保存</dd>
          </div>
          <div>
            <dt>后续管理</dt>
            <dd>登录后查看运行状态、设置和日志</dd>
          </div>
        </dl>
        <p className="muted">在服务器运行以下命令，复制启动日志中的初始化口令：</p>
        <code className="server-command">docker compose logs app</code>
        <p className="muted">口令仅用于创建首个管理员，完成后初始化入口会关闭。</p>
      </div>
      <section className="server-setup-form" aria-label="初始化管理员">
        {initialized ? (
          <>
            <h2>管理员已创建</h2>
            <p>请使用刚设置的邮箱和密码登录。</p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" onClick={() => location.reload()}>
              前往登录
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <label className="form-label">
              初始化口令
              <input name="token" type="password" autoComplete="off" required />
            </label>
            <label className="form-label">
              管理员名称
              <input name="name" autoComplete="name" maxLength={80} required />
            </label>
            <label className="form-label">
              管理员邮箱
              <input name="email" type="email" autoComplete="username" maxLength={254} required />
            </label>
            <label className="form-label">
              密码
              <input
                name="password"
                aria-label="密码"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                required
              />
              <span className="muted">至少 12 个字符</span>
            </label>
            <label className="form-label">
              确认密码
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                required
              />
            </label>
            <label className="form-label">
              对外访问地址
              <input
                name="publicOrigin"
                aria-label="对外访问地址"
                type="url"
                defaultValue={location.origin}
                required
              />
              <span className="muted">
                填写 OpenResty 的 HTTPS 根地址，不带 /api/v1。本机测试可用 HTTP。
              </span>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary wide" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={16} />}创建管理员并登录
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

type InstanceInfo = {
  publicOrigin: string | null;
  logLevel: string;
  originLocked: boolean;
  version: string;
  uptimeSeconds: number;
  sessionKeyConfigured: boolean;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    managed: boolean;
    passwordConfigured: boolean;
    status: string;
  };
};
type LogEntry = { time: string; level: string; message: string };
type RevealedSecrets = { databasePassword: string | null; sessionKey: string };
type Tab = 'overview' | 'account' | 'secrets' | 'logs';

export function ServerAdministration({ user, onClose }: { user: User; onClose: () => void }) {
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const info = useQuery({
    queryKey: ['server-instance'],
    queryFn: () => request<InstanceInfo>('/admin/instance'),
  });
  const logs = useQuery({
    queryKey: ['server-logs'],
    queryFn: () => request<{ entries: LogEntry[] }>('/admin/logs'),
    enabled: tab === 'logs',
    refetchInterval: tab === 'logs' ? 10000 : false,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState<RevealedSecrets | null>(null);
  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => setRevealed(null), 60000);
    const hide = () => {
      if (document.hidden) setRevealed(null);
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [revealed]);
  const action = async (run: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await run();
    } catch (error) {
      setError(failure(error));
    } finally {
      setBusy(false);
    }
  };
  const tabs: [Tab, string][] = [
    ['overview', '运行与设置'],
    ['account', '管理员账号'],
    ['secrets', '数据库与密钥'],
    ['logs', '运行日志'],
  ];
  const data = info.data;
  return (
    <main className="server-admin">
      <header className="server-admin-header">
        <button className="button ghost" onClick={onClose}>
          <ArrowLeft size={16} />
          返回看板
        </button>
        <div>
          <Server size={20} aria-hidden="true" />
          <h1>服务器管理</h1>
        </div>
        <span className="muted">{user.name}</span>
      </header>
      <div className="server-admin-layout">
        <nav className="server-admin-nav" aria-label="服务器管理分类">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => {
                setTab(key);
                setError('');
                setMessage('');
                setRevealed(null);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <section
          className="server-admin-content"
          aria-label={tabs.find(([key]) => key === tab)?.[1]}
        >
          {(error || info.error) && (
            <p className="form-error" role="alert">
              {error || failure(info.error)}
            </p>
          )}
          {message && (
            <p className="server-success" role="status">
              {message}
            </p>
          )}
          {info.isPending && <p role="status">正在读取服务器状态…</p>}
          {data && tab === 'overview' && (
            <>
              <h2>运行与设置</h2>
              <dl className="server-facts">
                <div>
                  <dt>数据库连接</dt>
                  <dd>{data.database.status === 'ok' ? '正常' : '异常'}</dd>
                </div>
                <div>
                  <dt>应用版本</dt>
                  <dd>{data.version}</dd>
                </div>
                <div>
                  <dt>本次连续运行</dt>
                  <dd>{Math.floor(data.uptimeSeconds / 60)} 分钟</dd>
                </div>
              </dl>
              <form
                key={`${data.publicOrigin}-${data.logLevel}`}
                onSubmit={(event) => {
                  event.preventDefault();
                  const fields = new FormData(event.currentTarget);
                  void action(async () => {
                    await request('/admin/instance', {
                      method: 'PATCH',
                      body: {
                        publicOrigin: String(fields.get('publicOrigin')),
                        logLevel: String(fields.get('logLevel')),
                      },
                    });
                    await info.refetch();
                    setMessage('服务器设置已保存。访问地址变更后，请从新地址登录。');
                  });
                }}
              >
                <label className="form-label">
                  对外访问地址
                  <input
                    name="publicOrigin"
                    aria-label="对外访问地址"
                    type="url"
                    defaultValue={data.publicOrigin ?? location.origin}
                    readOnly={data.originLocked}
                    required
                  />
                  <span className="muted">
                    {data.originLocked
                      ? '由部署环境的 PUBLIC_ORIGIN 固定。'
                      : '与 OpenResty 的 HTTPS 域名保持一致。'}
                  </span>
                </label>
                <label className="form-label">
                  日志级别
                  <select name="logLevel" defaultValue={data.logLevel}>
                    <option value="debug">Debug · 调试</option>
                    <option value="info">Info · 常规</option>
                    <option value="warn">Warn · 警告</option>
                    <option value="error">Error · 错误</option>
                  </select>
                </label>
                <button className="button primary" disabled={busy}>
                  保存服务器设置
                </button>
              </form>
            </>
          )}
          {data && tab === 'account' && (
            <>
              <h2>管理员账号</h2>
              <p className="muted">
                修改账号前需要验证当前密码。更换密码会退出其他设备并撤销 Agent 令牌。
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const fields = new FormData(form);
                  void action(async () => {
                    await request('/admin/account', {
                      method: 'PATCH',
                      body: {
                        name: String(fields.get('name')),
                        email: String(fields.get('email')),
                        currentPassword: String(fields.get('currentPassword')),
                        ...(fields.get('newPassword')
                          ? { newPassword: String(fields.get('newPassword')) }
                          : {}),
                      },
                    });
                    form.reset();
                    await client.invalidateQueries({ queryKey: ['me'] });
                    setMessage('管理员账号已更新。');
                  });
                }}
              >
                <label className="form-label">
                  名称
                  <input name="name" defaultValue={user.name} maxLength={80} required />
                </label>
                <label className="form-label">
                  邮箱
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    defaultValue={user.email}
                    maxLength={254}
                    required
                  />
                </label>
                <label className="form-label">
                  当前密码
                  <input
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    minLength={12}
                    maxLength={256}
                    required
                  />
                </label>
                <label className="form-label">
                  新密码（可选）
                  <input
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={256}
                  />
                  <span className="muted">留空则保留当前密码。</span>
                </label>
                <button className="button primary" disabled={busy}>
                  保存管理员账号
                </button>
              </form>
            </>
          )}
          {data && tab === 'secrets' && (
            <>
              <h2>
                <Database size={22} aria-hidden="true" />
                数据库与密钥
              </h2>
              <dl className="server-facts">
                <div>
                  <dt>数据库地址</dt>
                  <dd>
                    {data.database.host}:{data.database.port}
                  </dd>
                </div>
                <div>
                  <dt>数据库 / 用户</dt>
                  <dd>
                    {data.database.name} / {data.database.user}
                  </dd>
                </div>
                <div>
                  <dt>数据库密码</dt>
                  <dd>{data.database.passwordConfigured ? '已配置 · 默认隐藏' : '未配置'}</dd>
                </div>
                <div>
                  <dt>会话密钥</dt>
                  <dd>{data.sessionKeyConfigured ? '已配置 · 默认隐藏' : '未配置'}</dd>
                </div>
              </dl>
              <p className="muted">
                {data.database.managed
                  ? '密码和密钥由容器自动生成，保存在 taskboard-state 卷中，重启后继续使用。'
                  : '连接配置来自部署环境。'}
                数据库连接与密钥在此只读，备份时需要同时保存数据库和部署密钥。
              </p>
              {revealed ? (
                <div className="server-secret-values">
                  <label className="form-label">
                    数据库密码
                    <input
                      readOnly
                      value={revealed.databasePassword ?? '未提供'}
                      aria-label="数据库密码明文"
                    />
                  </label>
                  <label className="form-label">
                    会话密钥
                    <input readOnly value={revealed.sessionKey} aria-label="会话密钥明文" />
                  </label>
                  <p className="muted">60 秒后自动隐藏；切换页面或离开浏览器标签页也会隐藏。</p>
                  <button className="button ghost" onClick={() => setRevealed(null)}>
                    立即隐藏
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const password = String(new FormData(form).get('currentPassword'));
                    form.reset();
                    void action(async () => {
                      setRevealed(
                        await request<RevealedSecrets>('/admin/secrets/reveal', {
                          method: 'POST',
                          body: { currentPassword: password },
                        }),
                      );
                    });
                  }}
                >
                  <label className="form-label">
                    验证管理员密码以查看
                    <input
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      minLength={12}
                      maxLength={256}
                      required
                    />
                  </label>
                  <button className="button primary" disabled={busy}>
                    验证并显示密钥
                  </button>
                </form>
              )}
            </>
          )}
          {tab === 'logs' && (
            <>
              <div className="server-log-heading">
                <h2>运行日志</h2>
                <button
                  className="button ghost"
                  disabled={logs.isFetching}
                  onClick={() => void logs.refetch()}
                >
                  <RefreshCw size={16} />
                  刷新
                </button>
              </div>
              <p className="muted">
                展示本次启动的最近 200 条日志，每 10 秒更新。历史输出由 Docker 轮转保留。
              </p>
              {logs.error && (
                <p className="form-error" role="alert">
                  {failure(logs.error)}
                </p>
              )}
              <div className="server-log-list" role="log" aria-label="应用运行日志" aria-live="off">
                {logs.isPending ? (
                  <p>正在读取日志…</p>
                ) : logs.data?.entries.length ? (
                  logs.data.entries.map((entry, index) => (
                    <div className="server-log-line" key={`${entry.time}-${index}`}>
                      <time dateTime={entry.time}>{new Date(entry.time).toLocaleString()}</time>
                      <b>{entry.level.toUpperCase()}</b>
                      <span>{entry.message}</span>
                    </div>
                  ))
                ) : (
                  <p>当前日志级别下暂无记录。发生请求或运行事件后会显示在这里。</p>
                )}
              </div>
              <code className="server-command">docker compose logs --tail=200 app</code>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
