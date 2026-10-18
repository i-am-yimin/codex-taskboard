# Codex Taskboard 0.1.0 开发预览验收摘要

验收完成日期：2026-10-18（Asia/Shanghai）。

**结论：G0–G4全部通过，初版可用的开发预览验收完成。Windows未签名，Release保持草稿。**

候选提交：`f6a363e1779db36c97332725bdc433260c5ef366`；标签：`v0.1.0`。

## 验收范围

| 门槛 | 结果 | 条件数 | 原始证据 |
| --- | --- | --- | --- |
| G0 | 通过 | 12 | `g0-verdict.json` |
| G1 | 通过 | 22 | `installed-g1-complete-verdict.json` |
| G2 | 通过 | 17 | `second-device-g2-complete-verdict.json` |
| G3 | 通过 | 17 | `installed-g3-complete-verdict.json` |
| G4 | 通过 | 20 | `g4/g4-complete-verdict.json` |

G1在真实已安装Codex与Taskboard执行；G2/G3包含真实第二台Windows。撤权/缓存清理的本机模拟与第二台实际观察分别限定范围。G4包含实际Linux旧镜像→候选镜像→旧镜像及数据库回滚，测试部署已清理、虚拟机正常关机。

## 草稿发布

- [查看草稿 Release](https://github.com/i-am-yimin/codex-taskboard/releases/tag/untagged-3b5a5dbda88cbf9367e0)（需仓库维护者登录）。
- [发布运行 39100683953](https://github.com/i-am-yimin/codex-taskboard/actions/runs/39100683953)，五作业最终成功。
- 默认分支与v*标签保护规则、release环境人工审批及仅v0.1.0部署策略已配置并读回验证。
- 四种唯一文件摘要的来源证明验证成功，覆盖全部五项草稿资产；source/signer SHA均为完整候选提交。
- Windows版本0.1.0，Authenticode状态为`NotSigned`。Linux为`linux/amd64`，镜像ID`sha256:9969cb80e7eb3b9b06320a3cac232a876ea0d687cd3a05fd0bd1f1f6b8df1602`；SPDX2.3包含806个软件包。

## 下载文件摘要

| 草稿资产 | SHA-256 |
| --- | --- |
| `Codex.Taskboard_0.1.0_x64-setup.exe` | `77d3bfbfd6aa07243ca2ac70fa079d38e3394241e186ff6f25a366ae02e68009` |
| `SHA256SUMS` | `61dc18de68a061bcac4ebefb921f44d63cbc3164629b54a27ee66f8c96031ddc` |
| `taskboard-linux-amd64.tar` | `869161a6517473f9d5f473ebb438516fbe0535ad0441a98fe7816fe2eb01f14a` |
| `taskboard.spdx.json` | `e1ef952a8f5a63dc8dfb4faf1caca6d6bdbc6872f2b6cca2613eef3301fe5282` |
| `tmp-taskboard-linux-amd64_tar.spdx.json` | `e1ef952a8f5a63dc8dfb4faf1caca6d6bdbc6872f2b6cca2613eef3301fe5282` |

原始文件保存在忽略目录 `.artifacts/acceptance/2026-10-17-ci-f6a363e/g4/release-build-files/`，校验清单在同级 `release-extra-assets/SHA256SUMS`。GitHub将Windows文件名中的空格改成点号；若使用`sha256sum -c SHA256SUMS`，先将Windows文件名恢复为`Codex Taskboard_0.1.0_x64-setup.exe`。直接用PowerShell `Get-FileHash`与上表核对不受文件名影响。

## 已记录的构建差异与处理

1. Windows重建主程序仅28字节链接时间戳/CodeView GUID变化；这些字段之外的全部字节相同，13个runtime文件精确匹配。此处不声称二进制逐字节可复现。
2. 首次草稿作业因附加`.dockerbuild`记录格式不兼容失败。诊断原件完整保留，移除该附加CI产物后，仅重跑失败作业成功，候选/标签/正式产物保持。仓库收尾将 `pattern: "!*.dockerbuild"` 加入发布工作流的 artifact 下载步骤，避免再次下载该非 ZIP 记录；此后续修正不改变已验收标签。
3. 草稿说明更新后的标签字段已显式固定并读回核验。Windows下载名规范化说明和未签名状态已写入草稿。
4. HTTPS使用内部CA；测试环境的双设备耗时不构成互联网SLA。当前为开发预览。

## 可复核记录

原始诊断、安装与观察记录保存在忽略目录 `.artifacts/acceptance/2026-10-17-ci-f6a363e/`，不将账号、会话、设备路径或完整页面数据提交到仓库。[总判定 JSON](acceptance/v0.1.0-verdict.json) 保留验收完成时的原始字段；其中 `sourceWorkingTreeWorkflowFixLocalOnly` 描述该时刻状态，后续工作流修正在本次仓库收尾中提交。

| 原始判定文件 | SHA-256 |
| --- | --- |
| `g0-verdict.json` | `75f910c5f1fdbdd5a7fd4c39e732664ca2e7c2efbb1ceeb696843929d1c387c6` |
| `installed-g1-complete-verdict.json` | `b41d67fa2493077d06e8c05f7a7ff48f3dc921cdac1decf5f495c5c8f7a13187` |
| `second-device-g2-complete-verdict.json` | `3a87dc18e493f6019e3b5579179a5d02ae8a62f9c811cd2c325a4e3f143b59fc` |
| `installed-g3-complete-verdict.json` | `a192b659f3c513dddb26925b6ffd140b082b76d4d81da65e9033a04814162922` |
| `g4/g4-complete-verdict.json` | `ad19b56674b2f4212dabf30e4b5e898834e1dd48c58684e4ecaf212ce62d9d86` |

G3 的撤权与缓存清理包含本机已安装 WebView 的受控模拟；第二台的实际网络中断、只读按钮和自动恢复为独立观察，不能互相替代。双设备同步的耗时结论限于验收网络。G4 的 HTTPS 使用内部 CA，不代表公网证书或互联网 SLA。

## 仓库收尾范围

交付分支保留 `0748f67` 到 `f6a363e` 的九个原提交，与默认分支的工作流登记提交合并，并整理验收记录、文档和 Docker 构建记录排除规则。合并检查针对整理后的源代码运行；上方实机验收和草稿资产仍对应不可变的 `v0.1.0` 候选，不自动扩展到后续构建。
