# 下载与列表选择边界回归回执

## 结论与来源

本批修复正式下载任务页、搜索歌曲组和发现详情的选择栏：按钮显示“取消全选”时，现在按当前已加载 ID 清空选择并留在选择模式；再次点击恢复当前页全选。完成音频不再被任务选择控件标识，独立播放、导出、删除路径保留。该行为来自音枢自身按钮文案和共享选择模型；沿用 Sollin IPA E-006 与 Android E-1300→F-098→P-095 已审查的任务/文件及批量入口边界，没有新增参考采集、调用图或参考运行时等价结论。

## 负证据与修复

- `SourceUITests-1793610691871` 在“两项均已下载中”前提处失败；导航超过响应时长，`heldFull=0/fullFinished=2`。原结果保留，测试随后改为显式保持两份真实部分响应并核对服务端 `heldFull=2`。
- `SourceUITests-1793611118239` 在旧实现上按预期失败；两条响应已保持，`heldFull=2`，显示“取消全选”后仍为 2/2。该结果证明真实行为缺陷而非文案误判。
- `SourceUITests-1793611906503` 的新增搜索回归通过，发现页在原有文本替换 helper 上失败，链接被插入旧值；失败 xcresult、附件与层级已保留，不归为选择回归。
- 最终文件替换 helper 先尝试系统全选菜单，窗口内未出现则使用 XCTest Command-A，并始终断言字段最终精确值；未缩减原有安全链接场景。
- IPA strict review 初次把 Android `E-1300` 写进 IPA 的机器可追踪 `evidence_ids`，校验以 `reference.unknown_evidence`（当时报告为 timeline 第1170行）失败；Android `E-1300→F-098→P-095` 本身有效，错误只在跨案例引用位置。移除 IPA 列表中的该 ID、保留正文引用和 IPA `E-006` 后复核通过。初次结果已写入小型失败回执；原始标准输出被随后同路径重跑覆盖，不能写成“错误日志保留”。
- IPA 文件校验器首次在环境脚本之外的 Python 路径启动，在内容断言前因 `'str' object has no attribute 'removeprefix'` 失败。失败事实和“未进入IPA内容断言”的边界另记；加载项目环境后运行未改动的同一校验器，CRC、archive字节、架构、签名和隐私检查全部通过。

## 本地验证

两条最终正式 Release 使用同一产品源码，均在 iPhone 15 Pro Max / iOS 26.3.1 模拟器、Release、正式生产入口运行：

| 精确 xcresult | 用例 | 结果 | 用例耗时 | 源码 / 安装 bundle |
|---|---|---:|---:|---|
| `build/SourceUITests-1793612699584.xcresult` | `testDownloadTaskBatchActions` | 1/0/0 | 257.578 秒 | `530a1e85…` / `6d097b63…` |
| `build/SourceUITests-1793613088076.xcresult` | `testDiscoverySongActions` | 1/0/0 | 222.847 秒 | `530a1e85…` / `501b120e…` |
| 同上 | `testSearchHistoryAndStates` | 1/0/0 | 34.224 秒 | 同上 / 同上 |

两个 run manifest 均为 `exitCode=0`、`sourceUnchanged=true`。下载任务夹具最终 `authFailures=0`、`heldFull=2`、`fullFinished=2`，覆盖 1/2→2/2、清空模式 0/2、空选择五项禁用、再次全选、暂停/取消/重试两份响应、完成文件 2/2，以及完成行长按不进入任务选择后独立确认删除。搜索覆盖 1/1→0/1→1/1；发现详情覆盖 1/2→2/2→0/2→2/2；两种空选择均验证四项动作禁用，退出选择后仍走普通歌曲行为。

5 张下载 PNG 位于 `build/ui-screenshots/download-selection-r5/`，索引 SHA-256 为 `e477a229…`、provenance review 为 `dfe78d65…`；2 张搜索/发现 PNG 位于 `build/ui-screenshots/selection-search-discovery-r2/`，索引 SHA-256 为 `f1228653…`、provenance review 为 `9e1f35ce…`。7 张均为 1290×2796，逐张 `ready=true` 并亲看；选择清空、暂停、取消、完成态、按钮启用关系及正常底栏/安全区一致。截图目录位于真实 T7 路径的既有候选证据符号链接下，原始 xcresult、run manifest 与日志保留在本机 `build/`。

`npm run check` 为 980/980；新增选择域测试覆盖全选切换、再次全选顺序、失效 ID、当前页空集合与 inactive 防进入。Swift parse、workflow YAML、完整 native 与 `git diff --check` 通过。IPA/APK strict review 最终均 0 错误/0 警告；IPA 失败回执 SHA-256 为 `10566dec…`，准确记录原始输出被同路径重跑覆盖。修正后的 strict review 保留了 IPA `E-006`，Android 链只作正文跨案例边界引用。

工作流下载组新增正式 `testDownloadTaskBatchActions`，不再只跑单项离线播放；发现组保留原有完整场景，并新增搜索和发现选择切换断言。下载任务另有独立搜索选择运行，避免搜索/发现完整场景失败时漏测选择边界。

## 清洁包、阶段副本与云端交付

功能提交 `ad1cf1c55fa82d90bb9ca1da1de8d31ef037bf8b` 已正常 push，远端 main 实核一致。clean unsigned archive 的 manifest 为 `dirty:false`、`workingTreeChanges:[]`；IPA 12,899,920 字节、SHA-256 `20395f051a8ff7d25be18de47f554267f8717ecfc453a58b5b1fcb84026ed070`。164 个 ZIP 项和 138 个普通文件与 archive 逐项字节一致，arm64、iphoneos26.2、最低 iOS 15.1、设备族 `[1,2]`，无签名或描述文件；正式产物存在，测试、私人端点与夹具秘密标记排除。验证 JSON/日志 SHA-256 均为 `ca3d5e37…`，main JS bundle 为 `8c42695a…`。

T7 独立阶段位于 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-selection-boundary-ad1cf1c/`，含 IPA/archive、manifest、验证、两条 xcresult、run 日志、7 张截图、失败回执、报告、UI 规格与提交 diff。源/目标逐文件 SHA-256 和 `SHA256SUMS` 复核通过。本批只复制和生成阶段回执，不删除、不移动源证据；空间与保留回执 SHA-256 为 `5c9d4a7c…`，记录 `deleted=0/moved=0`、活动构建0及内盘/T7空间。未签名包只证明清洁构建与静态边界，不替代签名、安装、真机或 iOS 27 终态。

交付时云端 `41415230222`/`51e517a` 仍在运行，`41426350992`/`ad1cf1c` 是唯一 pending，实核1运行/1排队；没有取消运行中任务或手动重派旧版本。本文档补充提交为 Markdown-only，不会另触发 workflow。

## 验收边界

本批只证明正式模拟器中的任务管理与选择边界，不证明真实平台下载批量限流、真机后台传输、签名/安装、iOS 27 终态或参考 App 像素/动效一致；这些范围继续独立保留。
