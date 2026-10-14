# 研究来源与固定证据

日期：2026-10-14。固定提交用于复核，在线文档在正式实现时重新检查。此文件不代表第三方代码已导入或许可统一。

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
