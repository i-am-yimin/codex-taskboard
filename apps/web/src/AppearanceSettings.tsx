import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  builtinThemeIds,
  defaultAppearance,
  MAX_THEME_BYTES,
  parseThemeFile,
} from '@taskboard/core';
import { Download, Leaf, Upload } from 'lucide-react';
import { exportedBuiltin, identifyTheme, themeInfo } from './themes';
import type { AppearanceController } from './useAppearance';

export function AppearanceSettings({ controller: c }: { controller: AppearanceController }) {
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const importSequence = useRef(0);
  useEffect(
    () => () => {
      importSequence.current++;
    },
    [],
  );
  const value = c.value;
  const choices = [
    ...builtinThemeIds.map((id) => ({
      id,
      name: themeInfo[id].name,
      subtitle: themeInfo[id].subtitle,
      base: id,
      color: themeInfo[id].color,
    })),
    ...c.packages.map((p) => ({
      id: p.id,
      name: p.manifest.name,
      subtitle: `${p.manifest.author} · ${p.manifest.version}`,
      base: p.manifest.base,
      color: themeInfo[p.manifest.base].color,
    })),
  ];
  const update = (patch: Partial<typeof value>) =>
    c.preview({ themeId: value.themeId, mode: value.mode, layout: value.layout, ...patch });
  async function importFile(selected?: File) {
    if (!selected) return;
    const sequence = ++importSequence.current;
    const commit = c.prepareImport();
    setImporting(true);
    try {
      if (selected.size > MAX_THEME_BYTES) throw new Error('主题文件不能超过 64 KiB');
      const pack = await identifyTheme(parseThemeFile(await selected.text()));
      if (sequence !== importSequence.current) return;
      commit(pack);
      setError('');
    } catch {
      if (sequence !== importSequence.current) return;
      setError(
        '导入失败：请使用不超过 64 KiB 的有效 v1 主题 JSON 文件，仅支持规定的颜色和样式变量。',
      );
    } finally {
      if (sequence === importSequence.current) setImporting(false);
    }
    if (file.current) file.current.value = '';
  }
  function exportFile() {
    const custom = c.packages.find((p) => p.id === value.themeId);
    const builtin = builtinThemeIds.find((id) => id === value.themeId) ?? 'glass';
    const manifest = custom?.manifest ?? exportedBuiltin(builtin);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${custom?.id ?? builtin}.taskboard-theme.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="appearance-settings" aria-label="外观与主题">
      <h3>外观与主题</h3>
      <p className="muted">选择一种工作氛围。预览不会改变任务，应用后同步到账号。</p>
      <div className="theme-gallery" role="group" aria-label="选择主题">
        {choices.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className="theme-choice"
            aria-pressed={value.themeId === theme.id}
            onClick={() => update({ themeId: theme.id })}
            style={{ '--preview-accent': theme.color } as CSSProperties}
          >
            <span className={`theme-mini theme-mini-${theme.base}`} aria-hidden="true">
              <span className="mini-nav">
                <i />
                <i />
                <i />
              </span>
              <span className="mini-board">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
              {theme.base === 'island' && <Leaf size={18} />}
            </span>
            <strong>{theme.name}</strong>
            <span>{theme.subtitle}</span>
            {value.themeId === theme.id && <span className="theme-selected">已选择</span>}
          </button>
        ))}
      </div>
      <fieldset className="appearance-field">
        <legend>明暗模式</legend>
        <div className="segmented">
          {(['system', 'light', 'dark'] as const).map((mode) => (
            <button
              key={mode}
              aria-pressed={value.mode === mode}
              className={value.mode === mode ? 'selected' : ''}
              onClick={() => update({ mode })}
            >
              {{ system: '跟随系统', light: '浅色', dark: '深色' }[mode]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="appearance-field">
        <legend>导航布局</legend>
        <div className="segmented">
          {(['auto', 'top', 'rail'] as const).map((layout) => (
            <button
              key={layout}
              aria-pressed={value.layout === layout}
              className={value.layout === layout ? 'selected' : ''}
              onClick={() => update({ layout })}
            >
              {{ auto: '随主题', top: '顶部导航', rail: '紧凑侧栏' }[layout]}
            </button>
          ))}
        </div>
        <p className="muted">窄窗口和 Codex 内嵌看板会自动收起侧栏。</p>
      </fieldset>
      <div className="appearance-actions">
        <button
          className="button ghost"
          disabled={importing || c.busy}
          onClick={() => file.current?.click()}
        >
          <Upload size={15} />
          {importing ? '正在读取主题…' : '导入主题'}
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          aria-label="主题文件"
          hidden
          onChange={(e) => void importFile(e.target.files?.[0])}
        />
        <button className="button ghost" onClick={exportFile}>
          <Download size={15} />
          导出主题
        </button>
        <button className="button ghost" onClick={() => c.preview(defaultAppearance)}>
          恢复默认
        </button>
        {c.packages.some((p) => p.id === value.themeId) && (
          <button
            className="button ghost"
            disabled={c.busy}
            onClick={() => void c.removePackage(value.themeId)}
          >
            移除主题
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="muted" role="status">
        {c.status}
        {c.previewing ? ' · 正在预览，尚未应用' : ''}
      </p>
      {c.cloud && (
        <div className="theme-conflict" role="alert">
          <p>云端有新的外观设置，当前选择已保留。</p>
          <button className="button ghost" onClick={c.useCloud}>
            使用云端
          </button>
          <button className="button ghost" disabled={c.busy} onClick={() => void c.keepLocal()}>
            保留本次选择
          </button>
        </div>
      )}
      <div className="appearance-actions theme-save">
        <button
          className="button primary"
          disabled={!c.previewing || c.busy || !!c.cloud}
          onClick={() => void c.apply()}
        >
          {c.busy ? '正在同步…' : '应用主题'}
        </button>
        <button
          className="button ghost"
          disabled={!c.previewing && !importing}
          onClick={() => {
            importSequence.current++;
            setImporting(false);
            c.cancel();
          }}
        >
          取消预览
        </button>
      </div>
    </section>
  );
}
