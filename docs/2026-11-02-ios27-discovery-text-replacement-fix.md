# iOS 27 发现页文本替换修复

## 失败与根因

云端运行 `41390545740`（提交 `cfac30c`）在
`SourceSettingsTests.swift:4794` 的 `XCTAssertTrue` 失败。对应
`testDiscoverySongActions` 长按 `discovery-link-input` 后，等待系统编辑菜单中的
`Select All`、`全选` 或 `全選`。该菜单在 iOS 27 运行环境未出现。

紧凑日志位于
`/Volumes/T7 Touch/NexusMusic/BuildArchive/ci-41390545740/extracted/`；原始 ZIP 为
`ios-test-logs-cfac30c-13124438219.zip`，SHA-256
`7309e602061508a6bd8bfb0b8d0422cf15f71834c08c573a081d1d3b50d23616`。
`ui-online-runner.log` 后续的 `ECONNRESET` 发生在 XCTest 已失败并拆除夹具服务器后，是级联结果，不是本失败根因。

## 本地根因收敛

最终改为在测试侧使用 XCTest 已支持的原生文本输入快捷键：

```swift
field.tap()
field.typeKey("a", modifierFlags: .command)
field.typeText(value)
field.typeText("\n")
XCTAssertEqual(field.value as? String, value)
```

该 helper 同时用于发现页链接输入和另外三个原有依赖长按菜单的文本字段。三个独立 Release 结果均保留：

- `SourceUITests-1793607955575`：光标坐标加删除只删掉一个字符，实际留下 `...id=101101`，失败。
- `SourceUITests-1793608283189`：方向键/删除组合没有清空 React Native 输入，替换文本插入错误位置，失败。
- `SourceUITests-1793608470565`：`Command+A` 后替换，最终 `1/0/0`、204.493 秒；16 张 PNG 附件已按精确 xcresult 导出并抽查关键歌曲操作页。

`npm run check` 为 978/978；Swift parse 与 `git diff --check` 通过。

## 提交与构建

测试修正提交为 `51e517a1527ddb1d11ac2f2a2ef3b64ab139f0eb`，已正常 push 并核对
`origin/main` 一致。提交后从清洁工作区生成并验证未签名设备归档：

- IPA：12,899,334 字节
- SHA-256：`59e4818f8c355cfd0200797a38abafad41b79b8e7735c0b79c16b8ab8f3073f6`
- manifest：`dirty:false`、`workingTreeChanges:[]`、对应上述提交
- archive verifier：arm64、iphoneos26.2、最低 iOS 15.1、设备族 `[1,2]`，测试/私人/签名排除通过

## 云端队列与证据

push 后 GitHub Actions 为：

- `41415230222` / `51e517a`：唯一 pending
- `41406504201` / `a279581`：仍在运行
- 旧 pending `41411187417` / `73f975e`：由 `queue:single` 自动取消

本批未取消运行中任务，也未手动重派旧版本，队列保持最多 1 运行 / 1 排队；新运行终态继续观察。

T7 独立阶段目录为
`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-ci-discovery-text-replace-51e517a/`。
321 个普通 payload 共 119,897,975 字节，逐文件 SHA-256 与源一致；297 个 exFAT
AppleDouble 元数据另行记录。`SHA256SUMS` 的 SHA-256 为
`6f9cc5c78a916898ce9549f1bbd93aeb2c790188d1f618bc0a827fe98e15342e`。
源证据继续保留，本批没有删除源文件或迁移个人文件。

阶段收尾清理回执为
`build/logs/cleanup-2026-11-02-ios27-discovery-text-replace.json`，SHA-256
`cfa3faec5475d6b417b31e1d362fea22c74bd54d199b6922cf6f0dc6ad5dc056`。
独立 IPA 校验回执
`build/logs/ipa-verification-51e517a.json` 的 SHA-256 为
`c815e236734411d44e487c8d742ac0a303b88b07d61c773e6acbe83416c7f98d`：
164 个 ZIP entry 中 138 个普通文件 CRC/归档字节全部一致，manifest 对应代码提交
`51e517a`，其后的 `cce0005` 仅修改文档；测试、私人及签名标记排除，`ready=true`。
最终补充材料位于阶段目录 `supplement-final/`，其中
`SHA256SUMS` SHA-256 为
`0337be2e2ef113bc62c405f9ed6c1d3320660c5af9224769622bc5abbeb7180a`。

本批没有新增 Sollin IPA/APK 采集、Evidence/Finding/Path 或 strict review 声明；云端 iOS 27 终态、实体机、签名和其他开放验收项不能由本次本地测试与未签名构建替代。
