# Sollin iOS 2.0.0（60）IPA 静态核验

日期：2026-10-16。用户提供本机 `/Users/ningli/WorkSpace/ReferenceProject/Sollin-2.0.0 60-unsigned.ipa`，要求核验实现并以其 UI、交互和功能作为音枢的直接参考。范围按[决策0033](decisions/0033-sollin-mobile-scope.md)处理：完整参考移动端行为和四组设置，排除 Sollin 自有账号、商业、支持和遥测体系，保留音乐平台 provider 账号。此文件是移动二进制证据，优先于用桌面实现推测移动端；既有 F01–F37/J01–J59 总范围和 LX 优先、下载/漫途后置的顺序保留。

## 固定样本与分析边界

- SHA256：`c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`。
- ZIP 共323项，解压总计约45.6MiB。静态检查没有执行 IPA、内置 JS、WebAssembly 或访问其服务。
- 证据提取至 Git 忽略目录 `build/sollin-ipa-review/`，原 IPA 和解包的二进制、资源、业务字符串不进入仓库。
- 对原包 Runner 与 App.framework/App 使用本机 `file`、`otool -l`；两个 Mach-O 的 `LC_ENCRYPTION_INFO_64.cryptid` 均为0。这只说明该文件未标记 FairPlay 加密，不等于持有源代码或复制许可。
- `flutter_assets/NOTICES.Z` 实为 gzip，解压第三方 notices约1.47MB，包含 liquid_glass_widgets、media_kit、just_audio、audio_metadata_reader 等包；第三方 notices不证明 Sollin 应用代码、品牌、图片和设计资产具有相同许可。

## 已确认事实

| 包内证据 | 结论 | 不能据此推导 |
| --- | --- | --- |
| `Payload/Runner.app/Info.plist` | Sollin 2.0.0 / build60，bundle ID `com.leguandev.sollin.v2`，最低iOS13，包元数据SDK为iphoneos26.5，设备族1,2，四方向，background audio/fetch | 不是实际构建复现、所有iPad尺寸或长后台通过 |
| `Frameworks/Flutter.framework/Flutter`、`Frameworks/App.framework/App`、flutter_assets | Flutter 的 iOS 编译包，Runner和业务库为设备arm64；业务逻辑为编译后的Dart/AOT形态 | 没有发现可直接移植的应用Dart源码或RN JS bundle；不保证能无损还原原工程 |
| App业务库的可打印字符串 | 约252个 `package:flutter_sollin/` 文件路径候选，包含歌词/多皮肤/推荐/同步/账号等模块线索 | 路径不是文件正文，个别末尾字符串可能含相邻字节；不能直接称实现全部可读或功能已可用 |
| `packages/liquid_glass_widgets/shaders/` 五类frag资产 | 包内带液态玻璃、轻量玻璃、交互指示、几何混合和渐进模糊shader | 不证明每个界面正在使用该效果或其性能；Flutter shader不能直接放进RN |
| media_kit、Mpv/FFmpeg 与 just_audio、audio_service、audio_session frameworks/notices | 包内同时带多种媒体相关组件 | 不能仅凭依赖推断哪条后端负责某曲、EQ或后台播放；音枢仍保持唯一引擎和权威队列 |
| `assets/audio_match/index.html`、`afp.js`、`afp.wasm.js` | 识曲有可读的桥接/指纹资产 | 不证明远端识别接口、鉴权、限额或整项功能实际成功 |

识曲HTML显示：接收Base64编码的little-endian Float32 PCM，拒绝空/无效/近静音数据；非8kHz时通过OfflineAudioContext重采样为8kHz，调用GenerateFP时截取前三秒。注释说明录音由原生采集。该线索可以帮助设计音枢的原生录音→指纹→识别服务边界，但尚未完成资产来源、算法许可、远端接口和隐私行为核验，不直接复制执行或计入F34完成度。

## 可定位的移动端职责

以下为业务库内保留的模块路径/符号证据，属于静态线索，尚未还原函数正文：

| 对齐目标 | 路径/符号线索 | 音枢采纳方向 |
| --- | --- | --- |
| AM/沉浸/经典等播放器 | `src/player/apple_music/`、`applemusic2/`、`immersive/`、`classic/`、`player_host.dart` | 以实际界面复核尺寸、布局和切换行为，继续共用已有播放器 |
| 深度歌词 | `applemusic2/lyric/lyric_layout.dart`、`lyric_painter.dart`、`lyric_controller.dart`、`core/spring.dart`；`src/lyrics/apple_lyric_parser.dart` | 观察累计填色、布局/滚动/弹簧行为，映射现有原生绘制和有界更新；不引入全列表逐帧React刷新 |
| 主题背景/动态封面 | `artwork_flow_background.dart`、`blushing_beauty_player_background.dart`、`dynamic_song_cover.dart`、`bg/bitmap_flow_background.dart` | 分清实际动态视频、图片流动和静态背景；依据观测逐项实现 |
| WebDAV备份/同步 | `src/backup/webdav_backup_service.dart`、`src/sync/library_cloud_sync.dart`、`manual_cloud_sync.dart` | 比较同步范围/冲突/触发/恢复行为，保留音枢现有三方基线和ETag安全边界 |
| 推荐/FM | `daily_mix_coordinator.dart`、`taste_profile.dart`、`neteasePersonalFmContinuationProvider`、`qqMusicRecommendPlaylistsProvider` | 分开本机推荐与平台认证能力；接口实际验证后接入 |
| LX | `src/source/lx_script_executor.dart`、`lx_source_service.dart`、`lx_probe_song_info.dart` | 用于核对脚本生命周期/诊断交互，音枢已有原生宿主不整体替换 |
| 识曲 | `src/audio_match/audio_match_service.dart`、`audio_match_page.dart`及可读桥接 | 优先核查服务、权限、指纹算法来源和真实识别结果 |
| 设置组织 | `src/settings/appearance_playback_download.dart`、`src/playback/*settings*`、`src/download/*`、`src/theme/*`、`src/lyrics/*`、`src/backup/*`、`src/sync/*` | 作为播放与歌词、外观与界面、下载管理、数据与存储四组设置的静态线索；路径不是源码正文，需按行为重新实现 |
| 账号 | `src/auth/auth_api_client.dart`、`sponsor_access.dart`、`session_expiry.dart`、账号管理页面 | Sollin自有账号/用户中心、赞助门槛和后台会话排除；网易云/QQ/酷狗等平台账号只作为音枢 provider 能力保留，不能从模块路径推导歌单同步或后台服务 |
| 系统歌词/收藏 | `ios_now_playing_lyric_service.dart`、`ios_notification_favorite_service.dart` | 继续核对实际系统界面，符号不代替手机灵动岛/收藏入口验收 |

## 接续方法与可复刻程度

1. 固定此IPA/hash，对照已有九图与移动模块建立“页面/操作→前后状态→错误恢复→音枢实现→验证”表。静态线索与实际观察分别记录。
2. 页面间距、字体层级、颜色、卡片、弹窗、导航、手势和切皮肤等可以在RN中重新实现。精确动画节奏、弹性、模糊/取色、键盘与长列表表现仍需实际运行截图/录屏测量，单靠二进制不能保证像素或交互完全一致。
3. 设备arm64 IPA不能直接作为本机Intel iOS模拟器App运行；动态分析需签名后的iPhone/iPad，或获得原项目构建的模拟器版本。目前未签名安装/运行，不宣称已完成动态分析。
4. 可进一步分析未剥离的符号、Objective-C桥接/方法以及Dart AOT控制流，按必要功能定向研究；不承诺恢复完整可编译的Dart源码，不以其替代行为验证。
5. 可读代码/资源按资产分别核验来源与许可后才考虑复用；其余以行为规格原创实现。依赖服务端、账号授权或受限能力的功能必须单独联调，不能从UI按钮推导已可移植。

## 账号、设置与数据边界

- 四组设置是完整对齐范围：播放与歌词、外观与界面、下载管理、数据与存储。它们的代码、自动测试、模拟器、真实平台和真机证据必须分别记录。
- 网易云、QQ 音乐、酷狗等平台登录可保留，用于平台实际支持的个人歌单、收藏、推荐、FM、云盘或受限播放；凭据进入 Keychain，不进入备份、同步、日志或诊断。登录成功不能直接标记歌单同步完成。
- Sollin 自身注册/登录、用户中心、设备管理、赞助/订阅/付费解锁、免责声明、服务与支持、自推广帮助、遥测、行为分析、诊断上传和私有权益校验均排除，不计入进度分母。
- 下载、同步和备份按音枢自身数据模型实现，不设置参考 App 的商业门槛，也不复制其后台 API、品牌资源或 AOT 二进制。

这条路线能显著改善移动端对齐的证据质量，但尚不能用此次包检查提高开发完成百分比。已有RN/原生实现继续保留，先利用直接移动证据完善剩余工作，避免重写已验收的播放、队列和存储边界。
