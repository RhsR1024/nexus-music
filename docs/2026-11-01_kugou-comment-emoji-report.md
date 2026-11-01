# 2026-11-01 酷狗评论表情分段与过期 CI 断言

本批继续 F31 公开评论，只处理标准 Unicode 表情在评论 Sheet 中的字体回退，并修正一项使两个 iOS 27 测试同时失败的过期完整文案断言。没有新增入口、网络来源、持久化字段或播放副作用。

## 根因

评论正文继承用户选择的全局字体。当字体覆盖不能稳定回退到 iOS 彩色表情字体时，公开评论中的标准 Unicode 表情会显示为缺字方框。实现改为仅在完整 emoji cluster 上指定 `AppleColorEmoji`，普通正文仍继承原字体。

上一失败 CI run `41281715592`（提交 `d1a70cb`）执行 22 项，20 通过、2 失败。`testZNavidromePlaybackAndCredentials()` 与 `testFontImportAndLyricStyle()` 最终落在同一个综合播放器路径，真实根因只有一个：测试仍要求旧的评论来源提示，而产品已增加酷我、酷狗与咪咕。测试现改为精确完整文案，没有放宽成前缀匹配。

## 实现

- `splitEmojiText` 将普通文字和完整 emoji cluster 分段，覆盖单码点、VS16、ZWJ 家庭/职业、肤色修饰、区域旗帜、England/Scotland 等 tag-sequence 旗帜和 keycap。
- `CommentCopy` 以顶层无障碍原文包住视觉子段；emoji run 在 iOS 使用 `AppleColorEmoji`，正文、引用回复和选择能力保持原行为。
- 合成服务夹具加入音乐、职业女性、红心、家庭、火箭等完整序列；测试用精确完整 label 证明分割没有丢失不可见组合字符。
- 酷狗夹具控制调用改用 `URLSession` 与期望值等待，避免测试线程同步请求；原有加载更多失败、旧行保留与重试断言未缩减。

## 验证

`npm run check` 为 **914 passed / 0 failed / 0 skipped**，含 emoji 分段拼接、tag-sequence 旗帜和原有无表情文本回归。

三个精确 Release UI 结果：

| 场景 | xcresult | 结果 | 时间 |
|---|---|---|---|
| 合成评论 | `build/SourceUITests-1793525993209.xcresult` | 1 passed / 0 failed / 0 skipped | 40.731 秒 |
| 真实酷狗匿名服务 | `build/SourceUITests-1793526181969.xcresult` | 1 passed / 0 failed / 0 skipped | 74.539 秒 |
| 综合 CI 路径复验 | `build/SourceUITests-1793527124557.xcresult` | 1 passed / 0 failed / 0 skipped | 627.810 秒 |

合成 manifest `build/kugou-comments-emoji-run-20261101-synthetic/run-manifest.json` SHA-256 为 `03fa8959d3feb92a54fda867c049ace2d11d88851df1df471cfc0c72405da51a`；真实 manifest `build/kugou-comments-emoji-run-20261101-live/run-manifest.json` SHA-256 为 `cb64122d273c0c4e68326e640251ee8dcfa8588efbc95ce9617d42e0d8ad86cf`。两者 `sourceUnchanged: true`，source digest 均为 `4ca42fce79f94bd9d6f30bc6a1a9d09c0a109497470f75b0e5cd384634fa1c41`，dirty diff SHA-256 均为 `df5387d1009d817d93e31e6c4a5ebeacfb0b28ca664de475b604ffbf1366c378`。

综合复验 manifest `build/logs/run-manifest.json` SHA-256 为 `972db63e42921609437e0751edbb09c51b1f75337978d6c117452b620d4a1bc6`；`sourceUnchanged: true`，source digest 为 `2b7277d1eb5f70d731d019e8aa16ebade7cf6ef782ac978adf8040df402c5888`，dirty diff SHA-256 为 `ce64a1b15117b5690ae662af3ea84c90d593d738190602b0a4ca3e3407a1129c`，安装包 digest 为 `61fedfc72fe172b203ca560d370e4a5df2fc2a6d36d55140d5aa526875ba6ac9`，`resultInfoSha256` 为 `c642e37882cfd2a700a430261b555c2861851b370cba3225b0833bfdd0ddb0f6`。综合运行仅执行 `NexusMusicUITests/SourceSettingsTests/testZNavidromePlaybackAndCredentials`。

合成与真实场景各 3 张 PNG，共 6 张已亲看并核对来源；分页、长文本、最近评论、空态和完整无障碍 label 正常。真实昵称、正文与截图只留本机 Git 忽略的 `build/`。

## 表情字形边界

本机 iOS 26.3.1 模拟器即使由临时原生 `UILabel` 分别使用 system font 和显式 `AppleColorEmoji`，也显示相同缺字方框；两个独立诊断目录与截图保留为反证。因此本批只证明文本不再被错误拆分、字体归属及完整无障碍原文正确，**不宣称模拟器已显示彩色 emoji 字形**。iOS 27 云端、实体机与录屏仍须另验。

`security find-identity -v -p codesigning` 当时为 **0 valid identities found**。本批不能以模拟器或编译成功替代实体机、签名和动效验收。

## 未签名归档

`npm run ios:archive` 在 Xcode 26.3 / 17C529、SDK `iphoneos26.2`、最低 iOS 15.1、设备族 iPhone+iPad 下成功。归档 manifest 的 commit 为 `8d87811ead79661e97eaeab586e1fd6c9461dbd8`，记录了本批未提交源码，因此为 `dirty: true`；提交后的清洁归档另行记录。IPA 为 12,843,556 字节，SHA-256 `7a32aef8ba2e96bf7e5bbfb420e7bdbcdeac38ca0b5228f4fd0c281ed570f511`，归档日志 SHA-256 为 `76f0dcc9a4900a8ef7f8f3f0a580f819c9a31e8b655c292fd5d6b3564073361e`。

ZIP CRC 通过，共 164 项；arm64 主程序、生产 `main.jsbundle`、`com.nexusmusic.app`、最低 iOS 15.1 与 iPhone/iPad 设备族正确。bundle 含本批 `AppleColorEmoji` 实现，不含 UI 测试适配器或酷狗夹具控制标记。`codesign` 返回 `code object is not signed at all`，bundle 内没有 `_CodeSignature` 或 `embedded.mobileprovision`；这不构成签名或实体机通过。

初始 dirty IPA/manifest/日志独立保留在本机 `build/distribution-history/7a32aef8ba2e96bf7e5bbfb420e7bdbcdeac38ca0b5228f4fd0c281ed570f511/` 与 T7 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-01-comment-emoji-window/`。归档脚本现会在覆盖公共 distribution 路径前按 IPA 内容哈希保存独立快照，避免后续阶段再次覆盖最后可取包。

功能提交 `27a1a327117215d67fb86e60677aa2fcecbc7479` 后，在 clean `main` 上再次归档成功。archive manifest 为 `dirty: false`、空 `workingTreeChanges`，提交、Xcode 26.3/17C529、arm64/iphoneos26.2、最低 iOS 15.1 与 iPhone+iPad 均一致。clean IPA 仍为 12,843,556 字节，SHA-256 `26291bbb63624fb79e650cac5838c4a06c2eea8726f18a8ffa07ae4921d9d24a`；manifest SHA-256 为 `7c948a8727c386671bb599f0d8e45a127226865fa03fc27cef15da73b612f1a7`。ZIP CRC 通过且仍为 164 项，生产 bundle 含 `AppleColorEmoji`、不含酷狗夹具控制或 UI 测试标记；`codesign` 返回未签名，bundle 无 `_CodeSignature`/描述文件，签名身份仍为 0。

clean IPA、SHA 文件、manifest 与 `verification.json` 已独立复制到 T7 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-01-comment-emoji-clean-window/`；目标与本机源内容哈希一致，验证 JSON SHA-256 为 `01524e57832403b0143b197914b1c070e7106d25380639f030522cd890585aef`。前一 dirty IPA 的同路径快照重新核验仍为 `7a32aef8ba2e96bf7e5bbfb420e7bdbcdeac38ca0b5228f4fd0c281ed570f511`。

## 复用与未完成

沿用既有 Sollin 离线证据 `E-033 -> F-032 -> P-032`，严格复审为 52 Evidence / 17 Work Items / 106 timeline events / 43 Finding / 43 Path，0 错误、0 警告；只补充评论 Sheet 的标准字符渲染与测试证据，没有新增 IPA 分析、网络探测、账号请求或私有逻辑结论。完整回复、评论写操作、账号态/失效、弱网限流矩阵、Android、实体机、签名、动效及云端终态继续开放。
