import { embeddedCapability } from './companionBridge';

type Permission = 'granted' | 'denied' | 'prompt' | 'unsupported';
export async function notificationPermission(request = false): Promise<Permission> {
  const invoke = window.__TAURI__?.core?.invoke;
  if (invoke) return invoke<Permission>('notification_permission', { request });
  if (embeddedCapability()) return 'unsupported';
  if (!('Notification' in window) || !window.isSecureContext) return 'unsupported';
  const permission = request ? await Notification.requestPermission() : Notification.permission;
  return permission === 'default' ? 'prompt' : permission;
}

/** The desktop plugin queues a request; it cannot prove that the OS showed a toast. */
export async function sendDesktopNotification(title: string, body: string, onOpen: () => void) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (invoke) {
    const result = await invoke<{ requested: boolean }>('notification_send', { title, body });
    if (!result.requested) throw new Error('未能请求系统提醒');
    return;
  }
  if ((await notificationPermission()) !== 'granted')
    throw new Error('此设备未允许系统通知；请点击启用并检查系统设置。');
  await new Promise<void>((resolve, reject) => {
    let notice: Notification;
    try {
      notice = new Notification(title, { body, icon: '/brand/relay-light.svg' });
    } catch (error) {
      reject(error);
      return;
    }
    const timer = setTimeout(() => {
      notice.close();
      reject(new Error('系统通知未在限定时间内接受，通知仍保留在收件箱。'));
    }, 5000);
    notice.onshow = () => {
      clearTimeout(timer);
      resolve();
    };
    notice.onerror = () => {
      clearTimeout(timer);
      notice.close();
      reject(new Error('系统拒绝桌面提醒，请检查通知权限。'));
    };
    notice.onclick = () => {
      window.focus();
      onOpen();
      notice.close();
    };
  });
}
