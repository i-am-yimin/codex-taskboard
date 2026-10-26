# 接力卡片品牌与看板动效

本轮保留 Codex Taskboard 名称。原创标识由两张交错卡片和向右交接的三角缺口组成，表达任务交接、执行和人工验收；不采用 OpenAI 或 Codex 官方标志。产品为独立社区工具。

## 资源与生成

- React：`apps/web/src/brand/TaskboardBrand.tsx` 导出 `TaskboardMark` 与 `TaskboardBrand`。前者默认装饰，交互入口应由外层提供可访问名称；后者保留完整产品名，compact 仅收紧尺寸。
- 网页静态标识：`apps/web/public/brand/relay-light.svg`、`relay-dark.svg`、`relay-mono.svg`。单色资源继承 currentColor，明暗资源为实色，不依赖滤镜。
- 桌面母版：`apps/desktop/src-tauri/icons/taskboard.svg`。执行 `node scripts/generate-brand-icons.mjs` 从母版生成 `icon.png` 与含 16/20/24/32/48/64/128/256 像素图层的 `icon.ico`。需要已安装的 Playwright Chromium，不访问用户浏览器。
- Tauri 的 `bundle.icon` 引用 `icons/icon.ico` 与 `icons/icon.png`，桌面程序和复用 default_window_icon 的托盘使用该母版。NSIS 的 `installerIcon` 与 `uninstallerIcon` 另外显式引用同一 `icons/icon.ico`；`bundle.icon` 本身不会替代这两个安装器配置。最终产物和实机仍须分别核验，源码替换不能证明安装器缓存或任务栏刷新已完成。

## 动效语法

模式为操作工具。唯一重点是卡片交接：原位空出、浮层抬起、邻卡让位、目标列提示、落位确认。操作不等待动画完成，不新增动效依赖。

| 场景           | 接入                                         | 行为                                                                                                                                       |
| -------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 抬起与占位     | 共享 TaskCardContent；DragOverlay            | 完整标题、标签、协作和页脚保持尺寸；浮层使用主题实色材质，轻旋转 0.6°、缩放 1.015 与软阴影；原位虚线与降低透明度                           |
| 让位与落位     | dnd-kit sortable / dropAnimation             | 240ms 自然减速；浮层返回期间隐藏源卡，避免两个实卡同时显示；悬停卡片也标记目标列                                                           |
| 筛选与状态流转 | useBoardReflow(rootRef, revision, suspended) | board 相对坐标包含滚动偏移；中断前读取视觉偏移再取消旧动画；180–300ms，最多 12 张可见卡片；拖拽由 dnd-kit 独占位移                         |
| 他人更新       | data-motion-state=updated                    | 900ms 语义底色淡出；读屏状态始终保留固定节点，避免确认文字撑高卡片                                                                         |
| 抽屉           | useDrawerPresence 与 motion-drawer           | 进入 260ms、退出 180ms；退出捕获当前 transform/opacity，按 animationend 完成，260ms 有界兜底；重复关闭合并，卸载取消回调，减少动效立即关闭 |
| 请求           | RequestFeedback                              | 常驻反馈空间，等待图标旋转；成功和失败来自实际请求，配原状态文本、错误和重试入口                                                           |

在页面入口导入 `motion/boardMotion.css`。revision 应包含卡片 ID、状态、排序及更新版本，不包含正在输入的草稿。FLIP 只管理自身 Animation，不改变任务业务状态；拖拽时清空历史位置，避免与 dnd-kit 同时拥有 transform。筛选新增的卡片直接出现，不逐卡飞入。

## 开源参考与取舍（2026-10-26）

本轮阅读了以下项目的 README 与 LICENSE，以交互原则作参考，均未复制代码、图标、截图或付费示例，未增加依赖：

- [Motion](https://github.com/motiondivision/motion)：MIT，Copyright 2024 Motion B.V.。参考共享布局的空间锚定、手势连续性；不采用全屏 App Store 演示布局，Motion+ 付费示例不视为 MIT 素材。
- [AutoAnimate](https://github.com/formkit/auto-animate)：MIT，Copyright 2022 FormKit。参考列表变化的连续性；本项目保持限量、可打断的原生 WAAPI FLIP，不引入自动扫描整个 DOM 的库。
- [React Spring](https://github.com/pmndrs/react-spring)：MIT，Copyright 2018-present Paul Henschel et al.。参考可打断的弹性响应原则；操作看板避免持续回弹，使用轻微抬升和自然减速。

已安装的 dnd-kit 仍负责指针/键盘拖拽、排序与 drop side effects；Lucide 仍提供状态图标。这与上述仅提供启发的项目区分，原始依赖与许可记录保持原样。

## 可访问性和性能

四套主题共用 accent/ink/canvas/danger 等语义变量；不把主题色解释为任务状态。减少动态效果时关闭位移、旋转和循环，用 80ms 透明度反馈保留确认；dnd-kit 的 dropAnimation 也应在 prefersReducedMotion() 为 true 时设置 null。窄屏取消旋转，保留轻微抬升。

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

## 动效补充验收（2026-10-26）

- 完整卡片浮层保留标题、标签、阻塞、负责人、验收人和页脚；主题实色表面避免拖拽时透出底卡文字。目标列追踪卡片碰撞，drop 阶段隐藏源卡。
- FLIP 从当前视觉偏移继续；最多 12 张可见卡片，跳过过长位移。取消动画时同步释放 data-reflowing，防止 WAAPI 异步 cancel 事件在 map 清空后留下标记。拖拽阶段清空历史位置，不同时控制 transform。
- 抽屉进入中关闭时从实际 transform/opacity 继续退出；显式重开使用独立 epoch，旧实例的退出回调不能关闭新实例。保留评论与任务草稿、关闭后的焦点恢复。
- 个人任务视图与筛选区接入 page-gutter；360px 任务标题使用 26px 与平衡换行，完整保留名称。
- 最终专项 compact 8/8 通过（1.0m）；覆盖键盘拖放/取消、normal/reduce、稳定的 idle/pending/success/error 反馈高度、快速筛选/滚动、运行中切 reduce、抽屉进入40ms处打断的首帧数值连续性、同卡退出期间重开且旧260ms关闭期限后仍显示与保留草稿。
- 前一版 desktop 1920×1080 专项 7/7 通过（1.1m）；随后仅补个人视图 gutter、窄屏标题与同卡重开，最终 compact 8/8 已复验。collaboration + motion 前一轮 11/11 通过（1.5m），全仓最终检查由集成人记录。
- 最终 `pnpm typecheck`、专属 ESLint 均退出0。浏览器使用缓存 Chromium、模拟 API/合成数据，清空 TEST_DATABASE_URL，不启动 live-preview，不连接日常伴随服务。
- 360×800、CSS zoom=2，以及640×450等效CSS布局视口保留抽屉关闭入口。CSS zoom 与等效视口属于浏览器布局夹具，不等同真实浏览器/WebView缩放200%；实际Ctrl+plus、Windows显示缩放与最终安装包仍由集成验收。
- 截图与合成浏览器 WebM 保存于忽略目录 `.artifacts/motion/`。这些证据不证明真实宿主、读屏、物理设备帧率或最终安装包。

本轮最终仅执行一次 Impeccable detect，范围为 `main.tsx`、`TaskDrawer.tsx`、`motion/` 与 `collaboration.css`；退出0且无输出，未报告检测项。它是静态机械检查，不替代上述浏览器证据与最终实机验收。

## 标准安装器图标补验（2026-10-26）

首次标准0.1.8候选已实际生成原生程序与NSIS安装器，尚未执行安装。直接提取新产物图标确认：桌面程序为原创接力标识，安装器仍为NSIS默认圆形安装图标。生成的安装脚本中INSTALLERICON与UNINSTALLERICON均为空，Modern UI因此回退默认图标；早前从bundle.icon推断安装器也已接入的说法不成立。

窄修只在既有NSIS对象补installerIcon与uninstallerIcon，均指向现有icons/icon.ico，不生成新资源，不改变安装身份、权限、CSP、端口或安装模式。静态配置核对后重新固定来源构建标准安装器；原产物和失败图标证据保留。新安装/卸载图标的实际提取、安装窗口与托盘仍须以新产物验收，不用配置存在代替通过。
