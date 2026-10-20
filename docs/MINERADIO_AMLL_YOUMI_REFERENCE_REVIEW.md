# Mineradio、AMLL、Youmi 对音枢的功能参考清单

日期：2026-10-20，Asia/Shanghai。性质：固定源码调查、现状比较和候选建议；不代表已移植、真实接口联调通过或范围变更。

## 同步与基线

| 项目 | 本地目录 | 分支 / 固定提交 | 说明 |
| --- | --- | --- | --- |
| NexusMusic | `Z:\Z-WorkSpace\NexusMusic`（同一SMB目录也可由UNC访问） | main / `e72827d91c6a3238c1ed0844b9befa61048d07f4` | 从35ddf58正常fetch、fast-forward；同步前工作树干净 |
| Mineradio-paused | `Z:\Z-WorkSpace\Mineradio-paused` | main / `d43de565acabfdc1a9c9820a27e81a98ccbebcef` | 新建depth=1克隆；Electron Windows桌面项目，package版本2.2.0；README声明长期停更 |
| applemusic-like-lyrics | `Z:\Z-WorkSpace\applemusic-like-lyrics` | main / `ca0f41d67882d936c0365ffd99c16841ea2fa39d` | 新建main分支depth=1克隆；Web歌词组件库，非RN原生组件 |
| Youmi-Music-IOS | `Z:\Z-WorkSpace\Youmi-Music-IOS` | main / `152567b3c4a337c9c5bee06bb7f40ebaa49d40c2` | 新建depth=1克隆；首轮Windows长路径检出失败，用该仓core.longpaths=true及restore补全工作树/索引后干净 |

depth=1指工作树对应完整提交，不含完整历史；没有安装依赖或执行参考代码。四根均无`.codegraph/`，未自行索引。Youmi上游跟踪了build/DerivedData、IPA/归档和签名相关产物，本轮仅检出，没有运行、解析或向音枢复制这些产物及其中材料。参考仓库与音枢保持独立。

音枢已经有RN/TS业务、Swift/C++音频与脚本模块、原生逐字歌词、受控XML解析、账号安全底座、本地推荐/FM、Navidrome/WebDAV、下载续传和数据恢复。e72827d还包含歌词进行中请求共享和新的UI回归修正；不能按旧的纯方案状态判断缺口。下文音枢源码相对链接按此基线解释，Mac后续拉取到新实现时先重新核对缺口。

本次不分析Sollin IPA/APK，不产生或替代其逆向证据。既定Sollin视觉目标及门禁保持；参考项目的界面、动效和性能声明不等于音枢已对齐。优先级表示当前范围内的参考价值，不覆盖现有执行顺序。标“扩展候选”的能力须先确认范围，不能因参考有实现就默认新增。

## 采用方式与优先级总览

| 项目 | 最有帮助的内容 | 建议方式 | 不宜采用的内容 |
| --- | --- | --- | --- |
| Mineradio | 账号发现分区、云端歌单分页、QQ喜欢权限错误分类、QQ评论字段；节拍分析可作远期研究 | 按provider契约独立实现，与Beans/Q-music交叉核对 | Electron/Node本地服务器、Windows桌面、第二队列、品牌/粒子资源、汽水登录/专有运行时、整仓GPL代码移植 |
| AMLL | 词级/对唱/背景人声语义、TTML完整结构、重叠行、触摸与跟随、弹簧/背景生命周期 | 把数据和行为问题转化为音枢原创模型/原生渲染验收；源码复用先审许可 | 将React DOM组件当RN组件，直接引入DOMParser/Canvas/WebGL/Jotai，或绕过逐帧React限制 |
| Youmi | 网易验证码/二维码状态、私人FM低水位预取、账号实体、请求合并；Widget/MusicKit仅扩展线索 | 作为iOS行为对照，协议与Beans/Q-music核对后在音枢现有边界实现 | 未获授权的代码/资源复制、外部默认API、Cookie明文/日志、FM独立队列、AppGroup/签名配置与第二MusicKit播放器 |

## Mineradio：五项具体参考

### M01 · P1：账号发现页分别加载，局部失败不拖垮整页

- **证据**：[server.js:1699](https://github.com/XxHuberrr/Mineradio-paused/blob/d43de565acabfdc1a9c9820a27e81a98ccbebcef/server.js#L1699) `handleDiscoverHome`，`:1715`用`Promise.allSettled`分别取得公开歌单、账号推荐歌单、日推；`:1702`未登录返回starter；`:4886`为实际路由调用点。
- **音枢现状**：[recommendations.ts:66](../src/providers/recommendations.ts#L66)是本地收藏/历史打分，[discovery.ts](../src/providers/discovery.ts)是公开发现；平台账号推荐client仍待接入。
- **建议**：结果按`platform/accountId/contentKind`分区，公开推荐、账号推荐、日推、本地回退分别标识；一个请求失败不清空其他成功区块，保持已有HTTP/AbortSignal与账号版本守卫。
- **不能照搬**：参考将失败分支折为空数组，并固定`dailySongsComplete:true`，不能据此认定真正空/完整。音枢应区分未登录、空、失败、部分成功；全局`userCookie`也不适合音枢多账号隔离。Node服务不进入iOS。

### M02 · P1：账号歌单列表分页、全量读取与详情读取分开

- **证据**：[server.js:2160](https://github.com/XxHuberrr/Mineradio-paused/blob/d43de565acabfdc1a9c9820a27e81a98ccbebcef/server.js#L2160) `fetchAllNeteaseUserPlaylists`有页数/数量上限与歌单ID去重；`:2185`单页读取返回`nextOffset/hasMore`；`:6264`调用全量入口。`:2235`起另有歌单详情/曲目读取。
- **音枢现状**：[discovery.ts:124](../src/providers/discovery.ts#L124)已做公开曲目完整读取保护；账号歌单列表与公开曲目分页是不同层，不能当同一问题。
- **建议**：账号client先列歌单，再按选定歌单读取曲目；页数上限、取消、总数核对与重复页保护沿音枢现有规则。列表去重用歌单身份，曲目导入仍保留重复项和顺序。
- **验收/维护**：到达上限只能标部分读取；不能沿参考“短页就结束”默认所有平台一致。TS分页可供未来Android共享，账号材料由各平台安全存储适配。

### M03 · P1：QQ登录成功、喜欢列表权限和创建/收藏歌单分别反馈

- **证据**：[server.js:3120](https://github.com/XxHuberrr/Mineradio-paused/blob/d43de565acabfdc1a9c9820a27e81a98ccbebcef/server.js#L3120)保留`loggedIn:true`但返回`QQ_LIKED_REQUIRES_PLAYBACK_LOGIN/requiresPlaybackKey`；`:3163` `handleQQUserPlaylists`并行读取创建、收藏和喜欢入口后合并。
- **音枢现状**：[musicAuth.ts](../src/providers/musicAuth.ts)、[musicAccounts.ts:5](../src/providers/musicAccounts.ts#L5)有通用授权与能力底座，缺QQ具体账号内容调用。Beans已提供QQ/微信Cookie与歌单身份对照。
- **建议**：采用“授权完成≠每项账号能力均可用”的错误模型，分别展示歌单/喜欢读取状态；不因一个接口需要补授权就清除全部有效账号。
- **不能照搬**：接口错误码只是该实现的分类，不保证平台始终同码；不把播放凭据等价为会员权限，不移植服务器全局Cookie或把Token放普通仓储。以QQ/微信脱敏夹具和真实账号分别验收。

### M04 · P1：QQ评论数字ID、页码与热门列表映射

- **证据**：[server.js:3759](https://github.com/XxHuberrr/Mineradio-paused/blob/d43de565acabfdc1a9c9820a27e81a98ccbebcef/server.js#L3759)把offset换算为page，使用数字`topid`，分别读取`hot_comment/comment`并映射评论。
- **音枢现状**：[comments.ts:20](../src/providers/comments.ts#L20)仅支持网易，已有热门/普通分区和取消/失败保留。
- **建议**：与Beans QQ评论实现交叉核对，补`CommentReader`适配；保留原曲评论身份，QQ MID与数字ID不能混用。
- **不能照搬**：参考首屏有热评时只选择hotList而非同时返回普通首屏，照搬会混淆后续offset。音枢应保留两个列表/游标，测试热评缺席、分页重试、追加失败和切歌取消。不新增汽水评论产品范围。

### M05 · P2／扩展候选：真实节拍事件驱动视觉，区别于频谱和识曲

- **证据**：[dj-analyzer.js:384](https://github.com/XxHuberrr/Mineradio-paused/blob/d43de565acabfdc1a9c9820a27e81a98ccbebcef/dj-analyzer.js#L384) `decodePodcastDjEnergyRange`解码、降采样并取能量；`:293`起构造beat map；`:520` `analyzePodcastDjRangeSamples`分段抽样；[server.js:4778](https://github.com/XxHuberrr/Mineradio-paused/blob/d43de565acabfdc1a9c9820a27e81a98ccbebcef/server.js#L4778)向Cuefield提供本地beat-map缓存。
- **音枢现状**：[NexusAudioDSP.mm:24](../modules/nexus-native/ios/NexusAudioDSP.mm#L24)已有真实PCM频谱，不代表有BPM、拍点或downbeat模型；[playbackStats.ts](../src/storage/playbackStats.ts)已有真实听歌统计，不必重建。
- **建议**：仅在用户要节奏视觉/AutoMix时再立项，原生音频线程外分析并缓存低频拍点，视觉消费事件/时钟，不传PCM给React。区分能量峰、节拍估计和真正强拍，不能凭变量名宣称识别准确。
- **风险**：长音频按总字节/时长估算时间与Range偏移，对VBR/转码可能不准；原生实现需从实际解码时间戳建立时间轴。Node解码器、Cuefield运行时及双播放器混音不直接进入音枢。无音频指纹检索/麦克风识曲证据。

## AMLL：八项具体参考

### A01 · P1：扩展歌词模型，保留词级罗马音、对唱与独立行时间

- **证据**：[packages/lyric/src/types.ts:4](https://github.com/amll-dev/applemusic-like-lyrics/blob/ca0f41d67882d936c0365ffd99c16841ea2fa39d/packages/lyric/src/types.ts#L4)有`romanWord`，行有`isBG/isDuet/translatedLyric/romanLyric/startTime/endTime`，注释明确行时间不总等于首末词。
- **音枢现状**：[parser.ts:2](../src/lyrics/parser.ts#L2)已有词时间、行级翻译/罗马音、background/agent，但没有明确duet/词级roman字段；不能说音枢无逐字歌词。
- **建议**：如现有深度歌词目标需要，原创扩展规范化模型和迁移默认值，分开保留行可见区间与词高亮区间；由原生组件绘制。不要把AMLL的左右对唱标志当完整歌手身份或多语言元数据。
- **验收**：首词晚于行开始、双人交错、背景同起点、多字节/组合字符、缺词时间降级；不要均分时间伪造逐词。

### A02 · P1：YRC/QRC背景人声标记及格式兼容样本

- **证据**：[packages/lyric/src/formats/yrc.ts:36](https://github.com/amll-dev/applemusic-like-lyrics/blob/ca0f41d67882d936c0365ffd99c16841ea2fa39d/packages/lyric/src/formats/yrc.ts#L36)、[qrc.ts:22](https://github.com/amll-dev/applemusic-like-lyrics/blob/ca0f41d67882d936c0365ffd99c16841ea2fa39d/packages/lyric/src/formats/qrc.ts#L22)含格式解析/背景标记处理；[index.ts:25](https://github.com/amll-dev/applemusic-like-lyrics/blob/ca0f41d67882d936c0365ffd99c16841ea2fa39d/packages/lyric/src/index.ts#L25)导出QRC/TTML/YRC解析与序列化。
- **音枢现状**：[parser.ts:10](../src/lyrics/parser.ts#L10)已有LX/YRC/KRC/QRC词时间检查与行级降级；[normalize.ts:52](../src/lyrics/normalize.ts#L52)已有多格式选择。主要参考价值是边角语义和测试，不是重写全部解析器。
- **建议/验收**：建立原创小样本覆盖括号背景、时间偏移、坏标签、字词拼接与非BMP字符；不能把普通正文括号全部判为背景。保留2MiB/行数/词数上限和失败降级。
- **平台/许可**：纯数据解析与DOM渲染分开，但解析包本身也声明AGPL，不能因为TS或纯函数就视为可直接复制；导出器是另一个产品候选，不自动新增。

### A03 · P1：TTML丰富结构与受控解析差异

- **证据**：[packages/ttml/src/parser.ts:17](https://github.com/amll-dev/applemusic-like-lyrics/blob/ca0f41d67882d936c0365ffd99c16841ea2fa39d/packages/ttml/src/parser.ts#L17)及`:803`起处理agent/背景、翻译和罗马音结构；[index.ts:16](https://github.com/amll-dev/applemusic-like-lyrics/blob/ca0f41d67882d936c0365ffd99c16841ea2fa39d/packages/ttml/src/index.ts#L16)明确便捷API依赖DOMParser，`:30`起说明导出依赖DOMImplementation/XMLSerializer。
- **音枢现状**：[ttml.ts:2](../src/lyrics/ttml.ts#L2)已有无DOM/DTD/实体扩张的有界子集；保留agent字符串、x-bg/x-translation/x-roman，但忽略metadata/head，未完整保留agent信息和多语言sidecar。
- **建议**：按真实TTML样本逐项扩展受控子集；记录哪些语义保留、降级或拒绝，不能把“成功解析”写成TTML全规范兼容。保留原始行时间/词时间与副文本对应关系。
- **不能照搬**：Hermes/RN没有浏览器全局DOM，不能直接npm安装ttml包就算接入；不为它引入整套DOM shim/WebView或无界XML。源码复用先审AGPL和依赖。

### A04 · P1：有意重叠、背景组与间奏时间轴

- **证据**：[optimize-lyric.ts:149](https://github.com/amll-dev/applemusic-like-lyrics/blob/ca0f41d67882d936c0365ffd99c16841ea2fa39d/packages/core/src/utils/optimize-lyric.ts#L149)区分有意重叠和轻微错位；`:312` `optimizeLyricLines`组合归一化、主/背景同步和排序，并明确原地修改输入。
- **音枢现状**：[parser.ts:61](../src/lyrics/parser.ts#L61) `activeLyric`选择单一非背景当前行；[stage.ts:22](../src/lyrics/stage.ts#L22)保护同起点翻译/背景不截断主行，但stage跳过背景展示。
- **建议**：若要双人/背景同步舞台，建立“可见行集合+主焦点”而非强迫所有情况一个active index；独立测试背景组寿命、空隙和重叠。展示归一化应操作副本，不修改缓存的原始歌词。
- **不能照搬**：AMLL的100/500ms等阈值是展示启发式，不是协议事实；不能默认改写用户词时间。用户原始数据与派生显示策略分开保存。

### A05 · P1：手动浏览、惯性和自动跟随恢复

- **证据**：[scroll.ts:5](https://github.com/amll-dev/applemusic-like-lyrics/blob/ca0f41d67882d936c0365ffd99c16841ea2fa39d/packages/core/src/lyric-player/base/scroll.ts#L5)区分连续输入与滚轮，触摸意图阈值和`AUTO_ALIGN_RESUME_DELAY_MS`，`:151`处理拖动速度/偏移。
- **音枢现状**：[Lyrics.tsx:56](../src/ui/Lyrics.tsx#L56)、`:124`附近按当前行变化滚动，暂无对应统一手动浏览/惯性/跟随状态机；已有VoiceOver与双击定位。
- **建议**：在原生或UI线程管理自动跟随、手动浏览、惯性、待恢复四态；恢复只在用户停止交互且焦点变化等规定时机发生。页面隐藏/切歌/seek应失效旧计时器，避免用户读旧行时被抢回。
- **验收**：轻点不误拖动、快速反向、惯性中再触摸、边界、无歌词、屏幕阅读器。500ms是AMLL实现参数，不是音枢已确认体验常量；与Beans手动歌词跟随候选合并处理，不重复实现。

### A06 · P1：弹簧收敛、帧间隔和逐词动画职责

- **证据**：[spring.ts:4](https://github.com/amll-dev/applemusic-like-lyrics/blob/ca0f41d67882d936c0365ffd99c16841ea2fa39d/packages/core/src/utils/spring.ts#L4)建模质量/阻尼/刚度、延迟目标与`arrived()`；scroll引擎限制异常帧间隔。
- **音枢现状**：[NexusLyricsModule.swift:102](../modules/nexus-native/ios/NexusLyricsModule.swift#L102)已有30fps原生时钟和前后台/减动/视图门控；[Lyrics.tsx:119](../src/ui/Lyrics.tsx#L119)有虚拟列表与当前行局部订阅。现有逐字渲染不能改成每帧整列表React更新。
- **建议**：研究弹簧是否达到静止、拖动时跳过弹簧、seek/切行重新定目标、掉帧稳定性；用原创原生或worklet实现所需行为。延迟、缩放/模糊、词高亮分别度量。
- **验收**：同尺寸截图/真机录屏分别验证结构和动效；AMLL README桌面CPU/GPU帧率声明不能折算成iPhone性能。Android需对应原生绘制路径，TextKit代码不自动跨平台。

### A07 · P1：背景渲染器的生命周期和参数接口

- **证据**：[bg-render/index.ts:18](https://github.com/amll-dev/applemusic-like-lyrics/blob/ca0f41d67882d936c0365ffd99c16841ea2fa39d/packages/core/src/bg-render/index.ts#L18)包装HTMLCanvasElement，提供`setStaticMode/setFPS/pause/resume/setLowFreqVolume/setAlbum/dispose`。
- **音枢现状**：[NexusAmbientView.swift](../modules/nexus-native/ios/NexusAmbientView.swift)、[AmbientScene.swift](../modules/nexus-native/ios/AmbientScene.swift)、[AmbientTransition.swift](../modules/nexus-native/ios/AmbientTransition.swift)已有原生柔光、封面取色、异步/呈现所有权和过渡；不能说音枢尚无动态背景。
- **建议**：只比较renderer接口、暂停/销毁、静态模式、封面异步替换和低频音量输入的可测性；当前背景有证据的行为继续保留。若扩节奏驱动，消费原生低频指标而非React传PCM。
- **不能照搬**：Canvas/Pixi/WebGL及浏览器图像对象；不新增WebView背景或复制参考着色器。先有许可决策，再评估需要的原生替代；不把AMLL背景当Sollin算法证据。

### A08 · P2：歌词页面组合接口与播放控制解耦

- **证据**：[react-full/src/index.ts:1](https://github.com/amll-dev/applemusic-like-lyrics/blob/ca0f41d67882d936c0365ffd99c16841ea2fa39d/packages/react-full/src/index.ts#L1)导出组件/布局/状态；[configAtoms.ts:61](https://github.com/amll-dev/applemusic-like-lyrics/blob/ca0f41d67882d936c0365ffd99c16841ea2fa39d/packages/react-full/src/states/configAtoms.ts#L61)允许注入歌词播放器实现；[callbacks.ts:62](https://github.com/amll-dev/applemusic-like-lyrics/blob/ca0f41d67882d936c0365ffd99c16841ea2fa39d/packages/react-full/src/states/callbacks.ts#L62)提供seek/点击等回调。
- **音枢现状**：[services.ts](../src/app/services.ts)及播放器snapshot、歌词props已有控制/展示边界；最新[useLyricDocument](../src/ui/Lyrics.tsx#L167)已共享进行中请求。
- **建议**：只借鉴稳定输入、回调、可替换renderer和共享封面/控件职责，减少八布局分支间重复状态；不引入第二权威播放状态。新增共享元素转场必须另做RN/native可行性与动效验收，不因最新提交标题即宣称可移植。
- **平台**：React绑定是React DOM，不是React Native；Jotai/localStorage/DOM元素不整套搬入音枢。账号、歌曲解析和音频后端不是此库提供的功能。

## Youmi：八项具体参考

### Y01 · P1：网易验证码/二维码登录及会话恢复

- **证据**：[AuthViewModel.swift:61](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/NeteaseMusic/NeteaseMusic/ViewModels/AuthViewModel.swift#L61)验证码流程与倒计时；`:173`获取QR key→生成图→轮询，`:222`映射800/801/802/803；[AuthService.swift:43](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/NeteaseMusic/NeteaseMusic/Services/AuthService.swift#L43)是认证服务处理点。
- **音枢现状**：[musicAuth.ts](../src/providers/musicAuth.ts)只有可取消/过期/代次的通用flow；Beans参考提供网易网页方式。Youmi可补网页登录之外的二维码/验证码行为对照，不代表必须同时支持全部登录方式。
- **建议**：音枢应由网易adapter按已决定登录方式接既有launcher，二维码状态、请求与秘密存储分离；目标契约是轮询只允许单个在途请求，刷新/关闭/退出即失效旧代次，不是Youmi已具备的保证。
- **必须改造**：Youmi定时器每2秒启动Task，单靠停止Timer并不取消在途请求；其静默轮询错误不能一直无限等待。APIConfig依赖外部/自部署API，不能当作直接调用网易官方端点的证据，也不能复制默认服务、Cookie日志或明文持久化。

### Y02 · P1：私人FM低水位预取、耗尽取曲与明确“不喜欢”

- **证据**：[MusicService.swift:588](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/NeteaseMusic/NeteaseMusic/Services/MusicService.swift#L588) `getPersonalFM`，`:604` `fmTrash`；[PersonalFMView.swift:282](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/NeteaseMusic/NeteaseMusic/Views/PersonalFMView.swift#L282)启动调用，`:309`下一首，`:345`余量不足2首预取。
- **音枢现状**：[recommendations.ts:102](../src/providers/recommendations.ts#L102)本地FM已存在，平台FM client及供曲协调仍缺。Youmi补充了Beans批次API之外的前台供曲行为样本。
- **建议**：音枢应新增只向权威队列供曲的FM协调器，记录account/revision/队列会话、单个在途预取、低水位与去重集合；目标契约是退出FM/换账号/用户改队列取消。用户主动“不喜欢”才考虑调用排除接口，普通下一首不等价写回。
- **不能照搬**：Youmi有独立`fmTracks/currentIndex`且直接`AudioPlayer.shared.play`；`:363`按旧队列已有条目做去重检查，全部重复时又整批追加，批内重复也未排除。不得作为完整去重保证；预取失败、全重复、耗尽无结果需要有界策略，不改已暂停意图。服务URL是代理API语义，当前未真实联调；自然结束是否走FM续队列与锁屏须另验。

### Y03 · P1：日推与心动模式的数据上下文

- **证据**：[MusicService.swift:383](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/NeteaseMusic/NeteaseMusic/Services/MusicService.swift#L383) `getDailyRecommendSongs`；`:281` `getHeartbeatList`依赖songId、playlistId、可选startMusicId并区分需登录响应。
- **音枢现状**：[musicAccounts.ts:5](../src/providers/musicAccounts.ts#L5)有daily/fm声明，但只有本地推荐实现。心动模式不等于本地算法或普通随机，也不能由“AI”文案推断模型能力。
- **建议**：首先实现既定日推/FM；心动若采纳则作为有明确输入/权限/来源的账号推荐类型，保留原歌单上下文。与Beans直连候选、Q-music协议交叉验证。
- **验收**：缺登录、坏歌单、空结果、重复、账号退出、取消；Youmi日推只取data数组，音枢应先检查响应状态再判空，不把服务失败转成“没有推荐”。心动作为扩展候选不自动进入当前范围。

### Y04 · P1：网易在线实体、账号歌单与云盘读取

- **证据**：[MusicService.swift:498](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/NeteaseMusic/NeteaseMusic/Services/MusicService.swift#L498)歌手详情/热门/专辑，`:543`专辑详情，`:559`账号内容，`:632`云盘分页。
- **音枢现状**：[online.ts](../src/providers/online.ts)已有五平台歌曲映射，[discovery.ts](../src/providers/discovery.ts)有公开歌单完整读取；Navidrome/本地实体不等价网易在线歌手/专辑及账号库。
- **建议**：拆成在线实体reader和账号client，ID带platform/account上下文；复用音枢分页、取消和来源身份。云盘若未纳入本批产品范围，仅登记候选，不因有端点就添加上传/管理操作。
- **维护**：Youmi数据经外部API包装，响应字段/认证与直接平台协议可能不同。不能把其大量端点数量折算为音枢完成量；TS模型可共享Android，认证与存储另适配。

### Y05 · P2／扩展候选：网易评论线程与写操作状态

- **证据**：[MusicService.swift:399](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/NeteaseMusic/NeteaseMusic/Services/MusicService.swift#L399)起评论读取/热评，后续至`:488`有发送/回复/点赞接口；`Views/CommentView.swift`为呈现入口。
- **音枢现状**：[comments.ts](../src/providers/comments.ts)已有网易公开只读评论；评论写入与只读是独立授权和产品行为，不是必须补齐的“缺陷”。
- **建议**：可先借鉴线程/回复映射和分页错误分类；如用户需要写评论，再设计显式发送、重复提交保护、登录检查、错误保留草稿与结果确认。
- **限制**：本次不发送任何评论，不复制账号/服务配置。QQ/酷狗读取优先沿Beans/Mineradio候选；不能用网易写接口推断跨平台统一写入能力。

### Y06 · P1：请求合并与取消边界的反例验证

- **证据**：[APICache.swift:59](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/NeteaseMusic/NeteaseMusic/Services/APICache.swift#L59) actor内合并同key在途请求、TTL缓存，`:116`清空并取消任务；[MusicService.swift:51](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/NeteaseMusic/NeteaseMusic/Services/MusicService.swift#L51)等详情入口调用它。
- **音枢现状**：[Lyrics.tsx:167](../src/ui/Lyrics.tsx#L167)最新`useLyricDocument`通过[sharedRequests.ts:3](../src/lyrics/sharedRequests.ts#L3)的可取消租约共享在途请求，[service.ts](../src/lyrics/service.ts)有缓存/取消；不要再新增一套全局缓存替代它。
- **建议**：音枢扩展到账号数据前应先验证key含账号/版本/参数；目标契约是一个调用方取消不能误伤其他订阅者，清理后迟到任务不能回填旧缓存。这些是验收目标，不是Youmi已满足的保证。以共享请求的所有权与失效契约为测试重点。
- **不能照搬**：actor解决数据访问串行不等于业务取消正确；`clearAll`后旧Task若未响应取消仍可能返回/回填，缺版本守卫不能当作完善方案。不复制`Any`类型缓存和硬编码键到音枢账号层。

### Y07 · P2：下载与逐字歌词仅作现有能力对照

- **证据**：[AudioDownloadService.swift:138](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/NeteaseMusic/NeteaseMusic/Services/AudioDownloadService.swift#L138)每轨下载/预加载、`:253`任务取消；[MusicService.swift:80](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/NeteaseMusic/NeteaseMusic/Services/MusicService.swift#L80)取YRC/LRC/翻译，`Views/PlayerView.swift:252`以高频时间更新逐字界面。
- **音枢现状**：[offlineDownloads.ts](../src/storage/offlineDownloads.ts)、[offlineTransfer.ts](../src/storage/offlineTransfer.ts)已有续传/validator/摘要/配额/在播保护；[normalize.ts](../src/lyrics/normalize.ts)支持更多格式，原生逐字不经React逐帧重渲染。
- **建议**：只借鉴每轨状态/取消反馈和真实YRC缺失降级体验；FM预取歌曲元数据、解析URL和下载完整文件应分开，避免无意大量缓存或泄露鉴权URL。
- **结论**：不替换音枢下载引擎，不把URLSessionDownloadTask存在当作系统后台下载、断点/完整性已满足的证据，也不采用整页30fps SwiftUI/React刷新路线。

### Y08 · P2／扩展候选：Widget、Live Activity 与 MusicKit 的真实边界

- **证据**：[LyricActivityManager.swift:22](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/NeteaseMusic/NeteaseMusic/Services/LyricActivityManager.swift#L22)启动/更新/停止实时活动；[LyricLiveActivityWidget.swift:113](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/NeteaseMusic/LyricWidget/LyricLiveActivityWidget.swift#L113)是扩展布局；[AppleMusicService.swift:17](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/NeteaseMusic/NeteaseMusic/Services/AppleMusicService.swift#L17)使用`ApplicationMusicPlayer.shared`，并请求MusicAuthorization/Subscription。
- **音枢现状**：[systemMedia.ts](../src/playback/systemMedia.ts)及NativePlaybackEngine已有系统Now Playing；它与独立Widget/ActivityKit/MusicKit不同，不能为了参考扩展而重做系统媒体控制。
- **建议**：若未来明确需要，仅同步权威播放摘要到原生扩展，验证App Group、权限/签名、后台刷新/活动限制。MusicKit是另一内容与播放体系，需先明确是否采纳及如何协调唯一播放意图，不能直接加第二播放器单例。
- **范围/平台**：当前不自动新增Apple Music、独立歌词岛/桌面小组件或CarPlay；不复制entitlements/签名/AppGroup标识，不承诺免费自签可用所有扩展。Android需另做对应产品设计，不能把MediaSession简单称为ActivityKit等价实现。

## 三项目与Beans/Q-music的互补关系

1. **三平台登录/日推/FM**：继续以指定Q-music android为协议主参考，Beans补网易/QQ网页、酷狗QR与iOS字段；Youmi补网易验证码/QR和FM低水位供曲；Mineradio补账号首页局部失败与QQ权限分类。Youmi/Mineradio多数请求经过外部API或Node包装，不是无需服务的直接iOS接口实现。
2. **歌词/舞台/背景**：AMLL优先提供数据/交互问题清单，Beans和Youmi补手机行为对照。音枢TTML/原生逐字/背景/请求共享已存在；新增点聚焦背景人声、对唱、时间区间、拖动后跟随及弹簧收敛，不重复底座，也不改变Sollin截图度量目标。
3. **下载/数据/系统媒体**：音枢已有更严格的工程保护，参考仅用于交互/协议边角；没有证据表明这三者可以替代LX宿主、Navidrome、WebDAV、漫途格式或系统后台下载。

## 听歌识曲专项

本轮在Mineradio JS/HTML与Youmi Swift源码中限定检索识曲、Shazam/SHSession/SHSignature、ACRCloud/AudD、音频匹配/麦克风输入等，未定位到可确认的采样→音频指纹→曲库匹配→歌曲结果链。Mineradio的DJ节奏分析是音频能量/节拍估计，配置/缓存fingerprint不是识曲；Youmi测试/平台功能名也不能代替实现证据。AMLL是歌词解析/呈现库，本轮未定位识曲服务或录音匹配模块。

“未定位”仅描述这些固定公开源码，不推断其他分支、未公开版本或安装包。保留音枢[本期不实现识曲](RECOGNITION_ASSESSMENT.md)的既定决定，不因节拍或歌词算法新增麦克风权限/识曲SDK。

## 许可与维护事实

- **Mineradio**：[package.json](https://github.com/XxHuberrr/Mineradio-paused/blob/d43de565acabfdc1a9c9820a27e81a98ccbebcef/package.json)声明`GPL-3.0-only`，根LICENSE为GPLv3；[README.md:3](https://github.com/XxHuberrr/Mineradio-paused/blob/d43de565acabfdc1a9c9820a27e81a98ccbebcef/README.md#L3)明确长期停更。[NOTICE.md](https://github.com/XxHuberrr/Mineradio-paused/blob/d43de565acabfdc1a9c9820a27e81a98ccbebcef/NOTICE.md)列出Cuefield/LX上游及不属于普通自有代码的汽水Web安全运行时。不能用根GPL替这些资源作授权保证，发布仓库也与本次paused仓库不同，不随链接自动运行/更新。
- **AMLL**：根及本次检查的`core/lyric/ttml/react/react-full/vue`包均声明`AGPL-3.0-only`。包版本分别为0.6.0/1.1.0/1.0.1/0.6.0/0.5.0/0.6.0；ttml无普通dependencies不代表无DOM环境依赖，core/react-full仍是Web体系。README有招募维护者说明，不能把star数或依赖新版本当长期维护保证。
- **Youmi**：固定提交未发现LICENSE/COPYING；[README License段](https://github.com/7DaysMax/Youmi-Music-IOS/blob/152567b3c4a337c9c5bee06bb7f40ebaa49d40c2/README.md)只写个人学习研究，不是MIT/Apache声明。它是此前研究的Ryderwe/Youmi fork所指向的上游，但提交不同，不能假设字节相同或授权已解决。源码包含外部API与作者环境产物，均不复制到音枢。

本轮选择**行为/契约研究，不移植第三方实现**。如后续要复制、改编或直接依赖，先确定具体文件来源、上游、许可兼容和所需义务，再记录决策与THIRD_PARTY_NOTICES；不能把翻译成Swift/TS或换文件名当成绕开源码许可。不在本轮为音枢重新指定整体许可证。普通行为问题可以由音枢独立设计并用自制夹具验证，但不得声称抄写算法细节是原创。

## Mac接续与验收任务

Mac在本机SSD独立音枢工作树正常`git pull --ff-only`，不要共享网络盘node_modules/Pods/DerivedData。没有这三仓时可在本机ReferenceProject分别浅克隆，已有仓库先看状态再fetch；以下命令中的目录均是参考仓库，不是音枢工作树：

```sh
git clone --depth=1 https://github.com/XxHuberrr/Mineradio-paused.git Mineradio-paused
git -C Mineradio-paused fetch --depth=1 origin d43de565acabfdc1a9c9820a27e81a98ccbebcef
git -C Mineradio-paused switch --detach d43de565acabfdc1a9c9820a27e81a98ccbebcef

git clone --depth=1 --branch main https://github.com/amll-dev/applemusic-like-lyrics.git applemusic-like-lyrics
git -C applemusic-like-lyrics fetch --depth=1 origin ca0f41d67882d936c0365ffd99c16841ea2fa39d
git -C applemusic-like-lyrics switch --detach ca0f41d67882d936c0365ffd99c16841ea2fa39d

git clone --depth=1 https://github.com/7DaysMax/Youmi-Music-IOS.git Youmi-Music-IOS
git -C Youmi-Music-IOS fetch --depth=1 origin 152567b3c4a337c9c5bee06bb7f40ebaa49d40c2
git -C Youmi-Music-IOS switch --detach 152567b3c4a337c9c5bee06bb7f40ebaa49d40c2
```

用各仓`git rev-parse HEAD`核对SHA。静态复核不要求运行npm install/pnpm install、启动外部API/Electron或解析Youmi随仓构建产物。需要编译时另做当前工具链和依赖审查，不直接采用README性能/系统要求作为已通过事实。

建议后续任务按既定UI优先顺序推进，账号功能启动后按以下依赖拆分：

| 工作包 | 本次参考编号 | 必须保留的验收 |
| --- | --- | --- |
| 三平台授权adapter | Y01、M03及Beans登录项/Q-music | 取消/刷新/过期/退出后迟到结果，单个在途轮询，Keychain与账号隔离；真实登录另验 |
| 账号内容与FM供曲 | M01–M03、Y02–Y04 | 局部失败、内容来源、完整分页、单个在途预取、批内/批间去重、全重复/耗尽/回退、暂停不被迟到结果恢复、锁屏下一首 |
| QQ评论与在线实体 | M04、Y04及Beans相应项 | 原曲身份、数字ID/MID、热评与普通独立分页、失败保留旧数据；写操作不默认开启 |
| 歌词深度与交互 | A01–A06 | 背景/对唱/重叠/坏时间/Unicode；数据与派生显示策略分开，拖动/惯性/切歌/减动/VoiceOver，不每帧React全列表更新 |
| 背景与组件职责 | A07–A08 | 保留现有异步取色/呈现所有权/最多两场等保护，默认主题截图/区域diff和真机动效分别记录 |
| 范围外候选 | M05、Y05部分、Y08等 | 先明确产品需求与许可，再做最小验证；不自动新增AutoMix、评论写入、MusicKit、Widget或识曲 |

## 本轮证据边界

三组独立只读探索覆盖三个参考项目；主代理亲读基础文档并抽查账号推荐/分页/QQ评论、FM去重与预取、QR轮询、请求合并、AMLL模型/DOM依赖/重叠与背景接口。最终比较以e72827d的音枢代码为基线，没有把历史测试记录当本轮重跑结果。

本轮仅同步仓库、读取源码、形成比较与交接文档；没有复制参考源码/资源、安装依赖、运行参考服务或App、调用真实账号、执行iOS构建、设备采样、识曲或真机测试。所有“可帮助实现”均是候选，接口稳定性、许可可采纳性、手机后台/性能仍需分别验证。产品范围和完成度不因本报告调整。

校验回执：21项候选；本报告及交接/来源/比较/识曲共5份文档的247处本地文件或固定提交源码文件/行号引用检查通过，`git diff --check`通过。三参考仓工作树干净、`git fsck --no-reflogs`均退出0，收尾再次`ls-remote origin refs/heads/main`核对三者均等于表中SHA。独立审校后的措辞明确“音枢建议”与“参考现状”区别，并补足TTML环境和共享请求实现出处。Z盘剩余约816GiB，本轮无临时诊断包或构建缓存删除。
