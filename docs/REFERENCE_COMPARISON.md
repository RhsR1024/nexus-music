## 2026-10-17 全局背景分支与动效边界比较

五固定HEAD已逐一复核：悦音theme.ts:1–40（MIT/README原边界）、Q/wtf ImageBackground.tsx:52–104（根Apache2.0、文件Meta MIT头）、Cy usePlayerBackground.tsx:1–122/useAppTheme.tsx（根Apache2.0、RNTP独立许可）、自有Wayferar HomeCardTheme.java:44–87（home-only，反编译/第三方边界保留）。分别参考主题状态、图片/内容分层、有界缓存/身份/语义可读性；不移植源码/依赖/原生补丁/资源，避免引入旧RN或RNTP/Expo版本与Android Activity差异。音枢原创全局/播放页动效独立与原子迁移，TS状态可共享Android，原生图片/生命周期分别验收，详见[0039](decisions/0039-independent-global-background-motion.md)。

## 2026-10-17 主题呈现复核

五参考均沿固定HEAD/许可证：悦音Library908–947为三主题选项行，Cy settingModal615–645为原生MenuView；Q/wtf Theme/IsAutoTheme13–34通过平台支持开关复用主题store；Wayferar SourceSettings8–18不提供本次iOS模态方案。音枢采用已有原生pageSheet及原子PreferenceStore，无新依赖/源码移植；Android复用契约且独立验收。Sollin采纳限E-009直接包装调用，见[0038](decisions/0038-theme-mode-sheet.md)。

## 2026-10-17 设置分组参考复核

本批五参考固定HEAD/许可沿下表，亲读悦音Library806–824、Q设置Main14–25、wtf设置Main16–36、Cy settingModal403–435和Wayferar SourceSettings8–18；仅采纳分组职责与平台过滤原则，无源码/资源/依赖移植。Sollin分类/EQ采用E-008对象归属和原始BL证据，截图34补顺序，详见[本批报告](2026-10-17_reverse-sollin-settings-objects-report.md)。TS组织可共享Android，原生音频/返回/权限/服务仍分别验收。

## 2026-10-17 用户新增硬门禁：reverse-skill

后续 Sollin IPA/APK 逆向分析及功能、UI、交互对齐**必须使用 reverse-skill**，先路由/PRIMARY、检查工具、校验离线 scope，再产生该批 Evidence→Finding→Path 并严格 review 后采纳；禁止绕过或以“已读”代替执行。包已克隆到 `/Users/ningli/WorkSpace/reverse-skill`，固定 `cab634bd855fc287f6e420c1f36fd1a6b9245960`，项目入口 `.agents/skills/reverse-skill-router`。开工运行 `node scripts/sollin-reverse-gate.mjs ipa|apk`，采纳前加 `--review`；功能证据须覆盖当前工作项，安装检查不能代替。安装/路由/两案例严格review已通过，高级反编译/动态工具缺口如实保留；当前不声称对象调用图或完整UI对齐完成。完整安装、命令、拒绝路径及工具结果见[强制工作流](REVERSE_SKILL_WORKFLOW.md)，根 AGENTS.md 同步作为接手硬约束。IPA首要、APK互补、截图辅助、音枢特有能力、许可与隐私边界不变。

# 功能参考与移植决策规则

## 通用后端能力的 Sollin 对齐边界（2026-10-17）

参考 Sollin 时比较的不只是 UI：凡属于通用音乐产品的请求、鉴权、队列、下载、缓存、完整性、后台调度和状态恢复逻辑，都要先记录 IPA/APK 的静态或动态证据，再在音枢现有 provider、播放器和数据安全边界内原创实现。登录、推荐/FM、识曲和离线下载属于此类能力；不得以一次接口成功或一个按钮存在代替逻辑证据。

逆向分析统一走项目安装的 `reverse-skill-router`，执行平台 PRIMARY、`case-init`/`case-guard`、工具索引检查和功能工作项严格 review；未形成当前功能的 Evidence→Finding→Path 时，不得把 Sollin 结论用于实现或进度宣告。Sollin 自有账号体系、用户中心、服务支持、激活/赞助及商业权益仍是排除项。

如果证据显示能力依赖 Sollin 私有云端、专用链接或不可授权服务，不复制该服务或协议。先评估本地实现、已有音乐平台 provider 和音枢本地仓储；无法替代的部分登记为待决项并暂缓，完成其他开发，进入开发收尾和真机验证前再请用户选择落地方案。

用户要求将以下项目保存在 `/Users/ningli/WorkSpace/ReferenceProject`，后续每项功能比较后再采纳。它们都是参考仓库，不作为音枢整体替换底座；没有安装这些仓库的依赖，也没有把其功能算作本项目完成。

## 固定源码基线

### Sollin Android 互补逆向样本（2026-10-17）

用户补充了本机 `/Users/ningli/WorkSpace/ReferenceProject/Sollin-60-v8a.Apk`，SHA256 为 `668f590753e5c9d79d6b8835f68ba702be6ce90f484d0af2bd721afd50fe4c7f`。该 APK 是 Flutter Android arm64 发布包，当前仅作与 Sollin iOS 2.0.0 build 60 IPA 的互补静态证据源；APK、解包产物、反编译代码和其中资源不进入仓库。

Android 证据用于交叉核对页面层级、设置分组、播放器皮肤、歌词/背景、音源与数据流程，帮助后续 Android 支持时复用可共享的 TS/协议/状态模型，并识别 iOS 与 Android 原生适配差异。当前交付边界仍为 iOS：Android 静态资产不能证明 Android 运行、后台播放、签名、真机或服务验收，也不能替代 IPA 作为 iOS 行为的首要证据；两端静态证据都不能替代音枢本地/云端 XCTest、真实服务和真机验收。

APK 的 Flutter/Dart、第三方库、品牌资源和服务调用按各自许可单独核对，不整体复制或据包内依赖宣告许可。涉及具体功能时，记录 APK/IPA 的文件、符号、资源和证据等级，再决定原创重实现、共享契约或平台专属适配。

2026-10-16新增用户提供的直接移动参考：Sollin iOS 2.0.0（60）unsigned IPA，SHA256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`。已确认Flutter编译包、设备arm64、未标记FairPlay加密，以及皮肤/歌词/识曲/同步等模块字符串和可读识曲桥接；不能据此称取得源码或运行通过。移动端事实优先于桌面推测，原包/解包资产不提交，来源、许可与后续采纳规则见[IPA分析](SOLLIN_IPA_ANALYSIS.md)和[决策0033](decisions/0033-sollin-mobile-scope.md)。

Sollin IPA 只作为移动端 UI、交互、页面层级、弹窗、手势、错误反馈和设置组织的参考。完整纳入音枢对齐矩阵的是“播放与歌词、外观与界面、下载管理、数据与存储”四组设置；音枢保留自身 LX、多源择源、Navidrome、WebDAV、汽水匹配、漫途迁移、PCM/EQ、系统媒体和安全边界。Sollin 自有账号/用户中心、赞助/付费解锁、免责声明、服务支持、自推广帮助、遥测/诊断回传及其私有 API 不采纳，也不计入进度分母；网易云、QQ、酷狗等音乐平台自身账号登录继续作为 provider 能力保留，平台登录成功不自动等于歌单同步。不得复制 Flutter AOT、私有服务、品牌资源或未核验的第三方资产。

| 项目 / 本机目录 | 分支 / 提交 | 首要用途 |
| --- | --- | --- |
| 悦音 `joy-music-mobile` | master / d6f1af7f911e84babce56cd07297b44cfe46eed9 | iOS页面组织、发现/搜索provider、导入导出与主题 |
| Q-1515 `q1515-lx-music-mobile` | ios-adaptation / 547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a | 完整LX模型、宿主契约、原生音频/FLAC路径 |
| wtfdelphia `wtfdelphia-lx-music-mobile` | main / 6624ab58cbd2f5bda52ab8006912d3c60dc1f847 | 模块化iOS宿主、Rust加密边界、脚本回归/维护组织 |
| CyMusic `Cymusic` | main / bf0d4694acb52973bcd594d31b3c61f655e166cb | 独立JSC与生命周期、业务队列/播放意图、文件缓存与系统媒体控制 |
| 自有车机恢复项目 `Wayferar-Music` | main / 8e47cdc701cdbb772577b2bf7abb699e285b0fa6 | 既有用户行为与兼容需求的权威参考，尤其音源/队列/歌词/备份；不编译其反编译Java或将车机功能带入iOS |

不得只看默认分支README否定fork的iOS实现，也不得未经检查切到其他分支后沿用本表证据。需要新版本时记录新提交及差异，再跑音枢自己的回归。

## 已阅读源码的初步比较

下表是源码可见事实与工程判断，**不是五个项目实机性能比较或本项目最终选型**。

| 能力 | 事实与证据 | 初步采纳方向 / 仍要验证 |
| --- | --- | --- |
| LX原生宿主 | Q的JSC/串行队列/crypto较集中于ios/LxMusicMobile/AppDelegate.mm；wtf的ios/LxMusicMobile/Modules/UserApiModule.m独立，具备generation和preload事件通道；Cy为modules/cymusic-native/ios/CyMusicUserApiRuntime.m；悦音sources/joy.ts的new Function/mock属于探测 | 优先比较wtf/Cy的模块边界，用Q和自有旧工程校验完整契约；不把悦音探测器直接当生产宿主 |
| HTTP与后台下一首 | Q/wtf的src/core/init/userApi将request/response事件接到JS请求链；Cy宿主也有事件/生命周期设计 | 必须跟踪真正出站路径及锁屏行为；是否将HTTP放入原生URLSession须用实际脚本与十首锁屏测试验证 |
| 加密/编码 | wtf UserApiModule调用Rust lxcore C ABI；Q在原生代码中处理RSA/AES；Cy以native utils桥提供工具 | 对相同字节/模式/padding做黄金向量；Rust提高共享实现潜力但多一套构建工具，不能仅为复制功能立即引入。Buffer/Base64须含非UTF8和四字节UTF8测试 |
| 数据模型/provider | Q/wtf有LXMusicInfo/meta/qualitys等完整模型；悦音src/core/config/playlist.ts normalizeTrack保留部分字段但较简化；Cy存在平台适配与音质回退 | 统一模型保留平台原始ID、meta及实际档位；不整体照搬简化Track导致丢字段，也不固定tx平台。provider可移植部分先契约测试 |
| 播放器与队列 | Cy迁移到RNTP5.9.2并维护remote-control补丁与业务token；Q/wtf RN0.73依赖不同RNTP fork；悦音Expo54/expo-audio | 单独比较后台、FLAC、请求头、媒体事件、暂停竞态、维护/许可；只选一个后端，不把多个项目播放器叠加 |
| UI组织 | 悦音Library的来源/外观/缓存等分组，MiniPlayer将歌词加载与进度交互分开；Q/wtf现有导航体系不同；Cy使用Expo Router等较新栈 | 借鉴信息分组/触达路径，保留音枢的视觉与可选数据降级；不整屏复制或引入第二套导航/状态管理。首批界面仅工程空态 |
| 歌单持久化 | 悦音使用AsyncStorage持久化和归一化；旧漫途备份有来源、收藏、歌单与设置 | 本项目先定义版本化仓储、原子写入和重复曲序，不照搬忽略错误/字段的路径；真实漫途样本映射后置 |

## 维护与Android移植成本

| 项目 | 当前可见维护成本 | Android边界判断 |
| --- | --- | --- |
| 悦音 | Expo54/RN0.81.5与本机候选基线接近；仍要逐个核对原生库、长页面职责和临时adapter | TS数据/provider易共享；expo-audio等有跨平台实现，不能据此声称Android后台/媒体控制已满足音枢 |
| Q-1515 | RN0.73.11与新架构基线差距；AppDelegate承载多个模块，移植不能整文件覆盖 | 上游有Android协议资产；iOS自定义FLAC/DSP等需等价Android实现或明确能力差异 |
| wtfdelphia | RN0.73.11；iOS模块拆分、spec/回归和上游合并记录可供学习；Rust加密与fork依赖增加工具链成本 | Android仍有QuickJS等实现；文档说明Rust当前仅供iOS，不能宣称已双端共享加密库。复用前需逐字节双端对照 |
| CyMusic | Expo57/RN0.86.3；维护文档记录Xcode26.6和严格补丁，超出当前本机已验收基线；RNTP5另有独立许可 | TS与后端抽象有共享价值；iOS本地模块需要Android对应实现。新版本依赖不能未经构建证明直接复制 |
| 自有恢复工程 | 已阅读README与docs/BUILDING.md：正式入口tools/build_core_apk.ps1，app/src/main/smali为权威，Java为反编译参考；Windows构建工具链不能直接当作iOS工程 | 用作已有行为/测试向量基线；ECARX、Android文件路径、权限和后台服务不能直接搬到iOS |

“更易维护/移植”在这里是基于职责边界、依赖数量与版本差距的工程判断；实际成本要用最小移植和双端契约证据复核，不以星数或最新版本排名。

## 每项功能移植前必须留下的记录

1. 音枢需求/验收：对应F编号，输入、输出、错误与数据缺失行为。
2. 来源证据：候选仓库、固定提交、文件/符号；查清真实调用链，不只看README。
3. 对比：协议完整性、后台与竞态、数据保留、iOS版本/新架构、Android替代层、依赖/原生补丁和上游更新成本。
4. 来源与许可：自有代码/第三方代码区分，逐文件保留要求；悦音README与MIT文案并存需保留原信息，RNTP5不由Cy Apache许可覆盖。
5. 采纳结论：选择哪个模块、直接移植还是按契约重写、放弃其他候选的具体原因；不选“整个项目赢家”。
6. 实验证据：先黄金/契约测试，再本机Release构建、实际脚本/服务器和真机；记录未覆盖项。
7. 后续维护：固定版本、补丁位置、替换接口、回滚边界、升级后必跑的测试。

比较完成前允许推进独立领域接口与原创契约测试；涉及生产播放器、宿主加密或大块第三方实现时，先写该功能决策记录再移植。

## 当前已经做出的决定

- S8/F33按[0032](decisions/0032-webdav-device-sync.md)亲读五参考及Sollin后原创实现：采用持久三方基线、显式冲突选择、删除标记、条件写/回读与同一SQLite事务。TS合并/状态可共享Android，URLSession/Keychain另适配，无新依赖或复制代码。真实设备/个人服务和自动触发仍单独验收。

- S8/F32云备份按[决策0030](decisions/0030-webdav-backups.md)亲读五参考及Sollin固定源码：采用职责分离和确认恢复；原创实现条件版本上传、回读SHA256、MKCOL后目录核验、Keychain复用及事务恢复。不复制明文配置/URL日志/吞错覆盖；F33同步另外设计。TS数据与状态可共享Android，URLSession/Keychain需另实现，不宣称Android交付。

- Expo54/RN0.81仅为已通过本机构建的工程候选基线，不自动决定播放器或音源引擎。
- PlaybackBackend、MediaResolver、MetadataProvider、ScriptHost各自分离；队列与播放意图只有一个权威。
- LX bootstrap/Swift宿主为原创实现，没有复制上述native模块；生产桥与AES/RSA/zlib采用系统框架，逐字节测试通过；App导入/真实曲目播放待验收，见决策0002及LX_HOST_PROGRESS。
- 最新功能优先级：LX→核心播放→Navidrome→在线/UI/歌词缓存；漫途导入后置。

2026-10-15：五个参考仓库均已通过本地Git取得。Wayferar-Music为SSH部分克隆，当前稀疏检出README、docs及app/src/main/assets/script；未检出根目录大型APK。工作树干净，后续按具体功能补取对应Smali/importer源码及测试，不把“已取得参考仓库”当作已完成逐项比较或运行验收。

歌词/缓存/LX导入收尾按[决策0008](decisions/0008-lyrics-fonts-cache.md)复核五项目：Q/wtf保留实际字时间、压缩容器和LXMC结构；悦音提供普通LRC与库交互，Cy缓存抽象但不引入其RNTP/新框架，Wayferar保序与数据边界继续采用。QRC仅协议常量适配并注明Apache来源，原生有界执行；其余解析/仓储/缓存原创。分类收尾按[决策0009](decisions/0009-discovery-playlist-import.md)：KW必须保留43/10000的不同协议，MG分类与推荐模板不同，不能用返回空数组掩盖未识别字段。TS可用于Android，QRC/图片缓存等原生接口需对应实现。


## Sollin 桌面端补充参考（2026-10-15）

本地 `/Users/ningli/WorkSpace/ReferenceProject/Sollin-Music-Desktop`，origin `https://github.com/Ryderwe/Sollin-Music-Desktop.git`，固定提交 `c9d446f6ad3b7ea1aff64bd5ce290b6e7f9712a8`，package.json 版本 1.3.8。根 LICENSE 为 MIT / Copyright 2026 Sollin contributors；vendor/lxmusic、AMLL、Mineradio 与其他资源许可独立核对，不能用根 MIT 覆盖第三方。未安装/执行参考工程及其原生二进制。

| 源码证据（固定提交） | 能参考什么 | iOS/Android 与维护边界 |
| --- | --- | --- |
| src/components/player/AmllFullPlayer.tsx:2，PlayerBackdrop.tsx:2 | 确认桌面使用 AMLL LyricPlayer/BackgroundRender，背景与歌词分离；非“推测用某库” | React DOM/CSS/canvas 不是 RN 组件；不证明 iOS 用 AMLL；当前不引入 WebView/第二播放器 |
| src/components/player/ttmlLyrics.ts:167–171 | TTML 分词时间、agent、背景人声的结构参考 | 依赖 DOMParser，RN 无相同 DOM；需有界 XML 解析、坏数据测试和独立许可审查 |
| src/components/player/TtmlLyricPlayer.tsx:86–111 | 时间轴、焦点行、行/词样式 | 约 30Hz setDisplayTime 重渲染列表，与音枢约定不符，不移植该循环 |
| src/stores/uiStore.ts:12、52、388、423 | 外观模式、背景设置和默认值迁移 | 参考设置职责，音枢继续用自己的原子 PreferenceStore；不引入 Zustand/localStorage |
| src/constants/playerModes.ts:12 | 皮肤是配置，业务播放独立 | 桌面三模式不等于移动五皮肤，不照搬 Electron 布局 |
| src/services/webdavBackup.ts:9、178、212、259 | PROPFIND/目录/备份流程、兼容请求头 | DOM/XML/桌面持久化不可直接搬；iOS 凭据继续 Keychain，不照搬明文配置存储 |

本轮采用结论：根据九张移动截图原创 RN 主题/导航/mini 布局，桌面代码仅用于职责和状态模型参考；不复制其图片、CSS、整仓依赖或二进制。与前五参考比较：悦音同 Expo54 页面组织更接近本项目；Q/wtf 保留协议与回归；Cy 新框架不升级；Wayferar 保留多源/队列/真实逐字行为；Sollin 提供用户指定视觉目标及桌面歌词/背景可读证据。Android 可共享 TS 设置和皮肤定义，iOS 模糊层/音频/未来原生歌词需要对应 Android 实现。

2026-10-15 S4/S5：新增决策 [0014](decisions/0014-graphical-eq.md) 与 [0015](decisions/0015-ttml-native-lyrics.md)。Q 的 SoundEffectControl/原生 adapter 与 Sollin WebAudio 比较后，原创扩展现有 C++ DSP 为用户前级 + 自动余量、图形精调和有界命名预设；不复制其音效后端。TTML 用有界 TS XML/时间子集，原生 TextKit 负责当前行累计裁切和强调，不采纳桌面全列表 30Hz React 更新；解析与原生绘制的 Android 替代边界分别保留。

S6文件音频采纳边界见 [0016](decisions/0016-local-audio.md)：Cy的localFile.ts保留容器迁移/文件所有权问题，localMusic.tsx保留多选/曲库组织参考，但不采用文件名去重、绝对URI身份、在线结果改ID或打印私人元数据；不移植其JS ID3依赖。音枢用原创AVFoundation/CryptoKit/ImageIO与独立来源/相对标识，Android需替换对应原生实现；Sollin Electron目录扫描和Wayferar Android权限不直接搬入iOS。

S6设备媒体库按[0017](decisions/0017-device-media-library.md)处理：四RN参考限定Swift/ObjC/TS/配置检索未发现可直接采用的MPMediaQuery/MPMediaLibrary/ipod-library管线，不推导全仓无此功能。Wayferar Android媒体权限和Sollin Electron扫描不直接移植；原创iOS MediaPlayer原生边界，TS身份/分页/权限状态模型保留可共享部分，Android需对应实现。145项TS/原生与本地授权拒绝UI通过，不冒充设备媒体播放已验收。

WebDAV连接/协议基础采纳见[0018](decisions/0018-webdav.md)：比较Sollin目录/备份、Cy配置与其余限定检索后原创实现，不移植明文配置/响应日志/DOM。154项业务检查、真实原生合成HTTP与iOS SDK类型检查通过；App远程播放和元数据仍待接入。

WebDAV App接入继续按0018原创实现：AVFoundation远程读取复用0016的标签问题边界，音频仍是现有AVPlayer与队列。未复制Sollin的DOM/明文持久化/日志；未引入新npm依赖。已验证七种格式远程PCM与定位、合成App重启播放及账号移除；Basic之外的服务兼容性、手机后台、云备份/同步继续分别验证。

S7普通在线匹配按[0019](decisions/0019-online-fallback-matching.md)比较Q/wtf getOtherSource/findMusic、Cy findMusic、悦音URL重试与Wayferar imported守卫后原创实现；保留严格版本/时长和原始身份，不照搬宽松首项、共享取消Promise或第二播放器。TS匹配/记录/路由可供Android共享，原生播放后端仍分别适配；无新第三方依赖/复制源码。179项业务检查、合成App自动/人工/取消/重启已通过，真实服务及双构建按BUILD_STATUS实际记录。

S7音源平台/音质批测按[0020](decisions/0020-source-health.md)比较：Cy固定128k/非空URL、Sollin显式sourceId逐档、Q/wtf单宿主生命周期、悦音自动重试、Wayferar更新检查隔离，原创实现精确源/档位和原生有界响应检查。不复制打印地址/错误的路径，不把响应头当解码成功；TS调度/报告可共享Android，URLSession探测需对应平台实现。188项业务与完整原生/HTTP已通过，App集成验证中，无新依赖。

S7网易公开评论按[0021](decisions/0021-public-comments.md)比较六参考后原创实现，精确原曲身份/普通行数游标、热门与普通分区、失败留旧内容及取消隔离；其他平台不因参考存在代码就算已接入，无新依赖。2026-10-16用户另明确授权暂用漫途图标，固定素材路径、尺寸/无透明通道适配及许可边界见[0022](decisions/0022-temporary-app-icon.md)，不重新生成或改造其标志造型。

F34本地实际播放统计按[0023](decisions/0023-playback-statistics.md)原创实现，保留原生单调时钟与单一队列归属；参考中的歌单热度不当作个人聆听次数。TS仓储可共享，Android需替换原生计时采样；无新依赖或复制源码。

S4跨平台歌词选择按[0024](decisions/0024-lyric-selection.md)原创实现：Q/wtf候选循环、Cy歌词搜索与悦音行级/翻译、Sollin多平台协议、Wayferar实际时间职责逐项对比；不复制原实现、DOM或依赖。候选/持久化可共享Android，原生绘制继续分别适配。

S4/J41/J44字体与深度样式按[0025](decisions/0025-fonts-lyric-style.md)比较六参考后原创实现：公共Text/输入入口、全局与独立歌词字体优先级、私有字体文件与串行提交、TextKit静态模糊和原生累计绘制；不复制DOM字体、资产、动画或新依赖。设置/仓储可共享Android，字体文件和原生绘制分别适配。实际Files导入及重启已验证，完整App验收继续。

S10系统媒体按[0026](decisions/0026-system-now-playing-island.md)复核五参考后原创实现：Q封面requestId与命令可用性、wtf真实字段回查、Cy下一曲元数据、悦音expo-audio边界及自有Wayferar期望状态幂等收藏。复用唯一AVPlayer、CoverService与LibraryStore，不复制RNTP补丁/假音频/第二队列，不新增依赖或资产。TS协调语义可共享Android，MediaPlayer/UIImage另需Android适配。

S3 图片/取色/播放背景按[0028](decisions/0028-visual-assets-and-player-backgrounds.md)比较五参考及 Sollin 后原创实现：采纳职责隔离、有界取色与图片身份保护，不引入参考图片、图片依赖、DOM/WebGL 或 Android 路径。TS 资产槽位与设置可共享，ImageIO 解码/去元数据和取色需 Android 适配。实际 Files/UI 与双构建以 BUILD_STATUS 后续证据为准。

J40/J49 按[0029](decisions/0029-mini-player-controls-and-lyrics.md)亲读五参考及 Sollin 后原创实现：采用可达控制、共享意图和按身份取消，保留最多四按钮与必留播放暂停、原队列和歌词选择仓储；不引入 RNTP/Slider/BlurView/Android窗口或 Electron 特性。TS 配置/预览可共享 Android，原生适配分别维护，无复制代码/资产/新依赖。

2026-10-17用户明确调整执行顺序：**先按Sollin IPA逆向信息对齐已有UI/交互和音乐核心，截图仅补充；保留音枢特有能力，再扩展其他功能**。补充图筛选后68张/35组只留本机忽略目录，1张Apple ID/签名验证图剔除，原文件不动。全局封面主体色/模糊与切歌更新列为优先移植项；IPA已有全局作用文案和主题符号，但算法/调用关系尚待恢复，不能把播放页模糊当全局完成。最新逐项门槛见[对齐清单](SOLLIN_ALIGNMENT_PLAN.md)和[IPA专项](SOLLIN_IPA_ANALYSIS.md)，本条覆盖早期“根据九图原创布局”的证据优先级，不改变五参考的来源、许可及Android边界。

## Ryderwe 作者仓库全量盘点（2026-10-17）

已遍历 Ryderwe GitHub 主页显示的 46 个公开仓库（含 profile README 仓库），固定默认分支 HEAD、fork 上游、许可证结论和采纳边界见 [RYDERWE_REPOSITORY_REVIEW](RYDERWE_REPOSITORY_REVIEW.md)。重点新增参考为 Sollin-Music-Desktop、Youmi-Music-IOS、LX/网易 provider、网易 API、酷狗/QQ字段和 Meting；发布仓库只提供截图或包来源线索，其他网站/工具仓库不进入音枢实现。

Youmi 是 `7DaysMax/Youmi-Music-IOS` 的 fork 且未声明许可证；其网易登录、公开推荐/日推、私人 FM、缓存和下载状态可作为行为线索，但公开 API 服务、Cookie 协议、账号数据和品牌资源不能复制。下载实现没有足够证据替代音枢现有的暂停/续传/完整性/在播保护设计。所有 Sollin IPA/APK 对齐仍须先通过 `reverse-skill` PRIMARY、离线 scope 和严格 review。

## M10 启动/前台下载恢复（2026-10-17）

本批亲读固定参考的下载实现：wtf `src/core/download/scheduler.ts:25–35` 的恢复对齐锁、初始化/前台区分与 `reconcile.ts` 文件对账；Cy `src/helpers/fileDownload.ts:17–23` 明确为 FOREGROUND；Q `src/core/music/download.ts` 负责 URL/歌词解析，不作为持久任务恢复引擎；悦音 `src/core/music/audioCache.ts` 是临时音频缓存职责；自有 Wayferar 固定稀疏检出中未取得下载恢复模块，只有 `docs/WAYFARER_MUSIC.md:12` 数据迁移边界，不宣称已核验其任务恢复。Sollin desktop `src/stores/downloadStore.ts:159–180` 持久化任务/设置，不能证明 iOS 后台实现。固定提交与许可沿上表，没有复制参考代码或依赖。

采纳：音枢自行复用 `OfflineDownloadStore` 的串行队列与任务去重，只恢复 queued/中断任务，尊重 paused/failed；LX 就绪后才取下载 URL，首屏不等待所有源。TS 调度可为将来 Android 共享，原生后台、进程被系统挂起/终止的行为仍需单独适配。完整验收见[决策0036](decisions/0036-offline-recovery.md)。

## A06 既有下载UI归组（2026-10-17）

按[0037](decisions/0037-download-settings-and-tasks.md)亲读五参考的设置分类、缓存/下载入口与Sollin desktop任务页，固定提交/许可沿上表；采用声明式入口和职责分离，在既有音枢store上原创实现偏好/虚拟任务页及批量动作，无参考源码/资源复制。wtf仅iOS下载分组与Cy前台下载都不作为Android或系统后台能力证明。IPA E-006分类/模块线索优先、截图11/34/36补层级；不把截图或共存字符串写成调用图、默认值或算法证据。

## A07 既有 EQ 预设卡片（2026-10-17）

五参考HEAD按固定表重新核对。Q `SoundEffectControl.tsx:38–45` 保留增益/有界预设和声明式UI职责；悦音/wtf/Cy当前src、Wayferar当前docs限定检索无EQ/preamp匹配，沿0014边界，不外推全仓无能力。IPA E-007→F-006→P-006 严格review通过，截图02/07只补视觉。原创卡片用音枢实际十频段值绘制、按曲线和前级计算选中态；保留七预设/24个自定义与唯一DSP，不复制Q参数、参考图片或商业配额。共享TS与未来Android原生音效边界见 [本批报告](2026-10-17_reverse-sollin-eq-report.md)。
