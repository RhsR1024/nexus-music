# 音枢 NexusMusic 交接备忘录

更新日期：2026-10-15，Asia/Shanghai。此文件是后续开发的基础上下文，接手者应完整阅读。

## 当前任务与成果

用户希望先确定功能清单、技术框架和实现边界，之后在自己的 MBP 上开发。初期形成交接文档；用户于2026-10-14明确要求列出详细任务计划并开始实施，现推进工程基线与领域模块。

远程仓库为 `https://github.com/RhsR1024/nexus-music.git`。本轮在 Windows 上将原本空的远程仓库克隆到 `Z:\Z-WorkSpace\NexusMusic`。Z 盘是网络映射盘，后续 Mac 建议在本机 SSD 单独克隆仓库，不在 SMB 共享目录中共用 node_modules、Pods、DerivedData 或同一套 Git 工作树。

开始实施前仅有文档；当前实施清单见 [TASK_PLAN.md](docs/TASK_PLAN.md)，实际构建与测试以记录为准，尚无真实服务/真机验收。任何文档中的能力描述都必须区分：源码可见、协议支持、建议实现、真机已验证。目前最后一项尚未完成。

## 用户已经确认的决定

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
