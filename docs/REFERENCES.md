# 研究来源与固定证据

日期：2026-10-14。固定提交用于复核，在线文档在正式实现时重新检查。此文件不代表第三方代码已导入或许可统一。

## Mineradio / AMLL / Youmi（2026-10-20 补充）

- [Mineradio-paused固定提交](https://github.com/XxHuberrr/Mineradio-paused/tree/d43de565acabfdc1a9c9820a27e81a98ccbebcef)：main/d43de565；GPL-3.0-only，README明确长期停更，NOTICE列出独立上游与汽水专有运行时边界。只研究账号/分页/评论及节拍行为，不复制Electron服务或专有资源。
- [applemusic-like-lyrics固定提交](https://github.com/amll-dev/applemusic-like-lyrics/tree/ca0f41d67882d936c0365ffd99c16841ea2fa39d)：main/ca0f41d6；根及core/lyric/ttml/react/react-full/vue六包均声明AGPL-3.0-only。研究歌词语义、滚动、背景职责；DOM/Canvas/TTML环境依赖与许可均不能因TS/React而忽略。
- [7DaysMax/Youmi-Music-IOS固定提交](https://github.com/7DaysMax/Youmi-Music-IOS/tree/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2)：main/152567b3；无独立LICENSE，README仅学习研究声明。是此前Ryderwe/Youmi fork所指向的上游，不能混同固定提交；只作网易登录/FM/账号实体等行为对照。
- 三仓均位于`Z:\Z-WorkSpace\`对应仓库名的独立浅克隆；与音枢e72827d的21项证据、适配/不采纳边界和Mac复核命令见[三项目比较](MINERADIO_AMLL_YOUMI_REFERENCE_REVIEW.md)。未运行参考工程、未联调账号、未移植实现或资源。

## Beans-Music（2026-10-19 补充）

- 仓库：<https://github.com/XIaodou0416/Beans-Music>；main / `f9881318caf774129205c3160510ef0dfa318adc`；本地 `Z:\Z-WorkSpace\Beans-Music`，最新提交浅克隆。
- [项目配置](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/project.yml)：Swift 5、iOS 15、版本1.6.5.1/build39，XcodeGen；不是音枢RN依赖候选。
- [根许可证](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/LICENSE)：MIT / XIaodou0416；第三方实现、品牌和资源仍需逐项核查。
- 三平台授权、日推/FM、歌单收藏、评论/实体、导出备份/歌词等固定源码和音枢差异见 [具体清单](BEANS_MUSIC_REFERENCE_REVIEW.md)。仅研究，未导入第三方代码或资源，未运行参考App。

## 三个开源参考

### CyMusic

- 仓库：<https://github.com/gyc-12/Cymusic>
- 分支/提交：main / `bf0d4694acb52973bcd594d31b3c61f655e166cb`。
- [package.json](https://github.com/gyc-12/Cymusic/blob/bf0d4694acb52973bcd594d31b3c61f655e166cb/package.json)：Expo57.0.21、RN0.86.3、RNTP5.9.2。
- [原生JSC运行时](https://github.com/gyc-12/Cymusic/blob/bf0d4694acb52973bcd594d31b3c61f655e166cb/modules/cymusic-native/ios/CyMusicUserApiRuntime.m)。
- [LX adapter](https://github.com/gyc-12/Cymusic/blob/bf0d4694acb52973bcd594d31b3c61f655e166cb/src/helpers/userApi/lxMusicSourceAdapter.ts#L547)：请求平台字段为tx，不能声称已完整五平台适配。
- [URL/音质回退](https://github.com/gyc-12/Cymusic/blob/bf0d4694acb52973bcd594d31b3c61f655e166cb/src/player/MusicSourceResolver.ts)：当前主要三档回退。
- [RNTP迁移及验证边界](https://github.com/gyc-12/Cymusic/blob/bf0d4694acb52973bcd594d31b3c61f655e166cb/docs/maintenance/2026-09-10-rntp-v5.md)：作者记录不等于本项目验收。
- [RNTP独立许可](https://github.com/gyc-12/Cymusic/blob/bf0d4694acb52973bcd594d31b3c61f655e166cb/third-party-licenses/rntp-player-5.9.2.txt)：不被CyMusic自有源码Apache许可覆盖。

### Q-1515 LX iOS

- 仓库：<https://github.com/Q-1515/lx-music-mobile>
- 相关分支/提交：ios-adaptation / `547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a`。
- [音乐类型](https://github.com/Q-1515/lx-music-mobile/blob/547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a/src/types/music.d.ts)：平台/quality/size/歌词字段。
- [原生模块](https://github.com/Q-1515/lx-music-mobile/blob/547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a/ios/LxMusicMobile/AppDelegate.mm)：JSC、媒体控制与FLAC/DSP。
- [FLAC分流](https://github.com/Q-1515/lx-music-mobile/blob/547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a/src/plugins/player/nativeFlac.ts#L107)：自定义native streaming路径拒绝本地FLAC，不能推导全部本地播放能力。
- [iOS工作流](https://github.com/Q-1515/lx-music-mobile/blob/547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a/.github/workflows/ios-ipa.yml)。

默认master README保留上游“不支持iOS”的说明，不用于否定独立ios-adaptation分支。

### 悦音

- 仓库：<https://github.com/xiaoqi419/joy-music-mobile>
- 分支/提交：master / `d6f1af7f911e84babce56cd07297b44cfe46eed9`，package版本1.2.9。
- [package.json](https://github.com/xiaoqi419/joy-music-mobile/blob/d6f1af7f911e84babce56cd07297b44cfe46eed9/package.json)：Expo54、RN0.81.5、expo-audio。
- [脚本探测](https://github.com/xiaoqi419/joy-music-mobile/blob/d6f1af7f911e84babce56cd07297b44cfe46eed9/src/core/music/sources/joy.ts#L390)：临时lx、mock request、new Function与handler推断。
- [歌单持久化](https://github.com/xiaoqi419/joy-music-mobile/blob/d6f1af7f911e84babce56cd07297b44cfe46eed9/src/core/config/playlist.ts)：AsyncStorage。
- [本地库骨架](https://github.com/xiaoqi419/joy-music-mobile/blob/d6f1af7f911e84babce56cd07297b44cfe46eed9/src/core/music/index.ts#L36)。
- [音频缓存](https://github.com/xiaoqi419/joy-music-mobile/blob/d6f1af7f911e84babce56cd07297b44cfe46eed9/src/core/music/audioCache.ts)：真实下载，缓存目录和单质量索引。
- [播放封装](https://github.com/xiaoqi419/joy-music-mobile/blob/d6f1af7f911e84babce56cd07297b44cfe46eed9/src/core/player/expoav.ts)：后台/锁屏API，seek controls不等价业务上一首下一首。
- [发现类型](https://github.com/xiaoqi419/joy-music-mobile/blob/d6f1af7f911e84babce56cd07297b44cfe46eed9/src/types/discover.ts)、[网易评论](https://github.com/xiaoqi419/joy-music-mobile/blob/d6f1af7f911e84babce56cd07297b44cfe46eed9/src/core/comment/index.ts)。
- [歌词逐字标签去除](https://github.com/xiaoqi419/joy-music-mobile/blob/d6f1af7f911e84babce56cd07297b44cfe46eed9/src/core/lyric/fetcher.ts#L580)。
- [LICENSE](https://github.com/xiaoqi419/joy-music-mobile/blob/d6f1af7f911e84babce56cd07297b44cfe46eed9/LICENSE)为MIT；[README](https://github.com/xiaoqi419/joy-music-mobile/blob/d6f1af7f911e84babce56cd07297b44cfe46eed9/README.md)另有非商业文案，不能替作者自行消解。

## 原漫途工程证据

本次研究的原工程为293 / 2.4.1-qishui-parity，提交短SHA `8e47cdc`。原工程不包含在本仓库，不要求后续Mac存在先前Windows的D盘路径。

| 文件/位置 | 证据 |
| --- | --- |
| README.md、docs/BUILDING.md | 正式构建以Smali为权威、Java为反编译参考，不能直接加iOS目标 |
| app/src/main/assets/script/user-api-preload.js | lx_setup、HTTP/二进制/取消、Buffer/AES/RSA/MD5/zlib、version/env等宿主契约 |
| app/src/main/java/p016d2/p.java:158/166/303 | getAlbum、/rest/请求与salt/token、search3 |
| app/src/main/java/p016d2/q.java:122–363 | 歌单/专辑/歌手/封面与歌曲模型映射，部分排序另有私有API辅助 |
| app/src/main/java/Q1/q.java | Navidrome内部auth/login/排序辅助，不是唯一媒体客户端 |
| docs/playlist-sync/SPEC.md | 历史歌单完整性、长ID、重复曲序与失败保留策略；历史汽水范围不进入本项目首期 |
| app/src/main/java/p041i2/AbstractC0368c.java | wayfarer_music-backup.json及相关快照；实际导出格式仍需真实样本确认 |

不要把Java反编译中可疑分支当作原始业务保证；正式修改旧工程需读实际Smali。本仓库只继承协议/行为需求，不编译这些Java。

## 框架一手资料

- [RN New Architecture](https://reactnative.dev/architecture/landing-page)：JSI/bridge变化和能力边界。
- [RN performance](https://reactnative.dev/docs/performance)：JS/UI线程、Release性能评估。
- [Reanimated glossary](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/glossary/)：worklet/UI线程/shared values。
- [Expo Modules](https://docs.expo.dev/modules/overview/)：Swift/Kotlin原生模块。
- [Expo Audio SDK54](https://docs.expo.dev/versions/v54.0.0/sdk/audio/)：后台模式、锁屏与seek controls；API存在不等于某app完成系统控制验收。
- [Flutter Impeller](https://docs.flutter.dev/perf/impeller)：shader/pipeline与渲染目标，无彻底消灭所有卡顿的保证。
- [just_audio](https://pub.dev/documentation/just_audio/latest/)、[audio_service](https://pub.dev/documentation/audio_service/latest/)：Flutter音频路线具备实现路径，不构成自动最优排名。
- [ActivityKit/Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)、[WidgetKit](https://developer.apple.com/documentation/widgetkit/)：原生扩展展示，与主应用UI框架分离。

## Navidrome与构建/签名资料

- [Navidrome Subsonic compatibility](https://www.navidrome.org/docs/developers/subsonic-api/)。
- [Navidrome API v1](https://www.navidrome.org/docs/developers/api-v1/)。
- [OpenSubsonic extensions](https://opensubsonic.netlify.app/docs/endpoints/getopensubsonicextensions/)。
- [Apple Xcode requirements](https://developer.apple.com/xcode/system-requirements)。
- [macOS Tahoe supported models](https://support.apple.com/en-la/122867)。
- [Apple Personal Team限制](https://developer.apple.com/cn/help/account/basics/about-your-developer-account)。
- [SideStore prerequisites](https://docs.sidestore.io/docs/installation/prerequisites)、[SideStore FAQ](https://docs.sidestore.io/docs/faq)。
- [AltStore refresh](https://faq.altstore.io/altstore-classic/your-altstore)。

## 验证边界

本轮完成只读源码/文档研究、远程空仓库克隆和Markdown整理。未运行候选应用、未安装依赖、未编译iOS、未连接用户服务器/手机、未实测音频或续签。旧报告的Windows研究目录不是交接所必需输入；所需公开证据已固定链接，真实私人样本在实施阶段再获取。

## 本机参考仓库接续（2026-10-15）

悦音、Q-1515 ios-adaptation、wtfdelphia和CyMusic已完整克隆到本机ReferenceProject；固定提交与对比规则见 [REFERENCE_COMPARISON.md](REFERENCE_COMPARISON.md)。自有Wayferar-Music也已通过SSH取得，main / `8e47cdc701cdbb772577b2bf7abb699e285b0fa6`，当前检出README、docs和音源preload，其他Smali/importer文件按功能补取，避免下载根目录APK。README和docs/BUILDING.md已核实：正式构建以Smali及可编译importer源码为准，不能整体编译反编译Java。没有在本机运行参考项目构建，也没有复制其业务实现。
