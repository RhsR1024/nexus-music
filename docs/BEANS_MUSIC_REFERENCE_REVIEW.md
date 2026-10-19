# Beans-Music 对音枢的具体参考清单

日期：2026-10-19，Asia/Shanghai。性质：固定源码比较与实施建议，本轮未移植产品代码、未改变功能范围或既定 UI 对齐目标。

## 同步结果与证据口径

| 仓库 | 本地目录 | 分支 / 固定提交 | 同步方式 |
| --- | --- | --- | --- |
| 音枢 | `Z:\Z-WorkSpace\NexusMusic` | main / `d2d24e2c96a4cadfd32981a36ccb3909c93de1ed` | 从 `b0f0803` fetch 后 fast-forward；原工作区干净，未 reset/stash |
| Beans-Music | `Z:\Z-WorkSpace\Beans-Music` | main / `f9881318caf774129205c3160510ef0dfa318adc` | 原目录不存在；完整历史传输缓慢，改为 depth=1 检出该提交工作树，不含完整历史 |

已用 `ls-remote origin refs/heads/main` 核对上述提交分别等于当次远端 main。两个根目录均无 `.codegraph/`，没有建立索引。SMB 所有权检查使用精确路径的单次 `git -c safe.directory=...`，未改变全局信任配置。

旧 Windows 检出是纯方案，更新后的音枢已经有 Expo 54.0.37 / RN 0.81.5、TS 业务、SQLite/Keychain 和自有 Swift/C++ 原生模块。Beans 是 SwiftUI / Swift 5 / XcodeGen，最低 iOS 15，项目版本 1.6.5.1、build 39。不能沿旧文档把音枢描述为尚无实现，也不能因 Beans 是原生就建议替换现有架构。

下文 Beans 链接固定到该 SHA；音枢相对源码链接对应上述音枢基线。结论来自代码和调用点，不代表接口目前可用、App 已运行或真机验收通过。P0/P1/P2 表示参考价值顺序，不覆盖现有“先 UI 收敛、再扩展功能”的执行顺序。

## 具体参考候选清单

### 1. P0：网易网页登录的 iOS 适配

- **Beans 证据**：[NetEaseWebLoginSheet.swift:75](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/NetEaseWebLoginSheet.swift#L75)，`syncNow → readCookies → importWebCookies → auth.finishLogin`；`:109` 从 WKWebView Cookie store 提取登录材料，再读取账号/歌单。
- **音枢现状**：[musicAuth.ts:14](../src/providers/musicAuth.ts#L14) 已有 `MusicAuthFlow` 的取消、过期、代次与清理；[musicAccounts.ts:30](../src/providers/musicAccounts.ts#L30) 已有账号/秘密分层，但尚缺真实网页授权 launcher。
- **建议落点**：Swift 实现受控 WKWebView 授权呈现与域名白名单，凭据直接进入既有 Keychain 接口；TS 接收账号标识和完成事件，接入已有状态机。Cookie 存在后再校验账号，分别报告“授权成功”和“曲库读取失败”。
- **不能照搬**：Beans 的 `.163.com` 宽域匹配和 UserDefaults Cookie 保存。需测试取消/退出后迟到回调、账号替换、网页关闭、Cookie 过期。

### 2. P0：QQ / 微信登录身份与 Cookie 组合

- **Beans 证据**：[QQWebLoginSheet.swift:72](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/QQWebLoginSheet.swift#L72) 有网页 Cookie 校验/导入；[QQMusicAuth.swift:47](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/QQMusicAuth.swift#L47) 区分账号与歌单身份、QQ/微信 Cookie 候选，`:178` 有 `loginValidationMessage`。
- **音枢现状**：账号底座支持 `tx`，但没有上述 QQ/微信具体授权与身份适配。[online.ts:29](../src/providers/online.ts#L29) 已保留歌曲 MID、数值 ID 和媒体 MID。
- **建议落点**：新增 tx 账号 adapter，明确 accountID、playlist identity 和歌曲 ID 的区别；保留不同登录方式的请求契约，用脱敏 Cookie 字段组合夹具测试。
- **不能照搬**：Cookie 放 UserDefaults；把任何非空 Cookie 当成功；把微信身份强行转成 QQ 号。音枢凭据不进入一般 React 状态、备份或诊断。

### 3. P0：酷狗二维码登录的完整状态映射

- **Beans 证据**：[KugouMusicAPI.swift:41](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/KugouMusicAPI.swift#L41) 定义 `QRLogin/QRState`，`qrKey()` 获取二维码，`pollQR()` 区分等待、已扫、过期、成功，并在成功后补充设备/会员信息。
- **音枢现状**：[musicAuth.ts:1](../src/providers/musicAuth.ts#L1) 有通用授权状态，没有酷狗实际轮询器或二维码呈现。
- **建议落点**：kg client + 有上限、可取消的轮询；二维码更新即失效旧 key，关闭即停止；成功后验证账号再写 Keychain。设备补充信息与登录成功分离，不让辅助请求失败破坏主授权结果。
- **验收**：扫码后过期、刷新后旧成功、后台恢复、连续点击、保存失败回滚。设备注册字段与协议来源须单独审查，不原样模拟整套 Android 设备属性。

### 4. P0：网易账号日推与推荐歌单的候选协议

- **Beans 证据**：[NetEaseAPI.swift:509](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/NetEaseAPI.swift#L509) `dailyRecommend`；`:537` `personalizedPlaylists`；`:543` `recommendResource`；`:549` `recommendedHomePlaylists` 按登录态组合与去重。网络与加密边界在同文件 `request` 和 `NetEaseCrypto.swift`。
- **音枢现状**：[discovery.ts:36](../src/providers/discovery.ts#L36) 是公开发现；[recommendations.ts:72](../src/providers/recommendations.ts#L72) 是收藏/历史等生成的本地推荐；[musicAccounts.ts:5](../src/providers/musicAccounts.ts#L5) 仅声明 `daily` 能力。
- **建议落点**：独立 account recommendation client；结果携带 `platform/accountId/kind`，登录有效且接口成功才展示为账号日推，失败保留已显示内容并明确回退到本地推荐。
- **验收**：未登录、过期、空响应、换账号、失败重试、取消与来源文案；不把 `personalized` 端点名字自动解释成已登录用户的专属结果。

### 5. P0：酷狗每日推荐候选协议；QQ 日推需另行核对

- **Beans 证据**：[KugouMusicAPI.swift:239](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/KugouMusicAPI.swift#L239) `everydayRecommend` 调每日推荐路由并映射曲目，可作为音枢 kg 账号能力的候选协议；真实响应完整性及当前账号可用性待联调。
- **关键反例**：[QQMusicAPI.swift:1154](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/QQMusicAPI.swift#L1154) 的 `recommendSongs` 实际读取热歌/新歌/飙升三榜，按日期种子打乱。它是每日轮换的榜单混合，**不是 QQ 账号个性化日推**。
- **建议落点**：kg 依既有 HTTP/取消/Keychain 契约适配；tx 仍以已指定 Q-music android 参考继续核对。若采用榜单混合，明确显示“热门精选”，不计 F30 真实日推完成。

### 6. P0：网易 / 酷狗私人 FM 候选协议与批次处理

- **Beans 证据**：[NetEaseAPI.swift:618](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/NetEaseAPI.swift#L618) `personalFM` 多批获取并按歌曲身份去重；[KugouMusicAPI.swift:154](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/KugouMusicAPI.swift#L154) 有登录检查、批次上限和每日推荐回退；入口调用在 [DiscoverView.swift:924](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/DiscoverView.swift#L924)。
- **音枢现状**：[recommendations.ts:130](../src/providers/recommendations.ts#L130) 的 `nextFM` 来自本地库；不等于平台私人 FM。
- **建议落点**：FM 作为向唯一队列供曲的服务，按低水位有界预取，维护本会话已播/待播集合；换账号、退出 FM 或用户换队列后取消旧批次。回退须带 `kind`，不能把日推结果仍标为私人 FM。
- **必须改造**：酷狗源码 `:194–197` 在预取后续批次时用上一首时长构造 `playtime`。该字段的服务端语义尚未确认，不能先认定为纯游标或真实播放统计。预取不等于收听；实现前查明取曲与回报协议，不提交虚构的收听记录，只对实际播放采样回报。本轮未验证端点当前可用性、长期连续补队列或真实账号结果。

### 7. P0：平台个人歌单读取与身份兼容

- **Beans 证据**：[NetEaseAPI.swift:253](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/NetEaseAPI.swift#L253) 用户歌单/曲目读取；[QQMusicAPI.swift:1175](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/QQMusicAPI.swift#L1175) QQ/微信歌单路径与创建/收藏列表；[KugouMusicAPI.swift:113](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/KugouMusicAPI.swift#L113) 酷狗用户歌单。
- **音枢现状**：公开完整歌单导入与本地歌单已有实现，[discovery.ts:124](../src/providers/discovery.ts#L124) 有完整分页、总数、重复页与上限保护；账号歌单尚缺实际 client。
- **建议落点**：新增带账号上下文的歌单 reader，复用音枢完整读取校验；区分“平台只读列表”“导入本地快照”“写回平台”，保留原来源 ID、顺序和重复项，失败不覆盖旧歌单。
- **验收**：创建/收藏列表重复、空/删歌单、分页失败、数量不符、微信无 QQ uin。不要照搬参考按歌曲去重而破坏本地歌单重复曲序的行为。

### 8. P1：云端喜欢与本地收藏的明确状态

- **Beans 证据**：[FavoritesStore.swift:44](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/FavoritesStore.swift#L44)：网易失败回滚；QQ 失败保留本地并记 warning；酷狗分支仅更新本地。QQ 读取/写入在 [QQMusicAPI.swift:420](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/QQMusicAPI.swift#L420)、`:642`。
- **音枢现状**：[library.ts](../src/storage/library.ts) 的收藏属于本地，不能用同一“已收藏”状态宣告平台写回成功。
- **建议落点**：在账号 client 下提供平台喜欢能力，UI 区分本地、平台成功、同步失败/重试；写操作采用显式期望值和串行身份检查。
- **不能照搬**：QQ warning 后仍返回成功、酷狗本地 toggle 当作云端成功。本轮不能据三平台界面推定三平台均有云端收藏写入。

### 9. P1：QQ / 酷狗公开评论适配

- **Beans 证据**：[QQMusicAPI.swift:987](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/QQMusicAPI.swift#L987) `comments`；[KugouMusicAPI.swift:1373](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/KugouMusicAPI.swift#L1373) `comments`；[CommentsSheet.swift:116](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/CommentsSheet.swift#L116) 按平台分流。
- **音枢现状**：[comments.ts:20](../src/providers/comments.ts#L20) `supports` 仅支持网易；已有热门/普通评论、分页、取消、失败保留旧内容、最多 1000 条。
- **建议落点**：扩展 `CommentReader`，适配 QQ 页码与数字歌曲 ID、酷狗 mixSongID/hash；保持原曲评论归属，不用播放匹配目标替代原曲。复用音枢会话和 UI，仅补协议/映射。
- **修正参考行为**：酷狗 `:1498` 缺时间使用当前时间、`:1500` 用第一页判 `isHot`；音枢应保留未知时间，热门只取真实标记/独立列表，不制造时间与热度。

### 10. P1：在线歌手 / 专辑实体与详情

- **Beans 证据**：[NetEaseAPI.swift:365](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/NetEaseAPI.swift#L365) 专辑搜索，`:389/429/450` 歌手热门/歌手专辑/专辑曲目；[QQMusicAPI.swift:1680](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/QQMusicAPI.swift#L1680) 歌手歌曲与专辑；[KugouMusicAPI.swift:486](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/KugouMusicAPI.swift#L486) 歌手分页。
- **音枢现状**：[online.ts:17](../src/providers/online.ts#L17) 是歌曲搜索/元数据映射；现有 Navidrome、本地专辑/歌手浏览不能算在线平台实体已完成。
- **建议落点**：独立 `ArtistRef/AlbumRef {platform,id}` 和能力接口，补在线搜索类型与详情。QQ 缺 MID 时允许明确降级搜索，不能悄悄采用首个同名歌手；酷狗需测返回少于请求数量但仍有下一页的情况。
- **维护**：TS 解析/分页可共享 Android；iOS 登录/会话另适配。不要复制巨型 Swift 页面或把平台 IDs 合成一个裸整数。

### 11. P1：导出音频文件到系统分享面板

- **Beans 证据**：[DownloadManager.swift:78](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/DownloadManager.swift#L78) 解析/下载/检查后放入临时 `BeansShare`，返回请求音质、实际档位、降级与来源；[PlayerView.swift:2804](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/PlayerView.swift#L2804) 触发分享。
- **音枢现状**：[PlayerMenu.tsx:25](../src/ui/PlayerMenu.tsx#L25) 目前分享歌曲文字；[offlineDownloads.ts](../src/storage/offlineDownloads.ts) 已有持久离线任务、摘要/续传/配额/在播保护，但下载任务 UI 尚无该文件导出流程。
- **建议落点**：若采纳文件导出产品项，优先复用已校验离线文件，创建受控临时副本交给原生分享；取消/完成后轮换清理，私有来源不附带服务器 URL/鉴权。
- **范围/证据边界**：这是新增交互建议，不因报告自动成为承诺。Beans MIME/大小检查不是解码验证，`actualQuality` 是解析结果的档位，不是媒体探测或设备输出。临时目录仍占磁盘，不能沿参考注释称“不占存储”。

### 12. P1：可选择恢复外观、字体与背景资源的备份

- **Beans 证据**：[ProfileView.swift:2684](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/ProfileView.swift#L2684) 备份设置/字体/壁纸及元信息；`:2740` 先解析确认，`:2775` 后重建背景/字体。
- **音枢现状**：[backup.ts:5](../src/storage/backup.ts#L5) 当前格式包含 library/statistics，不含偏好、字体字节和视觉资产；[webdavBackups.ts:80](../src/storage/webdavBackups.ts#L80) 已有条件上传与回读摘要。
- **建议落点**：设计独立版本化 settings/assets 段及“恢复哪些内容”预览，内容哈希/相对身份、大小/数量限额、字体/图片验证及失败回滚；维持老版库备份可读。不把当前库恢复改为遍历任意设置键。
- **不能照搬**：Beans `includeAccounts` 选项或逐键 UserDefaults 写入。音枢账号凭据、音源私人令牌、服务器秘密始终排除。此为待产品采纳的备份扩展，不在本轮修改 schema。

### 13. P1：歌词手动浏览后恢复跟随

- **Beans 证据**：[PlayerView.swift:1100](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/PlayerView.swift#L1100) 黑胶歌词用 lazy 列表和可视位置；`:1143` 拖动取消 resume task，`:1158` 在非拖动态跟随当前行。
- **音枢现状**：[Lyrics.tsx:57](../src/ui/Lyrics.tsx#L57)、`:122` 当前行变化会触发滚动；原生逐字动画和虚拟列表刷新边界已存在（`:38`）。
- **建议落点**：补统一“自动跟随/手动浏览/返回当前行”状态，拖动不被新行抢回；超时或明确按钮恢复，切歌清理旧定时器。点行定位仍走唯一控制器，屏幕阅读器保留等价动作。
- **验收**：快速切歌、seek、长行、大字、拖动结束、页面关闭与重开；动效仅做行为参考，最终视觉按音枢既定目标验收，不照搬 SwiftUI 每个布局的几何。

### 14. P2：系统版本分级的原生材质

- **Beans 证据**：[Components.swift:182](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/Components.swift#L182) `#available(iOS 26, *)` 使用 GlassEffectContainer / glassEffect，旧系统退 ultraThinMaterial。
- **音枢现状**：[Materials.tsx:41](../src/ui/Materials.tsx#L41) 已支持减少透明度；[NexusMaterialView.swift:4](../modules/nexus-native/ios/NexusMaterialView.swift#L4) 是静态 UIKit 材质。
- **建议落点**：确需 Liquid Glass 时，仅在现有原生材质接口内新增可用性分支并隔离 SwiftUI 宿主，保留旧系统、减少透明度/动态和高对比回退。不为了材质重写 RN 页面或强行提高最低 iOS。
- **验收**：默认 blush/rose 主题同尺寸截图、明暗/大字/辅助功能、滚动遮挡、录屏和耗电。Android 使用既有替代层；本轮未证明 Beans 在真实设备更流畅。

### 15. P2：中英本地化的字符串清点

- **Beans 证据**：[Language.swift:3](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/Language.swift#L3) `AppLanguage` 和 `beansLocalized`，另有 `en.lproj/zh-Hans.lproj`。
- **音枢现状**：[Lyrics.tsx:49](../src/ui/Lyrics.tsx#L49)、[PlayerMenu.tsx](../src/ui/PlayerMenu.tsx) 等仍有直接中文字符串；歌词/删除已有无障碍角色和动作，不能说辅助功能从零开始。
- **建议落点**：若后续需要英文，集中资源键、格式化/复数、平台返回文本和本地文案分层，先覆盖授权/错误/播放核心；不要照搬按中文榜单文本做替换的表。当前主要中文使用目标下后置，不擅自增加本期语言承诺。

## 有条件研究与明确保留的边界

| 模块 | 源码比较 | 结论 |
| --- | --- | --- |
| 脚本协议 | Beans [LXScriptSourceRunner.swift:378](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/LXScriptSourceRunner.swift#L378) 有 CommonJS / MusicPlugin / cerumusic 别名；`:507` 的 stopRequests 是空函数，`:497` 改写 JSON.parse | 仅当真实用户脚本需要时研究独立 adapter；不是完整 LX 兼容证据。不采纳全局 JSON 语义改写和假取消；保留音枢 [bootstrap.js](../modules/nexus-native/ios/bootstrap.js) 的 RSA/zlib/二进制、请求 ID 和 [ScriptRuntime.swift](../modules/nexus-native/ios/ScriptRuntime.swift) 生命周期/限额 |
| 队列/解析竞态 | Beans PlayerManager 的 loadGeneration 是局部保护；音枢 [controller.ts:77](../src/playback/controller.ts#L77) 统一解析、操作代次与后端事件 | 保留音枢权威队列、暂停意图、取消与迟到保护，不移植 PlayerManager 单例 |
| 来源/音质 fallback | Beans PlayerManager 按平台与 host 分流；音枢 [multiSourceResolver.ts](../src/providers/multiSourceResolver.ts) / [matchedResolver.ts](../src/providers/matchedResolver.ts) 已有全局同档跨源再降档和原曲/匹配身份隔离 | host-specific 请求头可作为契约样本；不能照搬平台各自降档而破坏音枢总顺序；不复制外部解析服务/私有配置 |
| 下载与后台 | Beans DownloadManager 是临时文件分享；音枢 offlineDownloads/offlineTransfer 有持久状态、Range、validator、摘要和在播保护 | 只借鉴导出 UX。Beans 不提供足够证据解决音枢待完成的系统后台下载，不宣称 background URLSession 已实现 |
| 音频/频谱/EQ | 音枢自有 NativePlaybackEngine、AudioResourceLoader、C++ DSP 和 PCM 链 | 不为参考 UI 引入第二 AVPlayer/RNTP；不采用 DJVisualView 的装饰动画冒充真实频谱 |
| 倍速/睡眠/恢复 | 音枢 nativeSession/configureRate、SleepStore 和队列暂停恢复已有代码 | 作为对照验收项，不列成 Beans 补齐的新功能 |
| Navidrome/WebDAV/迁移 | 本次 Beans Swift 范围未定位到 Navidrome/Subsonic/WebDAV 对应客户端 | 无证据说明 Beans 可替代这些音枢模块；漫途导入继续以真实格式和音枢现有映射为准，不凭普通 JSON 导入推断兼容 |
| 工程管理 | Beans project.yml 为 XcodeGen、设备族仅 iPhone、竖屏；音枢维护 ios/、支持 iPad/旋转 | 不复制 XcodeGen、整仓依赖、NSAllowsArbitraryLoads、文件共享开关或 iPhone-only 配置；不执行覆盖性 prebuild |

## 听歌识曲专项补查（2026-10-19）

用户追问后核查固定提交 `f9881318caf774129205c3160510ef0dfa318adc`：**本次取得的公开源码未发现可确认的听歌识曲功能或实现链，不能把 Beans 列为识曲实现参考。** 原15项比较没有单独记录此项，本节为本次补充，不新增第16项采纳候选。

核查覆盖 `Beans/` Swift、仓库 Markdown、plist、yml 和本地化字符串，检索识曲、Shazam/SHSession/SHManagedSession/SHSignature、ACRCloud/AudD、audio-match、麦克风权限、AVAudioRecorder/requestRecordPermission、inputNode/installTap 等采样/匹配线索：

- [Language.swift:88](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/Language.swift#L88) 的 `听歌识曲榜 → Song Recognition Chart` 位于榜单名称翻译表；它只能证明有该榜单文案，不能证明录音识别入口、音频采样或匹配服务。
- [ThirdPartySourceImportParser.swift:340](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/ThirdPartySourceImportParser.swift#L340) 的 scriptFingerprint/fingerprint 用脚本、模板、请求头等组合去重；[UnblockService.swift:523](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/Beans/UnblockService.swift#L523) 的 requestFingerprint 同样是音源请求配置身份，并非音频声纹。导入器另有名为 fingerprint 的配置字段，也不足以证明音频识别。
- [project.yml:31](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/project.yml#L31) 的生成 Info 配置声明后台音频等能力，没有麦克风用途说明；工作树无独立已生成的 `Beans/Info.plist`。未定位到 ShazamKit/其他识曲SDK调用、录音输入链或识曲结果映射；README/FEATURES/CHANGELOG 也未检索到识曲实现声明。

这是限定于该公开提交的静态结论，不推断其他分支、未公开版本或用户安装包的能力；本轮未运行参考App。音枢当前识曲决策仍为[本期不实现、后续有需求再触发](RECOGNITION_ASSESSMENT.md)，没有因此启用麦克风、引入SDK或改变范围。若取得具体识曲入口或其他版本，再固定提交/包版本后检查其真实实现。

## 许可、维护与实施门槛

Beans [根 LICENSE](https://github.com/XIaodou0416/Beans-Music/blob/f9881318caf774129205c3160510ef0dfa318adc/LICENSE) 声明 MIT / Copyright 2026 XIaodou0416。若采用可确认属于其授权范围的代码，应保留版权及许可文本、固定文件与提交，并更新 THIRD_PARTY_NOTICES。根 MIT 不能替平台商标、图片/字体、来源不明算法或其他上游代码作许可保证；Kugou 源码提及 KuGouMusicApi 上游，正式移植前需追查文件级来源。报告未复制上述实现或品牌资源。

平台登录/推荐/评论的协议参考价值高于 SwiftUI 页面可复用性。建议沿现有 Q-music android 契约做交叉核对：共享 TS 的模型、映射、分页、会话状态和测试向量，iOS 单独维护 WKWebView/Keychain/分享/材质；Android 未来替换原生适配，不提前引入 SwiftUI 依赖或 Android 实现。

所有平台 adapter 都应使用已有有界 HTTP、AbortSignal、账号 revision 和错误分类；端点存在不代表稳定、公开受支持或当前登录可用。不携带 Cookie 向未知解析服务回退，不在日志/备份中输出鉴权 URL。不同账号缓存隔离，读/写操作分别验收。

建议实施次序：三平台授权 launcher → 网易/酷狗日推与私人 FM 候选适配及联调 → 个人歌单/平台喜欢 → QQ/酷狗评论和在线实体 → 文件分享/设置资源备份等产品扩展。继续遵守当前 UI 优先顺序；此处仅是账号功能启动后的依赖顺序，不调整总计划，未联调的端点不计为已可用。

## Mac 端接续与复核入口

Mac 在自己的本地 SSD 音枢工作树正常 `git pull --ff-only`，先检查本机未提交改动与当前 HEAD，不覆盖 Windows 或其他执行上下文的工作树。本文音枢现状固定于 `d2d24e2`；若拉取后已有后续实现，先对照当前源码更新缺口判断，不按旧快照重复开发。Windows 的 Z 盘路径仅为本轮取证位置，不是 Mac 运行依赖。

若 Mac 尚无 Beans 参考仓库，可在本机参考目录执行以下命令；已有仓库时直接进入它并从 fetch 开始，勿重复覆盖目录：

```sh
git clone --depth=1 https://github.com/XIaodou0416/Beans-Music.git Beans-Music
cd Beans-Music
git fetch --depth=1 origin f9881318caf774129205c3160510ef0dfa318adc
git switch --detach f9881318caf774129205c3160510ef0dfa318adc
git rev-parse HEAD
```

最后输出须等于本文 Beans SHA；检出前先确认参考仓库没有需要保留的改动。阅读 `Beans/NetEaseWebLoginSheet.swift`、`QQWebLoginSheet.swift`、`QQMusicAuth.swift`、`KugouMusicAPI.swift`、`NetEaseAPI.swift` 和本文固定行号。不要求为静态复核安装 XcodeGen、生成工程或启动参考App。需要编译时另按该固定提交 README 与本机工具链验证；读取源码不能替代真实协议联调。

以下是建议拆分的实施任务，不是已创建模块或已完成事项：

| 任务 | 复用现有边界 | 进入下一步前的证据 |
| --- | --- | --- |
| 三平台授权适配 | `musicAuth.ts` 的 launcher/清理契约、`musicAccounts.ts` 的账号与秘密存储；iOS 原生网页/二维码呈现 | 取消/过期/重开/退出后迟到结果被拒绝，Keychain 保存失败回滚；实际平台登录单独验收 |
| 账号内容 client | 注入有界 HTTP、AbortSignal、账号版本，映射日推/歌单/喜欢结果 | 换账号不复用旧缓存，错误与空列表区分；QQ 榜单混合不冒充账号日推 |
| FM 供曲协调 | 唯一 `PlaybackController` 和队列；现有 `LocalRecommendationStore` 作为明确标记的回退 | 单个在途预取、有界批次/去重；退出FM/换账号/换队列取消；迟到结果不能恢复已暂停播放，空/失败不无限重试 |
| 平台与原生验收 | 先用脱敏协议夹具，再接真实账号；沿现有 iOS 构建/模拟器/真机工作流 | 分开记录授权、取曲、解析、实际解码、锁屏下一首与账号退出；不以单次HTTP成功代替整链验收 |

后续每批记录采用的具体 Beans/Q-music 文件、固定提交、文件级许可、未采用行为和契约测试。TS client 与 iOS 原生授权桥分别设计，保留未来 Android 替代接口；本次不创建第二套播放器或账号仓储，不自动推进识曲及其他候选扩展。

## 本轮验证与未完成项

- 完成：两仓同步、分支/HEAD/远端 main 比对、干净工作区检查、源码调用点/关键语义抽查、报告内本地文件与固定 GitHub 文件/行号映射校验、文档 diff 空白检查。
- 校验回执：15项候选、55处源码链接的文件/行号检查通过；Beans `git fsck --no-reflogs` 退出0。确认没有该仓活动Git进程后，仅删除首轮中断克隆遗留的 `.git/objects/pack/tmp_pack_RKLuGX`（18,071,551字节）；已完成浅克隆的正式pack/索引及源码保留。Z盘收尾剩余约816.6GiB。
- 三组独立探索分别覆盖账号接口、播放下载、UI/资源许可；主代理复核了日推/FM、登录 Cookie、收藏分支、评论映射、导出/备份和歌词关键代码，并纠正了初查对 FM 缺失及三平台云端收藏的过度概括。
- 没有安装依赖、编译或运行 Beans；没有在 Windows 执行 iOS 构建，没有真实账号授权、平台接口联调、真机播放/后台/功耗或许可全量审计。音枢历史文档的测试结果只作为已记录背景，本轮未重跑、未新增完成度。
- 本轮只新增比较文档及引用入口；没有开始上述功能移植，也没有将报告建议直接写入 PRODUCT_SCOPE 作为新增承诺。
