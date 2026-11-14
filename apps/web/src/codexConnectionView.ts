import type { AdapterCapabilities } from '@taskboard/core';
import type { CodexConnection } from './codexConnection';

type ConnectionFacts = {
  phase: 'idle' | 'checking' | 'connecting' | 'waiting' | 'connected' | 'error';
  stage?: 'native' | 'sidebar';
  connection?: CodexConnection;
  capabilities?: AdapterCapabilities;
  diagnosis: string;
};
export type CodexConnectionView = {
  tone: 'idle' | 'progress' | 'connected' | 'partial' | 'error';
  title: string;
  summary: string;
  label: string;
  action: 'connect' | 'detect' | 'installSidebar' | 'open';
  native: string;
  sidebar: string;
  notice: boolean;
  restart: boolean;
};
export function codexConnectionView(facts: ConnectionFacts): CodexConnectionView {
  const native = facts.connection;
  const capability = facts.capabilities;
  const sidebar = capability?.sidebar?.state;
  const base: CodexConnectionView = {
    tone: 'idle',
    title: '日常 Codex 接入',
    summary: '沿用原登录、项目和会话；侧栏接入会单独检查当前工作区。',
    label: '连接 Codex',
    action: 'connect',
    native: '尚未检测',
    sidebar: '尚未检测',
    notice: false,
    restart: false,
  };
  const rejection = {
    'ownership-failed': ['Codex 归属核验失败', '请先检测原有窗口的连接身份，通过前停止接入。'],
    'target-mismatch': ['Codex 页面身份已变化', '请先重新检测当前窗口，通过前停止接入。'],
    'restoration-unconfirmed': [
      'Codex 页面恢复未确认',
      '请保留工作并正常退出原窗口，再检测连接；恢复确认前停止接入。',
    ],
  } as const;
  if (sidebar && sidebar in rejection) {
    const [title, summary] = rejection[sidebar as keyof typeof rejection];
    return {
      ...base,
      tone: 'error',
      title,
      summary,
      label: '重新检测',
      action: 'detect',
      native: '待重新核验',
      sidebar: '已停止接入',
      notice: true,
    };
  }
  if (facts.phase === 'checking' || facts.phase === 'connecting') {
    const checking = facts.phase === 'checking';
    return {
      ...base,
      tone: 'progress',
      title: checking ? '正在检测 Codex' : '正在接入 Codex',
      summary: facts.diagnosis,
      label: checking ? '检测中…' : '连接中…',
      native: facts.stage === 'sidebar' ? '已连接，正在核验侧栏' : '正在确认连接…',
      sidebar: '正在检查…',
      notice: !checking,
    };
  }
  if (
    facts.phase === 'waiting' ||
    (facts.phase === 'idle' && native?.state === 'restart-required')
  ) {
    const waiting = facts.phase === 'waiting';
    return {
      ...base,
      tone: 'partial',
      title: waiting ? '等待正常退出 Codex' : '首次连接需要正常重开 Codex',
      summary: waiting
        ? '请先保存工作并正常退出 Codex。退出后会自动打开原环境并检查侧栏。'
        : '日常 Codex 已运行，但本次启动尚未启用连接。准备好后，可让 Taskboard 等待正常退出。',
      label: waiting ? '等待 Codex 退出…' : '连接 Codex',
      native: '运行中，需正常退出重开',
      sidebar: '等待重开后检查',
      notice: true,
      restart: true,
    };
  }
  if (facts.phase === 'error' && native?.state === 'restart-required') {
    return {
      ...base,
      tone: 'partial',
      title: '等待已结束',
      summary: facts.diagnosis,
      native: '仍在运行',
      sidebar: '尚未接入',
      notice: true,
    };
  }
  if (facts.phase === 'connected' && capability?.embedded) {
    return {
      ...base,
      tone: 'connected',
      title: 'Codex 侧栏已接入',
      summary: facts.diagnosis,
      label: '打开 Codex',
      action: 'open',
      native: native?.mode === 'managed' ? '已连接独立测试环境' : '已连接日常环境',
      sidebar: '已接入左侧导航',
    };
  }
  if (sidebar === 'structure-ready' && facts.phase !== 'error') {
    return {
      ...base,
      title: 'Codex 已连接，侧栏可接入',
      summary: '当前工作区检查通过。点击接入后，Codex 左侧导航将显示“任务看板”。',
      label: '接入侧栏',
      action: 'installSidebar',
      native: '已连接',
      sidebar: '检查通过，待接入',
      notice: true,
    };
  }
  if (native?.state === 'connected') {
    const summary =
      sidebar === 'state-blocked'
        ? '请先处理 Codex 中的弹窗或保留未发送草稿，准备好后再检测侧栏。'
        : sidebar === 'structure-ambiguous'
          ? '当前工作区无法唯一确认。任务看板主窗口可继续使用，请稍后检测侧栏。'
          : '请确认 Codex 已进入对话工作区，再检测侧栏。任务看板主窗口可继续使用。';
    return {
      ...base,
      tone: 'partial',
      title: 'Codex 已连接，侧栏暂不可用',
      summary,
      label: '检测侧栏',
      action: 'detect',
      native: native.mode === 'managed' ? '已连接独立测试环境' : '已连接日常环境',
      sidebar: sidebar === 'state-blocked' ? '受草稿或弹窗保护' : '尚未确认可用',
      notice: true,
    };
  }
  if (facts.phase === 'error') {
    return {
      ...base,
      tone: 'error',
      title: 'Codex 连接未完成',
      summary: '当前任务看板主窗口可继续使用。请检测连接，并在连接详情中查看原因。',
      label: '检测连接',
      action: 'detect',
      native: '连接未确认',
      sidebar: '未连接',
      notice: true,
    };
  }
  if (native?.state === 'connectable')
    return { ...base, native: '已运行，可连接', sidebar: '连接后检查' };
  if (native?.state === 'not-running') return { ...base, native: '未运行', sidebar: '启动后检查' };
  if (native?.state === 'connecting')
    return {
      ...base,
      tone: 'progress',
      native: '已有连接正在进行',
      title: 'Codex 正在连接',
      summary: '正在等待已有原生连接完成；检测不会再启动一个实例。',
      label: '连接 Codex',
      action: 'connect',
      sidebar: '等待连接完成',
      notice: true,
    };
  return base;
}
