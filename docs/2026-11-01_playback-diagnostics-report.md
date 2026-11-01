# 播放链路诊断：J57 结构化纵向增量

2026-11-01。本批为播放器更多菜单增加正式“播放链路诊断”入口，并把离线命中/未命中、跨平台匹配、逐源请求、降档、缓存身份和 AVPlayer 原生就绪串成有界、可读的结构化记录。该能力复用音枢已有权威队列、唯一播放意图、匹配和 LX 多源边界，不改变选源算法。

## 实现

- `PlaybackController` 为每次解析建立独立 generation/run，最多保留最近 6 次；新播放、暂停、队列切换、媒体失效和释放会把仍运行的旧记录收敛为 cancelled，迟到结果不能写入较新的播放记录。
- trace 覆盖 `resolution/offline/match/source/cache/native` 六类阶段及 `info/success/fallback/failed/cancelled` 状态，记录来源显示名、平台、请求/实际档位和相对耗时。单次运行的 UI 以 8 个事件为当前产品观测上限。
- 正式服务链把永久离线命中/未命中接到匹配与路由之前；本机文件、系统媒体库、WebDAV、Navidrome 和 LX 路径分别产生明确的本地阶段。匹配记录手动版本、自动候选、实际取得音频和平台身份；多源记录逐源失败/超时、同档切换与降档。
- 原生 `ready` 事件增加 `cached` 标记。诊断页区分“网络媒体解码成功”和“缓存文件解码成功”，并明确 ready 只证明本次媒体容器已通过原生加载准备，不等于整曲播放、耳听音质或真机验收。
- 原生 route failure 会先把失败原因留档，再以新 generation 重试其他路线；失败 trace 不被后续 retry 覆盖。
- trace 文本由有界清洗器去除控制字符、完整 URL（含 token/query）并截断长度；请求头、认证信息、原始 resolver 异常和脚本输出不进入模型。测试注入 `https://private.test/...?token=PRIVATE`，序列化结果不含地址、主机或 token。
- 播放器更多菜单提供稳定的“播放链路诊断”入口；面板可重新解析当前曲目，展示空态、采集中、已就绪、失败和已取消状态，并保留手动返回播放选项的正常导航。

## 验证

- `npm run check`：类型检查及 **934/934** 项测试通过，0 失败、0 取消、0 跳过。
- `node --check scripts/test-ui.mjs`、`node --check scripts/test-native-playback.mjs`、`git diff --check` 通过。
- 完整 `bash scripts/test-native.sh` 通过：WAV、AAC、MP3、16-bit/24-bit FLAC、七种 opaque 容器、Range、缓存播放、PCM/FFT、自然结束、暂停/睡眠定时和 WebDAV。日志仍保留既有 Swift Sendable/weak-variable warnings，未把它们当作本批失败。
- 最终 Release UI `build/SourceUITests-1793544748938.xcresult`：**1 通过 / 0 失败 / 0 跳过**，187.544 秒。测试走正式在线歌曲匹配路径，要求结构化诊断行实际存在、精确“解码 · 原生媒体已就绪”行出现、native-success 事件存在和重试入口可用，再返回菜单继续原匹配/取消/换歌/重启断言。
- 最终证据目录：

```text
build/logs/playback-diagnostics-matching-20261101-225253-r4/
build/ui-screenshots/playback-diagnostics-20261101-225253-r4/
```

| 文件 | SHA-256 |
| --- | --- |
| xcresult `Info.plist` | `372d95458a4e0a1c840ea68d0bf9cf9d1c0cbc6518095fd936bea02495a73375` |
| `ui-catalog.log` | `7f9b0ea4c211e84c4525064dc1b3e783467ea3807c379822f9086415ddb5c98d` |
| `run-manifest.json` | `003f8f83b20b6ba6ec2e9dc1aa48c222858da5af42b622cb955eb1b7d0a47d5c` |
| `ui-summary.json` | `babe61e42fcce72cbb117d4438923ff516474951b0e69b98cbb83d6ef7b10ebb` |
| `ui-server-counts.json` | `90d9f27016eb4c1cfbd41a84b1242fa8d32a50a7623dcfa18979b9cfda92d629` |
| screenshot 001 | `b5eb04c6f9b9f7479827cb634404f8cd3fad4a4a79de9aebcce37bf8e38b5d43` |
| screenshot 002 | `f1d7263600bd4c7751bfa546400e0149c6b409fe97f9bb8e3ab80fc40aaf5a30` |
| screenshot `index.json` | `b7b6240c49ad64a566ee6b4b374dd860cf50f35cfe2e15bc52227e004e541f65` |

manifest 记录 `configuration: Release`、`exitCode: 0`、`sourceUnchanged: true`，基线提交 `69c931669982db39a4517552148c9494e5b6069b`，源码 digest `6cf1a86331db5af3776a8a8489606f9438fbcdd4bfe12a748a24523d15a7515e`，diff SHA-256 `4f632b30301e3e5e8bf3e606150c705160628e62fe5b8cb13da06455ae5318ae`，fixture SHA-256 `83ad352db7fef2363fe2d207b5397f7f607f3c08adca3a4995068b66e5cd654a`。安装 bundle digest 为 `15d79b716dc0d2497a77d6376b693c81b7ff2941760be1c4238810cc47a298b5`，`main.jsbundle` SHA-256 为 `727e3b7d50b201a3e444b3fbd2d838bb0591ba8c5c4cefb76ecdfcc174a4eda8`。夹具实际收到 4 次 `/matching-audio/fixture-live.wav` 请求。

两张截图均通过 `verifyCaptureEvidence`，`ready:true` 且无失败。已亲看正式播放页和诊断页：可见“永久离线文件未命中”“原曲优先，自动匹配作为回退”“匹配版本已取得音频”“播放地址已确定”“已绑定原生媒体缓存身份”和“原生媒体已就绪”的阶段顺序。诊断页底部 native-ready 行受当前视口裁切，截图中只露出部分；该行由 XCTest 对精确无障碍元素及 native-success testID 实际验证，不能把截图的裁切解释成缺失或整页像素验收通过。

## Clean unsigned archive

- `npm run ios:archive` 在 `bd904fe406c704966cd748ab41df829f292dd32f` 上以退出码 0 完成，Xcode 输出 `ARCHIVE SUCCEEDED`。`build-manifest.json` 记录 `dirty:false`、`workingTreeChanges:[]`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed:false`。
- IPA 为 12,859,396 字节，SHA-256 `45628ee9f872a0a5bfa81245a8ecb08f5e44752a4bb37160b0b552ad7810bd19`。ZIP 共 164 项且 CRC 全部通过。
- 从 IPA 直接读取的 `main.jsbundle`、arm64 可执行文件和 `Info.plist` 与 xcarchive 内对应文件逐字节一致。SHA-256 分别为 `37a0a27187285b143ebfcacaf517a27b577e67999a1855b7deeaee9d1f49e42f`、`4eb3b2fa2f98a21e56bb3d6aa0767b75fc0fa2ac833f4721777abc51bcf85391`、`dd9d3304202133385f743d3b89fc3af5f319faebaae0435cde36eb0b39e90452`；archive `Info.plist` SHA-256 为 `b25f5bc1bd5c5d6617840daae933184dacdb17d273d3c74db1927966db276786`。
- 生产 bundle 的精确测试适配器、matched fixture 和 `PRIVATE_TOKEN` 标记均不存在；bundle 没有 `_CodeSignature` 或 `embedded.mobileprovision`，`codesign` 也明确报告未签名。该结果只证明未签名设备包的生产内容与元数据一致，不证明 Apple 签名或真机可安装。
- 内容哈希快照保存在 `build/distribution-history/45628ee9f872a0a5bfa81245a8ecb08f5e44752a4bb37160b0b552ad7810bd19/`。独立副本保存在 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-01-playback-diagnostics-clean-bd904fe/`，包含 IPA、SHA-256、manifest 和机器可读验证摘要；两处 IPA 摘要一致。
- 当日检查内盘可用约 34 GiB、T7 可用约 695 GiB。构建完成后没有活动 Xcode/归档进程，本轮没有删除或搬走既有证据；`build/logs/cleanup-2026-11-01-ios27-j57.json` 记录保留决定和最新阶段引用。

## 失败与保留

- `SourceUITests-1793543519652` 在旧 Swift 第 1676 行、进入诊断导航前失败；原始 `run-manifest.json` 和日志保留。最终测试补上稳定 flac 前置、实际频谱等待和正式菜单导航，未降低原播放链路断言。
- r2 `SourceUITests-1793543703528` 与 r3 `SourceUITests-1793544052932` 已分别 1/0/0，但随后继续修正 trace 保留上限和最终 UI 证据后才采用 r4；中间成功不覆盖 r4。
- 本批没有删除失败 xcresult、r1/r2/r3 运行目录或最终截图，满足后续故障追踪与阶段证据留存要求。

## Sollin 门禁

- macOS 原生路由为 **R2**，PRIMARY 为 `skills/mobile-reverse/SKILL.md`；固定包提交 `cab634bd855fc287f6e420c1f36fd1a6b9245960`。
- `case-guard work/sollin-ipa` 通过，保持既有离线 scope；本轮没有新增 Sollin 采集、动态运行或私有服务访问。
- `node scripts/sollin-reverse-gate.mjs ipa --review` 通过，0 错误/0 警告；严格 review 为 52 Evidence / 17 Work items / 107 timeline / 43 Findings / 43 Paths。
- 本批复用既有播放/设置/诊断语义证据，产品实现和 UI 交互仍由音枢自有代码完成；不从参考包扩展私人服务、全局协议或商业权益。

## 未完成边界

- iOS 27 GitHub Actions 的当前代码云端终态尚未在本回执写成通过。
- 真实 iPhone、锁屏/后台、来电/耳机/蓝牙、真实源弱网与限流矩阵未验收。
- 冷/暖缓存、全部公开平台、Navidrome、WebDAV、本机/系统媒体与本批诊断 UI 的完整组合矩阵未覆盖。
- 小屏滚动、动态字号、VoiceOver、横竖屏/分屏和连续交互动效未覆盖。
- 未签名包、模拟器 ready 和合成匹配音频不能替代 Apple 签名、描述文件、真机或真实全曲播放。本批是 J57 的部分纵向增量，不报 J57、F04/F05/F08/F36 或全项目完成。

## 复现

```bash
source scripts/environment.sh
unset SDKROOT NODE_OPTIONS PYTHONPATH
export NODE_OPTIONS= PYTHONPATH=
node --check scripts/test-ui.mjs
node --check scripts/test-native-playback.mjs
npm run check
bash scripts/test-native.sh
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testOnlineMatching
node scripts/sollin-reverse-gate.mjs ipa
node scripts/sollin-reverse-gate.mjs ipa --review
git diff --check
```

每轮使用新的精确 xcresult、日志目录和截图导出目录；不要把 latest、历史成功目录或中间 r2/r3 当作最终候选。
