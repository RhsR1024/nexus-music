# 首批实现验收记录

## 已完成

| 检查 | 实际结果 |
| --- | --- |
| npm依赖 | 已安装，package-lock.json记录705个初次安装包；Expo兼容版本检查通过 |
| 类型检查 | `npm run typecheck` 通过 |
| 自动测试 | `npm test` 20项通过：队列、播放竞态、LX协议与MusicInfo适配 |
| Pods | 75个Podfile依赖、74个Pods安装完成，Podfile.lock已生成 |
| Release模拟器构建 | `bash scripts/build-ios.sh` 重试通过，`** BUILD SUCCEEDED **` |
| 安装与启动 | iPhone 15 Pro Max / iOS26.3.1 Universal，com.nexusmusic.app成功启动 |
| 首屏视觉检查 | 已截屏并检查音乐库空态、来源入口、底部导航；无运行错误页。截图位于build/nexus-library.png |
| LX离线初始化 | 原生JavaScriptCore隔离检查24份脚本，19份发出inited；完整边界见LX_HOST_PROGRESS.md |
| 漫途样本 | 版本1结构调查完成，原始文件未提交；导入器仍未实现 |

构建产物：`build/DerivedData/Build/Products/Release-iphonesimulator/app.app`。

第一遍构建期间AssetCatalogSimulatorAgent停在dyld映射等待；终止该遍资源编译、待运行时稳定后增量重试成功。没有删除资源或修改第三方依赖绕过编译。初次模拟器存在重复运行时注册，已通过本地完整DMG重新注册并成功启动。

## 当前版本可以做什么

应用目前提供音乐库空态与来源设置说明页；领域代码具备独立队列、FIFO、删除/移动、播放意图与过期请求保护，LX协议及数据适配已有首批契约测试。这些领域模块尚未与真实播放器、数据库或原生LX生产桥接通。

## 不能宣称通过的项目

- LX真实出站请求、AES/RSA/zlib、脚本导入到App、真实musicUrl和歌词返回。
- 实际音乐播放、锁屏十首、耳机控制、FLAC格式和功耗。
- Navidrome账号认证/实际曲库/播放，或服务端写入。
- 私人数据导入、SQLite持久化、重启恢复、unsigned IPA和个人签名。
- 四个参考项目本身在此Mac上的构建与运行；目前仅克隆、源码阅读、比较。

下一步优先补生产LX宿主及其回归测试，再接单一播放后端。每项功能先按REFERENCE_COMPARISON.md比较实现、维护与Android成本后移植，不能将本记录的离线结果扩大为完整兼容。
# 2026-10-15 多音源路由增量

`npm run check`通过：TypeScript检查及31项测试（新增11项）。本批实现SourceRegistry独立代次/批量部分成功、音质外层/音源内层路由、原始档位别名传参、取消/超时/源更新隔离、安全错误。没有新原生代码，本批未重复全量原生构建。

测试覆盖同档跨源优先、逐档降级、不升档、忽略取消的transport超时、暂停取消不重试、在途源停用、无效URL、批量失败隔离、替换顺序、删除重导入代次及初始化迟到。仍未接入生产JSC/HTTP或实际播放；源顺序持久化、UI批量勾选待后续接入。

## 2026-10-15原生宿主增量（当前）

- `npm run check`：类型检查、35项测试通过，含adapter及同步订阅者停用竞态修复。
- `npm run test:native`：24项utility独立字节对照、本地HTTP端到端及同进程生命周期测试通过；超量响应拒绝/无响应超时均有验证。
- Pods安装与iOS Release模拟器构建通过，自动链接NexusNative及bootstrap资源；模拟器安装/启动通过。
- 24份真实本地脚本以原生HTTP/timer初始化，23份发出inited，一份SCRIPT_TIMEOUT；报告只在build/logs，不提交。
- 本批没有实现App脚本导入/持久化/批量管理UI，也没有证明真实musicUrl、音频解码、后台、PCM频谱/EQ或Navidrome联调。单次解析取消与底层HTTP取消的边界见LX_HOST_PROGRESS及决策0002。

## 2026-10-15来源管理、播放DSP及搜索增量

- SQLite版本迁移/事务仓储、脚本文件/地址导入、SHA256去重、批量启停/删除、优先级顺序、订阅更新/旧版恢复已接入App；默认导入停用。来源批量初始化并发最多3项，较新批次阻止旧批次继续启动待处理源。
- Release XCUITest真实走通：进入来源页、文件选择器取消、从本地HTTP导入合成脚本、原生初始化/启用、停用、删除（测试后清理合成源）。首次UI测试发现URL输入字符丢失，配置URL键盘并按实际输入节奏复测通过；结果在build/SourceUITests-*.xcresult。
- 原创AVPlayer单后端、HTTP byte-range资源加载、MediaPlayer/音频会话/中断与路由控制、10段EQ与原生PCM→FFT→32频带。Mac同一生产播放引擎验证本地WAV与HTTP分段WAV：自然结束、真实PCM tap和频谱事件通过；C++黄金验证旁路逐样本相同、1kHz衰减、FFT峰值、余量/静音/有限输出。iOS Release构建通过，**App播放页真实播放与手机后台仍待单独验收**。
- 五平台真实搜索探测每平台返回3首，保留LX元数据与分页。TX采用签名请求，许可/来源见THIRD_PARTY_NOTICES；修复长整数解析对长小数的误识别，未静默舍入ID。聚合搜索分平台失败/分页/取消，不按同名合并。
- `npm run check`：类型检查与52项测试通过；原生测试含24项utility对照、HTTP/context生命周期、DSP及AVPlayer纵向验证。发现/榜单/公开歌单、歌词、收藏历史、临时音频缓存、Navidrome和M10仍未完成。
- 本地备份仅作为私密曲目输入做6份WY脚本真实解析：5份返回HTTP URL，3份读到可识别音频头；不提交地址/曲名/ID，不等于完整解码和真实手机播放。Python探测明确使用本机系统CA文件，未关闭TLS验证。
- 当前未发现已连接的iPhone；签名/覆盖安装/锁屏十首仍未验收。

## Navidrome、音乐库与歌词阶段验证

- Navidrome公开协议client、Keychain配置、浏览/搜索、星标和服务端歌单编辑已实现。鉴权/重复参数/错误分类及凭据写入回滚有合成测试。真实内网匿名ping可达，返回缺少认证；未用真实账号联调。
- `build/SourceUITests-1792025478550.xcresult`：Release模拟器登录→Keychain保存→专辑→HTTP流播放→原生PCM频谱→暂停→移除凭据通过。合成服务统计8次鉴权成功、0失败、4次stream Range请求。夹具是本地合成12秒WAV。UI测试使用本地临时签名；无签名构建不能作为Keychain验收。
- 收藏/实际播放历史/本地歌单、重复曲序、音枢版本备份与恢复、队列/游标暂停态恢复已接入。失败写入保留旧库、认证字段过滤、无效队列和重复条目有测试。漫途迁移仍待M10。
- 原生初始定位、暂停期间加载取消、系统暂停代次提前失效、解码失败保留进度已补强；Mac生产引擎HTTP初始定位与自然结束通过。
- 歌词解析支持LRC/LX/YRC/QRC/KRC已解码格式、真实字时间降级、偏移、翻译/罗马音和OpenSubsonic结构歌词，覆盖中文emoji的UTF8边界。获取优先已启用音源，回退平台；过期音源/取消不能发布结果，内存缓存限20项/30分钟。KG平台回退使用LRC；压缩QRC/KRC网络解码尚需补全。
- TTF/OTF字体导入、文件头检查/限额、默认/删除和字号已接入；用户字体待模拟器验收。
- 随机队列按条目无放回、历史上一首/向前恢复、FIFO优先；类型检查与81项TS测试通过。
- 临时音频缓存完整覆盖才提升，按歌曲/账号/来源指纹/音质隔离，签名URL不入索引；原生测试覆盖稀疏缺口、清理代次、活动保留、长度变化和失效。最新App集成复验中；持久离线/真机后台未验收。

集成复验更新：`build/SourceUITests-1792026827979.xcresult` Release UI测试通过，增加结构歌词获取和显示。缓存错误回退保留播放意图；缓存按HTTP MIME保留可识别文件扩展。Mac生产引擎测试新增完整HTTP缓存后改用不可达网络地址，仍完成解码、PCM频谱和自然结束，证明完整缓存命中。全部原生检查通过；当前类型检查与90项TS测试通过（包括恢复隔离与发现适配）。

发现后端真实探测：五平台歌单列表及榜单均有返回；网易/QQ/酷我/咪咕分类有返回。网易/QQ/咪咕歌单详情已取到歌曲；酷我返回条数与total不一致、酷狗详情仍需适配，不能记为完整导入通过。公开歌单先完整验证后落库，分页不推进或缺曲则失败保留旧库。发现UI仍待接入。

## 真实LX播放与发现/歌词/缓存继续验收

- `build/SourceUITests-1792045322336.xcresult`：使用本机真实LX脚本（不提交、不上传云端）从App导入、启用、真实网易搜索、自动解析、实际解码和PCM频谱、暂停、删除测试源，通过。修复键盘显示时首次搜索按钮点击被外层ScrollView消费的问题；仍不等于手机后台验收。
- 发现/浅深主题UI测试 `build/SourceUITests-1792027535934.xcresult` 通过。五平台完整公开歌单探测网易98/QQ104/酷我121/酷狗156/咪咕68首成功，数量随平台变化；五平台榜单详情均取得真实曲目。酷我详情补vipver，酷狗完整歌单采用公开PC页面的完整数据而非重复的移动预览，咪咕榜单适配columnInfo.contents.objectInfo。
- 封面按账号/封面ID或来源指纹隔离，URL仅内存；下载受8MiB限制，原生ImageIO缩小至512px、JPEG缓存限32MiB、LRU和清理代次。原生缩略图检查通过；播放器和Navidrome专辑已接入。
- Mac同一生产播放引擎新增AAC、16-bit FLAC、24-bit FLAC实际生成样本，定位、PCM/FFT及自然结束通过；WAV/HTTP/离线缓存命中仍通过。未将文件档位按钮作为格式证据。
- 原生utility独立Node oracle增至29项，包含KRC压缩字节解码、JSON/gzip导入和解压上限。KG真实网络歌词探测取得114行/817个真实字时间（仅记数量，不提交歌词）。QRC已解码格式可解析，网络密文变体尚需完成。
- LX v2 JSON/LXMC导入预览/追加已接入；来源与元数据、重复项/曲序保留，未知格式拒绝，非首期来源计数跳过，账号和脚本不迁移。普通音乐库用虚拟列表及原子批量移除；音源版本指纹在解析快照固定，避免更新竞态混入缓存。恢复隔离限定格式错误，模块/IO故障不挪走有效记录。当前97项TS检查通过。
- 本机共享archive脚本复测成功，设备arm64/iPhoneOS26.2及JS包验证通过，并生成环境清单和SHA256。云端已分配xcode-27-arm64、macOS27.0.1；修复Ruby依赖和Yoga生成checksum差异，原生检查通过，iOS27模拟器/归档仍在运行。不能提前宣称云端IPA成功。

## 云端启动修复与歌词分类收尾

- 2e7da07云端运行38695984346全部成功。iOS27 SDK要求UIScene生命周期，新增单场景适配后App测试通过；本地同一迁移回归为`build/SourceUITests-1792047430065.xcresult`。云端IPA已下载至`build/cloud-iOS27-2e7da07`并校验SHA256、arm64、iphoneos27.0、2.1MiB main.jsbundle；unsigned状态，未做个人签名/手机验收。
- 旧upload-artifact v4的Node20弃用警告不影响上一轮产物；2b78e43升级两处上传为原生node24的官方v7.0.2，需看后续实际运行日志。
- QRC网络密文原生变体解码、XML容器提取、独立翻译/罗马音失败降级、取消隔离已接入。合成固定向量由独立参考编码器生成；原生utility33项通过。真实QQ搜索3首后获取歌词，其中一首17行/82个真实字时间，其他条目无字时间时不伪造；不提交歌词正文。
- KW分类保留43专区/10000标签类型并选择对应接口，专区过滤未实现的专辑/歌手条目；MG分类读取logEvent模板及显式下一页，KG分类使用实际PC wire字段。真实KW专区17项/普通标签30项、MG分类30项；五平台分类均实际取到歌单。数量动态变化。
- 当前101项TS测试、完整原生宿主/DSP/播放/缓存/封面检查和本机Release构建通过。主目标仍有长列表交互收尾、用户字体UI、M10漫途/持久离线，以及手机/真实Navidrome账号验收，不能把云端成功归档当成全部功能完成。

## 汽水导入与匹配阶段

- 115项TS检查通过，新增原始身份/版本与时长判定、源故障/取消、匹配记录隐私过滤及备份往返、全局音质优先、目标隔离的解码重试、人工匹配不被自动覆盖、公开歌单分页完整性/重复游标/官方短链约束。
- 真实汽水公开接口读取38条完整歌单；同一原曲真实跨平台搜索36候选、1个可靠WY候选、5平台均有响应。报告仅在build/logs保留数量，不提交曲名/ID/地址或歌词。
- 漫途实际备份解析完整保留3歌单1187/38/1209、4收藏、unsupported0；忽略25个账号/音源配置与全部Android设置。原曲和目标分开保存，未匹配条目仍可显示/导出，不凭同名强行替换。
- `build/SourceUITests-1792053290760.xcresult` Release模拟器汽水导入入口/空输入禁止读取/关闭、Navidrome实音合成服务回归通过。新UI已编译，但尚未完成实际文件导入、人工匹配保存和App跨平台实音纵向验收。


## 2026-10-15 Sollin 对齐基础

40cc6a6 云端运行 38704334418 已完成：Linux、原生检查、iOS27 App 测试、IPA归档及上传全部成功。

Sollin 桌面源码已固定到 c9d446f，参考与许可记录在 REFERENCE_COMPARISON。S1 引入 Expo54 对应 Blur/Gradient/SafeArea 和图标；pod install 成功。类型检查与117项TS测试通过（build/logs/check-sollin-ui.log），含旧外观设置迁移及无效/存储失败保护。本地Release UI验收进行中，新增外观重启持久化/导航与原Navidrome播放回归。新UI未云端或真机验收，不能称完整对齐。


### S1 本地验收完成与 S2 初稿

120 项 TS 测试及类型检查通过，包含设置迁移/失败原子性、CDN HTTPS精确匹配、封面4并发/64等待上限/取消和清理失效。新增静态 NexusMaterialView 已通过 Release 编译与交互；实际测试无之前每次60秒动画空闲问题。

- build/SourceUITests-1792063450926.xcresult：外观选择/重启持久化/一级导航、发现完整歌单读取确认、Navidrome合成服务实际播放/PCM/歌词/暂停/移除凭据，3项通过。
- build/SourceUITests-1792063716396.xcresult：封面排队改动后Navidrome合成播放回归通过。
- build/SourceUITests-1792063866709.xcresult：音源导入/启停删与汽水导入入口，2项通过。

S1 原生模糊/渐变、安全区域、语义色/强调色、悬浮导航/封面mini基础已实现；S2新增发现双列封面卡、平台/分段、歌单封面与计数/简介展开/随机已加载入口。尚未实现完整日推登录、全套详情操作、取色和五播放皮肤。截图仅为本地模拟器；真实ND账号/真机签名与后台仍待验。后续云端新提交单独跟踪。

## S3 五种播放布局基础（2026-10-15）

120项TS及类型检查通过，build/logs/check-five-player-layouts.log。旧设置缺 playerLayout 安全回退 classic。AM/沉浸/写真封面背景/黑胶/声波核与经典布局共用现有 controller；黑胶原生驱动旋转，环形频谱读取现有真实FFT，不复制图片或随机模拟频谱。

最终本地 Release UI：build/SourceUITests-1792065306216.xcresult，合成Navidrome验证→实际原生播放/PCM/歌词→暂停→AM拖动定位仍暂停→沉浸/写真/黑胶/声波核切换与当前曲/暂停/控制可达→回经典→删除凭据，通过。前序截图审查发现的沉浸控制超出首屏、深色状态栏不可读已修复；五布局截图保留于本机xcresult，样本为合成音频/黑色封面，非私人歌单。

这不是播放中连续切换、真机帧率/功耗、独立写真图库、自定义背景导入、完整累计扫色或精确复刻验收。S3基础交付与S4动画/歌词目标分开，详见决策0013。S1提交2cb91a6已push；云端38728228483尚在进行，暂不以新push取消它。

b7d7226 五皮肤本地设备归档成功：build/distribution/NexusMusic-unsigned.ipa，arm64、iphoneos26.2，build-manifest dirty=false、signed=false，SHA256 a5fb7627e40ab3ae403241b6dee7b99461126c08d227cf8b0ee46a429efdc644。未做个人签名与手机安装。后续并发策略改为不取消正在运行的阶段、排队保留等待阶段；该工作流修改不影响此IPA内业务源码。

## 紧凑视口浮动栏遮挡修复

S1云端失败原因已由下载诊断定位：源导入按钮被浮动导航遮挡，XCTest命中音乐库页，非通用播放失败（云端外观/ND均通过）。根内容区现按底部chrome的实测高度与安全区约束ScrollView可见区域，发现列表尾部移除重复预留；新测试断言导入后仍在设置tab。

本地新增iPhone17/iOS26.3.1模拟器CACFEADC-4D00-4BBF-AD37-503CDD1BE24A，120项TS/类型检查通过；Release UI源导入/启停删通过69.151秒，ND实音/PCM/歌词、暂停、AM拖动定位及五皮肤切换/控制可达通过85.659秒。它覆盖云端同类紧凑尺寸，但仍不替代iOS27云端复验。九张用户参考截图已保留在忽略目录resource/reference-ui/sollin-v2，未作为App素材或提交Git。

修复版最终产物：d96ea74，build/SourceUITests-1792066875571.xcresult两个紧凑布局UI用例通过；build/distribution/NexusMusic-unsigned.ipa归档成功、arm64/iphoneos26.2、signed=false、dirty=false，SHA256 bd6ce7b6903915fbab041c52c2c75d64587156cfcb1d656add65ecef83615afe。构建清单和校验文件同目录。云端38735111951已排队，尚未称通过。

## S4/S5 在途验证（2026-10-15）

- 128 项 TS 测试及类型检查通过，build/logs/check-sleep-lyrics-eq.log：TTML 相对/帧/tick 时间、声部/翻译、XML坏数据/限制、缩进词时间；EQ旧设置迁移/有界预设/原子失败与排队捕获；睡眠迟到响应代次保护。
- build/logs/native-sleep-final.log：完整 native suite 通过，原生 DSP ±6dB RMS/钳位/逐样本旁路；实际 AVPlayer WAV/AAC/16/24FLAC、HTTP/缓存/PCM；新增实际音频按时暂停和本曲后暂停、不发布自然 ended；原生睡眠策略取消/替换/旧回调/一次性测试。
- build/SourceUITests-1792069586855.xcresult：图形 EQ 拖动/命名保存/重启/删除本地通过。下一轮联合歌词/控制测试仍在复验，不将第一次 UI 通过当作最终全部通过。

S4/S5 本批最终：130项TS检查通过（build/logs/check-s4-s5-final.log）；build/SourceUITests-1792070741768.xcresult 实音/PCM/五皮肤/原生逐字、本曲+100ms/重置、全部歌词双击定位仍暂停110.910秒通过，已看截图确认逐字部分扫色；build/SourceUITests-1792071034072.xcresult 图形实际增益/命名恢复/删除/睡眠开启取消145.144秒通过。手势按释放坐标提交，取消不写入。native-sleep-final.log全套通过含真实音频时长/本曲结束暂停。本地设备IPA待本批提交后生成；未声称新模块云端和手机通过。

前一基线d96ea74云端38735111951：checks、native与iOS27 App UI步骤通过，目前归档中；最终上传仍跟踪，不将它算作本批S4/S5新代码验收。
