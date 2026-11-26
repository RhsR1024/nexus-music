# 2026-11-25 全量功能补齐与 Sollin UI 对齐阶段回执

日期：2026-11-25（Asia/Shanghai）  
目标依据：[决策 0082](decisions/0082-sollin-ui-90-fidelity-restoration.md)（功能全面收口 + 前端 UI 恢复 ≥90% Sollin 复刻目标，做不到必须写明理由；保留音枢特有能力、唯一权威队列、`reverse-skill` 证据门禁与隐私/许可边界）。

## 一、新增与补齐的 Sollin 客户端功能

在既有全部 F01–F37 / J01–J59 实现基础上，补齐最后一批可离线验证的 Sollin 客户端能力（共新增 10 项持久化偏好与真实原生接线，全部支持 `backupSettings` 备份与原子回滚）：

1. **底部栏与菜单体系**：新增独立「本地」底部 Tab（`local`）、外观设置「显示『本地』菜单」开关（`showLocalTab`）以及三套 Sollin 底部栏样式（`navigationStyle`: `liquid` 液态玻璃 / `frosted` 磨砂融合 / `acrylic` 亚克力中置），保留原有「玻璃底栏」降低透明度回退与 iPad 侧边导航栏。
2. **原生播放与显示能力**：
   - `keepScreenOn`：通过 `modules/nexus-native/ios/NexusNativeModule.swift` 的 `setKeepScreenOn` 真实控制 `UIApplication.shared.isIdleTimerDisabled`（仅在播放页打开且开关开启时激活，关闭或退出立即还原）；
   - `fullScreenMode`：全屏播放页隐藏状态栏；
   - `autoPlayOnLaunch` / `openPlayerOnLaunch`：冷启动队列恢复后按偏好自动起播或直接展开播放页；
   - `mixWithOtherAudio`：通过 `NativePlaybackEngine.swift` / `NexusPlaybackModule.swift` 的 `configureMixWithOthers` 真实切换 `AVAudioSession` 的 `.mixWithOthers` 选项；
   - `preloadNextTrack`：预加载下一首设置持久化与设置页接线；
   - `lyricChineseMode`（`original` / `simplified` / `traditional`）：通过 `NexusNativeModule.swift` 的 `convertChinese`（CoreFoundation `CFStringTransform`）实现原生简体/繁体转换，统一接入 `Lyrics`、`ClassicLyrics` 与 `MiniLyric`；
   - `playlistAddPosition`（`end` / `start`）：接入 `LibraryStore.addTracks`，支持新增曲目插入歌单末尾或开头。
3. **AM 播放器内联评论面板**：按 `IMG_4860.PNG` 在 `AMPlayer` 机身内集成暗色毛玻璃内联评论面板，点击底部评论图标切换展示，不再强跳不协调的浅色弹窗。

## 二、全站前端 UI 重构与 Sollin 对齐（参考本地 iOS 截图 + T7 Touch 3,041 张 Sollin 参考库）

建立统一的 `sollinTokens` 设计令牌体系（毛玻璃白卡片、极细描边、砖红主控制色 `#8F4A4E`、玫瑰强调色 `#E83D56`、暖粉雾弹层渐变、黑圆点关闭/砖红开启 Sollin 开关），并重写全站前端页面：

- **全局壳层与底栏**：移除顶部粗糙 `音枢 · NEXUS MUSIC` 横幅；重写四 Tab 液态玻璃胶囊底栏 + 独立圆形搜索键、磨砂融合一体底栏、亚克力中置底栏与单行悬浮磨砂迷你播放器。
- **发现与歌单详情**：重构发现页（大标题 + 音源胶囊/账号头像 + 彩点平台条 + 三段磨砂分段条 + 热门歌手/新碟首发双卡 + 定制风格化推荐卡 + 紧凑收藏入口 + 歌单网格）、歌单详情头卡与双胶囊播放按钮、汽水导入页及暖粉雾歌曲操作 Sheet（`TrackActions`）。
- **音乐库、本地与搜索**：重构音乐库（大标题 + 三枚玫瑰圆形操作键 + 三段胶囊切换 + 播放历史时间线）、独立「本地」Tab（5 图标标签栏 + 干净空态）、全局搜索页（6 宫格圆角类型卡 + 3×2 音乐平台胶囊 + 热搜词 Top-3 玫瑰角标）。
- **设置全链路**：对齐设置首页、外观与界面总览、主题模式/底部栏/播放皮肤/迷你播放器弹层、播放与歌词设置、EQ 均衡器曲线与双列预设卡、下载管理与任务结果、数据与存储、音乐来源与字体设置；同时保持 `4855`/`4856` 主题与背景页既有精修常量不受干扰。
- **全部 8 套播放器皮肤与弹层**：修复经典（`4854`）与黑胶（`4851`）在默认 `blush` 浅色主题下被 `coverColor` 覆盖暖粉底色的根因；重做播放选项菜单（`PlayerMenu` 4 珊瑚瓷砖 + 分组毛玻璃卡）、播放界面样式选择器、倍速与睡眠定时暖粉雾弹层、声波核居中三行歌词与 60 放射刻度环形 `FrequencyHalo`、AM2 顶栏避让与暗底音量条对比度、歌词舞台纯黑无文字污染画布及全部歌词暖粉雾 Sheet。

## 三、正式 Release 模拟器验收与 `visual-lab.mjs` 量化结果

所有以下结果均来自本机 iPhone 15 Pro Max（iOS 26.3.1，1290×2796 @3x）正式 `Release` 构建，且已导出 1290×2796 PNG 逐张人工亲看。

### 1. 五个黄金态 `visual-lab.mjs` 量化汇总

| 黄金态 | 正式结果包 | 控件区 SSIM | 控件区 ΔE00 | 可比区 SSIM | 内容一致估算 | 门禁结果 | 说明与未达 90% 原因 |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| `4854-classic` 经典播放页 | `SourceUITests-1795579572350` | **93.09%** | **0.95** (p90 0.24) | **93.89%** | **96.32%** | **通过** | 暖桃粉渐变修复后，播放键填充 ΔE00 0.24、暂停双杠 ΔE00 0.00，全指标达标 |
| `4851-vinyl` 黑胶唱机 | `SourceUITests-1795583842176` | **91.49%** | **3.25** (p90 3.02) | **94.43%** | **97.39%** | **通过** | `provenanceReady: true`，播放键填充 ΔE00 0.00、唱盘/唱臂/工具行全部达标 |
| `4855-appearance` 外观上半页 | `SourceUITests-1795592488790` | **91.09%** | **0.07** (p90 0.51) | **93.98%** | **96.13%** | **通过** | `provenanceReady: true`；补齐共享「颜色」磨砂卡与分割线、7pt 圆角框及 `#FEDADA` 玫瑰选中色后，预览卡/选中分段/强调色 ΔE00 均为 0.00 |
| `4856-appearance-scrolled` 外观下半页 | `SourceUITests-1795592488790` | **94.13%** | **0.51** (p90 1.42) | **93.98%** | — | **通过** | `provenanceReady: true`；校准四条滑轨 `+1pt` 垂直定位、非激活 `4pt` 轨高、滑块左偏距 `+2pt`、真实刻度数（`17/41/18/41`）与「遮罩颜色」去穿线底色后大幅通过 |
| `4861-am-lyrics` AM 歌词页 | `SourceUITests-1795583842176` | 59.36% | 16.67 | 65.90% | 88.58% | 未通过 | **原因**：① 暂停双杠色块 ΔE00 0.00、几何布局一致，但 AM 背景完全随封面取色，测试使用红绿蓝合成图暗化后底色偏深黑（亮度 ~18），而参考图实景照底色为紫青雾面（亮度 ~55），控件框内 >85% 像素为背景色导致 ΔE00 偏高、SSIM 降至 59.36%；② 底部第 3 图标为音枢皮肤切换入口而非参考投屏图标；③ 歌词与进度内容不同 |

### 2. Release 模拟器全流程自动化与人工亲看汇总

- `testVisualLabAppearanceDirect` (`SourceUITests-1795579067241`)：1/0/0 通过，导出 `4855`/`4856` 2 张图亲看。
- `testVisualLabClassicDirect` (`SourceUITests-1795579572350`)：1/0/0 通过，导出 `4854` 经典图亲看。
- `testAppearancePersistenceAndPrimaryNavigation` / `testGraphicalEQPresetPersistence` / `testGroupedSettingsNavigationAndDrafts` (`SourceUITests-1795579812938`)：均通过，导出设置首页、EQ 曲线与预设、主题模式、迷你播放器 XXXL 截图亲看。
- `testMiniAndNavigationSheetsWithLargeText` (`SourceUITests-1795581087658`)：1/0/0 通过，导出底部栏样式 XXXL 与迷你按钮 XXXL 截图亲看。
- `testDiscoverySongActions` (`SourceUITests-1795581665686`)：1/0/0 通过，导出 17 张发现页、歌单详情与歌曲操作菜单截图亲看。
- `testSearchHistoryAndStates` (`SourceUITests-1795583188515`)：1/0/0 通过，导出搜索页截图亲看。
- `testZNavidromePlaybackAndCredentials` (`SourceUITests-1795583842176`)：1/0/0 通过（674.6 秒），覆盖全部 8 套播放器皮肤、播放菜单、倍速、睡眠定时、听歌统计与 4 按钮迷你播放器，导出 36 张截图亲看（并在亲看 AM2 截图后立即补修了左上角返回箭头避让与暗底音量滑轨文字对比度）。
- `testLibrarySongActions` (`SourceUITests-1795584678121`)：1/0/0 通过，导出 8 张音乐库、多选排序与下载任务提交结果截图亲看。
- `testLiveSourceCatalog` / `testLiveQueueEditing` (`SourceUITests-1795592849635`) & `testLiveSourceSearchStates` (`SourceUITests-1795590643504`)：在纯净模拟器下导入本机脱敏目录 7 个真实 LX 音源，验证网易云 `/api/cloudsearch/pc` 搜索、LX `musicInfo.songmid` 兼容与 `15000ms` 预算，实测真实封面、同步歌词、真实 MP3 流解码播放、实时 FFT PCM 频谱、分页加载、单点重建权威队列、队列锁定与清除当前之后全部通过（导出截图逐张亲看，不保存或记录任何私源内容）。
- 剩余 4 处旧深色次级界面（`NavidromeLibrary`、`PlaylistPicker`、`MatchModal`、`LocalPlaylistPicker`）已全部统一至 `sollinTokens`；全量单测 `npm run check` 1164/1164 通过，`sollin-reverse-gate.mjs ipa --review`（61E/26WI/131/52F/52P，0 错误/0 警告）与 `apk` 通过。
- 说明：上述扩展页面（发现、歌单详情、搜索、音乐库、本地、设置各子页、声波核、写真、舞台、AM2、播放菜单等）没有 1290×2796 iOS 同态黄金态 JSON 配置，均通过实际 Release 模拟器截图对照 Sollin 参考图完成人工质量验收，不虚报像素百分比。

## 五、第三轮：T7 Touch 实机截图逐页复刻（32 态肉眼闭环）、缺失功能补齐与全套 CI 本地预演

基于外置 SSD `/Volumes/T7 Touch/NexusMusic/SollinCapture/work/sollin-android-ui-20261023/evidence/` 实机截屏与本地 `resource/reference-ui/` 全部参考图，对全站所有页面与播放皮肤完成第三轮深度对齐，并补齐全部可离线验证的 Sollin 缺失功能：

### 1. 第三轮补齐的 Sollin 客户端与原生功能（新增 `tests/sollin-features.test.ts` 6 项单测，全量 `1170/1170`）

1. **原生渐入渐出（Fade In / Fade Out）**：在 `modules/nexus-native/ios/NativePlaybackEngine.swift` 与 `NexusPlaybackModule.swift` 实现 20ms 步进原生平滑音量淡入淡出（`configureFade`），联动播放设置开关与时长。
2. **iOS 锁屏/灵动岛实时系统歌词**：在 `NativePlaybackEngine.swift` 新增 `setSystemLyricLine`，通过 `MPNowPlayingInfoCenter` 在歌手位或标题位实时同步当前歌词行（支持简繁转换），暂停或关闭开关时无损还原原始曲目元数据。
3. **下一首音频预加载缓存与协调器**：新增 `src/playback/preloadCache.ts`（`PreloadCache` TTL LRU + `startPreloadCoordinator`），自动在播放后段预解析下一首音源并命中加速切歌。
4. **分平台播放音质与智能切源策略**：在 `src/app/preferences.ts`、`src/providers/multiSourceResolver.ts` 与 `src/app/services.ts` 完整接入分平台音质覆写、智能降级模式（`progressive` / `direct128k`）、跨脚本切源（`crossScript`）与失败自动跳曲（`smartSkipOnFailure`）。
5. **歌词双语译文/音译开关与副词缩放**：`src/lyrics/settings.ts` 与 `src/ui/Lyrics.tsx` 支持独立开关译文/罗马音及调节副词缩放比例；`PlayerMenu` 新增直达**歌词偏移微调面板**、**EQ 均衡器内嵌入口**与**音频输出路由（AirPlay）面板**。
6. **交互与曲库补齐**：启动自动播放三态来源（`last` / `favorites`）、播放页封面左右滑切歌与点击歌手直达搜索、搜索历史单条 `×` 删除/热搜与历史同屏/音质徽标（`QualityBadge.tsx`）、LX `playList_v2` JSON 导出（`encodePlaylistJSON`）、自建歌单搜索与排序、听歌统计四维时间段（7 天 / 30 天 / 今年 / 全部）、缓存分项清理（封面/临时音频/全部）以及本地音频右侧 A–Z 字母快查索引栏（`AlphabetIndexBar.tsx`）。

### 2. 第三轮全站 32 态 UI 逐页亲看复核与原生渲染修复

- **原生 `NexusMeshView.swift` 边缘斜切接缝根因修复**：肉眼审图发现 SwiftUI `MeshGradient` 在动画中边界顶点向内漂移且默认受安全区约束，导致 AM / AM2 / 沉浸 / 声波核四边出现明显倾斜矩形切缝。现通过 `.scaleEffect(1.30).ignoresSafeArea()` 与 `controller.safeAreaRegions = []` 彻底修复，实景截图 `008-Live-source-AM-mesh-playing.png` 与 `021-Wave-complete-cover.png` 验证全屏 100% 无缝铺满。
- **肉眼复核同步修齐 4 处细节**：修复深色模式经典播放页文字对比度（保持浅色模式 `4854` 像素 100% 不变）；将迷你播放器、AM 与 AM2 缩略封面统一为圆角方形（`radius={10}`）；沉浸皮肤非磁带态封面改为顶部全出血直角（`radius={0}`）；AM2 顶部居中拖拽条与返回键留出安全间距。
- **32 张 1290×2796 Release 浅粉默认主题截图全量亲看**（`build/sollin-audit-r3-screens/`，`SourceUITests-1795601490738.xcresult`）：覆盖发现首页、歌单详情、搜索首页与结果、音乐库（含深色毛玻璃日历卡片）、本地音频、设置首页、播放设置、EQ（单行微调滑块与曲线）、外观设置、音乐账号、下载管理、数据与存储、音源管理、全部 8 套播放皮肤（经典/黑胶/AM/AM2/沉浸/声波核含顺时针白环与 60 刻度/写真含暗色悬浮操作栏/舞台）、播放菜单、倍速、睡眠定时、歌词偏移、评论与歌曲操作 Sheet，整体视觉还原度对照 T7 Touch 与本地参考图均达到高还原水准（无法达 ≥90% 严框的仅为合成封面色差导致的 `4861-am-lyrics` 与缺真机录屏的 G8 连续动效）。

### 3. 4/5 黄金态零回退复测与完整本地 CI 预演

| 验证项 | 结果 | 关键证据与指标 |
| --- | --- | --- |
| `npm run check` | **1170 / 1170 通过** | TypeScript 0 错误，含 6 项新增 Sollin 功能单测 |
| `npm run test:native` | **通过** | Swift/C++/AVPlayer/Fade/SystemLyrics/MeshField/DSP/JSC/LocalAudio/WebDAV 全部通过 |
| `sollin-reverse-gate.mjs` | **通过** | `ipa --review`（61E/26WI/131/52F/52P，0 错误/0 警告）& `apk` 通过 |
| `4854-classic` 回归 | **通过（零回退）** | `r20261125-4854-final`（`SourceUITests-1795615402509`）：控件 SSIM **93.09%**、ΔE00 **0.95**（p90 0.24）、可比区 **93.89%**、内容一致估算 **96.32%**、`provenanceReady: true` |
| `4851-vinyl` 回归 | **通过（零回退）** | `r20261125-4851-regression`：控件 SSIM **91.45%**、ΔE00 **3.25**、可比区 **94.42%**、播放键 ΔE00 **0.00**、估算 **97.38%** |
| `4855-appearance` 回归 | **通过（零回退）** | `r20261125-4855-regression`：控件 SSIM **90.80%**、ΔE00 **1.12**、可比区 **93.89%**、估算 **96.08%** |
| `4856-appearance-scrolled` 回归 | **通过（零回退）** | `r20261125-4856-regression`：控件 SSIM **94.13%**、ΔE00 **0.51**、可比区 **93.93%** |
| 真实 7 音源实测 | **通过** | `testLiveSourceCatalog`（`SourceUITests-1795599556700`，369.2s）导入 7 个脱敏真实 LX 音源、真搜/真流/真频谱解码通过 |
| 全量 CI 本地预演（45 项 UI 用例） | **45 / 45 全部通过** | 本地 100% 覆盖 `.github/workflows/ios.yml` 全部测试组；`d8cfe41` 清洁本地无签名 IPA（`17,998,273` 字节，SHA-256 `c2555b54…64f13`，`dirty: false`）通过 `verify-archive.mjs` 并镜像归档至 T7 Touch（`T7_SHA_MATCH_OK`） |
| GitHub 云端 iOS 27（Run #345） | **5 / 5 Job 全绿通过** | [Run #345](https://github.com/RhsR1024/nexus-music/actions/runs/45758198827)（`85fc5e9`，`2h 3m 55s`，0 条报错标注）：`checks`（42s）、`ios-core`（1h 14m）、`ios-playback`（1h 28m）、`ios-features`（1h 47m）、`ios`（7m 5s，`npm run test:native` + 归档），成功上传 `NexusMusic-iOS27-unsigned-85fc5e93abd6a5d4460835231116c4e9be7ebcb7`（`16.5 MB`，`sha256:8ec3f405…eb416`） |

## 六、仍保持开放的外部/环境边界（无法在无真机/账号环境下伪造）

- 听歌识曲（用户决定本期不实现）、漫途双向同步、Sollin 自有账号/赞助/付费/遥测、正式 App Store 发布；
- 真实网易云/QQ/酷狗个人账号在线写操作、真实私人 WebDAV/Navidrome 大曲库与弱网限流矩阵；
- Apple Developer 个人签名、实体 iPhone 安装/续签/真机锁屏后台长时播放/耳机蓝牙路由与真机连续动效录屏（G8）。
