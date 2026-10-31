import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useContext,
  useId,
  createContext,
  type ReactNode,
  type FormEvent,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowLeft,
  Check,
  LoaderCircle,
  LogOut,
  Monitor,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { AccountProfile, PublicProfile, User, Contacts } from '@taskboard/core';
import { MAX_AVATAR_BYTES } from '@taskboard/core';
import {
  accountServerIdentity,
  api,
  ApiError,
  avatarRequest,
  request,
  companionKey,
  companionOrigin,
  hasLocalCompanion,
  type AccountIdentity,
  type RequestOptions,
} from './api';
import { AppearanceSettings } from './AppearanceSettings';
import type { AppearanceController } from './useAppearance';
import './accountCenter.css';

const failure = (error: unknown) => (error instanceof Error ? error.message : '操作失败，请重试');
const DirtyForms = createContext<(id: string, dirty: boolean) => void>(() => undefined);
const ExpectedAccount = createContext<AccountIdentity | undefined>(undefined);
function useAccountRequest() {
  const identity = useContext(ExpectedAccount);
  return <T,>(path: string, options: RequestOptions = {}) =>
    request<T>(path, { ...options, expectedIdentity: identity });
}
const contactNames: Record<keyof Contacts, string> = { phone: '手机号', wechat: '微信', qq: 'QQ' };
const date = (value: string | null) => (value ? new Date(value).toLocaleString() : '尚无记录');
function useServer(userId: string) {
  return useQuery({
    queryKey: ['account-server', userId],
    queryFn: () => accountServerIdentity(userId),
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
}
const asDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(blob);
  });

export function UserAvatar({
  user,
  className = '',
}: {
  user: Pick<User, 'id' | 'name' | 'hasAvatar' | 'avatarVersion'>;
  className?: string;
}) {
  const viewer = useQuery({ queryKey: ['me'], queryFn: api.me, enabled: false }).data;
  const server = useQuery({
    queryKey: ['avatar-server', viewer?.id],
    queryFn: () => accountServerIdentity(viewer!.id),
    enabled: !!viewer,
    gcTime: 0,
  });
  const picture = useQuery({
    queryKey: ['account-avatar', server.data, viewer?.id, user.id, user.avatarVersion],
    queryFn: async () =>
      asDataUrl(
        (await avatarRequest(`/users/${user.id}/avatar`, {
          expectedIdentity: { origin: server.data!, userId: viewer!.id },
        }))!,
      ),
    enabled: !!user.hasAvatar && !!server.data && !!viewer,
    gcTime: 0,
    retry: false,
  });
  return (
    <span className={`avatar ${className}`} aria-hidden="true">
      {picture.data ? <img src={picture.data} alt="" /> : user.name.slice(0, 1)}
    </span>
  );
}
export function ServerWebsiteLink({
  children,
  hash = 'admin',
}: {
  children: ReactNode;
  hash?: string;
}) {
  const target = useQuery({
    queryKey: ['account-server-website'],
    queryFn: async () => {
      if (!hasLocalCompanion()) return location.origin;
      const response = await fetch(`${companionOrigin()}/v1/browser/identity`, {
        headers: { 'x-taskboard-companion-key': (await companionKey()) ?? '' },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok || typeof body.data?.upstream !== 'string')
        throw new Error('无法读取服务器地址');
      const url = new URL(body.data.upstream);
      if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
        throw new Error('服务器地址无效');
      return url.origin;
    },
    gcTime: 0,
  });
  if (!target.data)
    return <span role="status">{target.error ? '无法读取服务器地址' : '正在读取服务器地址…'}</span>;
  return (
    <a
      className="button ghost"
      href={`${target.data}/#${hash}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}
export function AccountMenu({
  user,
  onAccount,
  onAdmin,
  onLogout,
}: {
  user: User;
  onAccount: () => void;
  onAdmin: () => void;
  onLogout: () => void;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const action = (fn: () => void) => () => {
    if (details.current) details.current.open = false;
    fn();
  };
  return (
    <details className="account-menu" ref={details}>
      <summary aria-label="账号菜单">
        <UserAvatar user={user} />
        <span className="account-menu-name">{user.name}</span>
      </summary>
      <div className="account-menu-content">
        <p>{user.email}</p>
        <button onClick={action(onAccount)}>
          <UserRound size={16} />
          个人设置
        </button>
        {user.instanceAdmin &&
          (hasLocalCompanion() ? (
            <ServerWebsiteLink>服务器管理</ServerWebsiteLink>
          ) : (
            <button onClick={action(onAdmin)}>
              <ShieldCheck size={16} />
              服务器管理
            </button>
          ))}
        <button onClick={action(onLogout)}>
          <LogOut size={16} />
          退出登录
        </button>
      </div>
    </details>
  );
}
export function MemberProfile({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const viewer = useQuery({ queryKey: ['me'], queryFn: api.me, enabled: false }).data;
  const server = useQuery({
    queryKey: ['member-profile-server', viewer?.id],
    queryFn: () => accountServerIdentity(viewer!.id),
    enabled: open && !!viewer,
    gcTime: 0,
  });
  const profile = useQuery({
    queryKey: ['member-profile', server.data, viewer?.id, user.id],
    queryFn: () =>
      request<PublicProfile>(`/users/${user.id}/profile`, {
        expectedIdentity: { origin: server.data!, userId: viewer!.id },
      }),
    enabled: open && !!server.data && !!viewer,
    gcTime: 0,
    retry: false,
  });
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="member-profile-trigger"
          aria-label={`查看 ${user.name} 的资料`}
          onClick={(e) => e.stopPropagation()}
        >
          <UserAvatar user={user} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="account-dialog-overlay" />
        <Dialog.Content className="account-profile-dialog" onClick={(e) => e.stopPropagation()}>
          <Dialog.Title>{user.name}</Dialog.Title>
          <Dialog.Description>共同空间成员可见的资料</Dialog.Description>
          {profile.isPending ? (
            <p role="status">正在读取资料…</p>
          ) : profile.error ? (
            <p role="alert">{failure(profile.error)}</p>
          ) : (
            <dl>
              {Object.entries(profile.data?.contacts ?? {}).filter(([, v]) => v).length ? (
                Object.entries(profile.data!.contacts)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{contactNames[k as keyof Contacts]}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))
              ) : (
                <p className="muted">尚未公开联系方式。</p>
              )}
            </dl>
          )}
          <Dialog.Close className="button ghost">关闭</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type Section = 'profile' | 'security' | 'appearance' | 'devices';
const sections: [Section, string, typeof UserRound][] = [
  ['profile', '个人资料', UserRound],
  ['security', '账号安全', ShieldCheck],
  ['appearance', '外观与主题', Sparkles],
  ['devices', '设备与会话', Monitor],
];
export function AccountCenter({
  user,
  appearance,
  onClose,
  demo = false,
}: {
  user: User;
  appearance: AppearanceController;
  onClose: () => void;
  demo?: boolean;
}) {
  const initial = location.hash.split('/')[1] as Section;
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>(
    sections.some(([key]) => key === initial) ? initial : 'profile',
  );
  const [mobileDetail, setMobileDetail] = useState(Boolean(initial));
  const [dirty, setDirty] = useState(false);
  const dirtyForms = useRef(new Set<string>());
  const reportDirty = useCallback((id: string, value: boolean) => {
    if (value) dirtyForms.current.add(id);
    else dirtyForms.current.delete(id);
    setDirty(dirtyForms.current.size > 0);
  }, []);
  const server = useServer(user.id);
  const capability = useQuery({
    queryKey: ['account-capability', server.data],
    enabled: !!server.data && !demo,
    queryFn: () => request<{ capabilities?: { accountCenter?: number } }>('/health'),
    gcTime: 0,
    retry: false,
  });
  const profile = useQuery({
    queryKey: ['account-profile', server.data, user.id],
    queryFn: () =>
      request<AccountProfile>('/me/profile', {
        expectedIdentity: server.data ? { origin: server.data, userId: user.id } : undefined,
      }),
    enabled: !!server.data && capability.data?.capabilities?.accountCenter === 1,
    gcTime: 0,
    refetchInterval: 30000,
    retry: false,
  });
  const changed = async () => {
    await profile.refetch();
  };
  useEffect(() => {
    if (profile.error instanceof ApiError && profile.error.status === 401) {
      queryClient.removeQueries({ queryKey: ['account-avatar'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    }
  }, [profile.error, queryClient]);
  const confirmLeave = () =>
    !(dirty || appearance.previewing) || window.confirm('有尚未保存的更改，确定放弃吗？');
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirty || appearance.previewing) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty, appearance.previewing]);
  useEffect(() => {
    const navigate = (event: Event) => {
      const currentHash = `#account/${section}`;
      if (location.hash === currentHash) return;
      if ((dirty || appearance.previewing) && !window.confirm('有尚未保存的更改，确定放弃吗？')) {
        history.replaceState(null, '', currentHash);
        event.preventDefault();
        return;
      }
      const next = location.hash.split('/')[1] as Section;
      if (location.hash.startsWith('#account/') && sections.some(([key]) => key === next)) {
        setSection(next);
        setMobileDetail(true);
      }
    };
    window.addEventListener('taskboard:account-navigation', navigate);
    return () => {
      window.removeEventListener('taskboard:account-navigation', navigate);
    };
  }, [dirty, appearance.previewing, section]);
  useEffect(() => () => appearance.cancel(), []); // Retire previews with this settings surface.
  const choose = (next: Section) => {
    if (next !== section && !confirmLeave()) return;
    if (next !== section) appearance.cancel();
    setDirty(false);
    setSection(next);
    setMobileDetail(true);
    history.replaceState(null, '', `#account/${next}`);
  };
  return (
    <ExpectedAccount.Provider
      value={server.data ? { origin: server.data, userId: user.id } : undefined}
    >
      <DirtyForms.Provider value={reportDirty}>
        <main className={`account-center ${mobileDetail ? 'account-detail-open' : ''}`}>
          <header className="account-header">
            <button
              className="button ghost"
              onClick={() => {
                if (confirmLeave()) {
                  appearance.cancel();
                  onClose();
                }
              }}
            >
              <ArrowLeft size={17} />
              返回看板
            </button>
            <h1>个人设置</h1>
            <span className="muted account-header-user">{user.name}</span>
          </header>
          <div className="account-layout">
            <nav className="account-nav" aria-label="个人设置分类">
              {sections.map(([key, label, Icon]) => (
                <button
                  key={key}
                  aria-current={section === key ? 'page' : undefined}
                  onClick={() => choose(key)}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </nav>
            <section
              className="account-content"
              aria-label={sections.find(([key]) => key === section)?.[1]}
            >
              <button
                className="button ghost account-mobile-back"
                onClick={() => {
                  if (confirmLeave()) {
                    appearance.cancel();
                    setDirty(false);
                    setMobileDetail(false);
                    history.replaceState(null, '', '#account');
                  }
                }}
              >
                <ArrowLeft size={16} />
                设置分类
              </button>
              {(server.error || capability.error) && (
                <p className="form-error" role="alert">
                  {failure(server.error || capability.error)}
                </p>
              )}
              {section === 'appearance' ? (
                <AppearanceSettings controller={appearance} />
              ) : capability.isPending ? (
                <p role="status">正在检查账号服务…</p>
              ) : capability.data?.capabilities?.accountCenter !== 1 ? (
                <p role="status">此服务器尚未支持用户中心，请升级服务器。现有主题设置仍可使用。</p>
              ) : profile.error ? (
                <div>
                  <p role="alert" className="form-error">
                    {failure(profile.error)}
                  </p>
                  <button className="button" onClick={() => profile.refetch()}>
                    重新读取
                  </button>
                </div>
              ) : !profile.data ? (
                <p role="status">正在读取账号资料…</p>
              ) : section === 'profile' ? (
                <ProfileEditor
                  initial={profile.data}
                  server={server.data!}
                  onChanged={changed}
                  onDirty={setDirty}
                />
              ) : section === 'security' ? (
                <SecuritySettings profile={profile.data} onChanged={changed} />
              ) : (
                <DeviceSettings />
              )}
            </section>
          </div>
        </main>
      </DirtyForms.Provider>
    </ExpectedAccount.Provider>
  );
}
function ActionForm({
  children,
  action,
  success,
  submit = '保存更改',
}: {
  children: ReactNode;
  action: (fields: FormData) => Promise<void>;
  success: string;
  submit?: string;
}) {
  const [state, setState] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reportDirty = useContext(DirtyForms);
  const formId = useId();
  useEffect(() => () => reportDirty(formId, false), [reportDirty, formId]);
  return (
    <form
      className="account-form"
      onChange={() => reportDirty(formId, true)}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setBusy(true);
        setState('');
        setError('');
        try {
          await action(new FormData(form));
          setState(success);
          form.reset();
          reportDirty(formId, false);
        } catch (error) {
          setError(failure(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        {children}
        <button className="button primary" type="submit">
          {busy ? (
            <>
              <LoaderCircle className="spin" size={16} />
              正在提交…
            </>
          ) : (
            submit
          )}
        </button>
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {state && (
        <p className="account-success" role="status">
          <Check size={15} />
          {state}
        </p>
      )}
    </form>
  );
}
function PasswordField({
  name = 'currentPassword',
  label = '当前密码',
}: {
  name?: string;
  label?: string;
}) {
  return (
    <label className="form-label">
      {label}
      <input
        name={name}
        type="password"
        minLength={12}
        maxLength={256}
        autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
        required
      />
    </label>
  );
}
function ProfileEditor({
  initial,
  server,
  onChanged,
  onDirty,
}: {
  initial: AccountProfile;
  server: string;
  onChanged: () => Promise<void>;
  onDirty: (v: boolean) => void;
}) {
  const scopedRequest = useAccountRequest();
  const identity = useContext(ExpectedAccount);
  const client = useQueryClient();
  const [baseline, setBaseline] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [contacts, setContacts] = useState(initial.contacts);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState('');
  const [crop, setCrop] = useState({ zoom: 1, x: 50, y: 50 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const dirty =
    name !== baseline.name ||
    JSON.stringify(contacts) !== JSON.stringify(baseline.contacts) ||
    !!source;
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) {
      setBaseline(initial);
      setName(initial.name);
      setContacts(initial.contacts);
    }
  }, [initial, dirty]);
  useEffect(() => {
    if (!source) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active || !canvas.current) return;
      const context = canvas.current.getContext('2d');
      if (!context) return;
      const side = Math.min(image.width, image.height) / crop.zoom;
      const x = ((image.width - side) * crop.x) / 100;
      const y = ((image.height - side) * crop.y) / 100;
      context.clearRect(0, 0, 256, 256);
      context.drawImage(image, x, y, side, side, 0, 0, 256, 256);
    };
    image.src = source;
    return () => {
      active = false;
    };
  }, [source, crop]);
  const refresh = async () => {
    await onChanged();
    await client.invalidateQueries({ queryKey: ['me'] });
    await client.invalidateQueries({ queryKey: ['board'] });
    await client.invalidateQueries({ queryKey: ['account-avatar', server] });
  };
  const avatarAction = async (remove = false) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (remove)
        await scopedRequest('/me/avatar', { method: 'DELETE', version: baseline.version });
      else {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.current?.toBlob(
            (value) => (value ? resolve(value) : reject(new Error('图片裁剪失败'))),
            'image/webp',
            0.85,
          ),
        );
        await avatarRequest('/me/avatar', {
          body: blob,
          version: baseline.version,
          expectedIdentity: identity,
        });
        setSource('');
      }
      setBaseline((value) => ({ ...value, version: value.version + 1 }));
      await refresh();
      setMessage(remove ? '头像已移除。' : '头像已保存。');
    } catch (error) {
      setError(failure(error));
    } finally {
      setBusy(false);
    }
  };
  const selectFile = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      if (file.size > MAX_AVATAR_BYTES) throw new Error('头像不能超过 2 MiB');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
        throw new Error('请选择 JPG、PNG 或 WebP 图片');
      const data = await asDataUrl(file);
      const image = new Image();
      image.src = data;
      await image.decode();
      if (image.width * image.height > 16000000) throw new Error('头像不能超过 1600 万像素');
      setSource(data);
      setCrop({ zoom: 1, x: 50, y: 50 });
    } catch (error) {
      setError(failure(error));
    }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await scopedRequest('/me/profile', {
        method: 'PATCH',
        version: baseline.version,
        body: { name, contacts },
      });
      setBaseline({ ...baseline, name, contacts });
      await refresh();
      setMessage('个人资料已保存。');
    } catch (error) {
      setError(failure(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h2>个人资料</h2>
      <p className="muted">资料属于当前服务器上的账号，在你的设备之间同步。</p>
      <section className="account-section">
        <h3>头像</h3>
        <div className="account-avatar-editor">
          <UserAvatar user={initial} className="account-large-avatar" />
          <div>
            <label className="button ghost">
              选择图片
              <input
                className="account-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(event) => {
                  void selectFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
            <p className="muted">JPG、PNG 或 WebP，最大 2 MiB。</p>
            {initial.hasAvatar && (
              <button className="button ghost" disabled={busy} onClick={() => avatarAction(true)}>
                移除头像
              </button>
            )}
          </div>
        </div>
        {source && (
          <div className="account-crop">
            <canvas ref={canvas} width={256} height={256} aria-label="头像裁剪预览" />
            {(
              [
                ['zoom', '缩放', 1, 3, 0.05],
                ['x', '水平位置', 0, 100, 1],
                ['y', '垂直位置', 0, 100, 1],
              ] as const
            ).map(([key, label, min, max, step]) => (
              <label key={key}>
                {label}
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={crop[key]}
                  onChange={(event) => setCrop({ ...crop, [key]: Number(event.target.value) })}
                />
              </label>
            ))}
            <div className="account-actions">
              <button className="button primary" disabled={busy} onClick={() => avatarAction()}>
                保存头像
              </button>
              <button className="button ghost" disabled={busy} onClick={() => setSource('')}>
                取消裁剪
              </button>
            </div>
          </div>
        )}
      </section>
      <form className="account-form" onSubmit={save}>
        <fieldset disabled={busy}>
          <section className="account-section">
            <h3>显示名称</h3>
            <label className="form-label">
              名称
              <input
                value={name}
                maxLength={80}
                required
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </label>
            <p className="muted">允许重名，登录仍使用邮箱。</p>
          </section>
          <section className="account-section">
            <h3>联系方式</h3>
            <p className="muted">
              均为选填。选择“共同空间成员”后，只有当前与你共享空间的成员可见。
            </p>
            {Object.entries(contacts).map(([key, value]) => (
              <div className="account-contact-row" key={key}>
                <label className="form-label">
                  {contactNames[key as keyof Contacts]}
                  <input
                    value={value.value}
                    maxLength={100}
                    type={key === 'phone' ? 'tel' : 'text'}
                    onChange={(event) =>
                      setContacts({ ...contacts, [key]: { ...value, value: event.target.value } })
                    }
                  />
                </label>
                <label className="form-label">
                  可见范围
                  <select
                    value={value.visibility}
                    onChange={(event) =>
                      setContacts({
                        ...contacts,
                        [key]: { ...value, visibility: event.target.value },
                      })
                    }
                  >
                    <option value="private">仅自己</option>
                    <option value="members">共同空间成员</option>
                  </select>
                </label>
              </div>
            ))}
          </section>
          <div className="account-actions">
            <button className="button primary" disabled={!dirty || !!source}>
              {busy ? '正在保存…' : '保存资料'}
            </button>
            {baseline.version !== initial.version && (
              <button
                type="button"
                className="button ghost"
                onClick={() => {
                  if (window.confirm('放弃本次输入并读取最新资料？')) {
                    setBaseline(initial);
                    setName(initial.name);
                    setContacts(initial.contacts);
                  }
                }}
              >
                读取其他设备的更改
              </button>
            )}
          </div>
        </fieldset>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="account-success" role="status">
          {message}
        </p>
      )}
    </>
  );
}
function SecuritySettings({
  profile,
  onChanged,
}: {
  profile: AccountProfile;
  onChanged: () => Promise<void>;
}) {
  const request = useAccountRequest();
  return (
    <>
      <h2>账号安全</h2>
      <section className="account-section">
        <h3>登录邮箱</h3>
        <p className="account-email">
          {profile.email}
          <span className="account-status">{profile.emailVerified ? '已验证' : '待验证'}</span>
        </p>
        <ActionForm
          submit={profile.emailVerified ? '更换邮箱' : '发送验证或变更邮件'}
          success="邮件已加入发送队列，请检查收件箱。"
          action={async (fields) => {
            await request('/me/email/request', {
              method: 'POST',
              body: {
                currentPassword: String(fields.get('currentPassword')),
                email: String(fields.get('email')) || profile.email,
              },
            });
          }}
        >
          <label className="form-label">
            新邮箱
            <input
              name="email"
              type="email"
              maxLength={254}
              placeholder="留空则验证当前邮箱"
              autoComplete="email"
            />
          </label>
          <PasswordField />
          <p className="muted">确认新邮箱前，原邮箱继续有效。更换完成后需要重新登录。</p>
        </ActionForm>
      </section>
      <section className="account-section">
        <h3>修改密码</h3>
        <ActionForm
          success="密码已更换，其他登录会话与 Agent 令牌已撤销。"
          submit="修改密码"
          action={async (fields) => {
            const newPassword = String(fields.get('newPassword'));
            if (newPassword !== fields.get('confirmPassword'))
              throw new Error('两次输入的新密码不一致');
            await request('/me/password', {
              method: 'POST',
              body: { currentPassword: String(fields.get('currentPassword')), newPassword },
            });
            await onChanged();
          }}
        >
          <PasswordField />
          <PasswordField name="newPassword" label="新密码（至少 12 个字符）" />
          <PasswordField name="confirmPassword" label="确认新密码" />
        </ActionForm>
      </section>
    </>
  );
}
type Device = {
  id: string;
  name: string;
  createdAt: string;
  revokedAt: string | null;
  lastActiveAt: string | null;
  current: boolean;
};
function DeviceSettings() {
  const request = useAccountRequest();
  const devices = useQuery({
    queryKey: ['account-devices'],
    queryFn: () => request<Device[]>('/devices'),
    gcTime: 0,
    refetchInterval: 30000,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const revoke = async (id?: string) => {
    if (!window.confirm(id ? '撤销这台设备的登录？' : '退出其他所有设备和 Agent？')) return;
    setBusy(true);
    setError('');
    try {
      await request(id ? `/devices/${id}/revoke` : '/devices/revoke-others', { method: 'POST' });
      setMessage('设备会话已撤销。');
      await devices.refetch();
      if (devices.data?.find((d) => d.id === id)?.current) {
        await api.logout();
        location.reload();
      }
    } catch (error) {
      setError(failure(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h2>设备与会话</h2>
      <p className="muted">撤销后立即拒绝该设备的后续请求。最近活跃时间最多延迟一分钟更新。</p>
      <button className="button ghost" disabled={busy} onClick={() => revoke()}>
        退出其他设备
      </button>
      {devices.error && <p role="alert">{failure(devices.error)}</p>}
      {devices.isPending && <p role="status">正在读取设备…</p>}
      <ul className="account-device-list">
        {devices.data?.map((device) => (
          <li key={device.id}>
            <Monitor size={21} />
            <div>
              <strong>{device.name}</strong>
              {device.current && <span className="account-status">当前设备</span>}
              <p className="muted">
                创建：{date(device.createdAt)}
                <br />
                最近活跃：{date(device.lastActiveAt)}
              </p>
            </div>
            {device.revokedAt ? (
              <span className="muted">已撤销</span>
            ) : (
              <button className="button ghost" disabled={busy} onClick={() => revoke(device.id)}>
                撤销
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </>
  );
}
export function ForgotPassword({ onBack }: { onBack: () => void }) {
  return (
    <main className="account-public">
      <h1>找回密码</h1>
      <p className="muted">使用加入服务器时的邮箱申请恢复链接。</p>
      {hasLocalCompanion() ? (
        <ServerWebsiteLink hash="forgot">前往服务器网页找回密码</ServerWebsiteLink>
      ) : (
        <ActionForm
          submit="发送恢复邮件"
          success="如果该邮箱存在有效账号，将收到恢复邮件。"
          action={async (fields) => {
            await request('/auth/recovery/request', {
              method: 'POST',
              body: { email: String(fields.get('email')) },
            });
          }}
        >
          <label className="form-label">
            邮箱
            <input name="email" type="email" required maxLength={254} autoComplete="email" />
          </label>
        </ActionForm>
      )}
      <button className="button ghost" onClick={onBack}>
        返回登录
      </button>
    </main>
  );
}
export function VerifyEmail({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  return (
    <main className="account-public">
      <h1>确认邮箱</h1>
      <p className="muted">确认由你发起的邮箱验证或更换操作。</p>
      {done ? (
        <p role="status">邮箱已确认。更换邮箱后，请使用新邮箱重新登录。</p>
      ) : (
        <ActionForm
          submit="确认邮箱"
          success="邮箱已确认。"
          action={async () => {
            await request('/auth/email/complete', { method: 'POST', body: { token } });
            setDone(true);
          }}
        >
          <p>确认链接为一次性使用，有效期为 30 分钟。</p>
        </ActionForm>
      )}
      <a className="button ghost" href={location.pathname} onClick={() => (location.hash = '')}>
        返回登录
      </a>
    </main>
  );
}
