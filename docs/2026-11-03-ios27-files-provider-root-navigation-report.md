# iOS 27 Files 本地提供方根目录导航修复

## 问题与范围

`41521043387` / `9fb541a` 的 iOS 27 运行在第二组 App 测试中 6 项通过、1 项失败。唯一失败为 `SourceSettingsTests.testWayfarerAppImport`，紧凑日志在第 270 行断言处结束：

```text
The actual Files cell/row must be visible before selection
```

失败附件中的 Files 层级同时显示：

- `DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: Nexus UITest Fixtures`
- `DOC.sidebar.item.On My iPhone` / `On My iPhone`

这说明 iOS 27 在尚未进入本地提供方时，就可能把目标提供方标题发布为 `DOC.browsingRoot`。旧辅助函数在检查 `On My iPhone` 之前接受该标题并只做停留等待，因此第二次打开选择器时一直停在 Locations 根页，目标夹具文件自然不可达。

本批只修正 UI 测试辅助函数的实际导航判定顺序。产品入口、Wayfarer 解析/导入逻辑、队列和原生播放均未修改。

## 修复

`ios/NexusMusicUITests/SourceSettingsTests.swift` 的 `selectLocalFixture` 现在按可见导航状态处理：

1. 目标文件、目标文件夹和实际文件行仍优先。
2. 只要 `On My iPhone` 单元存在，先点击进入本地提供方。
3. 进入后该 sidebar 单元不再存在，才接受 `DOC.browsingRoot` 并等待提供方枚举。
4. 不为通过测试放宽文件断言，也不以固定坐标代替 Files 导航。

测试补丁 SHA-256 为 `7c6053d2ec32711808d9a47e8627ca18bfae8a33e1b029b03d6483cd6300bcc8`。

## 本地验证

以下命令在 iPhone 15 Pro Max / iOS 26.3.1 x86_64 模拟器上执行：

```sh
source /Users/ningli/WorkSpace/Tools/env.sh
export NODE_OPTIONS=
export PYTHONPATH=
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testWayfarerAppImport
```

结果：

- Release xcresult：`build/SourceUITests-1793666257714.xcresult`
- 结果：1 passed / 0 failed / 0 skipped，测试耗时 270.476 秒
- `sourceUnchanged=true`
- `resultInfoSha256=a413bf911ded812279cea611a89c83a3cf30dc6233d890589f662de6a830241a`
- 安装 bundle 与同一运行清单绑定，模拟器 `BD3F486B-04DE-4BA7-9E58-64F10166B39D`
- `ui-catalog.log` SHA-256：`439a7ba579861976096778e1b7a0ddb2cc8d8ca0f80d4f2ecb584ad5583c3e41`
- `run-manifest.json` SHA-256：`5398cb1a3c3452f829b996014580e94ce0a78bcf27d38b2bc93689b379ad0665`
- `ui-summary.json` SHA-256：`7034256477075887ab28f4f688a54660b85585bbc1bddb1bb884bf0e02d46c88`
- `ui-server-counts.json` SHA-256：`57b2b1316c3b7e8a53a2bad8d2136afaa8139159d27ba9fd787122905977977d`

同一 xcresult 导出 5 张 1290×2796 验收截图至 `build/ios27-files-fixture-1793666257/`，索引 SHA-256 为 `e91b52ae3a7366b9a4c5953ed86626af6b761176c44a581650ee158c24ebaf03`。已亲看导入预览：2 个歌单、4 条歌曲、1 首收藏、1 条不支持来源，确认文案明确保留顺序/重复项并忽略来源连接、音源配置和设置。

`npm run check` 为 992/992，0 失败、0 取消、0 跳过。

## 门禁与边界

本批开始时的 dirty IPA SHA-256 为 `09f583075041608f0c2bc78283c713d76d9974f5441ce7aba671e6e0fce3160c`。产品/测试/初始文档提交 `2b6fbd50288f2747b0d37e513c913cea4630b420` 后，已从 clean HEAD 重建并独立核验：

- unsigned IPA：17,832,598 字节，SHA-256 `ab0f36957e10001d14dafb6c855d147f748837acd04dd00cdf8e4b5b61b66dff`
- manifest：校验时 HEAD 一致、`dirty=false`、`workingTreeChanges=[]`，SHA-256 `c449508bc6eb94a72ac62d8583311199d34881f28c11661514b0d24750927d57`
- archive log SHA-256：`ff8fb90605781f0e4cc9a23d8b1c34db77b26298994d45aa82c500d8f6514bf8`
- arm64、iphoneos26.2、iOS 15.1、设备族 `[1,2]`、bundle `com.nexusmusic.app`，顶层未签名且无描述文件
- 151 项 archive/IPA 文件逐字节一致，全部 ZIP 条目 CRC 通过
- 生产 `rubyInset` 标记存在；`selectLocalFixture` 测试辅助名称、目标文件断言文本、私人夹具、测试 bundle、源映射、签名和描述文件材料均未进入 IPA

独立验证回执 `build/logs/files-provider-clean-archive-verification-2b6fbd5.json` 为 `ready=true`，SHA-256 `d258d2e0ba8a7837089fe0bee780f455293d0c5bc850c2ba67764042ec9b93fd`。

dirty IPA/archive、精确本地 xcresult、截图和日志，以及尚未由新 iOS 27 运行关闭的失败压缩包/附件已复制至 T7 `2026-11-03-files-provider-root-precommit-b3451f3`；839 个普通文件、115,768,597 字节的 `SHA256SUMS` 复核通过，回执 SHA-256 为 `7aeb35448785853c13909eebc83f1b08d36328569abacbf90c0c49cea0042272`，源证据保留。

`node scripts/sollin-reverse-gate.mjs ipa --review` 通过，复用既有离线证据 `56 Evidence / 21 WorkItems / 119 timeline / 47 Findings / 47 Paths`，0 错误、0 警告。本批没有新增 Sollin 样本、目标观察或私有探测，也不提高任何 Sollin UI/功能完成度。

`2b6fbd5` 已正常 push 并实核 `origin/main` 一致。推送后的实际队列为 `41553030339` / `295bf94` 运行中，`41556364945` / `2b6fbd5` 为唯一 pending，即 1 运行 / 1 排队；没有手动取消或重派旧版本。

本地模拟器通过只证明测试导航在 iOS 26.3.1 上闭环。真正的修复结论仍以 `41556364945` 的 iOS 27 Actions 终态为准；实体设备、签名/安装/续签和真实 Wayfarer 数据继续独立验收。
