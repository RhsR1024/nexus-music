## 2026-10-17 设置与全局封面主题阶段

- `npm run check`：类型检查通过，自动测试 **302/302** 通过。
- `git diff --check`：通过。
- 本地 UI：`build/SourceUITests-1792169130948.xcresult` 分组设置导航/草稿/滚动恢复与发现/外观专项通过；`build/SourceUITests-1792168820230.xcresult` 的实际全局封面专项通过，最终结果以对应 result bundle 记录。专项覆盖红/蓝封面跨音乐库、发现、外观页切换，关闭恢复及重启恢复。
- 本地归档：`build/logs/archive-cover-settings.log` 为 `ARCHIVE SUCCEEDED`；`build/distribution/build-manifest.json` 记录 Xcode 26.3、iOS 26.2、arm64、unsigned、min iOS 15.1。IPA SHA256 为 `fb5cc2c3e3b1558e3669f870b54317b3b45f1521d90bbcd8d0ffa80f59fb5e06`。该归档在提交前生成，manifest 的 dirty 状态只反映待提交工作区，不能当作清洁交付包。
- 云端 iOS 27：待本阶段提交后由 GitHub Actions 运行；未将排队或本地 SDK 26.2 结果记作云端通过。
- 仍待：真机、减少动态效果/后台、低电量与功耗、真实私人封面，以及 Sollin 动态流动/视频背景的行为观察。

# 首批实现验收记录

2026-10-16 iPad证据更正：主App Debug/Release的TARGETED_DEVICE_FAMILY仍为1，当前Release模拟器App的UIDeviceFamily实读仅1。此前iPad截图不能解释为Stage Manager/分屏验证，也不能据此验收原生平板布局；详见[0031更正](decisions/0031-adaptive-ipad-layout.md)。本批已修正为1,2且实际窗口/旋转专项通过，证据见文末；保留旧构建成功但收回旧平板窗口解释。

## 2026-10-16 S8/F33 多设备同步本地验证中

按[决策0032](decisions/0032-webdav-device-sync.md)实现收藏/歌单（条目ID、曲序、重复项）/音频匹配/歌词选择的三方基线同步、逐项冲突选择、持久删除标记、账号和目录隔离。原生条件PUT创建/更新、条件GET回读，412废弃旧方案；共用MutationQueue复核本机快照并串行保存，基线/音乐库一个SQLite事务。历史/统计/队列/凭据/文件/音源/外观保留本机。无新依赖/参考资产，不宣称自动实时或两台真实设备已验。

`check-sync-final.log`类型与296/296业务通过（原269 + 同步27），包含两独立客户端、并发改名/改序/删除冲突、CAS、重启、预览后编辑、网络期间排队编辑、远端成功本地事务失败恢复、缺失删除标记拒绝、列表展示顺序保留、超限/畸形/未知版本与私密字段剥离。`native-sync-full.log`完整原生通过，含真实HTTP条件PUT更新、旧ETag PUT/GET412、当前GET成功，保留F32创建不覆盖及重定向/限额检查。

首次正式App `build/SourceUITests-1792157529159.xcresult` 同步210.933秒通过：真实连接/目录/首次同步、服务端合成编辑、本机改名、1冲突/未选时禁用/取消保留本机、选择云端/重启、删除传播/再次重启、只移除自身夹具连接。冲突截图已导出亲看。随后 `1792158115833` 同步215.301秒再通过并增加两侧版本详情预览；交叉组旧备份输入留下末尾斜杠导致目录断言失败，后续DAV误认为残留备份连接是自身夹具而停止，未计整组通过。已保存日志/附件，修正为实际全选菜单替换字段，以及仅发现自身夹具才核对/移除，保留全部原断言重验。最终交叉回归、本批清洁IPA和新iOS27运行继续。

## 2026-10-16 mini／源健康 iOS27 验证闭环

`13dc4505d7b85a8839c226173d6455d6e3e7ce37` / [38889054633](https://github.com/RhsR1024/nexus-music/actions/runs/38889054633) 已完整成功：checks、完整native、核心App、歌词/匹配/评论/源健康、设备归档和上传均成功。IPA artifact `12049450647` 已下载至忽略目录 `build/ci-38889054633`；完整ZIP SHA256 `58d6afe199afac1fbf34351004ef8529470250e15f5b8b4f3db835c96d2542dc` 与API digest一致，CRC/长度及内部IPA摘要通过，IPA SHA256 `adbcea0af31564f29b84734dc34b339f6c661b424f79ca0f588e32f7b3a03b09`。manifest为arm64 / Xcode27.0 27A266a / iphoneos27.0 / min15.1 / signed=false；dirty=true且唯一变化为ios/Podfile.lock，不称云工作树清洁。该批闭合了此前健康关键词漏字修复的iOS27验证，旧失败仍保留。

F32 `38894434005` 当前已过checks/native，核心App运行中；`38899071423`及后续正常排队，未取消或重复派发。同步新批次尚未上云；手机/个人签名与私人服务不由本结果替代。

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

## 2026-10-16 构建与 S6 在途证据

bdb8018本地build/logs/archive-s4-s5.log成功，manifest commit=bdb8018e85098026d920ca9ba5f636885035fc1a、dirty=false、arm64/iphoneos26.2/signed=false，IPA SHA256 8a799140bd5f59730f692975edc98c4ccd3cd7356da81954566be4c2825f4c0b。d96运行38735111951最终全成功；bdb新阶段运行38744057327 native子进程status=null失败，d643运行38768357550 utility/JSC/lifecycle通过后ARM DSP的启用平直滤波位相等断言失败，8a2e572保持关闭旁路位精确，仅对启用状态增加严格数值容差并复验云端。

本地文件阶段135项TS/类型检查通过，build/logs/check-local-audio-final.log；build/logs/native-local-journal.log全套native通过，包含MP3实解码/PCM以及WAV/M4A/AAC/AIFF/16和24FLAC导入、内容hash/去重、标签/内嵌歌词/封面、活动保护、删除日志恢复及坏文件/格式/暂存清理。App文件选择UI仍在复验，不把这些证据写成设备媒体库/WebDAV已完成。

S6首条App链路 build/SourceUITests-1792082405934.xcresult 40.912秒通过：真实系统文件选择器选中原创合成MP3，App复制持久化、显示实际ID3与内嵌封面、实际播放/PCM频谱。已查看截图；原始静音频谱为基线，不使用随机条。后续重启/删除/ND集成另复验。

S6本批最终：137项TS/类型检查通过。build/SourceUITests-1792082588688.xcresult 本地音频实际选择导入、重启播放/在用拒删/移除队列后删除61.161秒与ND实音/PCM/歌词/五皮肤99.008秒均通过；build/SourceUITests-1792082899195.xcresult补专辑封面网格/艺术家分组67.575秒通过。无私人素材，测试音频为原创合成MP3。最新TS修复覆盖缺失副本重新导入与不导出file://；未用UI通过代替设备媒体库/WebDAV验收。S6本地和云端新包仍随后分别记录。

c798ab4657e37d88347db322dcb6dfa4f6719b24已push。本地archive-local-audio.log **ARCHIVE SUCCEEDED**，验证arm64/iphoneos26.2；manifest dirty=false/signed=false，SHA256 22885744c59b72cbe960f4d7bd8d1d7a5c2284ed59a1d85b24ffc9f932cf29a7。云端S6运行38772611477 pending；8a2e的38769479789正在App测试，与S6分开验收。

## S6 设备媒体库增量（2026-10-16）

已接入原创 MediaPlayer 原生模块、用户主动授权、歌曲/专辑/艺术家与分页搜索、内嵌歌词和共享封面缓存。device来源使用本机namespace + UInt64字符串ID + 元数据签名，播放时重新查询并检查授权/DRM/云端未下载；assetURL不进入曲库备份。权限撤销清空浏览并停止当前设备来源播放，失效引用显示可操作提示，仍使用同一队列/AVPlayer。参考与Android替代边界见[决策0017](decisions/0017-device-media-library.md)。

145项TS/类型检查（build/logs/check-device-media.log）和native-device-media.log全套通过，覆盖长ID、跨设备碰撞、快照分页/迟到结果/权限变化、备份无URI及未授权ipod-library拒绝。Release build/SourceUITests-1792084293006.xcresult：真实权限拒绝界面16.053秒、ND合成实音/PCM/原生歌词/五皮肤96.506秒均通过，已查看截图。模拟器没有真实音乐库，设备歌曲/后台播放尚待手机，不将授权测试等同媒体库实音。

云端8a2e运行38769479789的native检查通过，App中ND播放通过、源管理失败；下载诊断11993526333，ui-catalog.log67209定位系统Files首启空白容器未出现取消按钮。测试改为中英文合并30秒有界等待，不跳过断言。c798文件阶段运行38772611477另在运行，不能以旧失败作为新阶段结论。S6 WebDAV仍待实施；全范围S2/S3/S4/S7/S8/S9和真机/真实ND验收继续，目标保持active。

音源选择器等待修订本地复验：build/SourceUITests-1792084866977.xcresult源管理实际Files打开/取消→URL导入→启停→删除56.553秒通过；最终check-device-media-final.log为145/145，无失败/跳过。新授权测试已加入CI，云端尚待新提交实际运行。

设备媒体库阶段已正常push ff84cc47183f9652994c657e4134498cd9a31258。本地archive-device-media.log归档成功；manifest commit=ff84cc4/dirty=false/arm64/iphoneos26.2/signed=false，IPA SHA256 861dfc6a95bf5c1fa17958107327ab490aca0c99e5db1ec6fa7c0d167e388ab8。新云端运行38776957927 pending，文件阶段38772611477 native通过/仍在App测试；不将其提前写为云端成功。

## S6 WebDAV 连接/协议基础（2026-10-16，未接App播放）

原创webdav.ts已实现根目录路径规范化/同源限制、DAV命名空间和成功propstat解析、Depth1目录及Depth0文件探测；webdavAccounts.ts提供多账号/Keychain隔离、验证后保存与写失败回滚。TTML的有界XML抽到formats/xml.ts，保留全部原TTML测试。原生DAVHTTP提供真实Basic/PROPFIND、2MiB响应预算、目录内重定向/5次上限、越界阻断/取消；已通过Mac合成HTTP实际请求及iOS15.1 simulator SDK类型检查。154项TS/类型检查通过（check-webdav-final.log），native-webdav-http-run.log原生HTTP通过。

参考与RFC决策见decisions/0018-webdav.md。这是连接和协议基础，尚未接入Expo桥、App目录UI、webdav Track来源、受限音频Range Loader或远程AVFoundation元数据；不能写成WebDAV播放完成。下一批优先这些剩余，再验证App合成服务器播放/缓存/移除账号，随后继续S2/S3/S4/S7/S8/S9等全部未完成目标，goal保持active。

## S6 WebDAV App 接入与验收（2026-10-16）

WebDAV独立来源、Expo原生桥、多账号Keychain、目录/当前目录搜索/分批自动标签、收藏与本地歌单、原生远程时长/标题/艺术家/专辑/封面/内嵌歌词、受限Range播放及临时缓存已接入。真实HTTP合成服务验证Basic/Depth/重定向；音频重定向不能越出账号根目录，强ETag条件读取与响应版本检查；无可靠版本不复用音频缓存，弱网仅已知版本可走cacheOnly，缺完整缓存明确失败。账号修改/移除阻断旧结果并停止对应播放，其他账号不误中断。标签缓存按UTF16长度估算最多8MiB/100项，原生封面共享32MiB配额与清理代次。无标题标签明确按文件名显示。

播放前的最新标签通过resolvedTrack更新权威队列，保持原始来源/条目顺序并保留暂停续播；跨来源替换拒绝。WebDAV歌词/封面按文件版本刷新；无版本文件每次解析使用临时版本。另修复设备媒体库ipod-library在JS控制器被错误拒绝，只允许device来源且有显式deviceMedia标记，新增测试；真实设备歌曲仍需iPhone，不将协议放行当作实机播放。

163项业务/类型检查通过（check-webdav-delivery.log）；native-webdav-scope-final.log全套通过，native-webdav-format-seek.log另通过MP3/WAV/M4A/AAC/AIFF/16和24FLAC远程信息/实际解码PCM/定位后首个进度>=0.9秒（请求1秒）、自然结束，以及ETag不匹配/越界无凭据泄漏、服务器关闭后完整缓存播放与缺缓存拒绝。没有采用私人音频。

本地Release证据：1792087323214（三项WebDAV65.977秒/媒体授权13.938秒/ND98.039秒）；英语新模拟器1792087725309（音源61.009秒/WebDAV62.275秒/本地音频58.892秒），日志确认系统Browse/Open；元数据队列更新后1792107930316（WebDAV63.030秒/ND101.482秒）。均已通过。1792108210188（WebDAV63.017秒）再通过移除当前账号后mini消失断言。

云端旧c798运行38772611477结束：native通过，五项UI仅testYLocalAudioFileImport失败，ND实音通过；诊断11995572813已下载。ui-catalog.log73283/当时SourceSettingsTests.swift:57只找中文tabBars“浏览”，实际iOS27 Files为英文Browse/Open且浮动栏是普通Button。现改为跨角色容器的中英文按钮查询，已在本地英语模拟器真实文件导入通过；不提前声称新iOS27运行通过。ff84运行38776957927仍跟踪，后续新WebDAV提交将按队列上云。

边界：WebDAV Basic合成服务/App已验，个人服务器、其他认证方式与手机长后台仍单独验证；搜索当前目录，不冒充递归远程全库索引。S6设备实曲/手机、S2/S3/S4视觉与深度功能、S7/S8/S9所有目标继续保留。WebDAV云备份/同步不是此次播放接入的一部分，仍在F32/F33后续任务。目标保持active。

最终已补特殊文件名百分号与UTF8路径大小写等价支持，仍拒绝多层编码的点段/路径分隔符；native-webdav-path-final.log验证同源路径等价与边界。云端ff84/161的38776957927、38778691513均native通过/UI的X和Y失败；最新诊断11999758014已下载，X为系统按钮Don’t Allow（U+2019）不匹配旧直引号，Y为英文Browse/Open；当前代码已修正并继续真实英语授权复验。以上云端旧运行不代表新代码结果。

英语首次媒体库授权最终复验：build/SourceUITests-1792108645460.xcresult 14.526秒通过，日志实际点击Don’t Allow（U+2019），拒绝后的App状态与设置入口断言通过。此前云端X的具体失败条件已在本地复现并修正；新iOS27运行仍需实际通过。

WebDAV本批已正常push 258772e08c616a241c510aafa4583a3e4bf4a0bf；archive-webdav.log归档成功，manifest commit=258772e/dirty=false/arm64/iphoneos26.2/signed=false，IPA SHA256 62ad00e172871023f4869df8451e7ade3248753c01c5c6bf44a3e1f8704c0e1b。新云端运行38826891584已创建，checks通过，iOS当前原生检查；保留实际跟踪，不提前标成功。下一步S7普通在线失效曲/人工版本与质量优先统一路由，参考定位和实施要求见决策0019，尚未改动该功能代码。其余完整范围和真机/真实服务验收继续，goal active。

## S7 普通在线匹配与人工版本（2026-10-16）

普通在线和汽水统一MatchedResolver：每档先原曲全部LX源，再可靠匹配目标，最后降档；保留原始歌曲/条目身份。支持普通在线自动匹配开关、修改候选关键词/分页、手动指定及取消、绑定变更后取消解析/停止旧媒体并保留定位。缓存与解码排除键隔离原曲/目标/源指纹/质量；不递归读目标自己的绑定。歌词与NowPlaying使用实际目标，旧自动记录不会使原曲播放误标匹配。

179项业务/类型检查通过，新增质量全局顺序、关闭/人工优先、自绑定/备份、取消/写入竞态、过期自动ID替换、搜索故障旧可靠目标与游标等检查。build/SourceUITests-1792110034870.xcresult：独立测试入口下原WY解析失败→TX可靠匹配→原生PCM频谱→人工Live版本→取消绑定→重启原身份→自动开关重启持久化，110.361秒通过。HTTP计数确认WY/TX和其余三平台适配器被调用，两种目标均各4次Range请求；截图已检查。合成WAV只验证真实播放链路，flac是请求档位，不能称实际FLAC文件。正式入口不引入tests/e2e；归档固定index并检查测试适配器标记缺席。正式入口ND/真实LX回归与本批IPA另验收。

参考对比/许可与Android边界见decisions/0019，全部原创，无新依赖。此批没有完成源健康批测、登录推荐/FM/评论、统计识曲、其余视觉/歌词、云同步/iPad/最后下载、真机签名和真实个人ND等任务；完整目标保持active。

验证隔离修正：正式入口1792110331290中ND回归99.020秒通过；同次testLiveLXPlayback虽断言通过，但服务计数发现残留Nexus Matching Fixture为真实TX候选提供合成WAV，不计作真实LX成功。已给正式入口测试的合成音频端点加404隔离，并为匹配UI增加删除测试源断言；清理后重新验证真实LX。保留失败性质，不用形式TEST SUCCEEDED冒充实曲证据。

最终匹配UI build/SourceUITests-1792110949807.xcresult：123.591秒通过，包括自动记录取消后废弃旧媒体/重新匹配、人工Live/取消、原身份重启/开关持久化，以及删除Nexus Matching Fixture测试源。check-online-matching-contracts.log为179项通过；归档入口拒绝覆盖和HBC测试标记可检出也已验证。正式隔离LX复验/归档仍继续。

隔离实曲验证：1792111177491的HelloWorld测试在45秒PCM等待预算内仍处于解析态，未通过；不误归为打包/解码成功。随后以公开关键词Shape of You运行原生CLI与真实Range头探测：gdstudio 128k返回HTTP206/可识别音频头（4.3秒），HelloWorld及stellarwave本次未取得URL（约15秒），均未记录私人地址。改用本次可用gdstudio，在App显式选择128k基础档做实音回归；全局高档优先仍由业务与合成App独立测试。真实音源随时可能失效，不把一次探测推广为全曲库可用。

隔离后的正式入口实曲最终通过：build/SourceUITests-1792111577110.xcresult，gdstudio/公开Shape of You/显式128k，95.548秒完成真实在线搜索→LX→原生PCM频谱→暂停→删临时源并恢复flac偏好。正式HBC无测试适配器，服务端计数无matching-audio请求；原HelloWorld失败记录保留。ND正式入口99.020秒回归已通过。本批为179项业务与合成/实曲App验收，不代替手机后台和所有真实平台。

WebDAV云端38826891584（258772e）最终成功：checks、native、7项App UI步骤、arm64/iOS27归档与上传全部通过。下载产物12016923864已校验IPA SHA256 3d19c67ffdc5f1cd3b1078aa82318e2e377a46a93a5d949dfb6eda79d1fad99b，manifest为arm64/macOS27.0.1/Xcode27.0 27A266a/iphoneos27.0/min15.1/signed=false。dirty=true如实保留；日志确认已知Intel/ARM Yoga podspec checksum差异且Pod锁版本比较通过，不称清洁云端工作树。本批构建清单新增workingTreeChanges，后续可直接定位变化文件，不隐藏dirty。S7匹配代码仍待新运行。

本批c4613a5a15ea868e03de4a709be72111c4998ee5已完成本地设备归档：archive-online-matching.log为ARCHIVE SUCCEEDED，manifest commit=c4613a5/dirty=false/workingTreeChanges=[]/arm64/iphoneos26.2/min15.1/signed=false，正式bundle无测试适配器。IPA SHA256 96f37a92ce7aeb9293e6517f7ad7603c1366e1cf91cc616ca3661f1b30f2ca8b，位于build/distribution/NexusMusic-unsigned.ipa；校验通过。源码保持清洁至归档结束；随后正常push并跟踪本批新云端，不能用上一批258772e成功替代S7结果。后续优先S7源健康/平台音质批测，S2/S3/S4/S8/S9及手机/真实个人服务等其余目标保持active。

S7 c4613a5已正常push，新云端运行[38832172978](https://github.com/RhsR1024/nexus-music/actions/runs/38832172978)已创建，当前queued；新增独立匹配App验收步骤及生产入口归档隔离，须等待实际结果。不要重跑/取消正常排队的运行；可继续下一批独立实现。当前目标active，未把本批或整个任务表标记为全部完成。

## 2026-10-16 云端 iOS27 失败定位更正与定向修复

2026-10-16 08:54（Asia/Shanghai）启动的运行 38832172978 / job 116753350795 已下载完整诊断产物 12019301035。`build/ci-38832172978/logs/ui-catalog.log:73581–73618` 明确失败为 `testWWebDAVBrowseTagsPlaybackAndRemoval`，旧 Swift 第73行等待“实时音频频谱”失败；点击 mini 时 hit point 为 {-1,-1}。失败附件 `D5173DA0-F73D-4283-A0D1-4097E23760D1.txt` 的第二窗口包含系统 `Save Password?` sheet 和 `Not Now`/`Save` 按钮，遮挡播放页入口。DAV请求计数为 propfind=8、ranges=9、authFailures=0。不能把该失败写成原生构建、网络认证、音频解码或匹配开关故障。

此前仅按步骤页面与本地独立问题把云端根因归为深设置页滚动，证据不足，现更正。自动匹配稳定 testID/短滚动是另一个已通过本地验证的问题；该运行尚未执行匹配组。测试定向处理密码建议 sheet：仅识别对应标题并选“Not Now”，覆盖关闭 WebDAV 后延迟弹出的窗口，等待播放入口可点和播放页实际打开，仍保留PCM、歌词、重启与移除连接断言。生产密码自动填充和安全存储不变。600秒诊断收集超时为失败后的额外开销。

本地和新云端验证结果按后续实际记录更新，不提前标记修复通过。上一批 `2ff7557` 的运行 38846783693 已启动，仍可能遇到旧密码建议问题。

## Git 作者与旧备份清理（2026-10-16）

新身份阶段2ff7557已push并核对远端main哈希一致；清洁本地归档通过。再次逐条比较原32提交的tree、提交说明、作者/提交者时间与父子映射一致，仅作者身份更新。已删除refs/backup/before-author-rewrite、refs/author-rewrite/main及build/history-identity中的bundle/隔离review仓库，并清理main/远端/HEAD不可达旧历史reflog；CI页面证据迁至build/ci-38832172978/page-snapshots。Codex checkpoint为tree对象而非旧作者提交，完整保留。git log --all的33条提交作者/提交者均为RhsR1024 <497334557@qq.com>。全局/仓库配置与受版本控制pre-commit双重检查已生效；人工绕过hook不在自动防错保证内。

## 2026-10-16 最新云端失败复核与统计增量

最新已结束运行 38846783693（2ff7557）中 Linux、完整原生检查及八项核心 App UI（含 WebDAV）均通过，失败发生在第二组 `testSourceHealth`。诊断产物12025830936已下载至忽略目录 `build/ci-38846783693`；`diagnostics/logs/ui-catalog.log` 和附件 `3FEB8190-2597-41AC-815A-140539B5FCA7.txt:98–110` 显示 iOS27 分享为 Popover，并存在 `PopoverDismissRegion`，ActivityListView 的远程子层不可执行下滑。失败为测试第57行的滑动定位，匹配和评论通过；未执行本次 IPA 归档，不归因为原生编译/音频/密码窗口。修正为核对JSON预览后点击实际弹出面板上方的关闭区域并断言返回原报告。d67fe40 的后续运行38848961113仍在核心App验证，不包含此分享修正，不提前标通过。

工作区继承的F34/J55播放统计已继续完善：原生playing区间的单调时钟累计、会话ID、原曲归属、暂停/切歌末段、清空与备份恢复；共享串行写队列防止恢复和聆听/历史写入互相覆盖。205项TS/类型检查通过（`build/logs/check-statistics.log`）；新增实际AVPlayer暂停/定位/会话测试与本地App复验仍在执行。统计与识曲分开，识曲、其余S2/S3/S4/S7/S8/S9及真机/个人服务仍未完成。完整目标保持active，本机仍为Xcode26.3/SDK26.2，云端为Xcode27/iOS27；不称本机有iOS27工具链。

本批正式入口本地验收：WebDAV `build/SourceUITests-1792126312028.xcresult` 88.805秒通过。首次新增ND统计断言因仍停留私人曲库未显示本机统计，已定向切至library-local；原数据库两条统计均为正值。最终 `build/SourceUITests-1792126794994.xcresult` 113.663秒通过ND真实合成播放/PCM/歌词/五皮肤/暂停定位、会话计数只增加一次及重启保留；已导出并查看统计截图。`build/logs/check-statistics-final.log` 205/205，`build/logs/native-statistics.log`完整套件均通过，含实际AVPlayer暂停计时不增长、seek后不以进度跳变累加及媒体会话一致性。最终源健康/本批IPA和新云端仍继续，不提前标完成。

源健康最终修正版 `build/SourceUITests-1792127036156.xcresult` 82.956秒通过，包含取消/六项逐档结果/JSON分享与返回报告/删除测试源；本地旧SDK使用可命中的常规sheet关闭分支。iOS27 Popover分支仍必须由新提交对应云端实测，不以本地结果代替。完整native、205项TS、正式入口WebDAV/ND与统计重启已全部通过；本批开始归档/提交push。

播放统计/分享修复阶段901954ac1dc1e54ddc444e9f1cfc0a7e4e8cd0f9已正常push并核对远端main一致。本地 `archive-statistics.log` 归档通过，manifest为dirty=false/workingTreeChanges=[]/arm64/iphoneos26.2/min15.1/signed=false，正式JS bundle通过测试adapter隔离校验。IPA位于build/distribution/NexusMusic-unsigned.ipa，SHA256 `44320925583c882859fb7621906b183531b93c0c7cde251aa80da8f1b1533612`，重新校验通过。新云端[38854140339](https://github.com/RhsR1024/nexus-music/actions/runs/38854140339)对应901954a，已创建排队；不把旧d67fe40/38848961113结果作为本批结果。接着推进S4跨平台歌词候选/人工选择等剩余并集，完整目标保持active。

S4/J38增量进行中：新增独立歌词选择层/候选预览UI、原歌词/显式自动优选/人工指定、按实际录音签名的SQLite与备份，213项类型/业务测试通过（build/logs/check-lyric-selection.log）。原歌词与缓存失败保护、可靠版本与时间轴排名、选择变化/取消及清理后的迟到结果、私人搜索主动确认、歌词变更不改变播放控制器已覆盖。App合成实音切换/重启恢复正在执行；不能提前标J38或本批双构建通过。参考与Android边界见decisions/0024-lyric-selection.md。恢复队列默认暂停且没有已解析媒体；实际录音经用户继续播放确认后再恢复其歌词绑定，不借旧自动音频匹配记录给原录音误标歌词。完整其余并集继续。

歌词首轮App `build/SourceUITests-1792127871358.xcresult` 在88.855秒的重启断言失败：自动WY逐字优选与人工TX Live预览/保存均通过，重启队列为暂停且media=null时实际录音尚未解析，正确显示原曲歌词；旧测试直接期待上次TX录音的绑定不符合实际身份边界。已将测试改为用户继续播放确认录音后验证该录音保存的选择，再暂停/恢复原歌词；不在产品中强用旧自动音频匹配记录。新一轮仍在执行。

S4歌词第二轮 `build/SourceUITests-1792128065182.xcresult` 119.756秒通过自动WY逐字、人工TX Live预览/保存、重启重新确认实际录音后恢复绑定及原歌词恢复。正式入口 `ui-lyrics-core.log` 对应ND/PCM/五皮肤（含歌词入口可达）/暂停定位/单曲偏移与统计重启111.294秒通过；完整候选/原匹配/评论/健康组继续复验。最新215项类型/业务检查通过，未修改原生音频/歌词渲染后端。

公开服务探测：`build/logs/probe-lyric-selection.log` 使用公开Shape of You关键词、真实五平台元数据/歌词接口，无私人曲目或音频请求。原歌词135行，本次自动选择返回网易122行、无候选失败提示；Node探针未配置原生KRC/QRC解码，因此本次字时间0，不宣称真实逐字跨平台或实音已验。正式ND截图已查看，发现声波核110pt歌词区被选择栏挤压，现改为该皮肤只显示当前行、其他皮肤有界2/3行，并保留44pt选择入口，最终布局复验继续。

联合组1792128501515：原有匹配200.191秒、评论19.554秒、源健康85.958秒通过；新歌词测试在搜索初始结果等待失败。失败AX附件C66ECB09显示输入值已为Synthetic match tone，但没有任何结果/错误/加载组，旧测试只输入换行，未显式点击搜索。现给真实搜索按钮稳定testID，测试明确选择网易并点搜索、滚动查找真实结果；未放宽结果或播放断言。新歌词最终复验及声波核可见性/私人搜索取消的正式ND复验继续，联合组不计全部通过。

最终正式入口 `build/SourceUITests-1792128987602.xcresult` 127.277秒通过：五皮肤暂停/定位、声波核当前歌词可点、私人曲目无自动公开匹配且主动搜索确认可取消、原生逐字/偏移、统计重启。已查看最终声波核截图，当前行完整显示。最新218项类型/业务检查通过；额外覆盖WebDAV/设备文件版本变化废弃旧选择/原歌词缓存，以及WebDAV跨实例临时版本不重复。新歌词显式搜索与WebDAV最后联合复验仍在执行。
云端901954a/38854140339已通过checks、iOS27完整native检查（含统计/DSP），目前核心App UI。旧d67fe40/38848961113已结束失败，job116813728363日志明确旧第74行ActivityListView为空可见区无法Swipe down，testSourceHealth 62.777秒失败；诊断产物12026707975。与2ff已定位分享问题一致，不归因本次歌词。901的修复分支仍等待实际云端通过。

S4/J38最终本地交付验证：`build/SourceUITests-1792129333583.xcresult` 中歌词98.717秒、WebDAV70.552秒均通过。歌词测试显式点击真实搜索按钮，覆盖原曲解析失败后的TX实际录音→暂停→WY逐字歌词优选→TX Live歌词预览/保存→重启后继续播放确认录音并恢复人工选择→暂停/原歌词恢复及测试源清理；音频身份/意图独立保留。HTTP计数确认五平台搜索、WY/TX歌词均被请求，DAV13次PROPFIND/4次Range/认证失败0；合成音频可命中已有临时缓存，不称本次真实平台实音。已看人工选择与最终声波核截图。最终`check-lyric-selection-delivery.log`为218/218，无失败/跳过。全批未修改原生后端，无新依赖或许可资产；开始阶段提交/本地生产IPA及新云端验收。其余S2/S3/S4样式字体/S7登录推荐评论识曲/S8/S9/真机仍未完成。

S4/J38阶段已正常push `92f4836eaa29c4196c3f1de0b6e75831f96eeed2` 并核对远端main一致。本地`archive-lyric-selection.log`为ARCHIVE SUCCEEDED，manifest commit=92f4836/dirty=false/workingTreeChanges=[]/arm64/iphoneos26.2/min15.1/signed=false，正式bundle无测试adapter。IPA SHA256 `67f280d3eefcfa6a1f7793521bb18b6476b8c61f40e6f2623afa9b0f26b24d77`，重新校验通过，产物仍为build/distribution/NexusMusic-unsigned.ipa。网页已确认本批新运行[38857771291](https://github.com/RhsR1024/nexus-music/actions/runs/38857771291)对应92f4836、Pending；不把排队写成云端已通过，未重复派发或重启已有构建。901954a/38854140339当前已过完整native，核心App继续。接下来继续S4深度歌词样式/实际字体导入及全局字体，保留S2/S3/S7/S8/S9等全部剩余目标与手机/真实个人服务验收，goal active。

## 2026-10-16 云端统计批次通过与歌词批次运行

网页实际确认：901954a 对应运行38854140339全部成功，checks 28秒、iOS任务54分25秒，包含原生检查、核心App、匹配/评论/源健康及设备归档上传。IPA产物12029158092为9.24MB，ZIP摘要7849f97a0c9af63e33611bfd5fd69b99f20f7585492085faed2f00757856078c；此摘要不是内部IPA校验值。诊断产物12029310935为207MB。旧分享Popover失败已由本次实际云端回归闭环，不再把旧失败作为当前修复状态。

92f4836对应运行38857771291现已从排队进入执行：checks 30秒通过，原生检查1分28秒通过，iOS27核心App UI运行中，后续歌词选择/匹配组及IPA尚待实际结束。未取消、重启或重复派发。字体/样式批次工作树仍未提交，不能把这两个运行计作字体批次通过。本机Xcode26.3/SDK26.2与云端iOS27结果继续分别记录。

成功运行38854140339的IPA已实际下载至忽略目录build/ci-38854140339/ipa，ZIP摘要与网页一致，内部IPA校验文件匹配，SHA256 8c82be090b0099aae1bfc29e7f9d534cf5ffb849696ad75dc61fd3495173199c。manifest为arm64/macOS27.0.1/Xcode27.0 27A266a/iphoneos27.0/min15.1/signed=false；dirty=true明确仅列M ios/Podfile.lock（已知Intel/ARM Yoga校验差异），不称清洁云端工作树。Info.plist/JS包与正式入口隔离已复核。

## 2026-10-16 92f4836 云端图标失败根因与字体批次归档

38857771291/116843765747实际八项核心UI中7通过、1失败（图标），不是“8项通过”。下载诊断12030142597因大文件慢，采用带校验的ZIP分段读取取得ui-catalog、完整小对象元数据及图标录屏对象；每项核对中央目录长度与CRC，未将不完整ZIP当作全包SHA256通过。证据在忽略目录build/ci-38857771291。ui-catalog.log:44348–44390为第26行isHittable失败；xcresult summary为passedTests=7/failedTests=1。

录屏icon-7.png清晰显示音枢黑金图标及正确中文名；icon-11.png显示测试盲滑入App Library。对应UISystemShellApplication AX快照只有根元素无图标子节点，不能归因图标丢失或显示名错误。定向修正为保留AX定位并按实际截图Vision识别精确“音枢”标签（置信度>=0.8），通过观察到的位置点击并必须回到App；不用固定坐标/直接activate/跳过。OCR已在失败录屏识别到精确标签且置信度1.0，本地修正版测试与新云端继续验收。

字体/深度样式本地工作树归档archive-fonts.log已ARCHIVE SUCCEEDED并验证arm64/iphoneos26.2/正式入口隔离。IPA SHA256为34589848b516f7e1ad154fa80b18b5fac31dd1bfd0ee1984e5b447f0472d435e；manifest commit=cbd80f6/dirty=true如实包含本批未提交文件，不能称最终清洁交付包，提交后再清洁归档。F37/J59计划已加入，但系统封面/收藏尚未实施，见决策0026。

本批最终本地检查：check-fonts-delivery.log为228/228通过；字体481.115秒专项/五皮肤/删除回退与重启、歌词/WebDAV回归及完整native结果保持通过。图标修正版build/SourceUITests-1792137331968.xcresult于15:56通过12.002秒，本地走AX分支；云端录屏精确OCR置信度1.0已离线核验，iOS27实际回调点击仍待新运行。准备本批阶段提交、清洁本地IPA和新云端；无系统灵动岛实现完成声明。

## 2026-10-16 字体批次清洁交付与新云端

字体/歌词样式与图标测试修复已提交并正常push `78e482785a50fdb9da01507f1f95ed50dc30431c`，远端main已核对一致。`build/logs/archive-fonts-clean.log`归档成功，`build/distribution/build-manifest.json`为commit=78e4827、dirty=false、workingTreeChanges=[]、arm64、iphoneos26.2、min15.1、signed=false；正式JS入口隔离和IPA重新校验通过。IPA SHA256 `ca6b2cd381c733bee12135df2d62106ce2f099657dc53041509a65dcf8bfd8d6`。此前dirty工作树包仅作历史证据，以此清洁包为准。

对应云端[38871835008](https://github.com/RhsR1024/nexus-music/actions/runs/38871835008)已于16:09（Asia/Shanghai）触发，16:15核对checks 28秒通过、iOS任务执行中，未提前标通过、未重复派发/取消。iOS27图标OCR分支、字体专项与IPA以本次实际结束结果为准。接着实施S10系统媒体封面/收藏；用户手机、真实私人服务与其他未完成并集继续保留，目标active。

## 2026-10-16 S10 系统媒体接入本地验收

已按决策0026亲读五参考并原创实现系统封面/专辑/媒体类型与收藏命令。SystemMediaSession复用CoverService和原LibraryStore：匹配录音用于封面文字、原曲用于收藏；独立媒体项标识跨暂停保留，换曲/停止清理，迟到图拒绝。原生like按明确期望状态处理，落库后更新isActive；App内收藏变更同步，串行写入时复核项身份，重复命令不切换。无新依赖、扩展或第二播放器。

`build/logs/check-system-media.log`为235/235通过，`native-system-media.log`完整套件及`native-system-media-contract.log`专项均通过。后者实际读取MPNowPlayingInfoCenter封面/专辑/速率与MPRemoteCommandCenter状态，覆盖暂停代次、迟到图、过期收藏、停止和受限路径；运行于macOS，不能称iOS灵动岛实测。本地iOS Release `build/SourceUITests-1792139174008.xcresult`通过Navidrome合成实音/PCM/歌词、暂停定位/五皮肤与统计重启；这仍不是用户真实Navidrome服务或系统面板实机验收。接下来本批生产IPA/阶段提交push及云端iOS27，保留后台面板/收藏入口/路由/真机与其余并集未完成项。

S10阶段 `256e935bcc23e144bba49e9f4693fbc59fe4966c`已正常push。本地`archive-system-media-clean.log`归档成功，manifest dirty=false/workingTreeChanges=[]/arm64/iphoneos26.2/min15.1/signed=false，正式JS入口隔离和SHA再次核验通过；IPA SHA256 `1ff96c79b3845c9142100d053287bbfa6b41bbcba875dcc2d39499312a3424fb`。新云端[38874981017](https://github.com/RhsR1024/nexus-music/actions/runs/38874981017)对应256e935，Pending等待字体批次38871835008完成；不重复派发/取消，未宣称云端通过。下一批S2详情搜索/排序/稳定条目多选与滑动删除先复核五参考，永久下载最后。

## 2026-10-16 S2 歌曲列表增量（验收进行中）

已按决策0027复核五参考，原创实现歌曲/歌手/专辑Unicode筛选、六种稳定排序、封面详情头与歌单卡、按独立entryID多选/筛选全选、确认后准确移除重复条目及横向滑动入口。公开详情只搜索排序已加载歌曲，完整导入仍读取原provider全量并保序；本地音频共用筛选排序。批量入队一次提交保留当前媒体和FIFO意图，避免逐条复制队列。无新增依赖或第三方资产。

`build/logs/check-track-list-delivery.log`类型检查与242项业务通过；覆盖一万条、长ID/重复条目、稳定选择、未知时长置后、失败原库保留、排序后准确删除/重启和活跃播放器批量入队不重载。实际Files导入1000首已通过，首次UI因封面加入后卡片自动无障碍名改变而停在定位；已补显式歌单名称，完整界面复验进行中。不得将本条记为全部S2或本批双构建已通过；全局歌手/专辑实体、云端及手机大字/手势等余项保留。

S2千首Files/App专项最终通过：`build/SourceUITests-1792141013648.xcresult` 92.293秒，实际导入1000首（含同一长ID重复两次）→搜索两条→选择第二条→切换时长排序仍选中→删除只减一条→清筛选999→重启仍只剩一条重复项→左滑露出按钮/确认删除至998→清理合成歌单。已导出并查看截图，数据与选择一致；未使用生产测试后门。正式入口本地音频/ND回归和生产IPA继续，云端/紧凑设备与大字手势门槛仍保留。

S2正式入口交叉回归 `build/SourceUITests-1792141307416.xcresult` 全通过：文件音频85.485秒（Files导入、专辑/艺术家、实音PCM、重启/在用拒删/移除队列后删除），ND156.455秒（合成服务实音PCM/歌词、五皮肤/暂停定位、统计与重启）。242项业务/类型及文档本地链接、diff空白/私人资源排除通过，无新增原生依赖。本批开始阶段提交与清洁本地设备归档；云端以新提交实际运行收敛。手机手势/后台、真实服务及其余S2/S3/S4/S7/S8/S9目标继续。

S2阶段 `82ad83ccd6dee23d8c770f1a6fc2b036a159b218`已正常push，远端main一致。`build/logs/archive-track-list-clean.log`为ARCHIVE SUCCEEDED，manifest dirty=false/workingTreeChanges=[]/arm64/iphoneos26.2/min15.1/signed=false；正式入口隔离和SHA再次校验通过，IPA SHA256 `915ed70c0cd0e50bee33f6710570140a0091f62da4fce98d778a8a7d3c66327c`。新云端[38878989928](https://github.com/RhsR1024/nexus-music/actions/runs/38878989928)对应82ad83c，Pending；前有256e935/38874981017等待字体78e4827/38871835008。17:10核对字体核心App步骤43分59秒已结束并进入匹配/歌词/健康组，不提前标完整云端通过。未重复派发/取消正常运行，目标保持active，接续S3图片/取色/背景。


## 2026-10-16 S3 图片资源批次中途记录

- npm run check：249/249 通过（含 tests/visualAssets.test.ts 7 项；新增取色缓存清理迟到结果测试）。
- npm run test:native：通过，含 Native visual assets passed；覆盖真实图片导入、尺寸/像素上限、GPS/EXIF 重编码剥离、稳定内容身份、颜色采样、坏图/远程 URL/符号链接拒绝和引用清理。
- 本地真实 Files/UI 测试 testVisualImagesAndPlayerBackgroundPersistence 已启动，结果待完成；尚未生成本批清洁 IPA。
- 以上属于中途状态，不能把原生/业务测试或编译成功当作图片设置、动态效果、真机和灵动岛验收。

## 2026-10-16 字体云端验证闭环

已通过 GitHub Actions API 核对 `78e4827` / [38871835008](https://github.com/RhsR1024/nexus-music/actions/runs/38871835008)：checks、完整 native、核心 App、歌词/匹配/健康组、设备归档及上传全部成功。IPA 产物 `12036329422` 已下载至忽略目录 `build/ci-38871835008`；ZIP SHA256 `37bd0c19c82451e6d3505e21f21da7d9e1dde0a1c50b78ce91e5879731290a42` 与 API digest 一致，内部 IPA 校验通过，SHA256 `c08817c2ba678842121d90ab3e56b398db095302d53d6b3954494195d1a540df`。manifest 为 arm64 / Xcode27.0 27A266a / iphoneos27.0 / min15.1 / signed=false；dirty=true 仅为已记录的 `M ios/Podfile.lock`，不称清洁云端工作树。

本批 S3 尚未提交。`256e935` / 38874981017 已过 native、核心 App 运行中；`82ad83c` / 38878989928 等待串行执行，未重复派发或取消。未连接 iPhone，手机后台/灵动岛/签名与个人服务器验收继续保留。

## 2026-10-16 S3 图片/写真本地阶段验收

`build/SourceUITests-1792145354706.xcresult` 图片专项 164.198 秒通过：实际 Files 导入两槽位、修改透明度/模糊/圆角/取色/动态开关、重启保留值与写真选择、移除共享背景仍保留写真、移除写真后重启保持空槽并回退。已查看导入预览截图。前几次失败定位为 Files 隐藏扩展名/记忆目录且导航标题会开菜单、无障碍单选角色和提交前 UI 快照；已限定实际文件单元格、使用真实角色及有界结果等待，没有跳过断言或添加生产导入后门。

正式入口交叉回归 `build/SourceUITests-1792144696895.xcresult` 中 Navidrome 项 134.037 秒通过合成实音/PCM/歌词/五皮肤/暂停定位/统计与重启；该运行图片项仍失败，不能写整组通过。最终 `check-visual-final.log` 为 250/250 业务与类型检查通过，含纯色模式不复活封面、写真与封面同时损坏时停止回退重试；`native-visual-delivery.log` 完整原生套件通过。写真背景遵循模糊设置，调为0可清晰显示；主界面图片保留主题色遮罩。无新依赖、参考图片或私人资产。

本批开始阶段提交与清洁本地 SDK26.2 IPA；云端 iOS27 以本批新提交的实际运行验证。系统媒体 `256e935` / 38874981017 已过核心 App、正在匹配/歌词/健康组；S2 `82ad83c` / 38878989928 为 pending。手机/减少动态效果/低电量/功耗与大字、真实私人服务，以及剩余 S2/S3/S4/S7/S8/S9/M10 继续保留，完整目标 active。

S3 图片阶段 `8cb083ce21fd89f4e0cea4b1403385d32c5181c3` 已正常 push，远端 main 一致。`archive-visual-clean.log` 为 ARCHIVE SUCCEEDED；清单 dirty=false / workingTreeChanges=[] / arm64 / iphoneos26.2 / min15.1 / signed=false，正式 JS 入口无测试适配器，IPA SHA256 再次核对为 `26e5202a94d8fc3b0ba08378a0dca76701fbe88a74bfa7121fa0b8a187d93a6b`。产物仍在 `build/distribution/NexusMusic-unsigned.ipa`。

本批新云端 [38886233605](https://github.com/RhsR1024/nexus-music/actions/runs/38886233605) 对应 8cb083c，状态 pending，前有系统媒体 38874981017 运行及 S2 38878989928 排队。未取消、重启或重复派发；不把先前字体云端成功计作本批通过。继续 J40/J49 迷你歌词/按钮配置等剩余并集，永久下载最后，完整目标 active。

## 2026-10-16 系统媒体云端失败定位 / J40、J49 继续

`256e935` / [38874981017](https://github.com/RhsR1024/nexus-music/actions/runs/38874981017) 已结束失败：checks、完整 native、核心 App 全通过；第二组歌词 102.481秒、匹配167.927秒、评论22.465秒通过，仅 `testSourceHealth` 第110行取消按钮不存在。未执行本次 IPA 归档。诊断 `12039714270` 已完整下载，ZIP SHA256 `7517612b3d56ad61193d7c11c05a146a94235943b20615334851c44f03ba768d` 与 API 一致。证据：`build/ci-38874981017/diagnostics/logs/ui-catalog.log:25151–25172`；附件 `F0499770-AA9A-432D-AD45-60403DF36E09.txt:24–30` 明确输入值为 `sow`（预期 `slow`）且 `health-progress=检查结束 · 6 / 6`、`health-start`已返回。检查已启动，但缺字未触发夹具的5秒慢请求；不是系统媒体编译/播放故障或检查根本未启动。600秒诊断收集超时是失败后的开销。

定向修改测试为逐字输入、断言完整关键词、显式点击开始；不扩大取消超时、不跳过取消/分享报告断言。源健康专项本地及新云端仍待复验；不盲目重跑旧提交。S2 `38878989928` 已开始，S3 `38886233605` 仍 pending，均未取消。

工作区继续 J40/J49：按钮选择/排序/默认恢复（最多四个且保留播放暂停）、复用原队列、本地收藏和可选 mini 单行歌词已编码；256项业务/类型检查通过，覆盖迁移/写失败/串行配置、录音版本/选择变化/关闭取消/迟到结果、偏移与结束回退。实际合成 ND/五皮肤/mini 配置重启/收藏/队列/歌词 UI 进行中，尚未提交或本批 IPA。参考与Android边界见决策0029。完整剩余并集及手机/个人服务继续，目标 active。

J40/J49 本地正式入口 `build/SourceUITests-1792146391692.xcresult` 284.278秒通过：ND 合成实音/PCM/歌词/五皮肤/定位/统计与重启，随后实际设置四按钮上限（第五个拒绝）、排序/歌词开关→重启→四控件可达/顺序与当前录音歌词→本地收藏往返→打开原队列仍暂停→恢复默认→移除凭据。已查看四按钮/真实歌词截图（忽略目录 `build/mini-passed`）。本批没有新增原生依赖/后端或复制参考代码；mini 歌词是有界单行文本，解析/缓冲/错误仍优先展示状态。

源健康漏字修复单独在 matching 测试入口运行中，不能把 mini 正式入口成功当作健康专项或新云端通过。本批 IPA/阶段提交仍待后续，256项业务/类型检查复验继续。

源健康修正版 `build/SourceUITests-1792146828117.xcresult` 98.538秒通过；`ui-catalog.log` 明确先断言 `value == slow`→点击 `health-start`→找到并点击 `health-cancel`，再逐字输入/断言 `fixture`→开始→六项完成/报告分享返回/删除测试源。云端 iOS27 仍需新提交实际结果，未把本地旧 SDK 当作云端成功。本批最终 `check-mini-final.log` 256/256、类型/改动文档链接/diff 空白检查通过。无新增原生模块或依赖；完整 native 沿本轮此前 `native-visual-delivery.log` 通过证据，未修改音频/脚本后端。准备阶段提交、生产入口清洁 IPA 与新云端。

J40/J49/源健康输入修正阶段 `13dc4505d7b85a8839c226173d6455d6e3e7ce37` 已正常 push，远端 main 一致。`archive-mini-clean.log` 为 ARCHIVE SUCCEEDED；manifest dirty=false / workingTreeChanges=[] / arm64 / iphoneos26.2 / min15.1 / signed=false，正式入口隔离与 SHA256 再核对通过。最新本地 IPA 为 `build/distribution/NexusMusic-unsigned.ipa`，SHA256 `7e1d996701f4c6c3ea5bee9ecc59dd0ed21634ca31180d461e5ed536509f68df`。

新云端 [38889054633](https://github.com/RhsR1024/nexus-music/actions/runs/38889054633) 对应 13dc450，pending；图片 38886233605 仍 pending，S2 38878989928 已过 native、核心 App 执行中。没有重复派发/取消或将旧失败说成已修复上云通过。接续 S8/F32 WebDAV 云备份（上传后校验、目录配置、预览恢复），F33 冲突同步另行实现；完整 S2/S3/S4/S7/S8/S9/M10 和手机/真实个人服务目标仍 active。


## 2026-10-16 S8/F32 云备份本地验证中

按[决策0030](decisions/0030-webdav-backups.md)亲读五参考后原创实现WebDAV独立版本上传、If-None-Match防覆盖、GET回读SHA256/格式验证、目录配置/逐级核验、列表/预览/确认事务恢复；账号凭据沿Keychain，JSON不含连接/音源/音频/外观资产。关闭/取消/凭据变化使旧网络结果失效；本机提交后不提供假取消，刷新异常明确提示检查数据。F33多设备冲突同步单独实施。

`build/logs/check-cloud-backup.log`为269/269业务与类型通过，13项云备份测试覆盖目录/Unicode、失败持久化、条件版本/回读不符、旧命名/坏格式/超限、预览不写入、明确恢复、取消/凭据变化/迟到回调和未知字段剥离。`native-cloud-backup-full.log`完整native通过，新增真实URLSession MKCOL/PUT/GET/Basic/条件请求/32MiB UTF8和分块上限/写重定向拒绝/读取根范围/取消；DAV多格式实音/PCM/定位回归也通过。

首次正式入口`build/SourceUITests-1792148588101.xcresult`云备份165.110秒通过：实际连接→创建合成歌单→上传/回读→重启保留目录与凭据→新增本机歌单→预览/取消保留新数据→确认恢复→坏JSON拒绝→重启保留恢复结果；仅localhost合成服务，无个人备份上传。服务计数propfind8/mkcol1/put1/get4/authFailures0；附件16C64E6D-CBE3-4FE5-B78A-1FABB04884BD.png已亲看，提示/列表可读。最终生产代码与WebDAV播放联合回归、本批清洁IPA和新云端尚在进行，不能提前标记双构建或个人服务/手机验收完成。


## 2026-10-16 S8/F32 最终本地阶段验收

最终正式入口 `build/SourceUITests-1792149512343.xcresult` 两项通过：云备份211.860秒、WebDAV音乐75.501秒；覆盖真实localhost连接/条件上传/回读、重启保留目录、预览取消不改数据、确认恢复、坏JSON拒绝与再次重启，以及DAV标签/解码/PCM/定位/删除连接。服务计数backup=PROPFIND8/MKCOL1/PUT1/GET4、DAV=PROPFIND15/Range6，认证失败均0。已亲看最终备份预览截图；269项业务/类型复验 `check-cloud-backup-delivery.log` 全通过，完整native沿 `native-cloud-backup-full.log`。

已核对origin为RhsR1024/nexus-music、远端main=a16590f；diff/私人资源排除检查通过，准备本批提交与清洁本地IPA。本批云端尚未触发，不把旧运行成功作为F32通过。S2云端38878989928已失败：完整native通过，核心App十项两失败，分别为字体测试暂停控件与千首列表筛选计数；CRC/长度已核验的单项日志位于build/ci-38878989928/verified，完整ZIP尚未下载结束，不宣称完整摘要通过。S3运行、mini排队继续跟进；F33同步、永久下载和全部其余范围仍保留。


## 2026-10-16 F32 清洁本地交付与云端排队

云备份已提交并正常push `a0ee5bbaafea05bed314f0519f6ab793fbd70d8e`，远端main复核一致。`build/logs/archive-cloud-backup-clean.log`为ARCHIVE SUCCEEDED；manifest commit=a0ee5bb、dirty=false、workingTreeChanges=[]、arm64、iphoneos26.2、min15.1、signed=false，正式入口隔离检查通过。IPA SHA256再次核验为`4770c0e19e07feb3067ce0d75cba19d2c4c50a8e7755d3b9d80cfbe35c54ad35`。本机仍是Xcode26.3/SDK26.2。

对应云端[38894434005](https://github.com/RhsR1024/nexus-music/actions/runs/38894434005)为pending；8cb083c/38886233605运行中、13dc450/38889054633排队，未取消或重复派发。旧S2/38878989928的字体暂停与千首筛选两项失败继续诊断/修复；F32个人WebDAV、F33同步、iPad和所有原计划余项仍保留，不能将本地归档等同云端或手机通过。


## 2026-10-16 S2 云端两项失败证据与定向修正

旧运行38878989928/116926990234的完整native通过，核心UI为8通过/2失败。CRC和长度已核验的xcresult小对象、日志及列表录屏位于忽略目录build/ci-38878989928；未把部分ZIP当作完整SHA256通过。

千首列表录屏playlist-68.png显示导入1000首且两条Duplicate fixture存在；playlist-75.png明确搜索框为`dplicate`，漏了u，筛选0条符合该实际关键词。原测试单次typeText("duplicate\n")不核对值，现两次搜索均逐字输入并断言完整duplicate，再保留筛选/排序/精确重复移除/滑动/重启断言。

字体失败AX只剩私人专辑页、无mini/播放页，日志显示实际PCM后等待/滚动跨过12秒fixture自然结束。现将合成ND真实音频字节、duration和第二行歌词终点统一为120秒，为跨皮肤/字体交互提供足够播放时长；仍保留实际PCM、暂停、定位保持暂停、歌词与五皮肤断言。自然EOF另有原生引擎测试，不延长生产播放或伪造暂停。修正版本地复验和新云端仍待结果，不提前标云端修复通过。


本地定向修正复验：字体专项`build/SourceUITests-1792150852780.xcresult`通过692.479秒（1/1，零跳过/失败），千首列表`build/SourceUITests-1792151687456.xcresult`通过85.840秒；269项业务/类型`check-ci-fixtures.log`通过。字体流程涵盖ND/歌词/五皮肤/mini/字体移除回退与重启。核对计数发现该次播放复用了既有临时音频缓存，因此未把它写成新120秒字节实际网络验证；另在专用UI模拟器仅清理NexusAudio缓存后执行正式ND专项，新增解码时长2:00断言，结果继续记录。没有清除音乐库或私人资源。


2026-10-16 20:01（Asia/Shanghai）再次核对S3/38886233605：核心App步骤10于19:43:49完成成功，歌词/匹配/健康组步骤11于20:00:48完成成功，当前进入设备IPA归档步骤12；尚未完成产物上传，不提前记完整运行成功。13dc450和a0ee5bb仍按正常队列继续。


冷缓存正式ND专项`build/SourceUITests-1792151863360.xcresult`最终通过313.986秒（1/1，零失败/跳过），真实stream请求4次、认证失败0；实际解码2:00、PCM、暂停定位/歌词/五皮肤/统计/mini配置与重启全部通过。日志与计数已单独保存ui-navidrome-cold-fixture-fix*。这补齐新120秒夹具的冷读取证据，不使用旧缓存或只信元数据。开始本批阶段提交、清洁本地IPA和新iOS27运行；旧失败保持历史结果。


S3云端`38886233605`已完整成功：checks、核心App、歌词/匹配/源健康、iOS27设备归档及IPA上传均成功。IPA artifact `12044676745`完整ZIP按API digest `c73abdc080c2db0752cc49c588875d4c5d70988983708f1fc19cf42d209388a6`、ZIP中央目录CRC/长度校验；内部IPA SHA256 `82da13216a67e66114e572b0a13677a0942b449c3260ca95aeac08177d647f15`。manifest为arm64、Xcode27.0 build27A266a、iphoneos27.0、min15.1、signed=false；manifest如实记录`dirty=true`且唯一工作树变化为`ios/Podfile.lock`，不能称清洁云端工作树。该结果证明本批iOS27 CI构建/测试/归档成功，不替代签名或真机验收。


## 2026-10-16 S2定向修复提交与新双构建

定向修复已提交并push `7c120231ce8cc4ba105b3088f3e170b5427cacf9`，远端main一致：列表搜索改逐字输入并断言实际值，Navidrome UI夹具改为真实120秒音频/元数据/歌词，补充冷缓存2:00解码断言。269项业务/类型通过；字体专项692.479秒、列表专项85.840秒、冷缓存ND专项313.986秒均通过，零失败/跳过。清洁本地归档`build/logs/archive-ui-fixture-fix.log`成功，manifest dirty=false、arm64、iphoneos26.2、min15.1、signed=false，IPA SHA256为`ed985f8c362d2ea71a2c6d3740f9c2ff613b375c7ed4d52d6747a692445ddf17`。

新云端[38899071423](https://github.com/RhsR1024/nexus-music/actions/runs/38899071423)对应7c12023，当前pending；13dc450/38889054633正在执行，未取消或重复派发。云端运行成功前不把本批修复记为iOS27通过。

## 2026-10-16 S8/J56 横屏与平板自适应本地验证

当前工作区在 `dc3bb66` 上补齐基础响应式壳：`app.json` 开放横屏并支持平板，iOS `Info.plist` 增加横屏方向；主壳在宽屏使用安全区域侧栏、最大内容列和播放器区域，窄屏保留底部导航；发现页按窗口宽度和 `fontScale` 计算 1–4 列。代码没有新增音频、队列或原生依赖，设计见 `docs/decisions/0031-adaptive-ipad-layout.md`。

本地证据：`npm run typecheck` 通过；`npm test` 269/269 通过；本地 iPad Pro 13-inch 模拟器 universal Release `xcodebuild` 成功，已安装启动并查看 `build/ipad-portrait.png`、`build/ipad-dark.png`；更正：当时原生设备族仅1，此截图不能作为分屏或原生平板验收。生产 `npm run ios:archive` 也已成功，`build/distribution/NexusMusic-unsigned.ipa` 为 arm64、iphoneos26.2、min15.1、signed=false，SHA256 `0bc8ef6f7ec88d84ad5a2ebf9df34a9a57e708d09867d3a95f84d0f714502d56`。宽屏侧栏、旋转、分屏切换、键盘、大字、无障碍和真机仍是验收缺口。

本批提交并推送为 `dc3bb66` 后，新云端 [38902069374](https://github.com/RhsR1024/nexus-music/actions/runs/38902069374) 已创建并排队；此前 `38889054633`（13dc450）、`38894434005`（a0ee5bb）、`38899071423`（7c12023）仍按原队列跟踪。不把排队或本地结果记作 iOS27 通过。


## 2026-10-16 F33最终本地联合验收

正式入口`build/SourceUITests-1792158625194.xcresult`三项全通过、零失败/跳过：同步222.425秒（含实际全选替换目录及两侧版本预览）、云备份204.159秒、DAV实音70.122秒。计数备份/同步合计PROPFIND17/MKCOL2/PUT4/GET11、模拟远端编辑1，DAV PROPFIND15/Range6，认证失败均0。296项业务/类型及完整native通过；首次冲突截图亲看，最终附件已导出。修正版保留取消/恢复/坏文件/重启/PCM/移除断言。阶段提交、清洁本地SDK26.2 IPA和新云端继续，不将合成服务当真实双设备/私人服务。

按全部F01–F37/J01–J59工作量加权：代码约75%（75.35%），整体交付约57%（56.65%，区间51%–61%），见[PROGRESS_ESTIMATE.md](PROGRESS_ESTIMATE.md)。同步新增证据与iPad设备族缺口同时计入，不按功能项或测试数量计算；全部目标仍active。下一批先修正主App iPad设备族，再继续真实宽屏/旋转与其余S2/S3/S4/S7/S8/S9，永久下载最后。


## 2026-10-16 F33阶段提交与双构建

三方同步已正常提交/push `26830dfde3e8243ae8eb845a98f54f792dbc6756`，远端main复核一致。`archive-sync-clean.log`为ARCHIVE SUCCEEDED；manifest commit=26830df、dirty=false、workingTreeChanges=[]、arm64/iphoneos26.2/min15.1/signed=false，正式JS入口隔离通过。IPA SHA256 `b14c0f058a7904405a68795d972a602d0a465bb34f0e5c67e7d04a3f9d173f7e`已再次校验，另保留于忽略目录build/local-sync-26830df。新云端[38913246781](https://github.com/RhsR1024/nexus-music/actions/runs/38913246781)为pending；F32/38894434005运行中，既有串行队列不取消/重复派发。

下一批修正主App iPad设备族（目前仍仅1）与RN弹窗横屏支持，验证真实宽屏/旋转。代码约75%、整体交付约57%，不将新排队或unsigned包计作真机/签名验收；F33自动触发及真实双设备/私人服务、全部其他余项仍保留，目标active。


## 2026-10-16 原生iPad窗口与旋转阶段验收

主App Debug/Release设备族已改为1,2，共享Modal允许四方向，发现网格改按实际容器宽度；归档校验新增读取UIDeviceFamily防回归。296项业务/类型检查通过（check-ipad-delivery.log），脚本语法和diff空白检查通过。

本地Release专项 `build/SourceUITests-1792160728178.xcresult` 48.992秒通过：实际iPad idiom、635点系统窄窗口底部导航→通过系统真实Zoom-button扩大→宽屏侧栏/隐藏底栏→搜索内容与实际窗口横屏旋转→同步弹窗转回竖屏并关闭→发现区域在侧栏右侧且不越界。已查看竖屏侧栏、横屏搜索及弹窗附件（build/ipad-rotation-passed）。首次宽屏断言失败保留，系统AX窗口控制和实际交互完成前未将其记为通过。

手机交叉回归 `build/SourceUITests-1792161115531.xcresult` WebDAV83.124秒通过，含真实合成服务解码/PCM/暂停定位/重启/移除连接；PROPFIND15、Range4、认证失败0。未改音频/脚本原生后端，没有新依赖或复制参考资产；完整native沿本轮native-sync-full.log证据。CI新增独立iOS27 iPad专项，尚未由本批提交触发/执行，清洁本地IPA继续。真正分屏切换、大字/无障碍、硬件键盘和真机仍保留，不能称整个F35/J56完成。


## 2026-10-16 iPad清洁交付与F32云端闭环

原生iPad修正与Sollin范围已正常提交/push `678a5ef869f6a5c1a5f1575d8661b15638aca4ab`，远端main一致。`archive-ipad-clean.log`为ARCHIVE SUCCEEDED；manifest dirty=false/workingTreeChanges=[]、arm64/iphoneos26.2/min15.1/signed=false，实际UIDeviceFamily=[1,2]、正式入口隔离与IPA SHA256校验通过。IPA SHA256 `f3c02028e0e3aaa5307ad43f2092b29a1f0114ee91d18a110890f4c789e9c286`，包另保留于忽略目录build/local-ipad-678a5ef。新云端[38924137682](https://github.com/RhsR1024/nexus-music/actions/runs/38924137682)为pending，独立iPad专项尚未执行。

F32 `a0ee5bb`/[38894434005](https://github.com/RhsR1024/nexus-music/actions/runs/38894434005)已全部成功：checks、完整native、核心App、歌词/匹配/健康、设备归档与上传。产物12053367117实际下载到build/ci-38894434005，9,768,014字节ZIP SHA256 `5c4404c9832fa88911e07e8ab1a4514164aa5e3606f805df0a7e425bd4ad8cf0`与API digest一致；所有ZIP/IPA CRC、自带摘要、正式bundle无测试适配器与xctest检查通过。内部IPA SHA256 `9028c67e56d992fdc01710c0d19d446ad1edd4b0e7b8fb4da499ea107461c020`，arm64/Xcode27.0 27A266a/iphoneos27.0/min15.1/signed=false。dirty=true唯一M ios/Podfile.lock，旧设备族[1]不用于新iPad验收。核验摘要见忽略目录verification.json。

7c12023/38899071423已过checks/native，核心App运行中；其后dc3bb66、26830df及678a5ef等按原队列等待，未取消/重复派发。文档或旧包不能替代新提交的云端结果。
