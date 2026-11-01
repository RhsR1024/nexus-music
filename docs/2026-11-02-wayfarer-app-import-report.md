# 漫途版本 1 备份：正式 App 导入、持久化与精确 MID 播放验收

2026-11-02。本批验证已有 Wayfarer v1 解析、存储和匹配实现通过正式 App 的 Files 文件选择器、预览、追加、重启与播放链路工作。生产 UI 只增加用于观察完成消息的稳定 `testID`；解析和导入实现沿用已存在的服务边界，不把本批次测试夹具写成真实私人备份验收。

## 实现与交互

- `LibraryDataTools` 调用正式 `importWayfarer`；选择文件后只展示计数与排除项，不显示源账号、连接地址、脚本或设置。
- 合成备份包含 2 个歌单、4 条歌单歌曲、1 首收藏和 1 条不支持来源；另有 2 个连接/源配置对象及全套设置必须忽略。
- 预览取消不得写入。确认“追加导入”后，经正式 `LibraryStore` 追加两个新歌单与去重收藏；歌单内顺序、重复项和导入身份均保留。
- 汽水长数字 ID 保持原始字符串，歌单行显示 `汽水 · 待匹配`；不支持来源不进入预览保存结果。
- App 终止并重新启动后，两个歌单、`first/second/first` 顺序、重复行及收藏继续存在。
- 导入的 QQ MID 通过已启用 LX 合成源精确解析和播放。夹具每次运行生成唯一纯字母数字 MID，测试读取该次预期 `/matching-audio/<MID>.wav`，从而同时排除旧缓存命中和模糊替换。
- 用例结束只删除两个唯一夹具歌单与夹具收藏，不触碰用户已有数据。

对应文件：

- `ios/NexusMusicUITests/SourceSettingsTests.swift::testWayfarerAppImport`
- `ios/NexusMusicUITests/SourceSettingsTests.swift::testWayfarerImportPickerCancellation`
- `scripts/test-ui.mjs` 的合成备份、唯一 MID、匹配计数与 fixture-state 路由
- `src/ui/LibraryDataTools.tsx`
- `.github/workflows/ios.yml`

## 验证结果

- 最终主用例 Release XCUITest：`build/SourceUITests-1793567530426.xcresult`，**1 通过 / 0 失败 / 0 跳过**，259.384 秒。
- 设备：`NexusMusic iPhone 15 Pro Max`，iOS 26.3.1 模拟器，x86_64。
- Files 选择器取消专项：`build/SourceUITests-1793567947710.xcresult`，**1 通过 / 0 失败 / 0 跳过**，27.286 秒。
- `npm run check`：类型检查和 **948/948** 项测试通过，0 失败、0 取消、0 跳过。
- `npm run test:native`：完整原生契约、音频处理、AVPlayer、系统媒体、WebDAV、缓存与视觉资产检查通过。保留既有 Swift 并发/弱变量编译警告，本批未修改对应生产代码。
- `node --check scripts/test-ui.mjs`、`swiftc -parse ios/NexusMusicUITests/SourceSettingsTests.swift`、工作流 YAML 解析及 `git diff --check` 通过。
- 主用例服务计数只命中本次唯一路径 `/matching-audio/WAYFARERMVYBSRDG.wav`，共 4 次。播放器显示合成歌词、真实进度与 `flac 实际请求`，证明该次导入 MID 进入 PCM 播放链。

### 运行 provenance

主用例最终运行目录为 `build/wayfarer-app-import-r3-20261102/`：

- `exitCode=0`，`sourceUnchanged=true`；
- 运行前后源码摘要均为 `382b7f201b4305fbfc48d4f6cfebfc978eccc3fe904f4050b6115e78cf3de595`，共 525 个输入文件；
- 运行输入 diff SHA-256 为 `c7e978976aaaec8c8eb2100f0c49297c602ff3ce35efe3db11470ddf7fcefeb1`；
- 安装 bundle digest 为 `912e4f7a03fc0e9219b68c4e0780d717db235cc3a78c2242e8dbd165920b9ba0`；
- `main.jsbundle` SHA-256 为 `667eed00c03df59889f6de2bc2e9e8320b142402abb7f362b043a9ca4c1f64ef`；
- 可执行文件 SHA-256 为 `f79e7a99566c85e2243a7643585418d24008483c11ee40d6f33b052d95bdd9bf`；
- xcresult `Info.plist` SHA-256 为 `c1cc08afa9ec06840f010f608a20a011a2d17e20a0267499056b7b351cb09503`；
- `run-manifest.json` SHA-256 为 `4848d5e3e47282295318023127b687ae6d2aaaee304ec73f8d56c4ab31a80834`；
- UI 日志 SHA-256 为 `3ec9985884c2bc9a3aa8ac3fae3891ab857ab4a88f537634527b9045a572b181`；
- 服务计数 SHA-256 为 `86cbbe80328241c8ae8c68e788fe26e2436eff4ea5888c3cbf7c1991abf69e6d`；
- summary SHA-256 为 `13ee6661c61bd95f62f7eac28159d7063e548500658c3d775076ec52a33ad1bc`。

文件选择器取消专项运行目录为 `build/wayfarer-import-cancel-r2-20261102/`：

- `exitCode=0`、`sourceUnchanged=true`，运行前后源码摘要同为 `382b7f20…`；
- `run-manifest.json` SHA-256 为 `af4da16531db7402697492b807fe35b1aa9c473f9369026aefe2a3d7bd6ab008`；
- UI 日志 SHA-256 为 `4cd5445609aaea4a725a864ea064f54fb4ad77fb31652a0d450196dd8a95d473`；
- xcresult `Info.plist` SHA-256 为 `2232df7d5ee89d72f24b991c3ff958fe6cf542120160ce19bf188d309b539542`。

## 清洁未签名归档与 T7 阶段副本

功能提交 `52f7d77a6dc363e3f788a8c34dd42137f1010bb3` 使用 `npm run ios:archive` 成功生成未签名设备归档。manifest SHA-256 为 `c4ace7f36ffc2b4245183335a860734ff83448f3a0fe928a2e874c2a85b2904e`，`commit` 与 HEAD 一致、`dirty=false`、`workingTreeChanges=[]`；归档为 arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`，`signed=false`，包内没有 `_CodeSignature` 或 provisioning profile。

IPA 为 12,872,804 字节，SHA-256 `9c82f60cc319dffb4e514703bb67c4a631eb50d192fb2d23b5e804d60be8fd47`。164 个 ZIP 条目全部通过 CRC；138 个 archive/IPA payload 文件路径集合一致、逐文件 SHA-256 一致。`main.jsbundle`、可执行文件和 `Info.plist` 的摘要分别为 `ebcb9180a4d1c6ca5888d443d6626499615ef87bbbd46ec61739ca57d0cd391a`、`613011efd36039102276bd23523aa581c2608470ddbe8da419e0d91bcdf0cc29`、`dd9d3304202133385f743d3b89fc3af5f319faebaae0435cde36eb0b39e90452`。生产入口标记 `Wayfarer`、`_importWayfarer`、`library-data-message` 存在；`fixture-secret`、`private.invalid`、`matching-audio`、`WAYFARERMVYBSRDG`、`Nexus Wayfarer Fixture`、`WAYFARERFAVORITE`、`private-source-script` 和 `nexus-ui-test-online-adapter` 均未进入 IPA。机器可读验证为 `build/distribution/ipa-verification.json`，SHA-256 `2ed4d3843d00b871ef636c33f6c28433a5f708dbf53e7046645246875c739880`；同内容快照保存在 `build/distribution-history/9c82f60c…/`。

精确阶段证据已复制到 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-wayfarer-import-52f7d77/`，包含本批文档、IPA/manifest/verification、成功/取消/失败 run 目录、6 个 XCResult、初始成功截图、检查/归档日志及当日清理回执。376 个 payload 文件共 113,764,938 字节在复制前后逐文件 SHA-256 一致，`SHA256SUMS` 376 行全部通过。exFAT 生成的 370 个 `._` AppleDouble 元数据文件保留且与 payload 分开记录；`transfer-receipt.json` 为 `payloadVerified=true`。

## 截图证据

5 张 1290×2796 PNG 位于 `build/wayfarer-app-import-r3-20261102/screens/`，逐张来源核验为 `ready=true`，并已人工查看：

1. `001-Wayfarer-imported-track-resolved-to-PCM.png`：`6e6b19b37a8451a55c70191fa57f06c0eedc869f7843679b223f8ab22441ac8c`
2. `002-Wayfarer-favorite-persists-after-relaunch.png`：`4668e980b54d9fa89962e9ac26ad857b606eadbbb3fecc8db5f7d7a366395f41`
3. `003-Wayfarer-playlists-preserve-order-duplicates-and-unsupported-count.png`：`1c8cdbfd74b4cfe67fc776d4d4973813cb03728a848fd083a97d6d085adf0b14`
4. `004-Wayfarer-import-appended-without-private-source-configuration.png`：`de097d7653d1e9f07063501fa7c83783785b3e0450a4830b898dd631521d8632`
5. `005-Wayfarer-preview-before-import.png`：`1025f42f657e8c378d7ccf946497f2ebef25a9f5ea6067e28a68cd3a9c188957`

截图索引 SHA-256 为 `d6a92e0245d4d1d7b1e07c4121d0b6961af0b9480ac19e44be8290d37f382f51`；逐图 provenance review SHA-256 为 `1a4906d39159a820c4b6031de62df49579020c5583934ed093e5df5e32f10e99`。

## 失败与修正

- `SourceUITests-1793566007652`：测试源码中的 `&&!` 缺少空白，Xcode 编译失败。之前的 Swift parse 未触发该诊断，随后改用真实 Xcode 编译验证。
- `SourceUITests-1793566158212`：测试夹具把 QQ MID 写成含下划线值，而正式解析器只接受字母数字。测试改为合法字母数字，不放宽生产校验。
- 初始通过 `SourceUITests-1793566440365` 为 1/0/0、268.562 秒，证明功能链路；最终 r3 以隔离目录重新采集完整 provenance。
- `SourceUITests-1793567128641`：固定 MID 在第二次运行时已缓存，播放器正常 ready，但夹具未收到新网络请求，测试错误地把缓存命中判为失败。真实根因是证据隔离而非导入/播放故障；改为每次唯一 MID并读取该次预期路径后，r3 通过。

上述失败 xcresult 与 failure-evidence 均保留，不以最终成功覆盖。初始通过的 xcresult 也保留为历史结果。

## 隐私与边界

- 仓库忽略的真实备份 `resource/wayfarer_music-backup.json` 未加入 Git：4,558,239 字节，SHA-256 `bd5f4fc4e25390b0c34a34af5edd52193c2a3a925097f38ba40d547f93d60460`。
- UI 测试只生成合成标题、账号、设置、URL 和令牌；预览及保存断言确认 `fixture-secret` 与私有源配置不可见。
- 本批没有新增 Sollin 逆向分析或采集，因此没有新增 reverse-skill case；既有离线 scope、Evidence 和寻址边界不变。
- 本批证明模拟器中的正式 App 导入、持久化、合成 LX 播放链及清洁未签名构建，不证明真实私人漫途备份、真实跨平台音源、iOS 27 云端、实体机、签名/安装、弱网或长期播放稳定。

## 复现

```bash
source scripts/environment.sh
export NEXUS_UI_RUN_DIR=build/wayfarer-app-import-final
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testWayfarerAppImport

export NEXUS_UI_RUN_DIR=build/wayfarer-import-cancel-final
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testWayfarerImportPickerCancellation
```

每次正式采集必须使用新的精确运行目录、xcresult 和截图导出目录；不得复用 `latest` 或覆盖旧 baseline。
