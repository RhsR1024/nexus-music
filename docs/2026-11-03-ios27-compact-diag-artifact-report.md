# iOS 27 紧凑诊断产物与夹具中断处理

## 失败现象与证据边界

运行 `41510740220`（提交 `78018c7`）在 checks、原生检查和第 10 步 App 回归后，于第 11 步 `testSequentialTTMLLyrics` 失败。紧凑产物 `13183600447` 为 1,580,932 字节，API digest 为 SHA-256 `377ef3502f218f4af4d37d30de1d30bb91a6e6a834120e1d64cc167bcdba4deb`；其日志包含 Node `Error: aborted`、`abortIncoming` 和 `ECONNRESET`。

完整诊断产物 `13182872453` 为 756,359,033 字节，SHA-256 `bfd8273b25871bb134833b987d98c2854bb5f96eab2e7984ef37cf844b30c241`，超过当前下载通道 512 MiB 上限。匿名 API 返回 401/403，浏览器与原生桌面控制通道也不可用于取得该 ZIP。因此原紧凑包没有嵌套 `ui-summary.json` 或 `ui-catalog.log` 时，不能把 `ECONNRESET` 推断为某条 XCTest 断言或产品缺陷。

## 修复内容

`scripts/test-ui.mjs` 将合成 HTTP 请求处理收进受控异常边界：

- 明确识别 `ECONNRESET`、`ECONNABORTED`、`ERR_STREAM_PREMATURE_CLOSE` 与 `aborted`，记录 `clientAborts` 和脱敏的 `lastClientAbort`。
- 未预期夹具异常记录 URL 与堆栈、返回 500，并设置非零进程退出码，避免测试在夹具失效时继续生成假结果。
- `server.on("clientError")` 区分客户端断开与真实 HTTP 错误，并可靠销毁失效 socket。

`.github/workflows/ios.yml` 的紧凑日志上传新增递归路径，覆盖 `build/logs/**/*summary*.json`、`**/*counts*.json`、`**/*.verification.txt`、`**/*.csv` 和 `**/*.log`。后续即使完整诊断仍超过下载上限，也可直接取得测试目录下的 summary、counts 和 catalog。

## 本地验证

`npm run check` 为 990/990，`node --check scripts/test-ui.mjs`、YAML 解析与 `git diff --check` 通过。正式 Release `build/SourceUITests-1793659369901.xcresult` 的 `testSequentialTTMLLyrics` 为 1 passed / 0 failed / 0 skipped，run manifest 为 `exitCode=0`、`sourceUnchanged=true`。

本轮测试工具实际处理了一次 `ECONNRESET`：`ui-server-counts.json` 记录 `clientAborts=1`、`lastClientAbort.code=ECONNRESET`，XCTest 仍完成并通过。这证明新增异常边界能隔离已有的客户端断开，不证明旧 iOS 27 运行的 XCTest 根因已被复现。

## 构建与逆向门禁

`60a638a` 的 clean unsigned archive 为 `ARCHIVE SUCCEEDED`，manifest 对应同一提交，`dirty=false`、`workingTreeChanges=[]`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`，manifest SHA-256 `6a3b2fa04b2da038f2f0e6c9b21cd927383560526336ec48ab9a29500ea27206`。

IPA 为 17,827,502 字节、SHA-256 `d6b8526aaec09bc1ecd046cbe32a5a726ab25fb3a0fef195ea330a62efa9978d`。独立回执 `build/logs/ci-diagnostics-hardening-archive-verification-60a638a.json` 为 `ready=true`，178 个 ZIP 项 CRC、151 个 archive/IPA 文件逐字节、bundle identity、arm64、SDK、最低系统、设备族和未签名状态检查通过；测试入口标记、XCTest/PlugIns、签名及描述文件 0 命中。

离线 reverse-skill 门禁为 PASS：56 Evidence / 21 work items / 119 timeline events / 47 findings / 47 paths，0 错误、0 警告。该批只修改测试夹具诊断和上传路径，没有新增 Sollin 采集、私有请求或产品对齐结论。

## 远端状态

`60a638a` 已正常 push，推送时远端 `main` 一致；本回执随后只追加文档。push 后旧 pending `41536098207`（`430754d`）由 `queue: single` 自动取消，新提交 `41540983547` 成为唯一 pending；`41521043387`（`9fb541a`）继续运行。实核队列为 1 运行 / 1 排队，没有手动取消或重派。

后续仍需等待 `41521043387` 终态并确认 `41540983547` 实际执行。新的紧凑产物只能改善失败诊断覆盖，不能被写成 iOS 27 通过或产品缺陷已修复。

本批有效产物已保存到 T7 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-03-ci-diagnostics-60a638a/`，包含 IPA、archive、manifest、专项 xcresult、测试日志、验证、strict review、提交补丁和文档快照。复制后 299 个普通文件、100,376,064 字节的 `SHA256SUMS` 复核 0 失败；18 组目录/文件来源与目标逐项比较 0 missing/extra/mismatch，源证据保留，删除与个人文件搬移均为 0。`transfer-receipt.json` SHA-256 为 `2f9a807550210cfe0931d32576bc9bb0fde5937dc22d5c59765c81b5ecdb2198`。
