# 接力卡片品牌与看板动效

本轮保留 Codex Taskboard 名称。原创标识由两张交错卡片和向右交接的三角缺口组成，表达任务交接、执行和人工验收；不采用 OpenAI 或 Codex 官方标志。产品为独立社区工具。

## 资源与生成

- React：`apps/web/src/brand/TaskboardBrand.tsx` 导出 `TaskboardMark` 与 `TaskboardBrand`。前者默认装饰，交互入口应由外层提供可访问名称；后者保留完整产品名，compact 仅收紧尺寸。
- 网页静态标识：`apps/web/public/brand/relay-light.svg`、`relay-dark.svg`、`relay-mono.svg`。单色资源继承 currentColor，明暗资源为实色，不依赖滤镜。
- 桌面母版：`apps/desktop/src-tauri/icons/taskboard.svg`。执行 `node scripts/generate-brand-icons.mjs` 从母版生成 `icon.png` 与含 16/20/24/32/48/64/128/256 像素图层的 `icon.ico`。需要已安装的 Playwright Chromium，不访问用户浏览器。
- Tauri 配置已引用 `icons/icon.ico` 与 `icons/icon.png`，托盘复用 default_window_icon，故安装器、窗口与托盘共用母版。最终安装包仍须实机核验，源码替换不能证明安装器缓存或任务栏刷新已完成。

## 动效语法

模式为操作工具。唯一重点是卡片交接：原位空出、浮层抬起、邻卡让位、目标列提示、落位确认。操作不等待动画完成，不新增动效依赖。

| 场景           | 接入                                                                                   | 行为                                                            |
| -------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 抬起与占位     | 原卡 data-dragging=true；DragOverlay 内层 task-drag-overlay                            | 原位虚线/降低透明度，浮层轻旋转与有偏移的软阴影                 |
| 让位与落位     | dnd-kit sortable transition；dropAnimation=boardMotion.drop；data-motion-state=settled | 240ms 自然减速，落位以轮廓收束确认                              |
| 筛选与状态流转 | useBoardReflow(rootRef, revision)；卡片 data-motion-id                                 | 读取新旧矩形后 FLIP 240ms；拖拽时让 dnd-kit 管理位移            |
| 他人更新       | data-motion-state=updated                                                              | 一次 900ms 语义强调底色淡出；必须同时显示是谁或什么已更新       |
| 抽屉           | motion-drawer 和 motion-scrim，data-state=open/closed                                  | 进入 260ms、退出 160ms；使用 Radix 的关闭生命周期保留退出动画   |
| 请求           | motion-feedback，data-request-state=pending/success/error                              | 等待图标旋转；成功/失败短显现，配实际状态文本；失败保留重试入口 |

在页面入口导入 `motion/boardMotion.css`。`boardMotion.ts` 导出 `boardMotion`、`prefersReducedMotion`、`useBoardReflow`。revision 应包含卡片 ID、状态、排序及更新版本；不包含用户正在输入的草稿。hook 清理自身 Animation，连续筛选会取消旧动画，不修改任务业务状态。新的筛选结果直接出现，避免每张卡片统一飞入。

## 可访问性和性能

四套主题共用 accent/ink/canvas/danger 等语义变量；不把主题色解释为任务状态。减少动态效果时关闭位移、旋转和循环，用 80ms 透明度反馈保留确认；dnd-kit 的 dropAnimation 也应在 prefersReducedMotion() 为 true 时设置 null。窄屏取消旋转并降低缩放。

动画不改变焦点，不替代 aria-live 状态信息。保留 KeyboardSensor、状态菜单/抽屉的非拖拽移动入口、Escape 取消和可见焦点。成功只来自 API 确认；他人更新不能覆盖未保存草稿。pending 旋转仅对实际等待期间的图标启用，卸载即消失。

## 验收清单与证据边界

1. 四套主题分别在明/暗下截取看板、抽屉、请求失败与成功；在 360px 与 Codex 内嵌宽度检查标题、品牌、操作无截断。
2. 指针拖拽跨列、同列排序、空列、取消与服务端拒绝：原位置保留，目标可辨，拒绝恢复真实状态且可重试。
3. 键盘拾取、移动、放下、Escape；非拖拽状态菜单可完成同等状态操作；焦点可见且更新后不丢失。
4. 快速连续筛选、拖拽期间 SSE、同卡连续更新与抽屉快速开关，无残留 transform、双重动画或丢草稿。
5. 模拟 prefers-reduced-motion=reduce，确认无浮层旋转、FLIP、抽屉位移和 pending 循环，状态文字仍完整。
6. 16/20/24/32px、单色、明/暗图标截图；真正安装后检查 installer、窗口、任务栏与托盘。截图和性能观察存于忽略的 `.artifacts/`。

用户提供的两个抖音链接本轮尚未播放，不能将本方案描述为已复刻视频；方案依据具体交互场景与既有主题约束设计。

自动类型、Lint、构建与浏览器模拟证据应在最终任务验收说明记录。真实宿主、安装器和最终签名/发布包的结果单列，未运行不得写成通过。

## 本轮实际验证（2026-10-25）

- `node scripts/generate-brand-icons.mjs`：成功生成 256px PNG 与八尺寸 ICO；已目视母版栅格图。
- `node node_modules/@playwright/test/cli.js test tests/e2e/collaboration.spec.ts --project=compact --reporter=line`：5 项通过（48.4s）。覆盖最小 PATCH、评论草稿、提交失败原键/原版本、AI 拆分人工调整后确认、减少动效与 Escape、四主题明暗和 360px 截图。全部使用隔离浏览器与模拟 API，未访问真实账号。
- 截图位于忽略目录 `.artifacts/collaboration-ui/`；四套主题通过现有 applyAppearance 实际应用 tokens，非仅修改 data 属性。第二轮核对修正窄头部 ID 拥挤与默认顶部导航缺少品牌标识。
- 专属 UI、品牌生成脚本 ESLint 通过。机械 Impeccable detector 对新增品牌/动效/协作组件返回空列表。整体 TypeScript 在并行实施时曾遇到其他工作区新增测试/自动化模块错误，最终全仓结果由集成人记录。
- 侧栏注入仅替换 SVG 图形路径与 viewBox，名称、版本、能力、nonce、来源和宿主身份检查未改；真实宿主显示、最终安装器/托盘及人工读屏未验证。
- 本轮 UI 已接服务端稳定的 /me/tasks 和 saved-filters；收件箱、桌面通知、runner 控件、自动化/统计界面将在后续集成，不宣称十二项全部完成。
