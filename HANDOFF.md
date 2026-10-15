# 音枢 NexusMusic 交接备忘录

更新日期：2026-10-15，Asia/Shanghai。此文件是后续开发的基础上下文，接手者应完整阅读。

## 当前任务与成果

用户希望先确定功能清单、技术框架和实现边界，之后在自己的 MBP 上开发。初期形成交接文档；用户于2026-10-14明确要求列出详细任务计划并开始实施，现推进工程基线与领域模块。

远程仓库为 `https://github.com/RhsR1024/nexus-music.git`。本轮在 Windows 上将原本空的远程仓库克隆到 `Z:\Z-WorkSpace\NexusMusic`。Z 盘是网络映射盘，后续 Mac 建议在本机 SSD 单独克隆仓库，不在 SMB 共享目录中共用 node_modules、Pods、DerivedData 或同一套 Git 工作树。

开始实施前仅有文档；当前实施清单见 [TASK_PLAN.md](docs/TASK_PLAN.md)，实际构建与测试以记录为准，尚无真实服务/真机验收。任何文档中的能力描述都必须区分：源码可见、协议支持、建议实现、真机已验证。目前最后一项尚未完成。

## 初期确认的决定（历史基线，最新并集变更优先）

1. 正式名称为 **音枢 NexusMusic**，仓库名 `nexus-music`，单独项目实现。
2. 先做 iOS，但不排除未来 Android；不要把未来 Android 当作首版已经承诺交付。
3. 首期整合在线平台和 Navidrome。Navidrome 是最常用私有云，可以先只接它；Emby、SMB 不进入首期。
4. 先不做本地音乐管理。这里不排除本地 JS 音源文件导入、字体文件导入、歌单文件导入与播放缓存，不能混淆。
5. 首期不做汽水。不做 ECARX，不做 CarPlay，不做车机扫码上传。
6. 保留普通后台播放、锁屏/控制中心、耳机和蓝牙媒体控制。它们不是 CarPlay。
7. 漫途数据迁移指“从漫途导出歌单，再导入音枢”，一般一次即可。不设计 Android/iOS 持续双向同步，也不要求直接复制漫途数据库。
8. 手机界面重新设计；用户要求先说明现有 LX、漫途接口究竟能展示哪些信息，避免凭空设计数据。
9. 目标真机是 iPhone 15 Pro Max，用户报告 iOS 27.0。开发电脑为 2019 年 15 寸 Intel MBP，系统约 macOS 15.7.4，尚未实际检查。
10. 使用目标为免费自签、尽量减少续签操作。不能承诺永久有效、永不掉签或任意系统权限。

## 技术推荐及其状态

当前推荐 **React Native 新架构 + TypeScript + iOS 原生音频/脚本模块**。这是结合三份现有 RN 参考、JS 音源协议、未来 Android 可能性与当前产品范围作出的工程建议，并非通过真机性能对比后的事实。

SwiftUI/UIKit 和 Flutter 都可实现产品。不要把 RN “更合适本项目”说成 RN 在所有性能上领先；也不要接受“Flutter 一定最流畅”“原生一定功耗最低”“跨桥会让音频有损”等绝对结论。

参考职责：

- CyMusic：首选验证底座，参考原生 JSC 音源运行时、音频接入、文件与缓存。
- 悦音：参考多平台在线浏览、主题、歌单导入导出和交互；其音源兼容主要是探测/模板/专用适配，不是完整 LX 宿主。
- Q-1515：必须看 `ios-adaptation`，参考 LX 类型/协议、系统音频和 FLAC；不要被默认 master 中“不支持 iOS”的上游 README 误导。

不要将三个项目整体合并。音枢只保留一个业务队列、一个权威播放意图、一个数据库和一个主播放后端。原生模块使用可跨平台替换的接口，但不提前实现 Android 平台代码。

候选框架版本不得因“最新”直接锁定。已研究的 CyMusic 是 Expo 57.0.21 / RN 0.86.3，悦音是 Expo 54 / RN 0.81.5，Q 分支是 RN 0.73.11。已知这些项目存在，不等于它们在旧 Intel Mac/iOS 27 上兼容。详见 [技术决策](docs/TECH_DECISION.md)。

## 环境上的重要区别

2019 年 **15 寸** MBP 不在 Apple 的 Tahoe 26 官方兼容名单中；2019 年 **16 寸**在名单中，不能混淆。Xcode 27 当前官方系统要求为 macOS Tahoe 26.6 或更新。

这意味着不能预设此电脑能按官方支持路径安装 Xcode 27 / iOS 27 SDK，**不意味着无法开发可在 iOS 27 运行的 App**。旧 SDK 编译的常规功能可能在新系统运行；能否构建所选依赖、安装、调试以及调用新 API 需要分别验证。iOS 27 的专有新 API 需要相应 SDK。SwiftUI、Flutter、RN 都受 Xcode 约束。

先检查真实机型、系统与可安装 Xcode；不要求用户立刻换电脑，不默认使用非官方系统补丁。若本机工具链不足，可用远程/云 Mac 构建、下载 IPA 自签真机测试。远程构建不是等价的本地调试，须记录效率和验收限制。详见 [环境文档](docs/MAC_ENVIRONMENT.md)。

## 接口能力边界

在线平台的元数据/搜索/发现与用户 LX 脚本解析播放 URL 是两条链。导入一个音源脚本，不表示它同时提供发现、搜索、封面、评论和歌词。各平台字段和源能力存在差异；按实际返回显示，缺失字段隐藏或降级。

Navidrome 首选公开 Subsonic / OpenSubsonic `/rest/*`，探测扩展，避免依赖其内部 Web API。旧漫途同时有 Subsonic 客户端与部分内部排序接口，不能仅看 `Q1/q.java` 的 `/auth/login` 就断言旧工程全部使用私有 API。

一轮子代理只定位到私有排序类，主线程随后已纠正：`app/src/main/java/p016d2/p.java` 有 `/rest/`、salt/token、getAlbum、search3；`p016d2/q.java` 有 getPlaylists、getAlbumList2、getArtists、getArtist、getPlaylist、getCoverArt 和歌曲字段转换。本交接以此纠正后的证据为准。

悦音歌单有 AsyncStorage 持久化；“MusicManager.localLibrary 为内存骨架”不能推导“悦音所有歌单都不持久化”。悦音也有网易评论模块，不能依据音源 adapter 没有评论就断言全项目没有评论。

详细字段与展示规则见 [数据能力](docs/DATA_CAPABILITIES.md)。

## 下一位接手者的执行顺序

1. 阅读本文件及 PRODUCT_SCOPE、TECH_DECISION、DATA_CAPABILITIES、MAC_ENVIRONMENT。
2. 与用户确认尚未确定的产品项；不要再次询问上述十项已确认决定。
3. 在 MBP 上做只读环境盘点，记录实际版本、工具链限制和候选构建路径。
4. 取得一个真实漫途导出歌单样本、实际使用的音源名称/版本，以及 Navidrome 版本/连接方式，用于兼容设计；不要将账号密码提交仓库。
5. 完成小范围纵向验证：实际音源→播放→锁屏后自动下一首；Navidrome→浏览→播放；漫途歌单→导入预览。
6. 根据结果锁定框架、播放器、依赖和原生工程生成方式，再实现首版。

当前不需要用户在本轮提交 Apple ID 或服务器凭据。没有真机、服务器和音源样本时不得伪造“联调通过”。

## 还未确定的产品项

- 队列/进度跨重启恢复是否默认开启：建议开启，但恢复后等待用户播放，不自动出声。
- 是否需要显式“保存离线”以及后台下载：用户仅排除本地音乐管理，不能据此自动判断下载需求。
- 首版是否包含真实 PCM 频谱和音效/EQ；它们来自原漫途广义功能目标，尚未明确取消，也未细化为首版验收项。
- Navidrome 收藏/歌单首版只读，还是回写服务器；建议允许星标，服务器歌单写入需按用户期望与权限明确。
- 小组件、Live Activities、画中画歌词：没有被明确列为首版需求，不自动新增，不作为框架选择的决定因素。
- 最低支持 iOS、iPad 专用布局和应用分发范围：先以目标 iPhone 验证，不自动锁定最低 iOS 27，不承诺 iPad 布局已完成。

这些问题不妨碍先完成环境检查与核心技术验证，不能反复以“需要确认”阻断独立工作。

## Mac 环境接续（2026-10-14）

已在本机 SSD 通过 HTTPS 克隆，SSH 公钥认证失败。实测 macOS 15.8.1 / Intel MacBookPro15,1 / 16 GB。Xcode 26.3（17C529）及 iOS 26.2 SDK、CocoaPods 1.16.2 已安装，首次启动和基础 Swift iOS 编译检查通过。工具位于 Tools，使用其 env.sh。iOS26.3.1 Universal模拟器已重新注册并启动，候选App Release构建与首屏启动通过。详见 [本机实测](docs/MAC_ENVIRONMENT_ACTUAL.md)。用户已授权实施，见下方新进度。

## 实施首批代码与用户补充

- 计划见 docs/TASK_PLAN.md。Expo54.0.37/RN0.81.5/React19.1.0候选；维护ios/，scheme为app，不覆盖prebuild。
- 已有TS模型、独立队列条目与FIFO/删除/移动、PlaybackController代次取消保护、provider/后端接口、首屏与来源空态。
- npm类型检查与20项契约/竞态测试通过；Pods、原生Release构建与模拟器首屏启动通过，见docs/BUILD_STATUS.md。
- 本机LX脚本resource/V261008共24份，JSC离线探针19份发出inited声明；没有实际HTTP/播放，不是完整兼容。优先补生产原生宿主，参考三个固定提交，不直接复制源码。
- Navidrome内网Docker，用户报告0.64.0（1072e9f7），地址在local-config/navidrome.json，未接入真实账号。
- 漫途备份已提供resource/wayfarer_music-backup.json；结构调查见docs/WAYFARER_IMPORT_FORMAT.md。导入后置，不再把样本列为缺失输入。
- resource/与local-config/均忽略Git；不提交脚本、备份、账号/密钥。测试与报告没有打印私人曲目或凭据。

用户要求四项目对照（悦音、Q-1515 ios-adaptation、wtfdelphia、CyMusic），四个公开项目已在本机ReferenceProject保存独立参考仓库。每项功能移植前按docs/REFERENCE_COMPARISON.md复核来源、维护及Android边界，不锁定整仓赢家。

自有Wayferar-Music尝试HTTPS稀疏拉取需认证，GitHub连接器返回404，尚未取得源码，不宣称已比较其当前提交。用户已授权后续每个验收阶段提交并push到RhsR1024/nexus-music。GitHub认证步骤见docs/GITHUB_SETUP.md，SSH配置完成后继续推送本地提交并拉取车机工程。

## SSH与远程同步接续（2026-10-15）

已验证SSH认证为RhsR1024，origin切为git@github.com:RhsR1024/nexus-music.git；main跟踪origin/main，基线6ffa60b已push。Wayferar-Music已通过SSH取得，固定main / 8e47cdc701cdbb772577b2bf7abb699e285b0fa6，按README/docs/script稀疏检出且工作树干净。已核对构建文档的Smali权威与Java参考边界；后续按功能补取源码和测试。此前认证阻碍已解除，不再重复要求用户配置SSH。

## 2026-10-15继续实施要求

用户要求持续完成全部阶段并阶段提交push。多LX源批量启用，参考Wayferar-Music；用户音质偏好优先，同档跨源全部失败后逐级降档。临时缓存先做；保存离线、下载列表、暂停/重试、容量管理最后实现。Navidrome允许星标及编辑服务端歌单。真实频谱/EQ首版必需，不后置，播放器选型须验证PCM/EQ路径。上述决定取代旧的对应待决描述。

本批新增SourceRegistry/MultiSourceResolver与Quality模型：各源代次、独立启停、批量部分成功，同档跨源后降档，超时/取消/旧源结果隔离；31项测试及类型检查通过。尚未接入生产原生宿主或UI，不能标记M3完成。TASK_PLAN新增M10最后实现迁移/离线；PRODUCT_SCOPE新增F21频谱EQ、F22下载管理，IMPLEMENTATION_PLAN同步验收。

后续增量：modules/nexus-native已有原创Swift JSC/HTTP/timer/crypto/zlib宿主、Expo模块和TS adapter，bootstrap从native/script-host移到该模块的ios目录（单一Pod资源）。35项TS测试与类型检查、24项原生工具字节对照、真实本地HTTP及同进程context生命周期测试通过；Pods/Release模拟器构建和安装启动通过。实际24份脚本用真实网络初始化23份成功，1份SCRIPT_TIMEOUT；不是musicUrl/播放成功。App源导入/管理/持久化、真实曲目请求、播放器/PCM频谱/EQ仍需完成，M3不能勾选。详见docs/LX_HOST_PROGRESS.md、decisions/0002-native-lx-host.md。iOS允许自定义HTTP服务并增加局域网用途描述，app.json与Info.plist同步；TLS证书验证未关闭。

## 持续实施接续：来源管理/播放DSP/五平台搜索

用户再次明确“继续，不要停，直到完成所有目标任务”，不能在下一批后仅汇报并等待继续。当前仍有大量M4–M10工作，需持续推进。

新增SQLite单仓储、SourceCatalog、App源管理（文件/URL、多选启停删、顺序、订阅/回退）、PreferenceStore；Release XCUITest源导入→实际原生初始化→启停→删除通过。新增NexusPlaybackModule/NativePlaybackEngine、AudioResourceLoader（流式Range和请求头）、原创C++AudioDSP/ObjC tap，JS session/播放页/EQ偏好接入。Mac使用同一生产引擎的本地/HTTP WAV播放、PCM tap/FFT、自然结束及DSP黄金检查通过；App实音播放/手机后台仍未测。源导入UI测试服务在scripts/test-ui.mjs，用合成源并自动删除；不要提交私人脚本到App包。

五平台OnlineProvider与SearchCoordinator/Search UI已接入；scripts/probe-online.mjs真实每平台3首通过，52项TS测试通过。TX签名适配Apache参考并保留licenses/及THIRD_PARTY_NOTICES；字段规则要保留TX meta.id数值ID字符串、meta.songId=MID、strMediaMid，KG独立hash与_qualitys、meta.songId=Audioid。LX musicInfo.id按上游加平台命名空间，领域origin与LX meta.songId不强行相同。长整数JSON预解析必须跳过字符串/小数；已有长小数回归。

scripts/probe-lx-resolve.py仅在忽略目录读取真实备份作私密WY样本；6源5URL/3音频头，不等于解码播放。Python默认CA缺失已显式用/etc/ssl/cert.pem，不能关TLS验证。所有报告build/logs排除Git。

下一步持续：App内搜索→真实LX→播放/定位/频谱EQ纵向验收；补收藏/历史/歌单与队列恢复、歌词；Navidrome Keychain配置/实际client与写入；五平台发现榜单/歌单导入；缓存、主题字体、交付、自签；M10最后做漫途迁移及离线管理。未发现连接iPhone，不要假称签名或锁屏真机验收。最新功能决策0003/0004/0005；状态以BUILD_STATUS为准。

## Navidrome、音乐库、歌词和缓存接续

已实现M4公开协议client与Keychain、浏览/搜索/星标/服务端歌单编辑。真实内网匿名ping可达但缺凭据。Release模拟器合成服务登录→原生流播放→PCM频谱→暂停→删除凭据通过，证据BUILD_STATUS。测试需要本地临时签名，不能使用CODE_SIGNING_ALLOWED=NO验收Keychain。合成服务测试不等于真实Navidrome曲库通过。

收藏历史/本地歌单、版本备份/恢复、队列游标恢复到暂停、恢复后首次定位、实际播放历史已实现。随机播放按条目无放回与实际历史，FIFO优先。歌词解析与获取、字体导入、独立全部歌词虚拟列表及局部逐字原生透明度动画接入；当前81项TS测试通过。原生AudioCache支持分段完整覆盖才提升、LRU/限额/活动保留/清理代次及来源指纹隔离，稀疏缓存测试通过；最新集成复验中。

继续剩余：歌词压缩网络格式、封面缓存、真实LX App媒体链路；五平台发现/榜单/歌单导入；主题/列表/批量交互与错误恢复；unsignedIPA/设备签名及真机；M10最后做漫途迁移、保存离线/下载列表/暂停恢复/配额。未找到连接iPhone，不能假定真机验收完成。持续推进，不要提交后结束等待用户继续。

## 本地和云端双构建要求

用户新增：本地继续尝试IPA，同时支持GitHub Actions Apple Silicon/iOS27构建。已核实官方xcode-27 runner（Public Preview）和镜像Xcode27.0/iOS27.0；不可用macos-latest泛称最新SDK。新增共享environment.sh、Gemfile/锁文件、显式SDK检查和build-manifest、工作流。云端成功状态必须看实际运行，不能仅写工作流即勾完成。详见GITHUB_ACTIONS.md。

本机unsigned IPA已生成，arm64、JS包与bundle ID已检查；用户选择稍后连接手机，继续独立开发。发现/主题UI测试已通过（build/SourceUITests-1792027535934.xcresult）。五平台完整公开歌单探测网易98/QQ104/酷我121/酷狗156/咪咕68首成功，返回可动态变化。最新代码基线包含用户提交cbe1f49，不重置或覆盖该提交。

## 真实LX与当前云端接续

真实LX App纵向测试已通过：build/SourceUITests-1792045322336.xcresult，实际导入本机脚本、网易搜索→解析→解码→PCM→暂停→删除。原测试失败暴露外层ScrollView吞键盘首击，已加keyboardShouldPersistTaps和显式收键盘。真实音源仅localhost可选探针读取，不提交也不上云。Native格式测试已覆盖WAV/AAC/16-bit FLAC/24-bit FLAC、定位、PCM/FFT、自然结束与无网络缓存；新增封面缩略图/配额/代次、KRC/gzip字节检查。当前97项TS测试通过。

云端99d3487运行 https://github.com/RhsR1024/nexus-music/actions/runs/38691008776 已失败：Linux、原生检查和Release模拟器编译通过，启动时iOS27因缺少UIScene生命周期终止App，两个UI测试失败，尚未进入IPA归档。诊断产物11953711775的xcresult已下载导出到忽略的build目录，标准错误明确为`UIScene life cycle is required for apps built with this SDK`。现维护AppDelegate.swift内单场景适配与Info.plist声明，窗口改由场景创建，保留同一React surface及链接/前后台转发；本地/云端复验分别记录到GITHUB_ACTIONS。之前bae412f因CFPropertyList3.0.9 Ruby上限失败，34cdbeb修复为3.0.8；随后Yoga动态podspec checksum不同，99d3487只放行已识别两种Yoga checksum，其余Pod锁变化仍失败。复验运行期间不要推送无关功能取消构建。用户已选择稍后连接手机。

新功能：封面缓存和Player/Navidrome专辑展示；音乐库虚拟列表/批量操作、LX v2 JSON/LXMC预览原子追加；源指纹快照固定防更新竞态；恢复只隔离格式错误，IO/原生故障不移动数据；MG榜单/艺术家和MRC字段修复。主功能仍需收尾QRC网络密文、KG分类/分类筛选及长列表，随后进入M10漫途迁移/离线下载。不得把原生PCM或云端编译代替手机锁屏十首、真实Navidrome账号和签名验收。

云端2e7da07运行38695984346已全部成功，iOS27 App界面/播放测试和设备IPA归档上传通过，UIScene启动崩溃已修复。用户要求消除upload-artifact的Node20弃用警告：两处上传Action改为官方v7.0.2固定SHA，原生node24；项目Node24不变。后续检查新运行的上传日志，不能仅因旧运行成功就声称升级后的Action已验收。工作树QRC/分类收尾已通过101项TS、33项原生utility及完整native检查；TX真实网络取得17行/82个字时间，KW专区/普通标签及MG分类分别返回17/30/30项，尚未随此环境修复提交。

最新范围变更：用户确认“加入汽水歌单导入，播放使用其他平台匹配”。覆盖此前首版排除汽水专用导入的决定；仍不接汽水账号/直接音频播放。F13/M6支持漫途同样的网易/QQ/汽水三平台，另保留现有KW/KG/MG；汽水原始ID/元数据必须保留，匹配不可靠显示待匹配，不擅自换同名曲。漫途备份内38条汽水也需保留并复用匹配流程。迁移初稿当前3歌单支持数1187/0/1209、4收藏，仍跳过38条，不能宣称迁移完整。105项TS检查通过，UI与汽水链路待验。8ed1393为本地功能阶段提交，暂未push以免取消2b78e43的Node24复验（运行38700544730）。

Node24复验38700544730已全成功：IPA11957042787与诊断11957302431由v7.0.2上传，日志无Node20弃用警告，可以继续正常阶段push。最新本地UI `build/SourceUITests-1792051658997.xcresult`通过漫途文件选择/取消及Navidrome播放回归；未实际选择私人备份导入。功能状态清单见FEATURE_STATUS，包含新增汽水与待实现持久离线。已补取漫途歌词显示类Java/权威Smali及导入源码，本机来源和结论见WAYFARER_LYRICS_REFERENCE：自定义Canvas/TextPaint/ValueAnimator，两条歌词绘制路径；不能把现有透明度动画说成已等价复现累计扫色/字强调。下一步：汽水身份/公开导入/匹配接入、漫途完整验收、持久离线；仍保留真机/真实Navidrome待用户外部输入。

汽水链路新进度：imported/qishui独立身份、官方公开接口完整分页/短链、预览追加、严格自动候选/人工MatchModal、音乐库匹配记录与备份、跨平台全局质量优先/目标隔离routeKey、目标歌词接入完成。原始队列身份不替换，不接汽水直接播放。真实接口读取38首；一首真实原曲搜索36候选、1可靠WY、无失败平台。漫途实际样本现在1187/38/1209、4收藏、unsupported0，不再跳过汽水；私人样本/原曲信息仍不入Git。115项TS检查通过；本地UI `build/SourceUITests-1792053290760.xcresult`通过汽水导入入口/空输入/关闭及Navidrome播放回归；不等于实际App导入/匹配实音已通过。新增Player/私人曲库本地收藏与歌单入口、长列表最多50项显示分页。40cc6a6（含8ed1393）已push，云端运行38704334418仍跟踪中，首次新原生封面/QRC验证不要随意取消。下一步重点持久离线/下载管理及完整导入、匹配/字体UI与逐字视觉验收；见FEATURE_STATUS和决策0011。


## 2026-10-15 SollinPlayer iOS 对齐范围更新

用户要求以 SollinPlayer 移动版 v2 为 UI 和功能对齐目标，提供九张截图（含补充 AM 风格）及功能清单，与音枢既有能力取并集。条目、状态、证据与实施顺序见 [Sollin iOS 对比](docs/SOLLIN_IOS_COMPARISON.md)。本次为对比/范围整理，未将新增功能标记为完成。

新增总目标包含设备媒体库/文件音频导入与本地曲库、WebDAV、经典/新拟态/粉粉主题、五种播放器皮肤、主题背景/强调色/字体完整设置、EQ曲线/独立前级/自定义预设、睡眠定时器；推荐/平台登录/评论、TTML与跨平台歌词、动态封面、云备份/同步、统计/识曲、iPad布局列入对齐扩展目标并逐项核验。此前本地文件管理、评论及持续同步的排除不再代表最终总范围。保留原有五平台、多LX优先级/同档跨源降档、汽水匹配、漫途迁移、真实频谱、Navidrome服务端编辑、本地/云端IPA。永久离线下载仍按已有安排最后完成。

九页为发现、歌单详情、EQ、写真歌词、封面沉浸、黑胶唱机、AM风格、声波核、外观设置。截图灵动岛不直接证明独立Live Activities，投屏入口不直接证明所有协议；不将桌面/Android专属能力混作iOS已证实能力。CarPlay/ECARX/Android正式版/SMB/商店发布没有因此自动新增。


2026-10-15：已拉取 Sollin-Music-Desktop 到本机 ReferenceProject，固定 c9d446f6ad3b7ea1aff64bd5ce290b6e7f9712a8。桌面 AMLL/TTML/背景/WebDAV 证据及 MIT/第三方边界见 REFERENCE_COMPARISON；不证明 iOS 同实现，不移植其全列表 30Hz 更新。增量任务已细分 S0–S9（TASK_PLAN，对应并集 J01–J58），S1 开始主题、一级发现页、悬浮导航与 mini 基础。旧本地文件/评论/同步排除已被本次并集目标覆盖；仍区分目标与已验收。


详细范围现在为 F01–F36，新增 F23本地/媒体库、F24 WebDAV、F25主题、F26九页五皮肤、F27深度歌词、F28图形EQ、F29定时、F30登录推荐、F31评论、F32云备份、F33同步、F34统计识曲、F35平板、F36匹配与诊断；不是只追加一句“参考外观”。任务已按S0–S9映射58项。S1实测发现ExpoBlur长期未完成animator导致自动化空闲超时，已移除并改原创静态NexusMaterialView；公开网易CDN旧HTTP按精确域名升级HTTPS，私人地址不改，详见决策0012。


### S1 本地验收完成与 S2 初稿

120 项 TS 测试及类型检查通过，包含设置迁移/失败原子性、CDN HTTPS精确匹配、封面4并发/64等待上限/取消和清理失效。新增静态 NexusMaterialView 已通过 Release 编译与交互；实际测试无之前每次60秒动画空闲问题。

- build/SourceUITests-1792063450926.xcresult：外观选择/重启持久化/一级导航、发现完整歌单读取确认、Navidrome合成服务实际播放/PCM/歌词/暂停/移除凭据，3项通过。
- build/SourceUITests-1792063716396.xcresult：封面排队改动后Navidrome合成播放回归通过。
- build/SourceUITests-1792063866709.xcresult：音源导入/启停删与汽水导入入口，2项通过。

S1 原生模糊/渐变、安全区域、语义色/强调色、悬浮导航/封面mini基础已实现；S2新增发现双列封面卡、平台/分段、歌单封面与计数/简介展开/随机已加载入口。尚未实现完整日推登录、全套详情操作、取色和五播放皮肤。截图仅为本地模拟器；真实ND账号/真机签名与后台仍待验。后续云端新提交单独跟踪。

S1已提交并push：2cb91a6605b0bf37704c007633d9bdbb8c5d5947。云端38728228483：Linux通过，iOS检查运行中；不要新push取消首次静态材质/渐变/SafeArea依赖验证。S3在本地继续：ModernPlayer/PlayerVisuals新增AM、沉浸、写真封面背景、黑胶和真实FFT声波核，保留经典；只改Preferences.playerLayout，不建第二播放器。120项TS通过。最终UI build/SourceUITests-1792065306216.xcresult：ND合成实音/PCM/歌词→暂停→五皮肤切换、AM进度拖动且仍暂停、按钮首屏可达→回经典→删凭据全部通过；已看截图并修复控件超屏/状态栏对比。照片目前来自歌曲封面，没有独立写真库/图片导入；无完整扫色/字强调/TTML、动态取色或真机性能验收。决策0013记录边界，不能写成已经全功能/视觉完全对齐。

S3已本地提交b7d7226b89869efbf90e49a29da5314025965e6a，并成功生成arm64/SDK26.2未签名IPA，manifest dirty=false，产物在build/distribution，SHA见BUILD_STATUS。为允许阶段push且保留S1云端证据，工作流按官方当前文档改为cancel-in-progress:false + queue:max，新阶段排队而非打断当前运行；未声称云端新包成功。

重要云端纠正：S1 38728228483失败，外观与ND合成实音两个测试通过，仅SourceManager失败；不是编译/通用播放故障。已下载11971211239，ui-catalog.log68351源启用按钮缺失，点击导入的hit point{-1,-1}，失败AX显示误进tab-library。实际是iPhone17较小视口的源导入按钮被浮动底栏遮挡，尾部大padding不足以约束ScrollView可见区域。当前工作树按chrome实际高度/安全区缩小滚动视口，并加导入后仍在设置tab断言；新建本地iPhone17模拟器CACFEADC-4D00-4BBF-AD37-503CDD1BE24A（iOS26.3.1）复验。原iPhone15ProMax测试模拟器暂时shutdown以节约Intel16GB内存。4db78c4已push，运行38732185670已启动，包含旧布局，不能称修复已上云。S3功能和本地IPA提交b7d7226已在远端。

紧凑视口复验已通过：新iPhone17模拟器源导入/启停删69.151秒，ND合成实音/PCM/歌词/暂停、AM拖动/五皮肤控制可达85.659秒，全部成功；120项TS通过。内容区实测chrome高度约束修复待随本批提交上云；旧基线云端成功不能替代新修复验收。九张截图本地持久保存在resource/reference-ui/sollin-v2（忽略Git），不作为打包资产。

最终本批状态：d96ea74d8e4d67c3de8426a7fa0af0613adaae5d 已正常push（无force）。紧凑视口最终证据 build/SourceUITests-1792066875571.xcresult 两项通过。修复版本地IPA再次成功，build/distribution/build-manifest.json记录d96ea74/dirty=false/arm64/iphoneos26.2/signed=false；SHA256 bd6ce7b6903915fbab041c52c2c75d64587156cfcb1d656add65ecef83615afe。修复云端运行38735111951已创建，当前pending；前面的4db78c4运行38732185670仍可能重现已知旧遮挡，不把它作为d96修复结果。两个本地项目测试模拟器均已shutdown节约Intel内存，UDID保留可再boot。

## S4/S5 增量接续（2026-10-15）

当前工作树已补图形EQ/精调/独立前级±12/七内置与命名预设，原生睡眠时长/本曲后停/App音量，TTML有界时间/背景声子集与原生TextKit累计裁切/字光晕，单曲偏移与全局叠加/双击/对齐。新模块NexusLyricsModule，已更新expo-module.config并pod install；无新增npm依赖。原生绘制不逐帧React，字体从既有App导入沙箱读取。130项TS通过，native完整套件及真正AVPlayer到点/本曲结束暂停通过。build/SourceUITests-1792070370380.xcresult：EQ实际增益改变/预设重启/删除/睡眠取消和ND合成实音/PCM/原生歌词/五皮肤通过。测试曾把半露出的curve坐标拖到底栏，已要求整个控件在视口内并断言增益改变，不以第一次“可点”成功代替拖动证据。决策0014/0015记录参考/范围；后续歌词最终改动另复验。S4候选/深度样式/真实TTML和字体、S6–S9仍未完成，不把新代码当作所有计划落地；手机和真实ND仍保留外部验收。云端d96运行38735111951目前仍在App测试阶段，不能提前标成功。

本批最终本地验收：build/SourceUITests-1792070741768.xcresult 110.910秒通过实音/PCM/五皮肤/逐字及单曲偏移重置/双击仍暂停；build/SourceUITests-1792071034072.xcresult 145.144秒通过曲线实际增益/预设重启删除/定时开启取消。已看原生逐字部分填色截图。130项TS及native-sleep-final全通过。CI已增加EQ/睡眠UI测试；d96ea74云端App步骤已通过，当前归档，不是本批新模块云端通过。

## 2026-10-16 持续目标与 S6 进行中

用户明确持续目标为“完成所有任务计划中的功能并集实现和测试调试，并通过本地和云端编译打包”，目标保持 active。不是仅完成S4/S5；S6设备媒体库/WebDAV、S7、S8、S9以及S4深度样式/候选、S2/S3视觉收尾、真机/真实ND验收均保留。

S4/S5已提交push bdb8018e85098026d920ca9ba5f636885035fc1a，本地IPA arm64/SDK26.2/dirty=false/signed=false通过，SHA256 8a799140bd5f59730f692975edc98c4ccd3cd7356da81954566be4c2825f4c0b。旧d96云端38735111951最终成功，包含App UI和iOS27设备IPA。新bdb运行38744057327在native-utilities子进程status=null失败，未进入App编译；d643cb6把工具CLI改Release优化/90秒有界预算/逐项耗时及进程错误诊断，下一运行38768357550已通过33项utility、JSC/lifecycle，随后ARM DSP测试finite==original失败。8a2e572仅将“启用平直滤波”的数值断言改为1e-6/1e-5误差界限，关闭EQ逐样本位同一性仍严格断言，已push待新云端；不能把新阶段标云端通过。

S6当前工作树：独立local来源/SHA256内容身份、LocalAudioStore原子批量导入、原创LocalAudioFiles/NexusFilesModule、原生标签/封面/内嵌歌词、App本地歌曲/专辑/艺术家/搜索/收藏歌单队列入口、原生在播文件保护。删除采用.pending-delete日志/暂存与SQLite提交、启动reconcile恢复；不导出绝对容器地址。135项TS及native格式检查通过，合成自制MP3已实际解码/PCM与提取ID3标题/艺术家/专辑/歌词/封面；WAV/M4A/AAC/AIFF/16和24FLAC也验证。测试脚本scripts/fixtures/silent-mp3.mjs为原创合成静音，无私人录音。设备媒体库/WebDAV尚未实现。

本地文件App真实导入UI还在复验。首次build/SourceUITests-1792081703955.xcresult因FilesProvider首次就绪较慢，3秒Browse存在判断跳过，停在Recents；已改等待系统Browse页签20秒并按实际AX定位。新一轮正在运行，不能将原生CLI成功当作App完整导入已验。随后发现Xcode默认克隆测试设备导致预放文件与实际UI不在同一设备；现test-ui关闭parallel testing，监测测试启动后在指定模拟器Files的group.com.apple.FileProvider.LocalStorage/File Provider Storage/Nexus UITest Fixtures放合成MP3，使用真实系统选择器，结束清理。UIFileSharing/LSSupportsOpeningDocumentsInPlace已撤回，避免将原有Documents/SQLite显示到文件App；生产没有夹具导入后门。

S6文件音频最终本批：137项TS检查通过（check-local-audio-final.log），包含缺失文件重新导入保留恢复副本和备份不带file://路径。native-local-journal.log全套通过。build/SourceUITests-1792082588688.xcresult：文件真实导入/重启再播放/在用拒删/移除当前队列后删除61.161秒，ND回归99.008秒通过；build/SourceUITests-1792082899195.xcresult再加专辑封面网格/艺术家分组67.575秒通过。未引入UIFileSharing。CI增加testYLocalAudioFileImport并关闭克隆，Files夹具是真实系统目录的合成数据、无生产后门。将本批提交push后生成本地IPA、跟踪云端新模块；不要将旧8a2e运行误认为S6云端结果。后续先设备媒体库/WebDAV，再继续全部未完成S2/S3/S4/S7/S8/S9，保持完整目标active。

文件音频阶段已提交并正常push c798ab4657e37d88347db322dcb6dfa4f6719b24。随后本地build/logs/archive-local-audio.log归档成功，manifest commit=c798ab4/dirty=false/arm64/iphoneos26.2/signed=false；IPA SHA256 22885744c59b72cbe960f4d7bd8d1d7a5c2284ed59a1d85b24ffc9f932cf29a7。云端S6运行38772611477创建并pending；前一8a2e运行38769479789已过native、在App UI步骤，不是S6结果。当前没有存量独立开发阻碍，下一步设备媒体库授权/独立身份/原生播放和WebDAV，继续完整目标，不要求用户再次说继续。

## S6 设备媒体库增量（2026-10-16）

已接入原创 MediaPlayer 原生模块、用户主动授权、歌曲/专辑/艺术家与分页搜索、内嵌歌词和共享封面缓存。device来源使用本机namespace + UInt64字符串ID + 元数据签名，播放时重新查询并检查授权/DRM/云端未下载；assetURL不进入曲库备份。权限撤销清空浏览并停止当前设备来源播放，失效引用显示可操作提示，仍使用同一队列/AVPlayer。参考与Android替代边界见[决策0017](docs/decisions/0017-device-media-library.md)。

145项TS/类型检查（build/logs/check-device-media.log）和native-device-media.log全套通过，覆盖长ID、跨设备碰撞、快照分页/迟到结果/权限变化、备份无URI及未授权ipod-library拒绝。Release build/SourceUITests-1792084293006.xcresult：真实权限拒绝界面16.053秒、ND合成实音/PCM/原生歌词/五皮肤96.506秒均通过，已查看截图。模拟器没有真实音乐库，设备歌曲/后台播放尚待手机，不将授权测试等同媒体库实音。

云端8a2e运行38769479789的native检查通过，App中ND播放通过、源管理失败；下载诊断11993526333，ui-catalog.log67209定位系统Files首启空白容器未出现取消按钮。测试改为中英文合并30秒有界等待，不跳过断言。c798文件阶段运行38772611477另在运行，不能以旧失败作为新阶段结论。S6 WebDAV仍待实施；全范围S2/S3/S4/S7/S8/S9和真机/真实ND验收继续，目标保持active。

音源选择器等待修订本地复验：build/SourceUITests-1792084866977.xcresult源管理实际Files打开/取消→URL导入→启停→删除56.553秒通过；最终check-device-media-final.log为145/145，无失败/跳过。新授权测试已加入CI，云端尚待新提交实际运行。

设备媒体库阶段已正常push ff84cc47183f9652994c657e4134498cd9a31258。本地archive-device-media.log归档成功；manifest commit=ff84cc4/dirty=false/arm64/iphoneos26.2/signed=false，IPA SHA256 861dfc6a95bf5c1fa17958107327ab490aca0c99e5db1ec6fa7c0d167e388ab8。新云端运行38776957927 pending，文件阶段38772611477 native通过/仍在App测试；不将其提前写为云端成功。

## S6 WebDAV 连接/协议基础（2026-10-16，未接App播放）

原创webdav.ts已实现根目录路径规范化/同源限制、DAV命名空间和成功propstat解析、Depth1目录及Depth0文件探测；webdavAccounts.ts提供多账号/Keychain隔离、验证后保存与写失败回滚。TTML的有界XML抽到formats/xml.ts，保留全部原TTML测试。原生DAVHTTP提供真实Basic/PROPFIND、2MiB响应预算、目录内重定向/5次上限、越界阻断/取消；已通过Mac合成HTTP实际请求及iOS15.1 simulator SDK类型检查。154项TS/类型检查通过（check-webdav-final.log），native-webdav-http-run.log原生HTTP通过。

参考与RFC决策见docs/decisions/0018-webdav.md。这是连接和协议基础，尚未接入Expo桥、App目录UI、webdav Track来源、受限音频Range Loader或远程AVFoundation元数据；不能写成WebDAV播放完成。下一批优先这些剩余，再验证App合成服务器播放/缓存/移除账号，随后继续S2/S3/S4/S7/S8/S9等全部未完成目标，goal保持active。
