import { MINIMUM_COLLABORATION_SERVER, type ServerCompatibility } from '@taskboard/core';
export function ServerCompatibilityNotice({
  compatibility,
  error,
  checking,
  onRetry,
}: {
  compatibility?: ServerCompatibility;
  error?: unknown;
  checking: boolean;
  onRetry: () => void;
}) {
  if (compatibility?.status === 'compatible' && !error) return null;
  const failed = Boolean(error);
  return (
    <section className="banner" aria-live="polite" aria-label="服务器兼容性">
      <div>
        <strong>
          {failed
            ? '暂时无法确认服务器兼容性'
            : compatibility?.status === 'upgrade_required'
              ? '服务器需要升级'
              : '正在核对服务器兼容性'}
        </strong>
        <p>
          {failed
            ? '当前未取得在线能力响应，不能据此判断服务器版本。看板只读，草稿保留；连接恢复后请重新检查。'
            : compatibility?.status === 'upgrade_required'
              ? `${compatibility.serverVersion ? `当前服务器 ${compatibility.serverVersion}。` : ''}${compatibility.reason}客户端 0.1.8 需要配套 ${MINIMUM_COLLABORATION_SERVER} 或声明相同协议能力且完成 0005—0009 迁移的服务器。升级前可浏览基础看板，协作写入已暂停，草稿保留。`
              : '核对期间暂停协作写入；不会使用上次成功结果授权本次操作。'}
        </p>
      </div>
      <button className="button ghost" disabled={checking} onClick={onRetry}>
        {checking ? '正在检查…' : '重新检查服务器'}
      </button>
    </section>
  );
}
