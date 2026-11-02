# iOS 27 发现页初始链接输入修复

## 失败与根因

云端运行
[`41406504201`](https://github.com/RhsR1024/nexus-music/actions/runs/41406504201)
（提交 `a279581`）的 `checks` 通过，iOS 作业在第 11 步失败。唯一失败测试为
`SourceSettingsTests.testDiscoverySongActions()`：测试首次向
`discovery-link-input` 输入的无效域名链接丢失了首字符，形成
`htps://music.163.c...`。应用因此显示“请输入平台公开歌单分享链接或选择平台后输入 ID”，
而断言等待“尚未识别此分享链接，请展开链接或输入公开歌单 ID”。

失败层级保存在
`build/ci-41406504201/evidence/SourceUITests-1793612555423/`。其中
`81DD5C80-A27B-4B2E-8E02-411FDC7C0188.txt` 明确记录了 `htps://music.163.c...`
及实际空输入提示。紧凑失败证据 ZIP 为
`build/ci-41406504201/ios-failure-evidence-a279581.zip`，SHA-256
`51b55e280d32101dff04ede83efe7c769babd2b6e0d44ca80fc35c0180d9ead2`。

提交 `51e517a` 已让测试在多数替换场景使用
`tap → Command+A → typeText → newline → 精确值断言`，但
`testDiscoverySongActions()` 的首次种子输入仍在 helper 定义后直接调用
`typeText`，漏掉了同一输入阻塞。该遗漏是本次失败根因，不是产品链接校验或网络故障。

## 修复

产品代码未修改；只将首次无效域名输入改为复用现有 `replaceLink(...)`：

```swift
replaceLink("https://music.163.com.attacker.invalid/playlist?id=101")
```

修复提交为 `ea134a9e335364cf81b7ea0a7609a42ffc69befb`
（`fix(ci): replace discovery seed URL on iOS 27`），diff 仅一文件一行替换。

## 本地验证

- 正式 Release `build/SourceUITests-1793617307441.xcresult`：
  `testDiscoverySongActions()` 1 通过 / 0 失败 / 0 跳过，测试耗时 234.199 秒。
- `exitCode=0`、`sourceUnchanged=true`；源码 digest
  `7126a103200e48d1a786eb2a2f3887046b17e6d89ec42da396b81b4faddf807a`，
  run diff digest
  `ad33e7a80201a8ddfe2527e1073fdb842bac8bb45122a025417d76a93a3f3d77`。
- 安装 bundle digest
  `efd73f396bd36c642664b44a4112c820b983d9aa8f0cb63849fc5e748ce927f6`。
- `npm run check` 980/980；Swift parse、`git diff --check` 与完整归档通过。
- Sollin IPA strict review PASS：54 Evidence / 19 WorkItems / 116 timeline /
  45 Finding / 45 Path，0 错误 / 0 警告。没有新增采集、私有服务探测或运行时声明。

## 清洁归档

`npm run ios:archive` 在提交 `ea134a9` 上输出 `** ARCHIVE SUCCEEDED **`。

- manifest：`commit=ea134a9`、`dirty=false`、`workingTreeChanges=[]`。
- IPA：12,900,214 字节，SHA-256
  `3ecd59c0e5eaef1273674b1987edd3fd56e89fb3bb6da7066e09d2ad42917613`。
- manifest SHA-256：
  `ae469a3339348b4b312988514c4c62b10e145cc6c902e62e85efb1c1ff902407`。
- arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、未签名。
- 164 项 ZIP entry / 138 个普通文件，CRC 和 archive↔IPA 逐文件字节均通过。
- 与已验证的 `90a0ecb` 产品 IPA 比较，138 个普通 payload 路径集合一致，
  payload 字节差异为 0；本次测试源码修改没有改变生产 payload。
- 无 `_CodeSignature`、provisioning profile、夹具 secret、测试输入 URL、
  私人 resource 路径或签名材料；既有 `/Users/ningli/` 构建溯源只出现在
  `app` 与 `main.jsbundle`，未发现凭据。
- 机器回执
  `build/logs/ios27-discovery-seed-archive-verification-ea134a9.json`
  SHA-256
  `bc0ae579caa501b19f52f85b8ee8c1acb720831dc6c5bbde0ac5fdae9c293a21`，
  `ready=true`、payload 差异 0。

验证器首次在系统 Python 3.7 上使用 `str.removeprefix` 失败，第二次因沿用了
J25 的特定中文生产标记断言而失败。两份失败输出均保留；最终 verifier 改为与上一清洁产品
payload 逐项比较后通过，没有放宽 CRC、签名、隐私或 archive↔IPA 检查。

## 推送与云端队列

`ea134a9` 已正常 push，远端实核 `origin/main` 一致。2026-11-02 19:14
Asia/Shanghai 的 Actions HTML 内嵌数据实核：

- `41415230222` / `51e517a`：运行中。
- `41435198362` / `ea134a9`：唯一 pending。
- `41430990767` / `90a0ecb`：已由 `queue:single` 自动取消。
- 队列为 1 运行 / 1 排队；未手动取消运行中任务，未重派旧版本。

云端 iOS 27 本批终态仍需该运行返回。实体 iPhone、真实授权账号、VoiceOver、
动态字号、小屏、弱网/限流、连续动效、签名/安装/续签、真机后台与功耗仍开放。
