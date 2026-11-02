# 全局歌曲/专辑/艺术家搜索回执

2026-11-02。本批补 J25 的统一实体入口：正式搜索页新增“全部”页签，在所选公开平台或聚合平台上并列搜索歌曲、专辑与艺术家，并按“平台 → 类型”分组展示有界预览。歌曲继续进入现有权威队列，专辑与艺术家打开既有 `Discovery` 详情，“查看全部”切回对应独立页签。歌单与 MV 保持原页签，不改变其详情、播放或分页语义。

## 实现

- `SearchTab` 增加 `all`；统一查询只启动歌曲、专辑、艺术家三个协调器，歌单与 MV 协调器保持独立。
- 统一页复用三个协调器的原有 `groups`、`loading`、`error`、`total`、`hasMore`、取消与同目标重试状态。每平台、每类型最多展示两项，不复制结果或另建分页状态。
- 歌曲预览把该平台已加载的歌曲列表交给 `services.playTracks`，使用当前权威队列和现有播放控制器；不另建播放器，也不把 MV 混入音乐队列。
- 专辑与艺术家预览调用现有目录打开逻辑，复用正式详情、曲目读取、返回路径和加载状态。每个类型块提供至少 44pt 的“查看全部”，切换到该类型页签。
- 切换类型时只对尚未加载当前查询/平台的类型补发请求；回到“全部”不会清空歌曲第二页、专辑或艺术家结果。
- 平台标题明确显示来源；已载入数和目录总数分开显示，总数缺失时不补造。统一页只说明预览上限，完整分页留在独立类型页。
- Navidrome 私人目录继续只在既有“私人曲库”模式中搜索，不把服务器地址、凭据或私人结果送入公开搜索。

对应场景、结构与验收边界见 [UI 规格](ui-spec/unified-search-2026-11-02.md)。

## 验证

本批最终自动检查：

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 业务与类型检查 | **978/978，0 失败/0 取消/0 跳过** | `build/logs/j25-check-final.log` |
| 完整原生测试 | 音频格式/PCM、AVPlayer、系统媒体、WebDAV、下载、缓存、视觉资产等通过 | `build/logs/j25-native-20261102-145357.log` |
| Node/Swift/YAML/diff | `node --check`、Swift parse、工作流 YAML 解析和 `git diff --check` 通过 | 最终收尾检查 |
| Release UI | **2/0/0，0 跳过** | `build/SourceUITests-1793603350460.xcresult` |
| 完整 Release build | **BUILD SUCCEEDED** | `build/logs/j25-build-final-20261102-151502.log` |

最终 UI 运行使用 iPhone 15 Pro Max、iOS 26.3.1 / 23D8133、x86_64 模拟器、430×932pt、Release。`testSearchHistoryAndStates` 用时 29.868 秒，`testUnifiedSongAlbumArtistSearch` 用时 107.794 秒。运行结果：

- 正常搜索/历史状态回归继续通过；输入达到夹具的确定性提交前提后，旧查询不会在清空或重启后复活。
- “全部”查询同时显示网易云夹具的歌曲、专辑和艺术家，三类来源、预览和“查看全部”均可达。
- 歌曲预览打开现有播放页并显示本次统一查询选中的歌曲；歌曲页加载第二页后返回“全部”，专辑/艺术家预览仍在。
- 专辑详情与艺术家详情复用正式既有页面；“查看全部”进入歌曲、专辑、艺术家独立页签，返回不会重置已加载结果。
- 用例结束时删除本轮 LX 测试音源，随后打开并关闭正式歌曲页，验证清理后正常退出。

运行目录为 `build/j25-final-search-20261102-r2/`。`exitCode=0`、`sourceUnchanged=true`；运行前后源码 digest 均为 `3d76a71f4bc199c1c40bd6bae4c6b3a2008aa4ec5db37f440b501eca135b943a`，运行输入 diff SHA-256 为 `fc279ff4629c32cdcda86f6334cb6c9a528dfcacc8325e268b6e99f20a0bcef1`，fixture SHA-256 为 `58b48953521ea0c7d6a2737de2b31d92342ec5115e39255c9bfe7dade577b07c`，安装 bundle digest 为 `91f789bb1c4ef599e57fec8193c5acd315d137f4ab9bf32de10e5a56edbcd54c`，xcresult `Info.plist` SHA-256 为 `0b9a50d7c9247b105c9f54deb266f8315fad8320d8f6897f18b08823ea8fac64`。

## 公开协议抽查

本机匿名公开协议抽查只确认网易云现有歌曲、专辑、艺术家搜索接口的身份字段、页大小和总数可读：

| 类型 | 本页数量 | 总数 | 身份字段 |
| --- | ---: | ---: | --- |
| 歌曲 | 3 | 275 | 合法 |
| 专辑 | 3 | 592 | 合法 |
| 艺术家 | 3 | 84 | 合法 |

回执为 `build/logs/j25-public-search-probe.json`。请求没有使用账号、Cookie、私人令牌或目标 App 私有协议。QQ、酷我、酷狗与咪咕继续使用既有 provider 和既有契约证据；本批没有对这四家重新做真实在线抽查，因此不把五平台统一 UI 写成五平台真实网络矩阵已通过。

## 截图

最终 5 张 1290×2796 PNG 位于 `build/j25-final-screenshots-1793603350460/`。逐张 provenance `ready=true` 且人工检查；可见来源标题、类型标题、封面/类型图标、两行标题限制、滚动可达性和正式详情入口。

| 场景 | PNG SHA-256 |
| --- | --- |
| 艺术家预览打开既有艺术家详情 | `8bb9f19e14fd671a7f03c2561bf1e9ee9d6c11e3ac37d6d71a3ee48b5bf88e0a` |
| 专辑预览打开既有专辑详情 | `4c0874b502a6497087c95dee550f00e4c45f651c64fa501d3bc62d6f948ebbbe` |
| 歌曲下方目录预览仍可滚动到达 | `2d28c8815d8c4fa23710a9142cb6ea85f2959237ce0ba2bbf7f7724a341d7cf4` |
| 独立歌曲分页和目录结果同时保留 | `05649299c53ab61129d2360bafcf6f14c427b87dd4810cc844cdce68e61abbf8` |
| 同一平台并列展示歌曲、专辑、艺术家 | `d114baad3588032c93fa18b9987152828a16e8dd9b08e6a03cac466e8c3d698a` |

截图导出索引 SHA-256 为 `1c3830f2843cd7b81c67b1fcfa863687a98c5669aa4d685c819c8ff12e5abd93`；逐图来源复核回执 SHA-256 为 `ad7ea5165124a9b26966c7cfc049481a8778b97410c024dfc568da54cfe6ffcd`。

## 失败与修正

以下原始 xcresult 均保留，没有用最终通过覆盖：

- `1793600394569`：文本末尾换行没有稳定产生输入值，查询前提为空。
- `1793600600253`：统一搜索目标未启用对应 fixture 路由。
- `1793601018704`：统一歌曲缺少可播放媒体，队列进入下一首；补齐精确音频路由。
- `1793601485745`：第二页断言错误期待 UI 索引 30，夹具实际把第二页行追加为索引 2；修正断言，未放宽分页身份。
- `1793602004097`：搜索历史用例的新换行输入再次丢失，层级快照显示输入框为空；改为逐字符输入后显式点击搜索。
- `1793602946156`：功能断言通过，但人工检查截图发现专辑预览使用人物图标。产品修正为 `albums-outline` 后完整重跑，得到最终 r2。r1 的 xcresult、run metadata 和截图原样保留。

上述失败都来自测试输入、fixture 路由/媒体或断言错误，除最后的专辑图标外没有产品逻辑缺陷；最终通过使用独立 xcresult，不合并或改写旧结果。

## 清洁未签名归档

功能提交为 `f611c06f2eb383fb740cf8c96a4cd0d6534bbd0f`。从该清洁 HEAD 生成的设备归档：

- IPA：12,900,173 字节，SHA-256 `fa85e7574244eec7fa3a3f8ee51cddbb690d60372e8cc6c5e80258f544e6b781`。
- manifest SHA-256：`0647640f9d456cb5955386feafeedbdb263ada45ace6b345077343a0d8350d55`；`dirty:false`、`workingTreeChanges:[]`。
- arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`com.nexusmusic.app`、未签名。
- 164 个 ZIP 条目 CRC 0 错误；archive/IPA 的 138 个普通文件/链接路径集合一致，0 字节差异。
- 生产统一搜索标记存在；测试 fixture、测试音源、公开搜索夹具名称、私人主机、Wayfarer 夹具和签名材料均排除。
- 归档校验回执为 `build/logs/j25-archive-verification.json`，SHA-256 `83913c13d6f5bcc933f7d735873cb483b825d738004cccdbd969dd0944849a38`。

未签名包只证明清洁构建结构和排除项，不证明 Apple 签名、安装或实体机运行。

## T7 归档与空间

T7 为真实挂载且可写的 exFAT 卷。阶段副本位于 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-unified-search-f611c06/`，包含清洁 IPA/manifest/checksum、归档验证、检查/构建/native 日志、最终与视觉失败 r1 的完整 xcresult、每个中间失败 xcresult、run metadata、截图与 provenance、公开协议抽查、UI 规格冻结副本、archive verifier、源码提交与 diff。

主阶段复制：

- 541 个源 payload，129,708,228 逻辑字节；逐文件 SHA-256 与目标一致。
- 目标 payload 543 个，130,053,429 字节，包含 `SHA256SUMS` 与复制回执。
- exFAT `._*` 元数据 571 个，2,338,816 字节；目标全部文件 1,114 个、132,392,245 字节。
- `SHA256SUMS` 542 行全部核验通过，其 SHA-256 为 `37fefc01b189dc36a52fc1b25056f5543382426d74181cfed354bc4b82b1f487`。
- `payload-index.json` SHA-256 为 `6b9891ae38964e8303e4ebca5985c215e734de376aea67f64fe8c9eaf81f9099`；`transfer-receipt.json` SHA-256 为 `07a6ce0052daad66b1d407714acd603f2f971de54427f7da57d06f1dd4fe19f4`。
- 源原件全部保留，本批没有删除项目内容或迁移项目外个人文件。

首次复制命令因单文件目标路径计算错误而中止；没有覆盖源文件。该不完整目录改名为 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-unified-search-f611c06-incomplete-copy-attempt1/` 并保留，未计入主阶段 payload。重新执行全部路径后在目标侧逐文件验哈希，再生成主 `SHA256SUMS`。

收尾检查时无活动 Xcode/XCTest/archive 进程。J25 在 T7 增加了约 262 MiB 主阶段证据；主阶段复制在 30 GiB 阈值以上完成，未因空间压力扩大清理范围。收尾时内盘可用 57,526,571,008 字节（约 53.58 GiB），T7 可用 649,974,120,448 字节（约 605.34 GiB）；本批删除 0 字节、搬移 0 个个人文件、搬移 0 个受保护项目文件。小型回执为 `build/logs/cleanup-2026-11-02-j25-postflight.json`，SHA-256 `00c61e8b215aad326b399c5811fa00e71dc939d1441fd5a16630c6625d221aa6`。

## 远程交付与 CI

`be26761..a279581` 已按正常 fast-forward push 到 `origin/main`，push 后 `git ls-remote origin refs/heads/main` 与本地交付提交均为 `a2795812b08dee6804e32723060deaa0e73c4460`。iOS 27 workflow 已创建运行 `41406504201` / `a279581`；核对时为唯一 pending。

同工作流/分支仍有旧运行 `41390545740` / `cfac30c` 在执行。旧的 pending `41398183935` / `465cba4` 已由 `queue: single` 自动替换为 cancelled；没有手动取消或重派。核对状态为 **1 running / 1 pending**，符合项目队列上限。机器可读回执为 `build/logs/j25-ci-queue.json`，SHA-256 `30a8c35aa99a8fa7f2c13bbf5162263be96d3c9330a02ad4448cb91a6baf19e9`。

`41406504201` 的终态尚未返回。后续只补录 CI 状态的回执文档由 workflow 的 Markdown-only `paths-ignore` 排除，不把 pending、旧运行结果或本地模拟器结果写成 iOS 27 已通过。

## Sollin 与验收边界

J25 来源为用户清单 `U`。本批只复用音枢既有搜索协调器、`Discovery` 和权威队列，不新增 Sollin IPA/APK 分析、原始采集、Evidence、Finding、Path 或 strict-review 申请；因此不声明新增 Sollin 证据链，也不声明与参考版像素、动效或私有实现一致。

本批关闭统一歌曲/专辑/艺术家入口、分组预览、详情/播放复用与独立分页保留这一纵向增量。真实五平台统一搜索矩阵、其他平台的真实网络抽查、真实 iPhone、签名/安装、VoiceOver 实际操作、动态字号/小屏、弱网/限流、迟到与失败的真实服务矩阵、连续手势/转场录屏及 iOS 27 云端终态仍单独待验；不报 J25 全平台/全状态完成，也不报整个 F/J 或项目完成。
