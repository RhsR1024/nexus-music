# Ryderwe 公开仓库盘点

盘点日期：2026-10-17（Asia/Shanghai）。来源为 Ryderwe 的 GitHub 公开仓库列表和各仓库默认分支的 `git ls-remote` 固定提交；仓库页面的 fork/上游信息与根许可证入口对重点项目做了复核。公开仓库数量按主页显示为 46，其中包含名为 `Ryderwe` 的 profile README 仓库。此文档是参考盘点，不代表复制、编译或运行了这些项目。

## 采纳规则

音枢只采纳可独立重实现的职责、数据契约和交互线索。Sollin IPA/APK 的功能、UI、交互对齐仍必须先走项目的 `reverse-skill` 硬门禁；本次公开源码盘点不能替代 IPA 证据。涉及 Sollin 私有账号、用户中心、激活/赞助、服务支持、遥测、专用 API 或外部云端链接的能力不移植。

需要登录或云端的通用音乐功能（平台登录、推荐/FM、识曲、评论、下载和同步）可以参考公开源码的状态模型，但必须接入音枢自己的 provider、Keychain、SQLite 和播放器边界。优先采用本地实现或已有平台 provider；无法在本地合法满足的项登记为待决，留到开发收尾和真实设备阶段再决定落地方式。

许可证按仓库根目录和 GitHub 页面逐项核对。表中的“未声明/未核验”不授予复制权；即使仓库有 MIT/Apache/GPL，也只覆盖其明确声明的源码，vendor、音源脚本、品牌资源和依赖仍需单独核对。GPL 项只用于协议/字段研究，不直接混入音枢闭源产品。

## 重点结论

| 优先级 | 仓库 | 固定提交 | 事实与可用方向 | 音枢采纳边界 |
| --- | --- | --- | --- | --- |
| A | [Sollin-Music-Desktop](https://github.com/Ryderwe/Sollin-Music-Desktop) | `c9d446f6ad3b7ea1aff64bd5ce290b6e7f9712a8` | Sollin 作者原始桌面源码，根 LICENSE 为 MIT；播放器、歌词、背景、设置、WebDAV 及本地状态职责清晰。 | 只参考职责和状态模型；Electron/DOM/AMLL/私有服务不直接移植，第三方 vendor 许可另核。 |
| A | [Youmi-Music-IOS](https://github.com/Ryderwe/Youmi-Music-IOS) | `152567b3c4a337c9c5bee06bb7f40ebaa49d40c2` | Swift iOS fork，页面和网易 provider 源码可读；上游为 `7DaysMax/Youmi-Music-IOS`，仓库未声明许可证。 | 可参考网易登录、公开推荐/日推、私人 FM、缓存和错误状态；不得复制代码、外部 API 地址、Cookie 协议或品牌资源。 |
| A | [lx-netease-music-mobile](https://github.com/Ryderwe/lx-netease-music-mobile) | `4d2f8b774617a7d359af8221b2ee52b68f6bdd11` | `souvenp/lx-netease-music-mobile` fork，Apache-2.0；LX/网易 provider 结构。 | 仅按 Apache 条款逐文件核对后参考 provider 契约；不整体替换音枢 LX 宿主。 |
| A | [api-enhanced](https://github.com/Ryderwe/api-enhanced) | `2c36daf07a4a092df3e5dc66f3acc9e1a9b4c91f` | `NeteaseCloudMusicApiEnhanced/api-enhanced` fork，MIT；网易端点和响应模型。 | 用作端点/字段研究和契约夹具，不把其公共部署或 Cookie 服务写入产品。 |
| A | [KuGouMusicApi](https://github.com/Ryderwe/KuGouMusicApi) | `3a2c2b1dbe97731c37fcd30fd0e4a8196bc1f13f` | `MakcRe/KuGouMusicApi` fork，MIT；酷狗搜索、登录和歌曲 URL 字段研究。 | 只提炼字段和失败语义；登录凭据、签名和接口稳定性需音枢 provider 自己验证。 |
| B | [QQMusicApi](https://github.com/Ryderwe/QQMusicApi) | `13b08afd3180cc74d76fff208956b77a560abd22` | `jsososo/QQMusicApi` fork，GPL-3.0；QQ 接口研究。 | 仅作协议/字段参考；不复制 GPL 实现到音枢发行物。 |
| B | [qqmusic_flac](https://github.com/Ryderwe/qqmusic_flac) | `0f9863507078acd6d26af40bd59ded2e262ab53c` | `Suxiaoqinx/qqmusic_flac` fork，MIT；QQ 音频链接和格式线索。 | 只做音质字段和可用性实验，仍需独立实现和真实服务验证。 |
| B | [meting](https://github.com/Ryderwe/meting) | `1c2f4c98eed749200d9d7ff5cab329c4308f4268` | `metowolf/Meting` fork，MIT；多平台 API 抽象。 | 用于比较 provider 适配边界，不引入其服务探测或未经审计的整套实现。 |
| C | [Sollin-mobile-release](https://github.com/Ryderwe/Sollin-mobile-release) | `8e2933e75d5960cde98bad0d3c1aa347eb4088b0` | iOS/Android 发布说明仓库，无移动源码。 | IPA/APK 只能按 `mobile-reverse`/`apk-reverse` 逆向；发布仓库不构成功能源码证据。 |
| C | [PrismMusic-Release](https://github.com/Ryderwe/PrismMusic-Release) | `078f567974ea1adc33e40bf3f67a8f95c1668812` | 发布和截图仓库。 | 截图可作 UI 补充，不能替代 Sollin IPA Evidence→Finding→Path。 |
| C | [astro-sollin](https://github.com/Ryderwe/astro-sollin)、[sollin-new-web](https://github.com/Ryderwe/sollin-new-web)、[Web-Music](https://github.com/Ryderwe/Web-Music) | 见下表 | 官网、网页或文档入口。 | 只参考公开文案和导航，不移植账号、赞助、服务支持或网页业务。 |

### Youmi 源码证据与限制

在固定提交 `152567b3c4a337c9c5bee06bb7f40ebaa49d40c2` 上，以下路径值得作为行为线索：

- `NeteaseMusic/NeteaseMusic/Services/AuthService.swift`：手机号、验证码、二维码登录，登录状态恢复和退出。
- `NeteaseMusic/NeteaseMusic/Services/MusicService.swift`：公开推荐、`/recommend/songs` 日推、`/personal_fm` 私人 FM、FM 丢弃、搜索、歌单、歌词、歌曲 URL 和评论。
- `NeteaseMusic/NeteaseMusic/Services/APICache.swift`：actor 缓存、TTL 和相同 key 请求去重。
- `NeteaseMusic/NeteaseMusic/Views/PersonalFMView.swift`：FM 批量获取、预加载、播放下一首和丢弃当前歌曲。
- `NeteaseMusic/NeteaseMusic/Services/LyricActivityManager.swift`：ActivityKit 歌词 Live Activity 的职责边界。
- `NeteaseMusic/NeteaseMusic/AudioDownloadService.swift`、`SongDownloadService.swift`：缓存、文件类型/有效性检查、并发下载和失败状态；未证明完整后台 URLSession、可恢复 Range 续传、摘要校验和重启调度。
- `NeteaseMusic/NeteaseMusic/Services/APIConfig.swift`：使用公开的外部网易 API 服务地址 `https://youmimusicapi.preview.aliyun-zeabur.cn`，该地址不能进入音枢配置。

因此 Youmi 能证明“平台登录后优先使用平台推荐/日推/FM”是合理产品路径，也能提供 FM 状态机的交互参考；它不能证明 Sollin 私有服务可以照搬，也不能替代音枢当前更严格的离线下载设计。音枢已实现的本地推荐/FM 仅作为无账号、离线或平台失败时的 fallback。

## 全量仓库清单

下表覆盖主页列出的 46 项。提交为 2026-10-17 盘点时默认分支 HEAD；“未声明/未核验”表示没有形成可用于移植的许可证结论。

| 仓库 | 默认分支 HEAD | 类型 / 上游 | 许可证结论 | 对音枢价值 |
| --- | --- | --- | --- | --- |
| `Ryderwe` | `2ea03881388adb25f15ef12b19d494f04a442356` | profile README fork，`anuraghazra/anuraghazra` | 未声明/未核验 | 无播放器功能 |
| `Abracadabra` | `e3171c8d4cf8f7df5b96b378ac1c4aa3a70139fe` | fork，`SheepChef/Abracadabra` | 未声明/未核验 | 与音乐核心无直接关系 |
| `AppleNetEaseMusic` | `a2fef541c0c2ca4ac6e97d752dac5120569dc443` | fork，`kakusx/AppleNetEaseMusic` | 未声明/未核验 | SwiftUI/Flutter 和网易接口线索；不复制 |
| `Astro` | `acde76dbeb9798c363fea774711969c3183e8f70` | 自有网站/模板 | 未声明/未核验 | 无播放器核心 |
| `ColorOS-Live-Lyrics-Bridge` | `85f27b5f0d3bb813e668c46591573d16d2d93472` | fork，`Andrea-lyz/ColorOS-Live-Lyrics-Bridge` | 未声明/未核验 | 系统歌词桥接线索，非 iOS 核心 |
| `DefaultOpener` | `a77e412d286c775d004f51cee981c6d3ba732c44` | 自有工具 | 未声明/未核验 | 无直接价值 |
| `DouyinVideoDownload` | `2b2df811c69800f280c0d725d020a57593d390a1` | 自有工具 | 未声明/未核验 | 无直接价值 |
| `Firefly` | `d0ff37cf17cd272b1cdaa5fe323b6a2a0f3ecbd0` | 自有项目 | 未声明/未核验 | 无直接价值 |
| `FlaskHTTPStudio` | `e0a78d4364af014e24cd920c4c5f3d6bf61cdf58` | 自有工具 | 未声明/未核验 | HTTP 调试线索，不能进入产品 |
| `ForumSystem` | `a371d00e3d29bd2153c5a0e783601d5433593ab4` | 自有网站 | 未声明/未核验 | 无播放器核心 |
| `KuGouMusicApi` | `3a2c2b1dbe97731c37fcd30fd0e4a8196bc1f13f` | fork，`MakcRe/KuGouMusicApi` | MIT（页面结论） | 酷狗 provider 字段研究 |
| `LinuxDoStar` | `66f8322822d0bac6e61cdbe5025acf467cdc1a9b` | 自有工具 | 未声明/未核验 | 无直接价值 |
| `LuN3cy` | `ff57b45223e572fffeeb4a235fbab7e05ab92d10` | 自有项目 | 未声明/未核验 | 无直接价值 |
| `NimbleMark` | `03c1330a183ac3194a274d0453c5a41bdf10938d` | 自有工具 | 未声明/未核验 | 无直接价值 |
| `OnlySwitch` | `25aab69a156cf45bfd250ca888052e385276fd47` | 自有工具 | 未声明/未核验 | 无直接价值 |
| `PasteMD` | `a98bb0b6cf60377a2ce106f7652b90852b8611e3` | 自有网站 | 未声明/未核验 | 无播放器核心 |
| `PrismMusic-Release` | `078f567974ea1adc33e40bf3f67a8f95c1668812` | 发布/截图 | 未声明/未核验 | UI 补充证据 |
| `QQMusicApi` | `13b08afd3180cc74d76fff208956b77a560abd22` | fork，`jsososo/QQMusicApi` | GPL-3.0 | 协议研究；不复制实现 |
| `Rainyun-Checkin` | `c160cf4230548baa2c7a97850447c90537361fa8` | 自有工具 | 未声明/未核验 | 无直接价值 |
| `ShortX-Files` | `ed261eb2a13b1ce93d507b8becb9d6befc6f0fc6` | 自有工具 | 未声明/未核验 | 文件处理线索，不能替代音枢存储 |
| `Sollin-Music-Desktop` | `c9d446f6ad3b7ea1aff64bd5ce290b6e7f9712a8` | Sollin 原始桌面源码 | MIT（根 LICENSE） | 最高价值：职责/状态模型 |
| `Sollin-mobile-release` | `8e2933e75d5960cde98bad0d3c1aa347eb4088b0` | 发布说明 | 未声明/未核验 | 只作为 IPA/APK 来源线索 |
| `Telegraph-Image` | `878932d625cf71e3331421d934fb66740d939bfd` | 自有工具 | 未声明/未核验 | 无直接价值 |
| `UniER` | `6cd226b267f12a2500dc7dc7d3ceef9a696472b8` | 自有项目 | 未声明/未核验 | 无直接价值 |
| `Web-Music` | `a0d897f8fb84a69f85787e8271c271700e20a000` | 自有网页 | 未声明/未核验 | 仅网页入口 |
| `XQuickEnergy` | `f60743569d123161333f6f48f94511301e028de5` | 自有工具 | 未声明/未核验 | 无直接价值 |
| `Youmi-Music-IOS` | `152567b3c4a337c9c5bee06bb7f40ebaa49d40c2` | fork，`7DaysMax/Youmi-Music-IOS` | 未声明 | iOS 网易 provider/UI 参考；不复制 |
| `agent-skill-git-checkpoint` | `2c5db689423820ae9b35c839780591efc0745962` | 自有工具 | 未声明/未核验 | 与产品无关 |
| `api-enhanced` | `2c36daf07a4a092df3e5dc66f3acc9e1a9b4c91f` | fork，`NeteaseCloudMusicApiEnhanced/api-enhanced` | MIT（页面结论） | 网易端点/响应字段研究 |
| `artex-ko` | `205ad921c2a3f7b5fa3c2a64df8195d065887ea1` | 自有网站/工具 | 未声明/未核验 | 无播放器核心 |
| `astro-sollin` | `eb7999f9b7ca615b77297c124602ba009e0fda43` | 自有 Sollin 官网 | MIT（页面结论） | 文案/导航参考 |
| `astro-theme-retypeset` | `a636b6d393be714cab52d3fc4baddd3f3905f701` | 自有主题 | 未声明/未核验 | 无播放器核心 |
| `build-your-own-x` | `6089685024985c2544f6a6986f81c3380ebead49` | fork/资料索引 | 未声明/未核验 | 无直接价值 |
| `clipboard` | `3b6562a5196205e600dbffa0e548bdcc0c39477a` | 自有工具 | 未声明/未核验 | 无直接价值 |
| `cloud-mail` | `574725538b9d4372f494d91e4542f202e9a791eb` | 自有服务 | 未声明/未核验 | 不能作为音枢云服务依赖 |
| `edgetunnel` | `448a83ced00a43c1d892d5ecbed86a26ea9eeaff` | 自有服务/工具 | 未声明/未核验 | 不接入音枢 |
| `jide-app-site` | `f403492cb893295366d891fa60b3fa1f6e20be99` | 自有网站 | 未声明/未核验 | 无播放器核心 |
| `lx-music-api-server` | `6cf2c74cc7de4f3d05cc423699577457dc754be9` | 自有/服务端 | 未声明/未核验 | 仅作服务边界研究，不接入 |
| `lx-netease-music-mobile` | `4d2f8b774617a7d359af8221b2ee52b68f6bdd11` | fork，`souvenp/lx-netease-music-mobile` | Apache-2.0 | LX/网易 provider 契约研究 |
| `meting` | `1c2f4c98eed749200d9d7ff5cab329c4308f4268` | fork，`metowolf/Meting` | MIT（页面结论） | 多平台抽象研究 |
| `paper_explorer_web` | `c86831d174ad5d7a1f05da8539b1e95a72448b9f` | 自有网站 | 未声明/未核验 | 无播放器核心 |
| `qqmusic_flac` | `0f9863507078acd6d26af40bd59ded2e262ab53c` | fork，`Suxiaoqinx/qqmusic_flac` | MIT（页面结论） | QQ 音频格式研究 |
| `sollin-new-web` | `74fa8e69470799a30b04e90b83048a8da80b4181` | 自有 Sollin 官网 | 未声明/未核验 | 仅网页入口 |
| `telegram_private_chatbot` | `96ffd6b492694ce68ce0f52d76630b5516425f93` | 自有服务 | 未声明/未核验 | 不接入音枢 |
| `twikoo-netlify` | `a486d028479c3cff19be4a2cf6ac05407c744a52` | 自有部署/服务 | 未声明/未核验 | 不接入音枢 |
| `umami` | `e4c1ec8b28034e2ccfc51af99b1be46abc58619b` | 自有部署/分析 | 未声明/未核验 | 遥测排除，不接入音枢 |

## 后续工作项

1. 将 `Sollin-Music-Desktop` 的推荐/FM、下载、备份和同步源码按 F/J 工作项补到 `REFERENCE_COMPARISON.md`，每项保留固定提交和采纳边界。
2. 将 Youmi 的网易登录、推荐/FM、缓存和下载状态与音枢 provider/离线下载设计逐项对照；如需要移动端包证据，先执行 `reverse-skill` 的 IPA PRIMARY 和严格 review。
3. 对 `QQMusicApi`、`KuGouMusicApi`、`api-enhanced` 和 `meting` 只提取字段/协议夹具，逐项完成许可证核验后再决定是否保留测试数据。
4. 不因发现公开仓库或新增参考代码提高完成度；进度仍按 `docs/PROGRESS_ESTIMATE.md` 的工作包权重计算。

## 平台会话、日推与 FM 的源码追踪（2026-10-17）

本轮继续只读固定HEAD源码，没有安装参考工程或访问平台/代理API。三仓库本机位于 `/tmp/ryderwe-review/` 的无checkout部分克隆；file:line来自固定Git blob，不写成ReferenceProject已有完整工作树。定点复现用 `GIT_NO_LAZY_FETCH=1 git -C <仓库目录> show HEAD:<路径>`，避免缺失blob引起隐式网络读取。Youmi无许可，仅行为研究；LX Apache-2.0、api-enhanced MIT/Binaryify均核到根LICENSE，依赖与资产仍独立审查。

| 来源/固定HEAD沿上表 | 代码证据 | 对音枢的含义 |
| --- | --- | --- |
| Youmi | `Services/AuthService.swift:93/103/123/143` 的getQRKey/createQRCode/checkQRStatus/getLoginStatus（路径均在`NeteaseMusic/NeteaseMusic/`下） | 扫码状态800/801/802/803与登录后账号确认分开；Cookie非空不等于已验证 |
| api-enhanced | `module/login_qr_key.js:7`、`login_qr_check.js:9`、`login_qr_create.js:10`、`login_status.js:5` | 二维码与账号确认是独立协议步骤；Youmi代理路由不可直接当作平台原生端点 |
| api-enhanced | `module/login_refresh.js:6/15`、`logout.js:5`、`util/request.js:185–201/319` | 刷新会更新Cookie；传输须受控处理响应头、CSRF与隔离Cookie，不把外部代理当依赖 |
| LX 网易 | `src/utils/musicSdk/wy/user.js:9/35–43`、`dailyRec.js:8/46` | 核验实际account后再读dailySongs/推荐歌单；网络失败与会话失效分开 |
| Youmi | `Services/MusicService.swift:588`、`Views/PersonalFMView.swift:284/309/347/363` | 首批/下一首/低水位补充可参考；全部重复时原样追加的fallback不采纳 |

拒绝沿用：Youmi `Services/NetworkService.swift:42–59/77/90–105/126–127` 的明文Cookie、敏感日志和URL参数；`AuthService.swift:148–155` 远端退出失败后留本机凭据及Cookie存在即登录；`ViewModels/AuthViewModel.swift:198/222` Timer每2秒创建Task可能重叠。LX `WebLoginModal.tsx:60–68` 的document.cookie桥与消息日志、`wy/utils/crypto.js:40–58` 的Math.random及对象日志均不移植。LX `wy/utils/crypto.js:3–9`依赖CryptoModule，其Android脚本不证明iOS可直接运行。

后续最小单元仍是原创“网易单账号会话核心→日推读取→平台FM”。会话须有generation/abort、非重叠轮询、验证成功且Keychain持久化后才authenticated；退出先撤销本机访问，远端失败不能保留登录态。HTTP响应头/受控Cookie、固定HTTPS origin及跨域重定向隔离先于真实登录。凭据只入独立provider namespace，不给LX脚本、SQLite、Track或备份。

音枢当前 `src/providers/contracts.ts` 只有元数据契约，`http.ts` JSON接口不提供Set-Cookie；`online.ts` 公开provider继续独立。复用 `nativeSecrets.ts` Keychain和 `navidromeAccounts.ts` 验证/失败回滚职责；日推与FM通过 `services.ts` 现有playTracks/addTracksToQueue进入权威队列。本地推荐/FM继续清楚标记fallback来源，平台缓存按账号与会话代次隔离。首批应验证写密钥失败、退出迟到返回、二维码取消过期、轮询不重叠、失效/离线差别、账号切换清缓存、Cookie刷新与备份无会话。

此段完成源码到设计缺口的追踪，未实现或验证真实平台登录/日推/FM；已有UI对齐优先级、五参考比较及真实账号/服务/设备验收继续保留。
