# 主题使用与制作

0.1.6 客户端提供玻璃、极简、开发者、自然岛屿四套主题，均支持跟随系统、浅色和深色。

## 使用主题

打开 **设置 → 外观与主题**，选择主题、明暗模式和导航布局。选择会立即预览，点击“应用主题”后保存；“取消预览”或关闭设置恢复上次已应用外观。“恢复默认”同样需要应用。

桌面、浏览器和 Codex 内嵌看板登录同一服务器、同一账号后同步主题。窗口激活时刷新，在线期间约每 30 秒检查一次。内嵌及窄窗口自动收起侧栏。

断网时仍可应用本机主题，显示“待同步”。重连若发现另一设备已修改，可选择“使用云端”或“保留本次选择”。旧服务端显示升级提示，仍可使用本机主题。

通过“导入主题”选择 JSON 文件，预览后应用；“导出主题”保存可分享的文件。导出不包含账号、任务或服务器地址。移除正在使用的自定义主题会回退玻璃，保留明暗与布局选择。移除账号主题需要联网。

## 制作主题包

最方便的方式是导出一套内置主题后修改。文件扩展名推荐 `.taskboard-theme.json`，UTF-8 文件不超过 64 KiB。

```json
{
  "formatVersion": 1,
  "name": "林间",
  "author": "Your name",
  "version": "1.0.0",
  "base": "island",
  "layout": "rail",
  "light": { "accent": "#386447", "radius": 24 },
  "dark": { "accent": "#b8d8a5", "radius": 24 }
}
```

`base` 为 `glass`、`paper`、`studio` 或 `island`；`layout` 为 `top` 或 `rail`。`light`、`dark` 均必须提供，可留空继承基础主题。

| 变量 | 可用值 |
| --- | --- |
| `canvas`, `ink`, `muted`, `accent`, `glass`, `glass-solid`, `card`, `field`, `edge`, `divider`, `hover`, `tint`, `on-accent` | 六位十六进制颜色，例如 `#386447` |
| `radius` | 4–28 的整数，单位 px |
| `spacing` | `comfortable` / `compact` |
| `shadow` | `none` / `soft` / `lifted` |
| `font` | `system` / `humanist` / `technical`，使用本机字体 |

只允许表内变量，不支持 CSS、JavaScript、HTML、图片或远程字体地址。名称最多 60 字符，作者最多 80 字符，版本使用三段数字。内容相同自动去重，每账号最多保存 100 套。

制作时同时检查正文和次要文字与背景的对比度、按钮文字、键盘焦点、任务详情和窄窗口。普通文字至少 4.5:1，大文字至少 3:1；导入格式校验不能代替视觉验收。

## 服务端升级

账号同步需要已发布的服务端 `0.1.3-preview.1`，镜像为 `ghcr.io/i-am-yimin/codex-taskboard:server-0.1.3-preview.1`。升级前备份 PostgreSQL 与密钥，按[部署与升级流程](deployment-openresty.md#7-备份升级和验收)更新服务；启动时自动执行 `0004_user_themes`，仅新增个人外观和主题表，不修改任务。旧客户端可继续使用原有接口。

回退服务端程序前保留数据库备份；旧程序无需删除新增表。若恢复旧数据库备份，备份之后的主题和任务数据都会丢失，请按部署文档执行恢复。

接口契约见服务端 `/api/v1/openapi.json`，设计边界见 [ADR 0005](adr/0005-account-themes.md)。
