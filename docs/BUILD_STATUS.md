## 2026-10-24 b61e09d 清洁归档与同步边界

代码提交 b61e09ded558092006f374ce4ef086019e7ac536 已本地保存。清洁归档 ARCHIVE SUCCEEDED；manifest dirty=false/workingTreeChanges=[]，arm64/iphoneos26.2/min15.1/设备族[1,2]/unsigned。IPA SHA256 f1612e9480ff1bb42e499e02007ea950d7f8ffef3e399cbf634d729e1d8e6dd0；ZIP CRC、测试适配器排除、23份私人原始脚本字节均不在bundle的核对通过。当前包与收据保留 build/local-shared-actions-b61e09d-20261024。511业务/类型、完整native、最终真实源App 1/0/0及前段菜单2/0/0见[回执](implementation-shared-song-actions-2026-10-24.md)。签名/真机与全源全档位仍未验。

origin仍为git@github.com:RhsR1024/nexus-music.git。ls-remote与正常push均因Permission denied(publickey)失败；agent无身份，按既有Keychain流程尝试加载也未成功。未创建新密钥、未改全局认证、未force push。本地提交保留，不能称远端已更新或本批CI通过；成功push后的远端SHA/队列核对尚待。阶段首次及收尾磁盘检查均已执行，收尾约38GiB可用；本批未做缓存或证据删除。

## 2026-10-23 黑胶阶段清洁归档及push回执

2326f4e已正常push到RhsR1024/nexus-music。`build/logs/archive-vinyl-pivot-20261023.log` ARCHIVE SUCCEEDED、verify-archive通过；manifest commit2326f4e9810d585119e0b082e54da086281ddfb3、dirty=false、arm64/SDK26.2/unsigned，SHA157187638b29ff70303d72e5db43179189db512aa604674208736ff777759d18。IPA SHA5813f8fe0c981df15ba84635ecb79da8f136134a311d33a9fe43d3ebadee160a，ZIP CRC通过，正式bundle不含vinyl-capture-entry/夹具初始化错误/online-adapter-fixture标记。本机不冒称iOS27、签名或真机。

新运行39943967819/2326f4e pending，39936859121/4206985仍in_progress；实际1运行/1排队，不取消或重派。前一有效distribution完整迁至build/pre-vinyl-pivot-distribution-20261023，73641040字节，IPA 6ad37083…保留；回执build/logs/archive-rotation-vinyl-pivot-20261023.json。使用中的缓存、样本、scope/Evidence未清理。磁盘约20GiB，仍需按既定保留策略轮换；没有为腾空间盲删证据。

下条为归档前历史记录。

代码447fe25已本地提交。r18正常入口Release1/0/0（SourceUITests-1792751971665）；r19b同内容采集1/0/0（1792753078367）和507检查通过，见[回执](ui-spec/vinyl-shadow-r19-2026-10-23.md)。完成本条文档提交后做清洁unsigned归档，再正常push。本机SDK26.2，云端iOS27、签名与真机独立待验。云端39926166155/e3f4b9c终态19/3/0，4206985运行，不取消运行中任务。

## 2026-10-23 iOS27 Files无Cancel分支

39915726008/4a21c8e首组21/22，音频已过，仅背景图片在仅认Cancel的就绪断言误报；失败层级实际已有可用目标cell。修复后本地Release1/0/0、sourceUnchanged=true、507检查；[证据](ci-files-navigation-2026-10-23.md)。e3f4b9c云端运行不含本修复，保持执行；新对应终态待。

## 2026-10-23 黑胶清洁本地归档

2c07e90清洁unsigned归档成功，arm64/SDK26.2、IPA SHA6ad37083…、CRC及正式入口标记检查通过；r11正常导航1/0/0，507检查/native通过。详见[证据](ui-spec/vinyl-r8-conic-2026-10-23.md)。新云端/签名/真机与静态90%仍待，不作替代。

## 2026-10-23 黑胶集成验证

Release模拟器正式导航 `SourceUITests-1792741979250.xcresult` 1/0/0、sourceUnchanged=true；507业务/类型和native通过，详见[回执](ui-spec/vinyl-r8-conic-2026-10-23.md)。清洁设备归档与本提交新云端待；不替代静态90%、签名/真机或真实服务。

## 2026-10-23 Files云端失败修复本地通过

两次云端首组均20/22，Files目录操作菜单误点与恢复目录/Browse、Open确认已在测试层修正。r3 Release2/0/0、sourceUnchanged=true，499检查及Swift parse通过。见[修复与证据](ci-files-navigation-2026-10-23.md)。本批待正常push/新iOS27；黑胶实验仍未提交，UI静态仍2/5，真实服务/签名/真机继续。

## 2026-10-23 私人FM低水位续批与经典r53负证据

`npm run check` **499/499**（typecheck+业务测试，0失败/0取消，exitCode 0），日志`build/logs/check-fm-station-20261023.log`，SHA-256 `5580e324764923df93f440c42f16ef6e59865d98546d5a2510b8774c5ff08ea6`。新增`AccountFmStation`与7项测试：FM剩余`<2`时单在途预取、按歌曲身份去重、只追加权威队列、同当前曲目最多成功追加一次、失败60秒退避、空/全重复耗尽；账号revision/会话/队列归属变化或用户改队列取消迟到批次。正式FM主按钮与行播放已接入，面板布局/文案未改，不重跑UI截图，不声明UI整页90%或工程百分比提升。

经典r53将active line合成加粗扩散从`.1`提高到`.26`后，歌词区SSIM **79.4218%**/ΔE **5.3467**，低于r49的79.52%/5.34；产品恢复`.1`，只保留注释和[负证据回执](ui-spec/classic-4854-r53-active-embolden-2026-10-23.md)。Phase 0仍 **2/5**（4855/4856），下一批转4851黑胶与4861 AM歌词冻结锚点/关键区。

FM回执见[platform-fm-station-2026-10-23](platform-fm-station-2026-10-23.md)。云端仍以API为准：`39892842558/cf31064`运行、`39895020303/e0b61c1`排队（1/1）；本批不取消运行中任务，推送前等pending转入running。真实账号网络/音频、本批云端iOS 27、签名与真机仍待。

## 2026-10-23 平台登录/日推/FM纵向批次

本地`npm run check` 492/492（typecheck+492业务测试），日志`build/logs/check-platform-ui-20261023.log`。正式入口Release模拟器UI `build/logs/account-recommendations-20261023-r3b`：xcresult `build/SourceUITests-1792725802476.xcresult`，1通过/0失败/0跳过、71.079秒、`exitCode:0`、`sourceUnchanged:true`、运行前后`diffSha256`一致`6c812c53…`（基线9f40879＋运行时代码/测试diff，回执文档写于运行后）、源码digest `ac653e50…`、fixture `2a3f82c2…`、resultInfo `ee9cbab1f0241486563beccd00d439fef15a6d5d0634fd4ce9f01feb54779853`、安装包digest `240955de…`、JS `f3289f0c…`；Xcode 26.3/17C529、模拟器iOS 26.3.1，不是iOS 27。截图`build/ui-screenshots-account-recommendations-20261023-r3b`两张已亲看并记录SHA-256。r3因shell未加载Xcode工具链在构建前失败，目录保留为负证据；r2通过但运行期间文档变化导致diff哈希不等，由r3b取代。

实现范围与未完成边界见[平台回执](platform-daily-next-batch-2026-10-23.md)：鉴权传输、日推官方endpoint、私人FM取批/不喜欢、旧账号兼容、正式UI入口已完成本地验证；真实账号网络验收、实际音频播放、云端iOS 27终态、Apple签名与真机仍未通过；FM低水位续批已由顶部2026-10-23批次补齐。本批不声明UI整页90%或项目百分比提升。提交/push后按single队列跟进云端，不取消运行中任务；旧`cf31064/39892842558`运行状态以push时API为准。

## 2026-10-23 高清封面r47与P3阶段回执

封面512/1024两档与P3 LX初始化预算已实现并验证：`npm run check` 474/474、`tests/lx-adapter.test.ts` 8/8、原生`CoverCacheTests`通过。r47 Release正式采集manifest `exitCode:0`、`sourceUnchanged:true`、外部scene/cover `unchanged:true`，`provenanceReady:true`；visual-lab封面98.825%/ΔE 1.392/ink r 0.994，整页95.03%、控件93.91%，仅歌词78.41%/5.60未过。r45因采集中编辑源码作废为诊断；r46在构建前因未加载工具链环境失败并保留目录，未覆盖。r44标点试验为负证据，产品恢复原标点。缓存实检924×924 JPEG（248548B）。

CI现状：39879388063/27e19b7仍in_progress，39882388385/e73473b唯一pending（1/1）。39837345526/6f2e413于step10失败，为已记录的录制时序问题，已有11秒延迟复验通过证据[ci-recorder-timeout](ci-recorder-timeout-2026-10-23.md)，修复已含于27e19b7，待终态。本轮无新本地iOS27归档声明；本机SDK26.2不冒充iOS27，真实服务、签名与真机仍待。下一次push后旧pending由single并发自动替换，不手动取消运行中任务。

## 2026-10-23 同秒采集阶段回执

e73473b已正常push。测试/文档阶段本地R41c/R43各1/0/0，源码相同、实际04:26/04:44，状态栏下零差异；465检查通过，17.5pt试验暂撤回并保留逐字反证。该阶段未改产品代码，无新增device archive声明，沿用27e19b7产品归档的有限证据。push后API核对39879388063/27e19b7运行、39882388385/e73473b唯一pending，1运行/1排队，未取消运行中或重派旧版；新iOS27终态、真实服务/签名/真机待。见[UI回执](ui-spec/classic-time-and-font-r41-2026-10-23.md)。

## 2026-10-23 经典字重与录制时序阶段

经典900/700字重与外部输入摘要接线完成；465检查、同输入独立r38/r39各1/0/0且状态栏下零差异，r40两行邻态1/0/0。全v3七区6过/歌词失败，Phase0仍2/5，代码75.1%/交付53.0%不变。[报告](2026-10-23_reverse-sollin-classic-font-report.md)。云端6f2e413失败保留；录制屏障改序经11秒延迟App1/0/0+录屏10中间帧通过，[失败与修复证据](ci-recorder-timeout-2026-10-23.md)。27e19b7清洁本地归档/包校验已过并正常push；云端39879388063运行、0排队，终态待验；随后继续字体度量/同秒、封面高清分层和P2余项/P3–P5、平台登录日推FM。

## 2026-10-23 26f69df云端iOS27完整成功

[39811557009](https://github.com/RhsR1024/nexus-music/actions/runs/39811557009)/26f69df completed/success：checks、Pods、native、第10步核心22项、第11步在线/歌词/健康/发现等5项、第12步断服务离线1项均通过，共28项App测试；归档/上传成功，失败附件按条件skipped。compact logs原ZIP SHA256 a0ea197e8eae37a507043f25a08b83fbeb1841786c5ea88897c9220ee5f98788，已CRC核验并逐组读取终态，不重复统计ui-catalog与ui-downloads同一用例。

IPA artifact12450714454外层ZIP SHA256 35318cb81a798d55c2575c4fb1ccabc49716feba66da747d36e3d5509a62cd23，与GitHub一致。IPA SHA256 3e80ea47d46f7e24d56bdb3003a94be741a3560abd4556f441df48bdc9cb46fb，11,633,900字节；83条目CRC/附带SHA、arm64入口、com.nexusmusic.app与非空生产JS、所列测试标记/私人资源路径排除通过。产物/日志ZIP/verification留build/ci-39811557009；未下载623MB全诊断重复包。

manifest为Xcode27.0/27A266a、macOS27.0.1、arm64/iphoneos27.0、min15.1、设备族[1,2]、signed=false。dirty=true有Podfile.lock与project.pbxproj两项，不能称云端清洁归档；JS SHA256 6ecf32d81b31d685f11725a732783d3b62a13d4fd44dabcd78473f6625a0edd6。仅覆盖26f69df（含早先经典封面顶边等改动），不覆盖后续标题/跳曲或parse P1/P2，也不代表真实私人服务、签名/真机。最新6f2e413/39837345526现in_progress，0排队，继续跟进。

## 2026-10-23 P2结构化歌词阶段归档

6f2e413正常push，check463/463；增强时间/坏词回退/Guest先入后切主唱专项App r3 Release1/0/0，三图已亲看，末次agent.role类型保护单独业务验证。精确来源与未完成边界见[P2回执](parse-structured-p2-2026-10-23.md)。CI step11已增加该独立正式组件场景；新iOS27运行39837345526/6f2e413 pending，39811557009/26f69df仍运行，保持1/1，未手动取消或重派。

清洁本地unsigned归档成功：6f2e4138b239f9861e804a22e30cb70792ec9356，dirty=false/changes=[]、arm64、Xcode26.3/iphoneos26.2、min15.1、设备族[1,2]。IPA SHA256 babad1a8145e50b9476e100d6cec9188ceb251a1cb4a9d94634e9f80d5c31965，12,275,434字节，83 ZIP条目CRC/附带SHA、正式JS与xcarchive字节一致、arm64入口及所列测试标记/私人资源路径排除通过。JS SHA256 9ad06ca239ac8ccaba67815dafdc6964b9e714ae6325ce267605b29b67b16f40。包/manifest/verification留build/local-p2-6f2e413-20261023；前一2987f1f分发完整保留至build/preserved-distribution-2987f1f-20261023，无删除。

阶段检查磁盘约14GiB余量，build23G/work246M；本轮无Xcode运行时清理，必要逆向和失败原始证据保留。上述本机SDK26.2不冒充iOS27；真实服务器、稀疏cue逐字动画、通用格式统一预算、P3–P5、UI整页/主题遮罩与签名/真机仍待，不增加项目百分比。

## 2026-10-23 日推隔离与Parse P1清洁归档

7bad024补日推真实仓储/缓存/clear/逆序请求隔离，2987f1f补歌词多格式回退与合成App验证。check450/450；App初采0/1/0因皮肤自动关闭竞态，明确等待后复验144.889秒1/0/0，未降低歌词/逐字/设置断言。完整parse清单P1–P5见[执行清单](parse-completion-checklist-2026-10-23.md)，P2–P5仍待，日推正式鉴权协议/UI/真实账号未完成，不增加工程或UI完成量。

2987f1f清洁本地unsigned归档成功：manifest dirty=false/changes=[]、arm64、Xcode26.3/iphoneos26.2、min15.1、设备族[1,2]。IPA SHA256 `5747e348adb9ef18e8a25792a2ebd2273e71fdb517e7784ddff67f5fd60db381`，12,272,623字节；83条目ZIP CRC/附带SHA、arm64入口、正式JS与xcarchive字节一致、所列测试标记与私人资源路径排除通过。JS SHA256 `a2b42c17fac331627e0665ad47db1cc3e13e04319df90280e0d5541fbf1b2198`；包/manifest/verification留build/local-parse-2987f1f-20261023。旧30f1874分发完整保留至build/preserved-distribution-30f1874-20261023，无删除。

正常push后39833088582/2987f1f最新pending、39811557009/26f69df运行，1/1；旧30f1874 pending由队列自动取消，不算通过。新代码iOS27终态、真实服务、签名与真机仍待。本地SDK26.2不冒充iOS27。

## 2026-10-23 30f1874 经典细节清洁归档

提交30f18740bfe219f14189e4d2a508ae12a4ed2053本地unsigned归档成功：dirty=false/changes=[]、arm64、Xcode26.3/iphoneos26.2、min15.1、设备族[1,2]。IPA SHA256 `1517c29108c436a337963c0e50c064097a8a65e75b1158705c04467d58bd95fd`，12,271,810字节；83 ZIP条目CRC、附带SHA、arm64入口、正式JS与xcarchive字节一致及所列测试标记/私人资源路径排除通过。JS SHA256 `b1c1d203e72fb977d410df5f1fd54bf786fdc80409f6eb0fd7a479826a6a47aa`。包/manifest/verification留build/local-classic-30f1874-20261023；旧distribution按4640a5提交完整保留至build/preserved-distribution-4640a5-20261023，无删除。

本地r29/r30/r31快速场景各1/0/0，r30正式导航综合1/0/0且五个主要画面已亲看；439检查通过。该导航的不同内容/滚动/进度截图不作固定主题颜色评分；完整主题遮罩专项、整页素材/量表与动效仍待。证据详见[字形回执](ui-spec/classic-4854-r31-2026-10-23.md)。

正常push后实核：39811557009/26f69df运行，39829873074/30f1874最新pending，41ecbd1旧pending自动取消；保持1运行/1排队，无手动取消或重派。本地不是iOS27；新云端终态、真实平台服务/Apple签名/真机仍未通过。工程估算和静态完成态本轮不加分。

## 2026-10-23 ab91c63 iOS27完整成功与产物核验

run39800510821/ab91c63已completed/success；checks、iOS27工具链、Pods、native、第10步核心App、第11步匹配/歌词/健康/发现、第12步断服务离线、第13步unsigned设备归档及上传全部success，失败附件上传按条件skipped。不包含后续99cf969起UI改动，不外推新代码。

IPA artifact12442029450已实际下载。外层ZIP11,557,779字节，SHA256 `2757143470035d116a31c706165043d6a607024fb51072a9286553c2571c5994`与GitHub声明一致，CRC通过；内部IPA83条目CRC、附带SHA、arm64 Mach-O、bundle ID、JS非空、三个测试入口标记排除和私人资源名称检查通过。IPA SHA256 `28ded12f27e9681f7adeccfe351c496f7bd97008597de6f13b8029eeef27bae3`。

manifest为Xcode27.0/27A266a、iphoneos27.0、arm64、min15.1、设备族[1,2]、signed=false；dirty=true包含Podfile.lock和project.pbxproj，不能称清洁归档。核验包/清单/收据位于build/ci-39800510821，未下载653MB全诊断重复包。Apple签名、真机与真实私人服务仍未验收。后续26f69df/39811557009已运行，终态另验。

## 2026-10-23 产物可用性校正与定点清理

本机原xcresult 1792307572879、1792268779844、1792132828517、1792319723943当前均不存在，无法由现有回执确认何时移除。历史“原始结果保留”描述不再代表当前可取；对应classic-modal/offline-hittability/fonts-sixth/failure-exports附件目录继续保留，不整目录删除。

已在xcodebuild结束后逐项重算SHA256，仅删除failure-exports/SourceUITests-1792319723943/0-fS3rsz中28个与failure-evidence/SourceUITests-1792319723943/0保留副本完全相同、且export-index标included的文件，共55,494,574逻辑字节；保留副本在删除后再次重算一致。目录/其他视频/快照/索引/日志未删除。详细路径、字节、理由、SHA与保留位置见build/logs/cleanup-20261023-verified-duplicates-{plan,receipt}.json。原包缺失的其余证据不可继续清理，reverse case与最新阶段产物未动。磁盘仍约14–15GiB，本次小规模去重不称已解决空间不足。

## 2026-10-21 942105c 原生双击测试语义修正

`fa8ddd7/39516000415`与`2bc2a63/39531808260`的iOS27 iPhone17均执行21项，结果19通过/2失败/0跳过，失败仍仅为AM2/AM歌词双击定位。原生手势代码正常编译；测试用两次独立`tap()`的间隔超过系统双击窗口，UIKit按两个单击处理。`942105c`仅改回`line.doubleTap()`，在独立worktree提交以免混入当时未提交的UI批次。两次失败证据ZIP CRC通过：fa8ddd7 logs/evidence SHA-256 `24722c9c8ff4c294c3e1266d652a975c395218478f175825e147b6548abc84da`/`0586f2682e9e8cd5cef8d4feebc18c971a1a2d92fc01aefcefd01e86d025adfb`；2bc2a63 `1f40554bee8c7a221d7c7f45403ce21b49492fa7012fe2f74d095a1267ab7cbc`/`56535eaec4757f57007b5c4d43420a9e3fdeb3ad09b671186646a8093e8ca101`。最新run `39590937799`执行中。

## 2026-10-21 07f81a2 原生歌词手势清洁归档

提交`07f81a28e1387f6e9ddcc052f2e559680742d52f`的本地unsigned归档成功：manifest `dirty=false`/`workingTreeChanges=[]`、arm64、iphoneos26.2、最低iOS15.1、设备族`[1,2]`、`signed=false`；ZIP CRC、测试/签名私有资源排除通过。IPA SHA-256 `a734eabb1b68528e346253183ac6b34f9755d80b95b0322a96ffe6f7b125e47c`，留`build/local-lyric-gesture-07f81a2`；IPA与xcarchive `main.jsbundle` SHA-256同为`a0809efabff20ea7311a67e1887171402a73fa79e27038cc87aa90f220815988`。本机RN0.81/x86_64原Release运行受预编译Hermes ABI故障阻断；该归档和静态/原生检查不代表云端iOS27、签名或双击真机交互已通过。云端`39499931841`（694db50）运行中、`39500726487`（07f81a2）排队，保持1/1。

`39499931841`失败证据已可取：checks、Pod安装、完整native和iOS27模拟器创建通过，Swift在`NexusLyricGestureView.swift:50`因`accessibilityActivate()`重复覆盖而编译失败，0项UI执行，后续UI/归档/上传跳过。compact logs 149401字节/SHA-256 `1e87593dbb8a8b2e2a1dfffd697e3a8a0406dd7490d2c4eac1a3b0a5a7eded96`，diagnostics 403894字节/SHA-256 `ba4f259fe845326c9e4d7a33e17dfa68f791fa94385930adf080289f0d4309be`，ZIP CRC通过；`07f81a2`已删除重复实现，最新pending待运行。

`39500726487`（`07f81a2`）在iOS27 iPhone17执行21项，19通过/2失败/0跳过；唯一失败为`testAM2PlayerWindowRotation`与`testAMPlayerWindowRotation`双击后进度未变为`0:06 / 2:00`，其余在线/离线/Files及归档前置用例通过。compact logs 555651字节/SHA-256 `a6b24a666e5f9934dee9af1077e0757ecd7bf724253f3b9fe97464dd0d3ffd07`，failure evidence 1353451字节/SHA-256 `2c847a66a1398a2bef57ddfa2991c0e3462eb93d74349fc8d1f6529d0c2382a1`，ZIP CRC通过。`fa8ddd7`按tapCount=2增加UIKit触摸结束捕获后，最新run `39516000415`执行中。

## 2026-10-21 0b4052a 最终清洁归档

提交`0b4052a04a3e08135c2cff3e6606dd29536ada29`的清洁unsigned归档成功：manifest dirty=false/changes=[]、arm64/iphoneos26.2/min15.1/设备族[1,2]、signed=false；ZIP CRC与包内JS字节一致，私人/测试/签名资源排除通过。IPA SHA-256 `d660acf22c94fe337c994f006a9483a9ff6b9fedd92e11f9d367b8ae6e1c3e7c`，留`build/local-ios27-recovery-0b4052a`。阶段清理约555MiB可重建IPA临时Payload；push及对应iOS27待。

## 2026-10-20 局部 SSIM 度量批次与干净 unsigned IPA

`testZNavidromePlaybackAndCredentials` Release 1/0/0（`SourceUITests-1792491019445`），导出 `build/ui-screenshots-batch20b`；`npm run check` 401/401（Node 24.14）。本地归档 `bash scripts/archive-unsigned.sh` 输出 `build/distribution/NexusMusic-unsigned.ipa`，11 MiB，SHA-256 `524d9924d8ab959ccba64d677b7dbcdaa7478c55f855424fb81ef8e04dbd98f9`，`build/distribution/build-manifest.json` 记录 commit `f3b3942`、dirty=false、arm64/iphoneos26.2、Xcode 26.3、minOS 15.1；`verify-archive.mjs` 通过。

脚本退出码为 2 但归档成功：`trap` 里的 `rm -rf build/ipa.XXXX` 被本机沙箱的批量删除保护拦截（57 个文件 > 阈值 50），发生在 IPA 生成与哈希打印之后，不影响产物；临时目录需另行小批清理。CI 无此保护。本机 WorkBuddy 终端还须 `export NODE_OPTIONS= PYTHONPATH=`，否则 Metro 打包因 node shim 的 broker IPC 断开报 `write EPIPE`。

视觉度量改为 7×7 局部 SSIM 后：4856 88.06→89.68（柔和 89.91）、4854 重采 78.48（遮罩封面 90.42）、4851 78.54、4855 82.89、4861 58.76、4863 63.18、4866 59.76、4867 60.40、4868 70.28、4872 44.91。旧全局统计值不再作为验收依据。

## 2026-10-21 iPhone 常态范围、完整回归与控件可比区

用户将当前视觉验收收缩为 iPhone 常态字号/常态布局，大字与 iPad 专用适配暂缓。`npm run check` 401/401；完整 `testZNavidromePlaybackAndCredentials` Release 1/0/0（`SourceUITests-1792511494373`，570.452秒）。三行测试歌词候选虽通过功能断言，但 IMG_4854 降至整屏76.20%、遮封面85.97%，已撤回。重新从未试验的`SourceUITests-1792507578198`导出两行基线（PNG SHA-256 `a06f5e40c280e6c3fe5f2c9e4834ef5e6f783bb0c7191c125eda256e6bcbeb23`），整屏78.48%/MAD30.79、仅遮封面88.94%/18.93、再遮不同文本内容后的UI控件可比区93.12%/12.47。E-049绑定三份报告和diff；93.12%不冒充整屏。CI YAML通过，自动门禁不再包含大字/iPad；reverse-skill IPA/APK strict review分别49E/41F/41P、17WI/100 timeline和3E/2F/2P，均0错误/警告。`0955e42`清洁unsigned IPA归档成功：manifest dirty=false/changes=[]、arm64/iphoneos26.2/min15.1/设备族[1,2]、unsigned；IPA SHA-256 `2a80bfa60a92a527360ea37496bbd1b13996180bcdbc1b4f279c3e40ea7e2ebd`，IPA与xcarchive JS同为`50edcba62456db741c55ec66f6ec770794b173a60713940d439e07ee3045fdd2`，ZIP CRC、arm64入口与私人/测试/签名资源排除通过，产物留`build/local-iphone-normal-0955e42`。对应iOS27 run[39457413268](https://github.com/RhsR1024/nexus-music/actions/runs/39457413268)运行中，终态待。

## 2026-10-20 4855/4856 字号层级批次

本地 Release UI 通过：`testZNavidromePlaybackAndCredentials` 1/0/0（`SourceUITests-1792485014622`），导出 `build/ui-screenshots-batch19c`（默认 032、柔和/玫瑰 031、外观首页 033）并亲看；`npm run check` 401/401；大字号/持久化回归 `testBackgroundSheetWithLargeTextAndPersistence` 1/0/0（`SourceUITests-1792484768700`）。写真单像素夹具、歌词两行夹具、默认主题与默认 accent 未改。

参考分区标题约 13pt、滑轨行标签约 15pt：`AppearanceSettings` 三个分区标题 16→13pt（上/下距 20.6/14、18.9/19.7、33.8/20.8），`VisualSettings` 小标题 16→13pt（容器 `paddingTop:2`、`gap:7.4`），`SliderControl` 行标签 17→15pt（控制行 `marginTop:2.7`）。最终锚点（pt）：视觉参数 394.3..405.3 vs 394.3..406.0，四个行标签 433.3/528.3/623.3/801.7 vs 433.3/528.3/623.3/801.3，全部 ≤0.7pt；4855 顶部标题 268.3..283.3 vs 271.0..284.0。分数：4856 默认 **44.87%/MAD 16.14**（33.57/17.37→）、柔和/玫瑰 **45.08%/11.48**（33.90/12.76→）、4855 20.41/24.08 持平。结构项（sheet 顶 59 vs 92.7pt、参考无 X、44pt 表头带、多出的底部标题、± 字形、轨道跨度）未变；除 4851 90.62% 外无页面达 90%。

云端单队列：39389962025（7492bf7）pending，不取消/不重派；真实服务、Apple 签名、真机未验收。

## 2026-10-20 4856 控件调色/卡片透明度批次

本地 Release UI 通过：`testZNavidromePlaybackAndCredentials` 1/0/0（`SourceUITests-1792481796152`），导出 `build/ui-screenshots-batch18b`（默认 032、柔和/玫瑰 031、外观首页 033）并亲看；typecheck 通过。写真单像素夹具、歌词两行夹具、默认主题与默认 accent 未改。

`controlColor` 由 accent 派生哑色（玫瑰 #854C55 vs 参考 #864D4F），滑轨填充/拇指与空轨/33 刻度按参考重做；两个色块再内缩 16pt（边框距屏幕 32pt，参考 x=96px）。外观玻璃底与视觉参数卡片底改随卡片透明度派生：30% 时柔和态卡片 #e0eaf1 vs 栅格 #dee9f1（参考 #d0e1ef/#d4e4f1，剩余偏浅来自主题渐变），默认 blush 卡片与栅格已不可分。同状态补充态由柔和/珊瑚改为柔和/玫瑰（参考字段值 #E83D56）。两态归一证据均 135.99999pt。分数：4856 默认 **33.57%/MAD 17.37**（33.44/20.85→）、柔和/玫瑰 **33.90%/12.76**（33.64/17.30→）、4855 20.09/24.18 持平。除 4851 90.62% 外无页面达 90%；sheet 顶 59 vs 92.7pt 与参考无 X 仍是结构主因。

大字号/持久化回归 `testBackgroundSheetWithLargeTextAndPersistence` 1/0/0（`SourceUITests-1792482704621`）。云端单队列：39378551259（e232a36）进行中、39383137897（4e80965）pending，按序等待，不取消/不重派；真实服务、Apple 签名、真机未验收。

## 2026-10-20 4856 滚动落点/滑轨与 4863 波形批次

本地 Release UI 两次通过：`testZNavidromePlaybackAndCredentials` 1/0/0（滚动补偿 `SourceUITests-1792477605376`、滑轨与波形 `SourceUITests-1792478387341`），导出 `build/ui-screenshots-batch16-scrollfix`、`build/ui-screenshots-batch17-track` 并亲看；`npm run typecheck` 通过、`npm run check` 401/401。写真单像素夹具、歌词两行夹具与默认主题未改。

4856 滚动归一循环此前每次被按压拖动吞掉约 10pt（目标 136 却停在 146.0），改为 `correction=delta±10` 后附件证据为 `background-gradient maxY=135.99999pt`（目标 136、参考 136.7）。字段/四行锚点收敛到 -2.7..+0.7pt；滑轨 3→6pt（参考 5.7pt）、遮罩底→模糊标签 35.7→31.3pt（参考 31.1）；分数 7.07→**28.64%/MAD 21.24**（仅滚动）→**31.67%/MAD 21.01**（含滑轨/行距）。背景页滚动 >90pt 时标题/操作淡出、关闭 X 固定；残余 44pt 表头带与 X。4863 播放指示换为 5 柱波形，36.36/38.55 持平；4866 29.11/38.82、4855 19.12/24.43 无相关改动重截一致。底色 blush `#fbf4ef` vs 参考蓝灰 `#d6e4ef` 仍是主要差距；除 4851 90.62% 外无页面达 90%。

云端单队列：39367954644（a39e8c1）ios 自 04:42Z 起 in_progress（约 2 小时无更新，疑似 runner 挂起），39378551259（e232a36）pending；不取消/不重派。39360042052 失败附件仍受 401 权限限制。真实服务、Apple 签名、真机未验收。

## 2026-10-20 AM 信息块与 4855/4856 场景批次

本地 Release UI 通过：`testZNavidromePlaybackAndCredentials` 1/0/0（`SourceUITests-1792475773655`），导出 `build/ui-screenshots-batch14-classic` 并亲看；`npm run typecheck` 通过、`npm run check` 401/401。写真单像素夹具、歌词两行夹具与默认主题未改。

4866 信息块收口：`marginTop` 32、标题/歌手间距 5、歌手 17pt、图标组 +2pt、控制容器 +5pt；锚点（pt）标题 560.7 vs 561.0、歌手 589.0 vs 590.0、进度 636.0 vs 635.7、时间 662.3 vs 664.0、传输 743.3 vs 743.3、工具 839.0 vs 840.0。整页 29.11%/MAD 38.82（噪声级持平）；遮罩封面内容区 50.17%/30.94。4863 无改动，重截 36.36/38.54 与上批一致；4872 无改动，有效对照仍是 batch5 展开态 52.77/16.26（进度填充两侧 #8F4A4E）。

4855 下半页按 3×5 重算：背景类型 578.0 vs 578.0、分段 619.7..659.3 vs 617.7..657.3、颜色 702.0 vs 701.3、两个色块下边框 793.0/877.0 vs 791.7/874.7；分数 13.23→**19.15%/24.41**。4856 滚动归一改为胶囊下缘 142pt（参考 136pt），分数 -0.49→**7.23%/23.24**；行内标签→滑轨仍比参考多约 10pt，纵向差 13–32pt，下一批先收 `VisualSettings`。两页均远低 90%，不增加已对齐页数（仅 4851 90.62%）。

云端单队列：39375131477（7d1de5b）pending、39367954644（a39e8c1）in_progress，按序等待，不取消/不重派；39360042052 失败附件仍受权限限制。真实服务、Apple 签名、真机未验收。

## 2026-10-20 经典页 4854 锚点收口本地批次

本地 Release UI 通过：`testZNavidromePlaybackAndCredentials` 1/0/0（`SourceUITests-1792473570664`），导出 `build/ui-screenshots-batch11-classic`（经典页 `A274FE8D`）并亲看；`npm run typecheck` 通过、`npm run check` 401/401。写真单像素夹具、歌词两行夹具与默认主题未改。

经典页按 4854 实测收口：歌手 17pt、进度容器 18pt 内缩与 -4.5pt 补偿、传输行 gap 24.5、工具行 25.5pt 内缩且不再下沉、脚注 -9pt。锚点（pt）：歌手墨迹顶 493.7 vs 493.7、歌词 570.3/606.3 vs 参考后两行 570.3/606.7、进度 670.7 vs 669.7、工具中心 840.8 vs 840.8、脚注 873.3 vs 874.0。SSIM（`--ignore-top 180`）74.38→**76.09%/MAD 30.79**（31.96→）；仍未达 90%，主因合成 RGB 封面/英文长文本/两行歌词夹具/纸面底色，不增加已对齐页数；除 4851 90.62% 外无页面达标。

云端单队列：39367954644（a39e8c1）in_progress、39372628064（4ffea70）pending，按序等待，不取消/不重派；39360042052 步骤 10 失败附件仍受权限限制。下一步按用户批次做 4866/4863 行距与字体层级、4872 行距、4855 卡间距；真实服务、Apple 签名、真机未验收。

## 2026-10-20 AM 队列/大封面锚点收口本地批次

本地 Release UI 通过：`testZNavidromePlaybackAndCredentials` 1/0/0（`SourceUITests-1792471759953`），导出 `build/ui-screenshots-batch9-am`（队列 `4D576F33`、大封面 `E24C2222`、歌词 `F7736FEF`）并亲看；`npm run typecheck` 通过、`npm run check` 401/401。写真单像素夹具、歌词两行夹具与默认主题未改。

修复 `am-body` 的 `overflow:'hidden'` 裁掉队列面板负边距问题后，4863 面板缩进 20pt（参考 20）、分段 204..244/40pt、行顶 258/321/328、行标题墨迹 81.7/273.3、副标题 82/296 与参考一致，行卡圆角 10、图标缘 400.7 对 400.7；新增 8 首长队列夹具并断言“· 8”与第二行可达。4866 封面态按参考改为无迷你头标题 20pt、内间距 7、marginTop 34，心形 576.3 vs 576.7、进度 644、传输 760、工具 850 对齐。分数（`--ignore-top 180`）：4863 **36.36%**/MAD 38.54（21.46/44.98→）、4866 **29.16%**/38.78（28.70/38.95→）、4861 **19.84%**/41.70（13.86/42.27→）。仍远低 90%，不增加已对齐页数；除 4851 90.62% 外无页面达标。

云端单队列：39360042052（36f3f2d）已 completed/failure，checks 成功，ios 在步骤 10“Verify source management and Navidrome playback in the App”失败，后续组/归档跳过，失败截图与诊断附件已上传但本机取回仍受权限限制；39367954644（a39e8c1）in_progress，按序等待，不取消/不重派。下一步在权限内定位步骤 10 失败；UI 继续 4855/4856 底色与滚动可比区、4880+ 未覆盖页；真实服务、Apple 签名、真机未验收。

## 2026-10-20 AM 传输键/舞台进度色/4855 3×5 收口本地批次

本地 Release UI 全部通过：`testZNavidromePlaybackAndCredentials` 1/0/0（`SourceUITests-1792468636419`），`testStageStylesAndWindow` 1/0/0（`SourceUITests-1792468410201`）；`npm run typecheck` 通过、`npm run check` 401/401。截图导出 `build/ui-screenshots-batch5-am3`（AM 封面/队列）与 `build/ui-screenshots-batch5-stage2`（舞台面板）并亲看。

AM 传输键按参考放大并下移（前后键 52、主键 68、行距 38）：前后键 734.7..763.3 vs 733.7..762.7，主键 724.7..773.0 vs 724.0..772.3；标题/进度轨/时间/质量胶囊/工具行 1–3.3pt 内。4866 **28.70%**/MAD 38.95（内容区 51.14/30.76），4863 **21.46%**/44.98。4872 **52.77%**/16.26。4855 **13.23%**/25.62（3×5 紧凑化，下半页上移约 35pt；分数受 13 vs 11 芯片行数差影响），4856 1.41%/24.19。除 4851 90.62% 外无页面达到 90%，不增加已对齐页数；写真单像素夹具与默认主题未改。

云端单队列：39360042052（36f3f2d）in_progress、39364277386（586a48d）pending；39363484535（449df0e）已 completed/cancelled（并发取消，非本机重派）。本批 push 后按序排队，不取消/不重派。下一步 AM 真实长队列与同封面背景、舞台夹具换行、4855/4856 滚动与底色；真实服务、签名、真机未验收。

## 2026-10-20 上一批：原生歌词 rgba 透明度修复本地批次

`testStageStylesAndWindow` Release 1/0/0，`SourceUITests-1792466412273`；舞台面板截图导出 `build/ui-screenshots-batch5-stage` 并亲看。原生 `NexusLyricLineView` 此前仅解析 `#RRGGBB`，`rgba(...)` 透明度全部回退为不透明白色；已补 `rgb()/rgba()` 解析（0–255 通道、0–1 alpha）及 hex 兼容。4872 SSIM **37.78→52.70%**/MAD 24.06→16.30（`--ignore-top 180`），高亮/非高亮灰度层次恢复；未达 90%。云端单队列：39360042052（36f3f2d）in_progress、39363484535（449df0e）pending，无重派。下一步重跑 AM/写真确认灰度收益，继续 4856/4855/AM 队列；真实服务、签名、真机未验收。

## 2026-10-20 上一批：4856 视觉参数卡与滚动锚点本地批次

`testZNavidromePlaybackAndCredentials` 连续三次 Release UI 1/0/0，最终 xcresult `SourceUITests-1792465509431.xcresult`；`npm run check` 401/401。4856 视觉参数整卡/分隔线/17级刻度/描边遮罩字段/步进按钮已实现，测试用 `background-gradient` 锚点把低区截图收到 110pt 并逐次沉降。SSIM（`--ignore-top 180`）：4855 14.73→**15.27%**/MAD 25.38；4856 -5.52→**1.41%**/24.19（内容区 2.38/23.10、卡面遮罩 1.28/15.44）。固定 Sheet 头、主题底色、步进按钮和 13 vs 11 芯片仍造成偏差，除 4851 黑胶 90.62% 外无页面达到 90%。写真单像素夹具与默认主题未改。提交后按单队列检查新 iOS27 run；真实服务、Apple 签名和真机验收未完成。

## 2026-10-20 上一批：AM/舞台/4855 3×5 本地批次

组合回归 `SourceUITests-1792462187452`：2通过/0失败/0跳过，舞台125.930秒、两来源播放473.780秒。最终舞台复测 `SourceUITests-1792463600128`：1/0/0、121.352秒，包含面板芯片、背景开关、进度、主控制与四套舞台样式。`npm run check` 401/401；`npx tsc --noEmit -p .`通过（含把旧`neon`默认断言改为读取`defaults.stageStyle`）。截图已从xcresult导出：4866 **19.91%**/MAD39.99、4863 **16.18%**/45.37、4872 **37.78%**/24.06、4868 26.79%/29.40、4854 74.38%/31.96、4855 14.73%/25.49、4856 -5.52%/50.43。除4851黑胶90.62%外均未达90%。

写真单像素夹具契约未修改。4855按用户要求落地13芯片3列5行；参考实际为11芯片四行，故整屏分数下降，不声明该页提升。舞台面板锚点/歌词行位已对齐到≤5pt。本批提交后按单队列检查新iOS27 run；`2cd956b`的39305209267失败诊断仍受CI日志401限制。真实服务、Apple签名和真机未验收。

## 2026-10-21 iOS27 39427267903 失败补修

对应`1fd71e8`的iOS27 run`39427267903`为29通过/2失败/0跳过，后续测试、iPad和归档跳过。已核验日志ZIP SHA-256`bbb9000b96ef7f1515bfc3fa47eaecedf778798ee0f00edfcd3ea025a8bdbb05`与失败证据ZIP`06e01e2f570bb908ef9051ab95f20aa631c57f087fe5d03d98bb9467089e2982`及CRC。背景大字号失败是标题已滚出可访问树仍被拖拽，改为固定44pt抓手下滑；舞台大字号失败是单行四芯片裁切，XXXL改为换行。本地`1792510252469`、`1792510589729`、`1792510859019`均为1/0/0。最终状态匹配截图4855 84.36%、4856 90.26%；当前没有运行/排队任务，需push后以新iOS27为准。

## 2026-10-20 外观设置 4855/4856 视觉复核

`testZNavidromePlaybackAndCredentials` Release 1/0/0，`SourceUITests-1792497763561.xcresult`，508.126秒；`npm run check` 401/401、`git diff --check`通过。默认blush/rose截图经7×7局部SSIM：IMG_4855 84.53%/MAD22.41，IMG_4856 90.25%/MAD15.08；4856该状态达标，4855仍实施中。截图、参考和diff已亲看，哈希绑定在`work/sollin-ipa/evidence/nexus-ui-verification-b21.json`，Evidence E-044 strict review为44E/41F/41P、17WI/95 timeline、0错误/警告。测试后诊断采集缺少`simctl`，发生在1/0/0终态之后。

提交`330ff9ddc18dcf2f8927a2ae0b1d55fd2029587a`的清洁unsigned归档成功：manifest dirty=false/changes=[]、arm64/iphoneos26.2/min15.1/设备族[1,2]、signed=false；ZIP CRC、包内可执行入口、IPA与xcarchive `main.jsbundle`字节一致及私人/测试/签名资源排除通过。IPA SHA-256 `ccdd754b5eb1dca3a7ff06a1e23c235c4ee6a779ced99582b7f5afa3807785dd`，留`build/local-appearance-330ff9d`。push及对应iOS27仍待；本机结果仅为iOS26.3.1模拟器和合成服务，不替代真实服务/签名/真机。

## 2026-10-20 共享播放器/背景批次与云端状态

播放器Release UI `SourceUITests-1792432689070` 416.640秒1/0/0，背景大字专项`1792432251070`148.083秒1/0/0；`npm run check` 401/401，reverse-skill strict review 43E/41F/41P、17WI/94 timeline、零错误/警告。默认主题4855/4856 SSIM为5.76%/-1.95%，未达到90%且仍实施中。最终 clean unsigned IPA留存`build/local-presentation-ui-2cd956b`，SHA256 `363aed3b1d0d6191a7ef5d8ae1a354c1df05c919adb4fdd78a2810f13a5388ef`；归档CRC/字节一致性及隐私排除检查通过。`2cd956b`对应[39305209267](https://github.com/RhsR1024/nexus-music/actions/runs/39305209267)已completed/failure：checks/native通过，首组App为28通过/3失败/0跳过，iPad/归档未执行。设置导航失败证据保留于`build/ci-39305209267`；完整CI日志artifact未能认证下载，精确根因/修复待定。当前没有运行或排队的iOS27任务；真实服务、Apple签名和真机验收未完成。

## 2026-10-20 共享播放器/背景批次本地结果（历史记录）

播放器Release UI `SourceUITests-1792432689070` 416.640秒1/0/0，通过真实AM封面/歌词/权威队列切换、单曲→随机→顺序、播放意图/时钟与截图；背景大字专项`1792432251070`148.083秒1/0/0。前一轮因旧断言二进制失败未计通过，源码重编译后本轮通过。最新默认主题截图亲看；4855/4856 SSIM仅5.76%/-1.95%、MAD29.53/31.60，远低90%，不能标记页面对齐。`npm run check`401/401与offline case strict review43E/41F/41P、17WI/94 timeline/0 errors通过。首份arm64/iphoneos26.2 unsigned IPA SHA256 `4365e247f67dd2ef9578589a8c6ffd382af2fdafe471760ae839409df8a93ba7`，ZIP/归档JS字节/正式入口及测试适配器、fixture凭据和签名材料排除均通过；构建manifest为dirty=true，因此只作为审阅产物保留。远端35ddf58 Beans Music比较/交接已merge并保留；clean unsigned归档将在最终文档提交后重建。iOS27新提交、真实服务/签名/真机未验。

## 2026-10-19 iOS27 d2d24e2 新失败待专项复验

39210631200 checks/原生通过，首组28/3/0、后续及IPA跳过；两来源仍为舞台布局污染，新增背景大字visual-motion不可达。日志/小证据包SHA与CRC已核验，[追加诊断](CI_FAILURE_2026-10-19.md)记录原Swift行与层级。背景测试已改为可见窗口交集中央拖动，保留原断言并补最终失败附件；Swift语法/diff通过，App专项/清洁IPA/提交push/新云端均待。封面本轮通过不覆盖前轮释放竞态。共享Xcode正在运行，不争用；0运行/0排队，无重派，约40GiB、无缓存删除。真实服务/签名/真机仍待。

## 2026-10-19 iOS27 39204735117 失败补修待验

56f37c0 首组 App 28通过/3失败/0跳过，checks/原生通过，后续组和归档未执行。[诊断](CI_FAILURE_2026-10-19.md)已用校验后的日志/层级确认：取色夹具 release 在超时断连后丢失；WebDAV/本地导入继承舞台而缺少经典频谱节点。持久释放状态及两来源真实设置基线已补；397业务/类型、实际分支回放、JS/Swift语法和diff通过，原PCM断言未放宽。正式App顺序回归/本地清洁IPA/提交push/包含修复的iOS27仍待。当前共享经典页批次未完成，未启动竞争构建或代为提交；d2d24e2/39210631200保持运行、0排队。磁盘约42GiB，必要原始包移至本机诊断目录，未删缓存/样本/Evidence。真实服务、签名和真机缺口保留。

## 2026-10-19 舞台样式实施与验收中

按E042严格review及独立冻结重放，原创四样式、独立背景偏好/Sheet和剩余高度舞台主体已接入，详见[0075](decisions/0075-stage-style-presentation.md)。五固定参考相关源码亲读并核对工作字节等于HEAD，无源码/依赖/资产移植。396业务/类型通过，新增偏好迁移/保存失败与独立开关检查；正式App像素差异/位置保持/重启、横屏/大字/iPad和完整八布局回归正在验证，归档/提交/对应云端待。完整参考转场/粒子/动态背景、真实服务/签名/真机未完成，全部计划active。

## 2026-10-19 舞台样式静态证据通过，实施待

reverse-skill新R2路由083205/mobile-reverse、原offline scope及E042→F041→P041严格review通过：42E/41F/41P、16WI/93事件，0错误/警告。6229原始字/455BL/424池引用独立冻结重放通过，确认四枚举选择、整数保存/恢复、偏好与有效覆盖的区别、组/绘制器字段以及独立背景开关；完整特效/转场/目标动态仍未恢复，详见[舞台报告](2026-10-19_reverse-sollin-stage-styles-report.md)。无新产品采纳或完成度增长；下一亲读相关代码/五参考后实现原创样式，并独立验证原生绘制、生命周期和主控可达。全部计划继续active。

## 2026-10-19 写真封面补验清洁归档与 push 回执

946b638ae2b4f576aeddd682b64362bcb7e05605已正常push到RhsR1024/nexus-music，ls-remote实核main一致。395业务/类型、原生像素单测和最终App两项2/0/0通过；图片139.533秒、完整八布局/PCM等320.837秒，详细证据及未验边界见[0074](decisions/0074-photo-artwork-coverage.md)。

清洁unsigned归档ARCHIVE SUCCEEDED：dirty=false/changes=[]，Xcode26.3/SDK26.2、arm64/min15.1/设备族[1,2]；CRC/附带SHA/可执行和JS与归档字节/正式入口/私人签名资源排除通过，合成图片控制端点及fixture-photo未进入正式JS。IPA SHA256 `eb7a6cabe05f1e83ac5720e9d9f5d267800f4ed286b78a712a757fb90bcda374`，包及verification留build/local-presentation-946b638，日志archive-photo-artwork-clean.log。

API实核新[39182097746](https://github.com/RhsR1024/nexus-music/actions/runs/39182097746)/946b638唯一pending，0302b24/[39179554648](https://github.com/RhsR1024/nexus-music/actions/runs/39179554648)继续App验证、checks成功；1运行/1排队，无重派或手动取消。本批iOS27终态、真实服务/签名/真机仍待。下一舞台R2路由083205的探查尚未形成新不可变Evidence/review，不据此实施；全部计划保持active。阶段磁盘约45GiB，必要原始证据/失败及最近两阶段有效归档保留，未盲删构建目录。

## 2026-10-19 写真封面比例与坏图补验本地通过

新reverse-skill R2路由081447/mobile-reverse、原offline scope及41E/40F/40P严格review通过；E041独立1946原始字/BL/manifest重放通过，无新增参考动态结论。按[0074](decisions/0074-photo-artwork-coverage.md)加入原创64×256/256×64 PNG、404及成功HTTP坏字节，正式入口/真实Navidrome客户端/原生缓存路径独立验收；原播放器和缓存尺寸/策略未改，背景说明与0072清晰前景职责对齐。

最终SourceUITests-1792369614570两项2/0/0：图片139.533秒、完整八布局/实际PCM/黑胶像素/歌词/统计/重启/凭据清理320.837秒；395业务/类型与原生像素单测通过。41合成鉴权/0失败、16流请求；portrait1/landscape1/missing2/corrupt1图片响应。独立PNG圆形310×311和672×675符合cover裁切，无拉伸；坏图无旧圆，返回纵图恢复。五图/摘要留photo-artwork-final-passed，最终坏图与返回图亲看；不算真实服务或参考动态/真机验收。

清洁归档/正常push及对应新iOS27待。当前0302b24/[39179554648](https://github.com/RhsR1024/nexus-music/actions/runs/39179554648)仍在App验证，checks已success，无重派或取消；最新成功仍b492261。下一舞台已新R2路由083205及前置门禁通过，2642原始指令/197BL/248池引用仅作本机探查；尚未形成E042/严格review，不据此采纳样式，也不移植参考赞助逻辑。其余AM评论正文、舞台/菜单/设置及全部A/F/J继续active，不提高百分比。

## 2026-10-19 写真清洁归档与正常 push 回执

0302b24f8b22582cbead91a2be7376dd2e82f70a已正常push至RhsR1024/nexus-music，ls-remote实核main一致。395业务/类型、完整原生CLI、写真手机三项3/0/0及iPad113.592秒1/0/0通过；新Mini可见窗口夹具162.737秒1/0/0通过，旧流程本机通过不能代替新iOS27结论。41E/40F/40P严格review、独立1946原始字/BL/manifest及394本地文档链接通过；截图/失败和云端边界见[0072](decisions/0072-photo-lyrics-composition.md)/[0073](decisions/0073-ci-mini-sheet-viewport-and-evidence.md)。

清洁unsigned归档ARCHIVE SUCCEEDED：dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64/min15.1/设备族[1,2]；CRC/附带SHA/可执行和JS与归档字节/正式入口/私人签名资源排除均通过。IPA SHA256 `a5abb0015f7398ba98a1fc34211551af34cef9b5ac8765d75fa95f321e75ab14`，包和verification留build/local-presentation-0302b24，日志archive-photo-composition-clean.log。

新[39179554648](https://github.com/RhsR1024/nexus-music/actions/runs/39179554648)/0302b24已in_progress，API实核1运行/0排队；b492261成功、292e076失败均保留原结论，无重派或取消云端任务。对应iOS27终态、真实服务、签名/真机仍待。下一继续写真宽高比/坏图补验与舞台/菜单/设置、AM评论正文和全部A/F/J；不提高开发百分比。收尾磁盘约45GiB，必要失败/最后两阶段有效IPA和摘要及逆向原始证据保留，无盲删构建缓存；清理回执已更新。

## 2026-10-19 写真本地通过与 iOS27 失败跟进

按reverse-skill E041→F040→P040/41E40F40P严格review和[0072](decisions/0072-photo-lyrics-composition.md)原创写真主图/纵向遮罩、歌词正文和五秒操作区，保留唯一意图/权威队列及音枢功能。395业务/类型（含计时与失败附件识别）通过，完整原生CLI通过；最终手机SourceUITests-1792340980963三项3/0/0：旋转78.470秒、大字122.324秒、完整八布局/PCM/歌词/统计/重启/凭据清理311.934秒。21合成鉴权/0失败，无新stream/coverArt，复用缓存，不是真实服务。五张必要PNG已亲看，独立PNG顶部/底部最大色值169/90通过；超大字长行保留滚动阅读，不承诺全部同屏。

iPad最终SourceUITests-1792367266454窗口/旋转113.592秒1/0/0通过。首轮94.072秒在Sheet关闭后立即测hittable失败，录像93.5秒显示播放页已恢复；仅夹具改为限时等待Sheet消失、写真页存在及真实播放按钮可点击，保留原断言条件。手机三项在这一夹具等待更正前通过，产品代码未变化。iPad必要图留photo-ipad-final-passed；首轮实际像素失败118.538秒、旧轮操作通过但遮罩未生效、以及末次对比层前的中断轮均保留，不冒称最终通过。Fabric提交/布局/trait后恢复遮罩，前景对比受深浅设置控制，保留RN子视图契约。

云端最新：b492261/[39127780177](https://github.com/RhsR1024/nexus-music/actions/runs/39127780177) completed/success；292e076/[39142704842](https://github.com/RhsR1024/nexus-music/actions/runs/39142704842) completed/failure，手机组25/1/0，迷你大字Sheet重置按钮不可达，未进入后续iPad/归档。按[0073](decisions/0073-ci-mini-sheet-viewport-and-evidence.md)先校验小日志/失败包；完整564MB包超连接器上限，未取得，不虚构云端视觉原因。本机原流程166.699秒通过；可见窗口交集中央拖动、失败截图/层级与裸UUID附件识别已实施，新UI复验162.737秒1/0/0通过，原设置/持久化/滑动关闭断言保留；iOS27恢复尚待新提交证明。无重派或手动取消。

写真清洁归档/正常push及对应iOS27待；真实服务/签名/真机无新增完成证据。其余AM评论正文、写真宽高比/坏图补验、舞台、菜单/设置及全部A/F/J继续active，不提高开发百分比。磁盘约47GiB，清理回执在build/logs/cleanup-photo-stage-2026-10-19.json；原图、逆向证据和必要失败结果保留。

## 2026-10-19 写真歌词独立主体（验收中）

reverse-skill R2/mobile-reverse、原offline scope/IPA门禁和E041→F040→P040严格review通过：41E/40F/40P，零错误/警告；独立1946原始指令/165BL/172池引用/manifest重放通过。按[0072](decisions/0072-photo-lyrics-composition.md)原创清晰前景主图/纵向原生遮罩、歌曲动作行、虚拟歌词正文与五秒操作区；背板设置和用户写真/封面回退、唯一播放意图、权威队列及音枢特有功能保留。参考完整手势/动作语义/精确物理几何/动态运行未证明，不把截图当运行证据。

392业务/类型检查通过（含五项计时/过期回调/拖动/身份/退出测试）；正式App完整八布局/像素/歌词/PCM/前后台/重启/凭据清理回归正在执行，新增写真大字/横屏验收随后运行。清洁归档、提交/正常push和对应iOS27待验。当前云端39127780177/b492261运行，39142704842/292e076排队，1/1；无手动取消或重派。真实服务、签名和真机均无新完成证据，全部计划继续active。今日清理检查约47GiB可用；Xcode运行中未清构建目录，必要结果/原图/逆向证据保留。

## 2026-10-18 AM 批次清洁归档与 push 回执

292e0763ad81b676a6c5728e455ad468dcd4224e已正常push到RhsR1024/nexus-music，ls-remote实核main一致。387业务/类型、最终大字154.595秒及完整八布局307.761秒2/0/0通过；普通手机横屏100.565秒、iPad120.417秒分项结果与大字视觉补修边界见[0071](decisions/0071-am-body-and-artwork.md)。40E/39F/39P strict review及独立1830原始字/BL/manifest通过。

清洁unsigned归档ARCHIVE SUCCEEDED：dirty=false/changes=[]，Xcode26.3/SDK26.2、arm64/min15.1/设备族[1,2]。ZIP CRC/附带SHA、可执行及JS与归档字节、正式入口及私人签名资源排除通过。IPA SHA256 `bc907d15342c30c7ab8cd82a2d0013f3be24dd135491934f09935a44bcbbf7e9`；包与verification留build/local-presentation-292e076，日志archive-am-body-clean.log。

API实核新[39142704842](https://github.com/RhsR1024/nexus-music/actions/runs/39142704842)/292e076唯一pending，b492261/39127780177继续in_progress，3385605旧pending被single自动替换；1运行/1排队，无手动取消/重派。本批iOS27终态、真实服务/签名/真机均待。下一写真已新R2路由234045/PRIMARY mobile-reverse、原scope/IPA前置门禁通过，1485原始指令/122BL/138池引用只留限定探查，尚无新不可变功能Evidence/review或产品采纳；继续先已有UI后新增功能，AM评论正文/写真/舞台/菜单/设置及全部A/F/J保持active。临时完整导出自动清理，必要截图/原结果/所有逆向证据保留，磁盘约46GiB可用。

## 2026-10-18 AM 完整封面与正文切换本地通过

reverse-skill R2/mobile-reverse、原offline scope及E040→F039→P039的1830原始指令/160BL/128池引用独立重放通过，40E/39F/39P严格review零错误/警告。按[0071](decisions/0071-am-body-and-artwork.md)原创完整AM封面、互斥歌词/权威队列正文、重复选择回封面及独立主控；保留原曲收藏/评论与实际录音封面/歌词、唯一播放意图和音枢功能。固定IPA只证实三态，评论正文仍待，未把实际音质回调误记评论。

387业务/类型通过；最终build/SourceUITests-1792337928789.xcresult两项2/0/0：大字154.595秒、完整八布局/PCM/黑胶像素/歌词/统计/重启/凭据清理307.761秒。大字当前行首frame断言通过，原先147.057秒操作虽通过但视觉发现长行居中裁首的截图保留，修正版另验。普通手机横屏100.565秒、iPad窗口/旋转120.417秒此前通过，普通字号分支未受行首补修影响；不是全部同一次运行。最终五张必要PNG/manifest/摘要留build/am-final-passed，修正后大字行首与完整封面已亲看；超高行仍需滚动阅读，不承诺整行同屏。完整临时导出已自动清理，清洁归档/正常push/对应iOS27随后记回执；真实服务/签名/真机未新增。其余AM评论正文、写真、舞台、菜单/设置与全部A/F/J继续，不提高开发百分比。

## 2026-10-18 首批截图构图清洁归档与push回执

338560502d0fcbb0196f980234cfadcd58b937b0已正常push，ls-remote实核main一致。最终387业务/类型、完整App295.404秒1/0/0、39E/38F/38P严格review与31原件/副本摘要通过。清洁unsigned归档ARCHIVE SUCCEEDED：dirty=false/changes=[]，Xcode26.3/SDK26.2、arm64/min15.1/设备族[1,2]；CRC/附带SHA/可执行及JS与归档字节/正式入口/私人签名资源排除通过。IPA SHA256 `a2c63feae7e962a6796b0df1d797392624dc98921e72f2dfd3699b9585a08db7`；包与verification留build/local-presentation-3385605，日志archive-player-composition-clean.log。

API实核新[39137919717](https://github.com/RhsR1024/nexus-music/actions/runs/39137919717)/3385605唯一pending，b492261/39127780177继续in_progress，393adcf已success；1运行/1排队，无手动取消/重派。本批iOS27终态、真实服务/签名/真机均待。下一AM已新R2路由224708、PRIMARY mobile-reverse及原offline scope/IPA门禁通过，仅定位元数据入口，完整原字节调用/字段关系尚待，未据此实施AM。其余31图差异继续，不以首批修正宣称整体对齐完成。

## 2026-10-18 新31图归档与首批构图本地通过

31张用户原图已原字节归档到本机忽略目录resource/reference-ui/sollin-2026-10-18，132,113,191字节；原件/副本/manifest/迁移基线SHA全部复核。逐图差异与后续顺序见[截图矩阵](SOLLIN_SCREENSHOT_REVIEW_2026-10-18.md)。按reverse-skill R2路由215123、PRIMARY mobile-reverse、原offline scope和39E/38F/38P strict review零错误/警告，E039补充截图，E013/E037/E038保持主要IPA结构证据。

按[0070](decisions/0070-player-square-composition.md)修完整方形封面、当前歌词可见和黑胶主体尺寸；独立底部歌词Sheet保留原来源/偏移/展开功能。0069唱臂/配重原独立App299.054秒通过，本批最终SourceUITests-1792333778177完整295.404秒1通过/0失败/0跳过；387业务/类型通过。新增实际封面包含/黑胶尺寸/歌词frame包含，原PCM/八布局/唱臂像素/前后台/歌词定位/统计/重启/凭据清理均保持，9合成鉴权/0失败、无新stream/coverArt（复用缓存），不计真实服务。最终必要PNG及摘要留build/player-composition-visible-passed，声波当前歌词和黑胶暂停截图已亲看；完整导出自动清理。

首次设置导航15.735秒失败、黑胶歌词入口136.904秒失败和304.377秒虽回归通过但截图发现声波歌词裁切均保留，不改写为最终视觉成功。声波仍需三行/标题居中/底部工具预算、其余AM/写真/舞台/菜单/设置均按矩阵待，完整材质/手势/目标运行未证明，不增加开发百分比。下一优先AM完整封面和正文切换证据，随后写真/舞台；音枢特有功能及许可/隐私保持。

云端393adcf/39121914443已completed/success（checks、iOS27全部原生/手机/在线/离线/iPad/unsigned归档及上传步骤成功），只证明该提交；云端包未下载核字节。b492261/39127780177正在运行；本批清洁unsigned归档/正常push/对应iOS27随后记回执。真实服务、签名和真机无新结论。磁盘约41GiB可用，清理回执build/logs/cleanup-player-composition-2026-10-18.json；原图/不可变证据/未解决原结果和最新产物保留，无盲删。

## 2026-10-18 黑胶主轴方向与配重（验收中）

新reverse-skill R2路由203610、原offline scope/IPA门禁和E038→F037→P037独立1886原始指令/258BL/108池引用/20方向向量通过，采纳前38E/37F/37P strict review零错误/警告。经cos/sin/端点保存/画布变换作用域证据，按[0069](decisions/0069-vinyl-primary-axis.md)把原创4°/24°修正为有证据的主轴0°/21.6°和.035S→.395S可见线段，补后部配重；完整唱头/渐变/精确缓动/手势和目标运行仍未知。387业务/类型通过，正式App完整回归正在串行执行，新增实际唱头/支点/配重范围，原PCM/八布局/像素/生命周期断言保持。归档/提交/对应iOS27待；真实服务/签名/真机不变。

## 2026-10-18 黑胶分层清洁归档与push回执

b49226167093d849f6afc054d43bc0c75f6305cc已正常push并实核远端main一致。387业务/类型及完整App288.843秒1/0/0通过，E036/E037独立原字节重放及37E/36F/36P严格review通过。清洁unsigned归档ARCHIVE SUCCEEDED，dirty=false/changes=[]、Xcode26.3/SDK26.2、arm64/min15.1/设备族[1,2]；ZIP CRC/附带SHA/包内可执行与JS字节/正式入口及私人签名资源排除通过。IPA SHA256 `050818fb2baed5c4f375688896a19c1a46cd1ea3d1f080355dff2fc0d51f7936`，包与verification留build/local-presentation-b492261，日志archive-vinyl-layout-clean.log。

API实核新iOS27运行39127780177/b492261为唯一pending，39121914443/393adcf仍in_progress；旧2042736pending自动替换，未手动取消/重派，1运行/1排队。没有新云端终态、真实服务/签名/真机结论。完整唱头/渐变/手势、精确缓动和其余A/F/J继续；下一以逆向证据补齐有限绘制变换及实际设备动效边界，再收敛其余既有UI。阶段收尾检查空闲约48GiB，完整临时导出已删除，最新两批有效产物/原测试结果/未解决云端证据和reverse case保留。

## 2026-10-18 黑胶分层几何本地通过

按[0068](decisions/0068-vinyl-layered-geometry.md)，E036/E037严格review及五固定参考比较后，原创底座/盘托/偏置唱片/封面/支点，保留native双动效、唯一播放意图及音枢功能。387业务/类型及完整App1792326094312通过：288.843秒、1通过/0失败/0跳过；实际几何包含/共心、81点非空停转/旋转、唱针往返/Home恢复和原八布局/PCM/歌词/统计/重启/凭据清理均保持。两张黑胶PNG已亲看，独立封面内部120×120裁切差异通过；必要PNG/manifest/verification留build/vinyl-layout-passed，临时完整导出已自动清理，原xcresult及ui-vinyl-layout-{catalog.log,summary.json,counts.json}保留。9次合成鉴权/0失败，无新stream/coverArt，复用既有缓存，不计真实服务。清洁归档/正常push/本批iOS27待；完整唱头/渐变/手势、参考运行与签名/真机边界保持。

## 2026-10-18 测试导航修复清洁归档/push回执

204273619e3602059f63c339eb152e8cdc68791d已正常push并触发最新pending39125685677，393adcf/39121914443仍运行；3313457旧pending自动替换，未手动取消/重派，1运行/1排队。两项Release App2/0/0和原断言保持见0067。

本批清洁unsigned归档成功，manifest dirty=false/changes=[]；Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]，CRC/附带SHA/包内可执行与JS字节/正式入口及私人签名资源排除通过。IPA SHA256 `f3c644fffd36519400b80cada0523d51791f7a0e2d4b24cda122299f9566f1e0`，包及verification留build/local-presentation-2042736，日志archive-sheet-eq-repair-clean.log。对应iOS27、真实服务/签名/真机待，不计新增功能或提高完成比例。下一黑胶几何已新路由200307/PRIMARY mobile-reverse与原离线scope、IPA门禁通过，正在静态取证，尚未采纳新几何。

## 2026-10-18 云端Sheet/EQ失败定向修复本地通过

按[0067](decisions/0067-cloud-sheet-eq-test-navigation.md)核对39115107158官方小日志的准确失败行：背景Sheet关闭后父入口可触达竞态、EQ右边缘拖动后预设仍在视口外。仅测试增加关闭/入口明确等待，并将EQ双向滚动移至左侧4%留白，完整原断言保持；产品设置/背景/音频代码未变。

Release App结果SourceUITests-1792324493576：背景大字号91.912秒、EQ182.995秒，2通过/0失败/0跳过；包含关闭重开/下滑/重启持久化、增益/各频段恢复/归零/重置/旁路/预设增删/睡眠定时。正式入口Release编译通过，非合成业务适配入口。6张必要PNG/manifest留build/cloud-sheet-eq-repair-passed，自定义选中与大字截图已亲看；完整临时导出自动清理，原xcresult及ui-cloud-sheet-eq-repair-{catalog.log,summary.json,counts.json}保留。没有新真实服务、签名或手机验收；对应新云端终态仍待。

## 2026-10-18 黑胶批次清洁归档与云端回执

33134574d46db4ad8189e8acd6dc72993a58cf09已正常push，远程为RhsR1024/nexus-music。清洁unsigned归档成功，manifest dirty=false/changes=[]；Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]。ZIP CRC、附带SHA、包内可执行/JS与归档字节、正式入口及私人/签名资源排除通过。IPA SHA256 `04b569c04234bf4d2212eee8582d4a2aaf3c29ab9ea2fa7d1f35c976e44d9b7c`；包和verification留build/local-presentation-3313457，日志archive-vinyl-motion-clean.log。E034/E035独立原字节重放及35E/34F/34P严格review通过。

push后API核验[39124884346](https://github.com/RhsR1024/nexus-music/actions/runs/39124884346)/3313457为唯一pending，[39121914443](https://github.com/RhsR1024/nexus-music/actions/runs/39121914443)/393adcf继续运行，1运行/1排队；未取消或重派。对应iOS27终态待，不将本地SDK26.2计为云端成功。

旧39115107158/4797970已失败：checks/工具链/完整native通过，核心24项22通过/2失败；后续在线/离线/iPad/归档跳过，无IPA。官方小日志537369字节、SHA256 `3bbb867dc472c58afd49cf8bce57ff49b1f548210f9e1bc4c310437630d46c39`及CRC核验通过，留build/ci-4797970-compact。catalog47224定位背景Sheet关闭后立即检测父入口不可触达（旧源码1645）；56074定位EQ自定义预设滚动失败（旧1526），右侧手势x≈398与原生滚动条x396重合、预设仍在视口下方。先修测试关闭等待/手势触达，再专项验证；不据此宣称产品EQ或背景持久化损坏/已修复。真实服务/签名/真机及其余A/F/J保持。

## 2026-10-18 黑胶双动效本地通过

按[0066](decisions/0066-vinyl-independent-motion.md)原创线性转盘、歌曲身份相位隔离、独立唱针与ready门控；387业务/类型及完整八布局/PCM/歌词/统计/重启/凭据清理App1792322360079通过，282.844秒、1/0/0。新增实际非空像素停转/转动、唱针frame正反变化、Home恢复均通过；两张画面已亲看，独立中心裁切像素变化与摘要收据留build/vinyl-motion-passed，完整临时导出已finally清理。10合成鉴权/0失败、无新stream，复用缓存，不计真实服务。E034/E035原字节重放与35E/34F/34P严格review通过；完整几何/手势、曲线/动画开关来源及运行中减少动态效果/曲目切换/缓冲和真机仍待。清洁归档、正常push及对应iOS27尚待，其他A/F/J保持。

## 2026-10-18 暂停背景基线批次：清洁归档与云端排队回执

测试/诊断提交 `393adcff072740f5f11867eb3e97dabe661236d7` 已正常 push 到 RhsR1024/nexus-music，ls-remote 实核 main 一致。完整背景专项467.221秒通过，387业务/类型及PNG/几何native专项通过；生产背景和音频未改，暂停恢复改用实际14点RGBA基线，播放态三色与原PCM/异步/明暗检查保留，原失败不改写。

清洁unsigned归档 ARCHIVE SUCCEEDED：manifest dirty=false/changes=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]。79条目ZIP CRC、附带SHA、可执行/JS与归档字节一致、正式入口及私人/签名资源名称排除通过。IPA SHA256 `d27332f3397de78c7097ed33e74161e9d84b701baeb230a3279fe0711d50b3f8`；包及verification留build/local-background-baseline-393adcf，日志archive-background-paused-baseline-clean.log。

push后API实核新iOS27运行[39121914443](https://github.com/RhsR1024/nexus-music/actions/runs/39121914443)/393adcf为唯一pending，39115107158/4797970保持in_progress；single自动替换旧pending 39119277363/8aefb23，未手动取消/重派，1运行/1排队。对应新云端终态仍待，本地SDK26.2归档不计iOS27成功。下一继续黑胶必要标志/参数的reverse-skill证据与五参考比较，再采纳已有UI/交互；其余A/F/J及真实服务/签名/真机缺口继续。

本轮临时完整附件导出与失败导出中间目录已在成功/出错finally清理，关键四张PNG/原xcresult/必要失败证据及逆向case保留。当前本机可用约45GiB；每日首次可用跟进与阶段收尾按AGENTS/BUILDING轮换清理，活动构建缓存不清理。

## 2026-10-18 账号隐私修正版构建回执

产品提交 `4797970ec9fc386a9d7ac9ba5e39482966d327b6` 已在 387/387 检查及 clean unsigned archive 校验后正常 push。manifest dirty=false/changes=[]、arm64/iphoneos26.2/min15.1/设备族[1,2]/signed=false，ZIP CRC、归档可执行文件与 JS 字节一致、正式入口及私人资源名称排除通过；IPA SHA256 `dfaaa1c0964dc298d6d512e24ed335aca8bb7cd20b401b2b76eb56346b7f5d8b`。日志留 `build/logs/archive-auth-privacy-final.log` 与 `verify-auth-privacy-final.json`。

push 后 API 核对新运行 `39115107158`/4797970 唯一 pending，`39111966447`/23090d0 仍 in_progress；后者 checks、iOS27 工具链和完整 native 已通过，核心 App 步骤尚在运行。single 自动替换旧 pending，未手动取消或重派，保持 1 running/1 pending。无新增云端成功、真实平台授权、个人签名或真机结论。下一批须继续既有 Sollin UI/交互未完成项的 reverse-skill 门禁及平台具体授权适配，不能将账号底座当完整登录。

## 2026-10-18 WebDAV 前台预览阶段回执

提交 `42156f0737326ed3c805a79594f4f3ee9914b771` 补齐 WebDAV 同步初始化/前台恢复自动预览；冲突仍需确认，不自动提交。`npm run check` 376/376。清洁 unsigned archive 成功，manifest 对应42156f0、dirty=false/changes=[]、arm64、iphoneos26.2、min15.1、设备族[1,2]、signed=false；IPA SHA256 `da4d52f1657f5490d82aca6acd347b7aa26dd09f4fe40cbc9f20c85e37746e62`，`verify-presentation-archive.py`通过。push后最新运行39112637167为42156f0 pending，39111966447为23090d0运行中；保持1运行/1排队，不取消运行中。

## 2026-10-18 经典安全区回归与漫途范围更新

产品提交 `7b8b023dce470743717f0017277326082c1ad49a`：经典播放器安全区专项通过，完整背景回归在捕获重试后通过（`SourceUITests-1792311318332`，475.014s，1/0/0；过渡视频60帧/8中间色/红蓝0.481667s）；`npm run check` 375/375、`npm run test:native` 通过。清洁 unsigned archive `build/distribution` 对应7b8b023，manifest dirty=false/changes=[]、arm64、iphoneos26.2、min15.1、设备族[1,2]、signed=false；IPA SHA256 `c96fd9dadc99c8198a6758313ff1b52bce1042f584d5ac043b2ebd6bd06423d`，`verify-presentation-archive.py`通过，回执留 `build/local-presentation-7b8b023`。

用户随后明确取消音枢与漫途歌单持续/双向同步；漫途只作为多个平台公开歌单的一次性导入来源。已在范围与计划文档标记不实现并重算开发量：80.95%/19.05%，完整交付57.93%。文档提交23090d0已正常push；对应iOS27运行39111966447正在执行，遵循single队列。

## 2026-10-18 当前接续：经典独立专项通过，完整背景继续

session43157的正式联合回归SourceUITests-1792310358432正在运行；testClassicPlayerWindowSafeArea已98.693秒通过，包含实际合成播放、滚动/队列返回、横屏cutout及转回。完整testGlobalCoverThemeChangesAcrossPages仍运行，原像素/PCM/异步/三色/明暗重启断言保持，尚不记整批通过。日志build/logs/ui-classic-separated-final.log及ui-catalog.log；终态先保存catalog/counts/summary再启动下一Xcode。

云端39104211437/b6f66a2已failure：checks/iOS27工具链/完整native通过、核心22通过1失败0跳过，EQ开关滚动触达失败；后续步骤跳过，无该批云端IPA。原始官方日志转录和下载限制留build/ci-39104211437/FINDINGS.txt。下一复现并修复EQ触达，保留全部原断言；0运行0排队，不重派旧版。下方旧session14771和“云端运行中”仅为历史。

## 2026-10-18 经典视口横屏首因已取证（最终修正复测中）

1792307131284在300.962秒明确记录window(0,0,932,430)、viewport(0,59,932,337)：根SafeAreaProvider在全屏Modal旋转时沿用竖屏insets，原margin方案确实未修好横屏，失败catalog/counts/summary和截图留ui-classic-viewport-stale-insets-failed-*及build/classic-viewport-stale-insets-failed，截图已亲看。前面类型查询/AX根/设置页触达失败各自保留，不混同此确定坐标证据。

现PlayerScroll仅经典布局使用本Modal独立SafeAreaProvider及原生SafeAreaView约束四边；背景仍为全屏兄弟，未改播放/队列/其他布局/依赖。375业务/类型通过（check-classic-modal-safearea.log），当前唯一本地Xcode为session14771，正式完整背景日志build/logs/ui-classic-modal-safearea.log及实时ui-catalog.log；保留全部原像素/PCM/异步/主题重启和新增竖屏/滚动/队列返回/横屏/转回断言。先核实终态、保存结果再继续构建，尚未验收本批App/归档/云端。

背景产品b6f66a2及回执a3b0bc5已正常push/清洁归档，见下文；云端39104211437已通过checks/iOS27工具链/完整native，当前App步骤运行，1运行/0排队，未取消或重派。全部A/F/J继续；真实服务/签名/手机没有新证据。0062含新reverse-skill R2路由142527、scope/strict review、五参考固定HEAD/许可/平台比较；本批不声称Sollin具体安全区已还原。

## 2026-10-18 背景呈现批次清洁归档与push回执

`b6f66a267b1694a0364b96bdf1140f1a519d91a4`已正常push到RhsR1024/nexus-music，ls-remote核对main一致。375业务/类型、最终完整native、正式背景466.067秒及iPad两项135.232/39.899秒通过，详见0060/0061。清洁unsigned归档ARCHIVE SUCCEEDED；manifest dirty=false/changes=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、signed=false。完整ZIP CRC、附带SHA、包内可执行/JS与归档字节一致、正式入口及私人/签名资源排除通过，IPA SHA256 `726605bad9033e3642099b8d73123cab9ea3e6d5989229b7ff0e346d58f9d800`，收据与包留build/local-presentation-b6f66a2。

push后API实核[39104211437](https://github.com/RhsR1024/nexus-music/actions/runs/39104211437)对应b6f66a2已in_progress，实际1运行/0排队；未取消运行或重派旧版。新云端iOS27终态仍待，最新完整成功且IPA核验仍为76c9cd0/39050349015；本地归档不证明云端修复、真实服务、签名或手机。下一已有UI缺口：经典ScrollView视口安全区（实际父层恢复截图已确认内容进入状态栏），及独立全屏业务背景；全部A/F/J继续。安全区批次新R2路由master-route-20261018-142527与IPA门禁已通过，未新增Sollin安全区语义结论。

## 2026-10-18T14:19 背景呈现批次本地验收完成，待清洁归档与push

正式背景SourceUITests-1792303322232：466.067秒、1通过/0失败/0跳过；嵌套全屏队列及独立发现关闭后实际运动恢复、PCM/Home/暂停稳定、封面异步/迟到/失败、两页三色与明暗重启通过。视频59帧/10中间色，红切换0.505秒；16次合成鉴权/0失败，无新stream、复用缓存。日志/counts/summary另存ui-presentation-barrier-passed-*，附件build/presentation-barrier-passed，深色及父层恢复截图已亲看。

375业务/类型与最终完整native通过；iPad1792304057941两项通过/零失败/跳过：AM2旋转135.232秒，窗口/导航/Modal旋转39.899秒，截图已亲看。日志/counts/summary另存ui-presentation-ipad-passed-*，附件build/presentation-ipad-passed。当前没有活跃Xcode测试。reverse-skill新R2路由135148、scope/IPA门禁、E024独立原字节重放及严格review32E/31F/31P通过，案例workitems/timeline/现场日志和公开0060/0061已同步；380个文档相对链接及diff检查通过。

1792302794209旧失败保留：lastHeldRed=2，新id诊断确认旧轮恢复封面污染夹具屏障；只修本轮身份/response close清理，最终按原断言通过。1792302119491中断缺Info.plist、无终态，不计通过。0059实际overlay推断修正与独立小日志上传同批，云端仍待对应新运行验证。HEAD/origin目前8cf108d，接下来审查暂存→阶段提交→清洁unsigned归档/CRC/SHA/正式入口隐私排除→正常push→核对新云端至多1运行/1排队。无真实服务/签名/手机新证据；全部A/F/J保持，下一经典长滚动安全区、各独立全屏背景及其余功能继续。

## 2026-10-18 Q-music安卓参考调整提交回执

用户指定三平台登录/每日推荐及评论后端参考Q-music android；评论UI仍按Sollin IPA优先/截图补充与reverse-skill。固定源码5db858f32695d10c5e9ef0f7037d586aef6a8c4b已克隆并核对干净HEAD，Apache2/NOTICE与酷狗MIT来源已读，未复制产品代码/资源/依赖。新接入记录、PRODUCT_SCOPE及J矩阵已按文档批次提交8cf108d71886568b6c120aad59254a0d795d31d3，正常push并实核origin/main一致；其余计划/交接补充与背景产品批次仍在工作区。相关文档相对链接通过。

参考源码离线mock入口20项中19通过/1失败：登录路由与18账号检查通过，daily入口因上游verify-account-playlists测试桩缺./qqCredentials而加载失败；未改参考，不计真实账号/日推成功。源码路径、iOS适配、评论五源与验收边界见Q_MUSIC_ANDROID_REFERENCE。当前375业务/类型检查通过（check-presentation-reference-final.log）。push后GitHub API核对0运行/0排队，最新仍为dfd304b原生测试失败；文档提交不触发iOS构建，没有新增云端成功或提高完成度。

## 2026-10-18 背景采样复测与跨页面回归检查点

最终采样复测 `1792301048820` / PID91772已终态exit65，366.600秒0通过/1失败；失败位于1251行heldRed的30秒实际HTTP挂起观察，尚未执行后续三色断言。catalog/counts/summary另存`ui-presentation-sampling-failed-*`，附件`build/presentation-sampling-failed`与录屏333/336秒独立帧已亲看：点击已切到transition red tone，不能将失败归咎于未点中。仅3次getCoverArt、15次合成鉴权/0失败、无新stream；现有计数未记录封面id，不足以断言缓存或原生队列首因。合成控制接口增加no-store及调用/封面id诊断，不改变产品或放宽断言。此前99551的失败记录继续保留，像素修正仍未获最终整项通过。

跨页面回归正在session90935/PID93406运行，结果包`build/SourceUITests-1792301687706.xcresult`，日志`build/logs/ui-presentation-cross-page.log`和实时`ui-catalog.log`。先核实实际live/终态再继续，不重复启动Xcode、不覆盖现有证据。本批最终背景/iPad/清洁归档/提交push及对应iOS27仍待，全部A/F/J目标保持。

## 2026-10-18 最终背景失败取证与采样修正（下一轮待验）

session99551/PID90227已终态exit65，不能继续当live；1792300131198在深色重启后暂停的三色断言失败，392.492秒。完整日志/counts/summary另存ui-presentation-final-failed-*，附件build/presentation-final-failed已导出、失败截图已亲看。记录的14组RGBA全零与实际三色不透明PNG不符；独立Pillow/CoreGraphics读取确认实际alpha255/红绿蓝。同时证实旧Set精确相等把一个近中性−1点当额外颜色，误拒绝已含三色的截图。

按[0061](decisions/0061-background-pixel-sampling.md)改用独立屏幕捕获、物理像素裁切/sRGB RGBA8及“三种有效色必须齐全”的原要求，保留14位置/2与6色差/20秒及全部音频/异步/重启断言。只属于UITest的BackgroundPixels.swift及原生像素单测已接入维护工程/脚本；6确切像素、非法坐标/中性过渡/缺每一种颜色/透明拒绝及实际失败PNG均独立通过，目标归属已核验无生产引用。产品场景和0060可见拥有关系不变；不将本机原因直接推广到旧云端557999a，下一完整App/跨页面/iPad/归档/提交push仍待。

## 2026-10-18 全屏业务层背景拥有关系（验收中）

按[0060](decisions/0060-presentation-background-ownership.md)，reverse-skill新R2路由、既有离线scope、E024独立2358原始指令/28BL/9池加载及采纳前严格review通过，五固定参考已亲读。原创实例内层级注册表/Context接入全屏Modal、全局原生背景、图片动效与黑胶；page/form/透明Sheet不抢父背景，iOS等实际onDismiss释放，保留唯一播放意图。375业务/类型（含7项层级/竞争/清理）通过；原版背景基线1792298919988为422.277秒1/0/0、65视频帧/10中间色、15合成鉴权/0失败且无新stream，明暗截图已亲看。新版含嵌套队列/独立发现关闭恢复的背景与设置回归仍运行，不能提前记本批App完成。

39098201855/dfd304b已在原生测试再次失败。完整官方源码上下文定位实际是overlay alpha的CGFloat/zip推断；前次仅按行号误改中心像素，没有修到首因，历史失败保留。现按[0059](decisions/0059-swift-color-oracle-inference.md)显式CGFloat逐项验证，原alpha/明暗/阈值与32向量保持，本地原生场景专项通过，新云端待提交；未执行该失败批次App/归档。独立小日志artifact新增但保留完整诊断/全部测试和single队列，实际下载待新CI。旧三色云端失败仍未完整取证，不放宽断言；新增失败RGBA数值诊断。全部A/F/J与真实服务/签名/真机目标继续。

## 2026-10-18 当前总工作量表与编译修正回执

用户询问的总工作量已按[进度表](PROGRESS_ESTIMATE.md)核对：保守开发约81%/剩余约19%，完整交付约58%。14工作包新增剩余总量百分点与执行顺序，保留原权重/评分，合计100/80.95/19.05/57.93已复算；[功能状态表](FEATURE_STATUS.md)当前总览已更新为八布局、原生背景、启动/前台恢复及最新云端边界，移除当前表中“无完整Xcode”等过时说明。未因测试数/提交数自动上调进度，全部F01–F37/J01–J59继续。

dfd304bb8e3323bf2d00846a4b96266d6d58ea31已正常push，远端main一致；368业务/类型、完整native及清洁unsigned归档/CRC/附带SHA/包内可执行与JS字节/正式入口和私人签名资源排除通过。manifest dirty=false/changes=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]；IPA SHA256 `7df9faac9c3a4b2fbe231532645ba9ea7297a244f617e342e6000869c0d8d3d1`，留build/local-ambient-swift-inference-dfd304b。新iOS27运行39098201855当前queued；API核对旧运行均已结束，无人为取消/重派，至多1运行/1排队。真实服务/签名/手机与三色旧云端失败诊断继续，不能以该本地包或排队称云端修复通过。

## 2026-10-18 iOS27 配色测试编译修正（本地通过）

[0059](decisions/0059-swift-color-oracle-inference.md)：最新ce192a4/39094486501在原生测试Swift106类型推断超时，未执行App/归档。仅拆分中心像素偏移/切片/期望为显式类型，保留全部32颜色向量与字节相等断言。368业务/类型及完整native通过；E032独立862原始指令/7BL/10池加载/20向量重放和strict review32E/31F/31P、10WI/67事件零错误/警告通过。清洁归档/正常push/新iOS27继续，不以本地SDK26.2证明云端修复。

较早e6d9d11/39086161205仍失败于旧统计断言；557999a/39091013423统计264.919秒通过，核心22/23，唯一三色边缘像素失败，根因未定。625107504字节诊断包超过连接器536870912上限，Chrome诊断入口未附加成功，尚未下载或宣称hash/CRC/录屏核验；官方日志摘录留build/ci-39091013423。最新完整成功且IPA核验仍为76c9cd0/39050349015。全部A/F/J、真实服务/签名/真机目标继续。

## 2026-10-18 统计验收修正清洁归档与push

557999acfbbd892e9dd6841d7e97b64df4acfc75已正常push，远端main一致。清洁归档dirty=false/changes=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned，ZIP CRC/附带SHA、归档可执行及JS字节一致、正式入口和私人/签名资源排除通过；IPA SHA256 `67a92440f91cc8975739f9bf027a83fe61f30bed449090ae50814bbcb3c2f296`，留存build/local-statistics-557999a。正式App270.029秒与368业务/类型沿0057，不代替iOS27/真实服务/签名/手机。

push后API实核39091013423/557999a唯一pending、39086161205/e6d9d11仍运行；24aafa4旧pending39089783874由single自动取消，不算通过。最多1运行/1排队，无人为取消或重派。最新完整成功且IPA已核验仍为76c9cd0/39050349015；下一E032原生配色实施继续，全部A/F/J目标active。

## 2026-10-18 统计显式基线本地专项通过

[0057](decisions/0057-statistics-ui-baseline.md)保留原样失败189.708秒41/1；仅修测试通过真实清空确认建立显式0，缺行/解析不再当0，生产计数不变。368业务/类型通过；SourceUITests-1792290648455正式App专项270.029秒、1通过/0失败/0跳过，八布局/PCM/歌词/一次会话+1/重启/mini/凭据清理均保持。已亲看重置前41次、统计历史、AM2及四按钮mini截图；8合成鉴权/0失败，无新stream、复用临时音频缓存。日志/摘要/counts留build/logs/ui-statistics-explicit-*，附件build/statistics-explicit-passed。清洁归档/push/对应iOS27继续，未据此认定云端全部根因。

E032配色静态证据已strict review32E/31F/31P通过，尚未产品采纳、不增加A04完成度。云端39086161205/e6d9d11仍运行，39089783874/24aafa4唯一pending；真实服务/签名/手机继续。

## 2026-10-18 原生旋转清洁归档与push

产品提交`24aafa4ec7bad6b419e55b8c9822f287e28cee44`正常push、远端main一致。archive-ambient-rotation-clean.log成功，核验器verify-rotation-archive.py确认dirty=false/changes=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned，ZIP CRC/附带SHA、可执行及JS与归档逐字节一致、正式入口/私人及签名资源排除均通过。IPA SHA256 `68f71527ff7736839dda2eccebed17495d2a62002248c4f2284384bb8d3ee661`，留存build/local-ambient-rotation-24aafa4，核验收据build/logs/verify-rotation-archive.json。

2026-10-18 10:22 API实核[39089783874](https://github.com/RhsR1024/nexus-music/actions/runs/39089783874)/24aafa4唯一pending，[39086161205](https://github.com/RhsR1024/nexus-music/actions/runs/39086161205)/e6d9d11核心App运行中、checks/native成功，1运行/1排队，无取消或重派。最新完整成功且IPA已核验仍为76c9cd0/39050349015。本批云端、真实服务、签名、手机和性能仍待；HSL/双色/主题覆盖层不计完成。

## 2026-10-18 原生旋转本地验收

[0056](decisions/0056-seeded-ambient-rotation.md)经reverse-skill E031及31E/30F/30P严格review后实施。368业务/类型、完整native最终通过；正式App SourceUITests-1792289108066为406.668秒、1通过/0失败/0跳过，原背景完整断言保留；视频59帧/6中间色，蓝0/红0.581667秒阈值穿越，两页/经典/中间帧截图亲看。15合成鉴权/0失败，无新stream、复用临时音频缓存，不计真实服务。

首轮native系统封面固定0.2秒等待失败，原样重放通过，两个正向路径改为最多5秒等待实际artwork后独立及完整检查通过；首轮/最终日志分别保留。UI末尾附属simctl诊断定位错误保留，xcresult及正式流程成功。SDK仍26.2/Xcode26.3，清洁IPA/本批push/iOS27继续；25b1e05旧云端统计断言失败/e6d9d11运行见下，不能计全部通过。

## 2026-10-18 09:58 心跳：云端统计断言失败待复核

`25b1e05` / [39077179759](https://github.com/RhsR1024/nexus-music/actions/runs/39077179759) 已失败，checks及完整native步骤成功；核心App为23项中22通过，唯一 `testZNavidromePlaybackAndCredentials` 在旧Swift1052断言实际播放次数4、预期1，177.317秒。后续600秒诊断收集超时不是首因；在线组/离线/iPad/归档跳过，无本批云端IPA。官方原始job日志已下载，证据见本机忽略目录 `build/ci-39077179759/FINDINGS.txt` 与job-logs.txt:877、955–974。

诊断artifact12120974173已登记495628911字节及发布摘要6af1665c；浏览器下载被Chrome以ERR_BLOCKED_BY_CLIENT阻止，未绕过，未称ZIP/xcresult/录屏已下载或校验。测试初始count在导航后无等待、条目不存在即返回0，UI仅展示前五个统计且按标题匹配；这些只属基线/身份疑点，尚不能认定统计重复或测试问题，需补看基线/完整诊断或本地复现再修复，不改预期为4或删会话/重启断言。后续39086161205/e6d9d11已自动运行，保持1运行/0排队，无重派/取消；当前旋转批次在开发，本心跳未启动竞争构建或提交。全部功能与真实服务/签名/手机验收继续。

## 2026-10-18 两场过渡清洁归档与push回执

`e6d9d113bbd6b55966fa66c98ea09ca77c521d5d`已正常push到RhsR1024/nexus-music，远端main一致。清洁归档dirty=false/changes=[]，Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带SHA、可执行及JS与归档字节一致、正式入口及私人/签名资源排除通过。IPA SHA256 `7a7d865ab3fde2f3b267b5838f7ccf81b56e898dba4f99ceba898475edc0d38f`，留build/local-ambient-transition-e6d9d11。368业务/类型、最终完整native、正式App388.381秒及65帧/11中间色画面验收见下；验收后strict review30E/29F/29P、8WI/61事件零错误/警告。

push后API实核39086161205/e6d9d11唯一pending，39077179759/25b1e05继续运行核心App，1运行/1排队。旧ea4f5d6 pending39083490325由single自动取消，不算通过；未取消运行或重派旧版。最新完整成功且IPA核验仍为76c9cd0/39050349015，只覆盖其代码。下一已有背景旋转/原始运动复核继续按新路由及严格门禁，再逐页收敛A03/A06–A09；全部F/J与真实服务/签名/手机/性能目标保持active。

## 2026-10-18 两场过渡与加载回退（本地通过）

reverse-skill新R2/mobile-reverse路由及既有离线scope，E028/E029/E030独立原字节重放与采纳前严格review通过；按[0055](decisions/0055-bounded-ambient-transition.md)五参考比较后原创实现显式pending、显示层暂留、最多两场/0.6秒Cubic整体混合和停止/失败清理。媒体URI/色板仍立即清旧，abort/当前URI守卫保持；原生属性一次应用，渐变按宽高比保留原物理投影。

368业务/类型和最终完整native通过。正式入口SourceUITests-1792285502088完整背景388.381秒、1通过/零失败/跳过；本机HTTP屏障验证旧蓝/红保留、迟到蓝隔离、当前失败回退，原三色两页/暂停稳定/播放变化/跨页重启/经典PCM/Home→激活/开关与底色恢复/凭据清理均通过。独立视频65帧/11中间色帧，蓝0至红0.563333秒阈值穿越；这是连续画面证据，不推断精确时长、FPS/能耗或参考运行。截图亲看；15次合成鉴权成功/0失败，无新stream，复用临时音频缓存。

首次完整流程暴露三色像素回归，物理/单位渐变投影纠正后原断言通过，失败留存；Pods探查上游失效转源码/生成文件未就绪的零测试构建失败也保留，已用本机已有预编译包恢复且锁文件不改。日志/摘要/counts为build/logs/ui-transition-passed*，视频/CSV/预览/核验为build/logs/ambient-transition-1792285502074.mp4*，附件build/transition-passed。清洁归档/本批push/对应iOS27继续；完整旋转/参考Random/逐页复核及全部A/F/J、真实服务/签名/手机仍待，目标active。

## 2026-10-18 原生柔光清洁归档与push回执

产品提交9b13459及静态/构建文档提交 `ea4f5d66f608a307d19af91815b11daaf88880b6` 已正常push到RhsR1024/nexus-music，远端main一致。最终干净归档dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离及私人/签名资源排除均通过。IPA SHA256 `61441439204e2b57cfaa59173cda67c560fff5322ee1b4b507ba17eea4046259`，留存build/local-ambient-scene-ea4f5d6。首轮9b13459归档成功但期间心跳追加文档，另存首包；最终ea4f5d6全程干净，未混用两份收据。366业务/类型、最终完整native、正式背景354.349秒与截图验收见下。

push后API实核新运行39083490325/ea4f5d6唯一pending，39077179759/25b1e05继续运行，1运行/1排队；未取消运行或重派旧版。8f865af旧两小时运行超时取消不算通过；最新完整成功且IPA核验仍为76c9cd0/39050349015。E030静态补证后的strict review30E/29F/29P、8WI/59事件零错误/警告。下一批先解决切歌加载空态与最多两场过渡的可见所有权，再做实际帧/快速切换/停止回退验收；不得弱化CoverThemeStore旧请求/迟到结果守卫。完整A/F/J、参考运行及真实服务/签名/手机/性能仍待，目标保持active。

## 2026-10-18 08:28 心跳：背景批次旧预算超时

API核实 `8f865af` / [39072820731](https://github.com/RhsR1024/nexus-music/actions/runs/39072820731) 已结束为cancelled；官方Annotations明确“exceeded the maximum execution time of 2h0m0s”。checks、native、核心App和歌词/匹配/健康/发现步骤成功，离线步骤被取消，iPad/设备归档/IPA上传跳过；不能计完整成功，也不能据此判定离线产品失败。诊断上传另报创建ZIP失败，artifact API为0项，没有可下载核验的诊断包或本批云端IPA；API原始回执与边界留忽略目录 `build/ci-39072820731/FINDINGS.txt`。

后续 `25b1e05` / [39077179759](https://github.com/RhsR1024/nexus-music/actions/runs/39077179759) 已开始运行，checks成功、native进行中，当前1运行/0排队；它已包含180分钟预算，等待实际终态，不重复修改预算或重派/取消。最新完整成功且IPA核验仍为76c9cd0/39050349015。当前A04原生柔光本地验收及清洁归档/提交工作继续由现有执行流程推进，本心跳未启动竞争构建或提交；全部剩余功能、真实服务/签名/手机和性能验收缺口保留。

## 2026-10-18 A04原生四场柔光（本地验收通过）

按[0054](decisions/0054-native-ambient-soft-lights.md)原创实现144×144预乘贴图、四个复用CGImage的CALayer与有界几何，tick只更新矩形/透明度，不逐帧重绘整屏或传入React。366业务/类型和最终完整native通过；正式入口SourceUITests-1792282616128完整背景流程354.349秒、1通过/零失败/跳过：具名原生视图、暂停实际像素稳定/播放像素变化、两页三色、红蓝切歌/跨页/开关/重启、经典页PCM、Home→激活、收起/暂停，以及播放中打开独立动效再关闭全局动效、恢复底色/独立偏好和凭据清理。截图已亲看；12次本机合成鉴权成功/0失败，本轮无新stream，复用临时音频缓存，不计冷下载或真实个人服务。

前五轮完整流程及播放中短探针失败、两个独立短专项通过、图层首个短探针缺队列而未到目标步骤均保留；最终自建连接/队列的完整流程通过，不推断实测CPU/FPS或全部根因。日志/摘要/counts留build/logs/ui-ambient-layer-*，附件build/ambient-layer-passed。reverse-skill新R2路由/离线scope后E026–E029原字节独立重放通过，严格review29E/28F/28P、8WI/57事件零错误/警告；E029仅核有限交接/释放，当前产品同步替换，完整异步load/retry/参考运行仍待。见[报告](2026-10-18_reverse-sollin-ambient-scene-report.md)。清洁归档/提交push/对应云端继续；全部A/F/J、真实服务/签名/手机及性能边界保持active。

## 2026-10-18 三色背景清洁归档与push回执

`25b1e0538c4c9a0e7221f14fdf87c29e0eca71ef`已正常push，远端main一致。清洁归档dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离和私人/签名资源排除通过。IPA SHA256 `50371f64901f6414dab4762768fa0d75890c2a8dc8a5fdfcfca2e4b3d9f3b14c`，留存build/local-flow-palette-25b1e05。366业务/类型、完整native、正式背景App329.540秒及两页三色截图见下；验收后strict review25E/24F/24P、8WI/51事件零错误/警告。

push后API实核39077179759/25b1e05唯一pending，39072820731/8f865af仍运行，1运行/1排队；未取消运行或重派旧版。新三小时iOS预算随本提交生效，未计新云端通过；最新完整成功且IPA核验仍为76c9cd0/39050349015。下一A04柔光/场景构造已新路由及前置门禁，初步原字节探查仅留忽略notes，尚无新功能Evidence/产品采纳。完整A/F/J、参考完整运行、真实服务/签名/手机目标保持active。

## 2026-10-18 云端6c8be2f超时及后续

官方[运行Annotations](https://github.com/RhsR1024/nexus-music/actions/runs/39066065139)明确超过2h最大执行时间；核心23/23、在线5/5、离线1/1实际通过，iPad取消、归档/IPA跳过，整次不算通过。日志和API已核对，诊断产物12116637366/7f272f36已登记，尚未下载核验整个ZIP，不能称全包CRC/摘要已验。最新8f865af/39072820731已运行；本批将iOS预算从120改180分钟，保留全部断言/工具链/归档与single队列，不取消运行、不重派旧版。完整成功且IPA核验仍为76c9cd0。

## 2026-10-18 06:59 心跳：历史批次超时与后续队列

API实核 `6c8be2f` / [39066065139](https://github.com/RhsR1024/nexus-music/actions/runs/39066065139) 已因原120分钟预算结束为cancelled：checks/native、核心App、歌词匹配健康发现和离线断服务播放步骤成功，iPad步骤被取消，设备归档/IPA上传跳过；不能计完整成功。官方Annotations及实际作业日志的2h上限与分项证据见 [GITHUB_ACTIONS](GITHUB_ACTIONS.md)。这与pending被single替换及人为取消分别记录。

当前 `8f865af` /39072820731仍在核心App，1运行/0排队，继续保留；其工作流仍为120分钟。新三色批次 `25b1e05` 已包含180分钟预算，checks仍15分钟，全部原生/手机/离线/iPad/归档断言及single策略保留；尚待该批清洁归档/push和新云端终态，增加预算本身不算通过。完整目标及真实服务/签名/手机缺口保持，本心跳未启动竞争构建或重派旧版。

## 2026-10-18 A04三色取样（本地验收通过）

reverse-skill R2/mobile-reverse、离线scope/case-guard与E025→F024→P024采纳前strict review通过；2307原始指令/9BL/11池加载独立重放通过。按[0053](decisions/0053-three-color-flow-palette.md)五参考比较后原创接入24×24 HSV三色、灰阶亮度分位、40°分离/补齐、有界缓存和三色背景，保留单色语义主题及唯一播放意图。366业务/类型与完整native通过；正式入口SourceUITests-1792277163729背景全流程329.540秒通过，1通过/零失败/跳过：两页实际红绿蓝像素、原红蓝切歌/跨页/开关/重启、经典页PCM、系统Home→激活、收起/暂停/开关恢复和凭据清理。截图已亲看；12次本机合成鉴权成功/0失败，本轮无新stream，复用已有临时音频缓存，不计真实私人服务或冷下载。

首轮编译及两轮导航/像素排序失败保留；第四轮1792276291425在清理阶段中断、xcresult缺Info.plist，无最终状态，不计通过。JPEG重编码影响等宽条排名，真实JPEG原生专项和排序无关三色集合断言均通过，未放松三色必须同时存在。验收日志/counts/摘要与截图留build/logs/ui-flow-palette-passed*、build/flow-palette-passed。清洁归档/push/对应iOS27继续；8f865af/39072820731当前唯一运行、0排队，最新完整成功且IPA核验仍为76c9cd0。完整参考场景/动态/功耗、真实服务/签名/手机以及全部A/F/J保持active。

## 2026-10-18 背景可见性清洁归档与push回执

`8f865af0569a9fa5b53a65cdd70a2126580a25e7`正常push；archive-background-visible-clean.log成功。manifest dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离/私人及签名资源排除通过。IPA SHA256 `28af9fffc93b082c8333b0849aa3d7022f8a0d70c73f26cbd6325cdb340d5807`，留存build/local-background-visible-8f865af。359业务/类型、正式背景308.007秒及截图见下；验收后strict review24E/23F/23P、8WI/47事件零错误/警告，手写验收时间提前一分钟已追加更正，结果未改。

push后API核对[39072820731](https://github.com/RhsR1024/nexus-music/actions/runs/39072820731)/8f865af唯一pending，[39066065139](https://github.com/RhsR1024/nexus-music/actions/runs/39066065139)/6c8be2f仍运行，1运行/1排队；2db0872旧pending39070885003自动取消，不计通过。未取消运行或重派旧版。最新完整成功且IPA核验仍为76c9cd0/39050349015；本批对应云端、完整参考运行/功耗、真实服务/签名/手机继续。

## 2026-10-18 背景可见性本地阶段验收

reverse-skill新R2/mobile-reverse、固定离线scope/case-guard、E024独立2358原始指令/28BL/9池加载重放及采纳前严格review24E/23F/23P、8WI/44事件通过。五参考固定HEAD/实现/维护/Android/许可及原创可见门控见[0052](decisions/0052-background-visible-owner.md)。全屏播放页打开时移除隐藏根背景MotionImage，保留静态渐变与经典/现代背景独立职责；无原生播放后端/依赖改动。

`check-background-visibility.log`为359业务/类型通过；正式入口`SourceUITests-1792273286451.xcresult`的完整背景专项308.007秒、1通过/零失败/跳过，iOS26.3.1/23D8133模拟器、Xcode26.3/SDK26.2。红蓝封面实际像素/跨页/独立开关/重启、经典页实际PCM、系统Home→激活、收起恢复/暂停、夹具凭据清理通过。已亲看经典蓝背景与返回外观页截图，留存build/background-visible-passed。日志/counts为build/logs/ui-background-visible-passed.log和ui-background-visible-counts.json；20成功鉴权/0失败、8次本机合成stream，不计真实个人服务。首轮遗漏UITest目标前缀返回70且0测试执行，单独保留，不计产品失败或通过。

测试标识仅观察Animated实际采用的门控，不证明不可见层的实测耗电、帧率或完整参考场景等价。清洁设备归档/push/对应iOS27继续；参考完整palette/场景/运行、真实服务/签名/手机与全部A/F/J继续。云端前批6c8be2f/39066065139核心App已成功，歌词匹配健康发现运行，2db0872/39070885003唯一pending。

## 2026-10-18 分页恢复清洁归档与push回执

`2db0872a18a41b692ef620a7fedc894fc5a3f577`已正常push并核对远端main一致。359业务/类型、完整发现App145.119秒及两次失败/页序列核验、截图亲看通过；验收后strict review23E/22F/22P、8WI/43事件零错误/警告。清洁归档dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；CRC/附带摘要、归档可执行及JS字节一致、正式入口隔离/私人及签名资源排除通过。IPA SHA256 `d326ac91c04a8c6834ca8d74031a20944bcbdef564a92575329b4a3054272682`，留存`build/local-discovery-pager-2db0872`。此条覆盖本批归档/push待办，不扩展真实服务/签名/手机结论。

push后API实核39070885003/2db0872唯一pending、39066065139/6c8be2f仍运行核心App，1运行/1排队；07a6de3旧pending39069432881由single自动取消，不算通过，代码包含于最新。未取消运行或重派旧版。最新完整成功且IPA核验仍为76c9cd0/39050349015，只覆盖实际代码。下一A04背景算法/生命周期已新路由并过前置门禁，尚未新Evidence/产品采纳；全部A/F/J、完整参考运行、真实服务/签名/手机目标active。

## 2026-10-18 发现分页与刷新恢复（本地验收通过）

reverse-skill新R2/mobile-reverse路由、既有离线scope和E023→F022→P022采纳前严格review通过23E/22F/22P、8WI/42事件；610原始指令/10BL/3池加载与回边独立核验。五参考固定HEAD及维护/Android/许可取舍见[0051](decisions/0051-discovery-pager-recovery-validation.md)。仅支持静态入口边界，不推断参考失败界面/缓存时效/运行协议。

359业务/类型、完整发现App1792271857949的145.119秒零失败/跳过：追加失败保留100/101、同页重试到101/101，刷新失败保留两页/数量/筛选，成功重试替换身份并复位下一页；独立服务器页序列[0,1,1,0,0,1]、两次失败。原取消/完整读取截断/收藏/重复项/两种Sheet/清理均通过；已亲看失败保留与替换截图。22次本机合成请求、无音频，不计真实provider；未修改产品/后端/依赖。清洁归档/push/对应iOS27继续，全部A/F/J、完整参考运行、真实服务/签名/手机保持active。

## 2026-10-18 完整读取校验清洁归档与push回执

`07a6de313e8b4483471491c7a171ba34f95f7cb1`已正常push，远端main一致。359业务/类型、完整发现App125.372秒零失败/跳过和截断2/3保留截图通过；验收后strict review22E/21F/21P、8WI/41事件、零错误/警告。清洁归档dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `3ecc1d8da2592225ac36b40d0f4fa2e215f82f8b33eba4ebc1e45e21b89eaa20`，留存`build/local-discovery-completeness-07a6de3`。此条覆盖本批归档/push待办，不扩展真实服务/签名/手机验收。

push后API实核39069432881/07a6de3唯一pending、39066065139/6c8be2f继续运行，1运行/1排队；0b57726旧pending39068540573由single自动取消，不算通过，最新提交包含其修正。未取消运行或重派旧版。最新完整成功且IPA核验仍为76c9cd0/39050349015，只覆盖其实际代码。下一发现刷新/pager缓存关系已新路由并过前置门禁，5函数610原始指令的初步探查只留忽略notes，尚未新增不可变功能Evidence或采纳结论；全部A/F/J与参考完整运行、真实服务/签名/手机保持active。

## 2026-10-18 完整歌单数量与取消校验（本地通过）

reverse-skill新R2/mobile-reverse路由、既有离线scope/case-guard及E022→F021→P021采纳前40事件严格review通过；五参考固定HEAD/实现/维护/Android/许可及原创取舍见[0050](decisions/0050-complete-playlist-count-validation.md)。E022只证明数量helper和独立loadAll边界，参考完整计数/分页/取消语义未恢复。

5项独立失败基线复现终页截断/超量、非法/变化/遗忘已知数量及取消后末页返回。原创complete每页返回后检查abort，保留并核对声明总数，终页严格数量相等；未知总数、顺序/重复项与原分页上限保持。359业务/类型通过，App1792270600285完整发现专项125.372秒零失败/跳过：截断拒绝确认、重试完整结果预览2首、原导航取消/收藏/重复项/两种Sheet/清理通过；2/3计数与错误/两首歌曲保留截图已亲看。16次合成wire请求、无音频，不计真实服务。清洁归档/push/对应iOS27继续，全部A/F/J、参考完整运行、真实服务/签名/手机保留。

## 2026-10-18 发现取消修复清洁归档与push回执

`0b57726995f5fb8de92f6c9f1823a470108d50b5`已正常push，远端main一致。352业务/类型、发现114.383秒/离线200.468秒实际PCM与Range专项通过，strict review22E/21F/21P、8WI/40事件零错误/警告。清洁归档dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `9817c8e2da16ef5d55c6a931b0a739fcdf6e870d07bda68b43b9f83fe0134b1f`，留存`build/local-discovery-cancel-0b57726`。初次归档核验参数误写完整提交号触发断言；从git/manifest取得实际完整SHA后核验通过，产物未改。此条覆盖本批归档/push待办。

push后API实核39068540573/0b57726唯一pending，39066065139/6c8be2f继续运行，1运行/1排队；未取消运行或重派旧版。AM2/39058310652失败诊断完整ZIP已验SHA256/4804条目CRC，本批本地离线修正通过仍不能代替iOS27。最新完整成功且IPA核验仍为76c9cd0/39050349015。下一已有发现完整分页/截断保护继续审查；全部A/F/J、真实服务/签名/手机及完整参考运行保持active。

## 2026-10-18 离线云端失败定向复验（本地通过）

AM2/39058310652的首因仍是旧测试查询屏幕外暂停按钮isHittable抛Activation point invalid，未推断产品下载/音频故障。仅测试加入exists/正尺寸/整框可见短路后才查询isHittable，保留原中心拖动和全部实际音频/Range/阻断服务/清理断言；选经典后显式等待样式Sheet消失，避免自动关闭与下一导航重复点击。首轮1792268779844已完成full1/resumed1/blocked0但边缘拖动无法收起，219秒失败；恢复中心拖动后1792269279648在准备阶段22.878秒遇Sheet自动关闭竞态，均保留失败与截图/层级。

最终SourceUITests-1792269442492完整离线专项200.468秒通过、零失败/跳过：真实下载暂停/重启1024MB保持、条件Range继续、完整文件、清空临时缓存、阻断服务器后的离线PCM播放不新增stream/blocked=0、删除取消/确认和凭据清理。服务计数full1/resumed1/blocked0，鉴权14成功/0失败，stream累计6（含播放阶段请求；断服务前后相等另有实际断言），已亲看11.0MB已完成文件截图。没有改产品播放/下载后端或新增依赖；本地SDK26.2不能代替iOS27，修正待随本批清洁归档/push进入新队列，旧云端失败不改写。真实服务/签名/手机及全部A/F/J保持。

## 2026-10-18 发现完整读取的导航取消（本地通过）

reverse-skill新路由R2/mobile-reverse，既有离线scope/case-guard及E022→F021→P021严格review保持；采纳前39事件，验收后22E/21F/21P、8WI/40事件零错误/警告。五参考固定HEAD/生命周期/维护/Android/许可与边界见[决策0049](decisions/0049-discovery-read-navigation-cancellation.md)；不把参考静态loadAll名称解释为完整取消语义。

音枢原问题是完整读取abort后旧finally保留importing，返回再入详情时导入入口一直禁用。服务器hold/release屏障确认held=1，旧代码1792268341340在22.380秒精确失败于入口未恢复；仅在上下文变化复位局部读取状态/旧提示，保留Abort/迟到guard。352业务/类型通过，最终1792268529189完整发现专项114.383秒通过、零失败/跳过，包含重入/重新读取预览并取消/无迟到确认和原收藏/重复歌单项/两种Sheet归属/清理；截图已亲看。3列表/5详情为本机合成服务，不计真实provider；无新原生后端/依赖，清洁归档/push/对应iOS27继续。并行跟进AM2云端离线测试可见性失败，详见最新构建回执；全部A/F/J、真实服务/签名/手机保留。

## 2026-10-18 04:28 云端 AM2 离线专项失败回执

API核实 `332cac5` / [39058310652](https://github.com/RhsR1024/nexus-music/actions/runs/39058310652) 已失败：checks/native/核心App及歌词匹配健康发现均成功，离线专项72.281秒在旧Swift176获取“暂停”按钮isHittable时抛出Activation point invalid，尚未执行恢复Range/阻断服务播放断言。后续600秒诊断超时不是首因；iPad/归档被跳过，无本批云端IPA。经浏览器步骤日志核对的证据与下载状态留存 `build/ci-39058310652/FINDINGS.txt`；诊断artifact12113032789完整483716929字节已下载，SHA256 `05d0f657a8bf35b9e2ede47027cd988483775f8d1fea9beee3dcd9577f4eabe8`与4804条目全ZIP CRC通过；本地xcresult摘要独立复核同一首因，已亲看录屏70秒帧；失败层级中暂停y875.3超出窗口底874点。不能宣称产品下载/音频故障。

该导航辅助逻辑增加exists/正尺寸/整框入屏后才查询isHittable与失败截图/层级；最终保留原中心拖动，并等待样式Sheet完成自动关闭。原PCM、Range、暂停重启、断服务和清理断言保留，产品播放/下载实现未改；最终本地专项200.468秒通过详见上文，待本批清洁归档后提交上云。后续 `6c8be2f` /39066065139已开始核心App，未包含本次未提交的导航修正；当前1运行/0排队，未取消或重派。最新完整成功仍为76c9cd0/39050349015；全部A/F/J与真实服务/签名/手机验收保持。

## 2026-10-18 历史日期分隔清洁归档与push回执

`6c8be2ff4724a721e62e536cad4ceae2c5eaff5d`已正常push并核对远端main一致。清洁归档manifest dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `8bfdf0f7b3b1c5195d5f8b4d5ce3685b8f99e39e312f99e6ac08b284ef7dcf7d`，留存`build/local-history-calendar-6c8be2f`。352业务/类型与正式App260.169秒、日期截图/重启及39事件严格review见下；此条覆盖本批归档/push待办。

push后API实核39066065139/6c8be2f唯一pending，39058310652/332cac5继续运行（核心App及歌词/匹配/健康/发现已过，断服务离线组执行中），1运行/1排队。EQ旧pending39065099990/be16e10由single自动取消，不算通过；未手动取消运行或重派旧版。最新完整成功且IPA已核验仍为76c9cd0/39050349015，仅覆盖其祖先。下一发现完整读取取消/导航的原创状态边界审查继续，尚未产品修复或采纳新参考动态结论；全部A/F/J与真实服务/签名/手机目标保持active。

## 2026-10-18 播放历史本机日期分隔（本地通过）

reverse-skill E022→F021→P021采纳前strict review22E/21F/21P、8WI/38事件零错误/警告，2033原始指令/15BL/5分配头及池偏移已独立核对。五参考固定HEAD/维护/Android/许可与原创取舍见[决策0048](decisions/0048-history-calendar-sections.md)。仅现有最近播放增加本机日历日期标题，不排序或改变歌曲索引/身份/前20项加载更多及唯一播放入口；无效日期回退，epoch0有效，不把未知参考时区/文案当作已还原。

352业务/类型检查通过，含UTC/上海/纽约午夜/跨年/闰日及夏令时跳时与重复时刻。正式入口SourceUITests-1792267559956的实际Navidrome合成播放/PCM/八布局/歌词/统计/mini/凭据清理260.169秒通过，零失败/跳过；新增日期标题可达与重启保持断言通过，日期/时间轴/歌曲截图已亲看。鉴权8次成功、0失败，无新stream请求，使用既有临时音频缓存，不能称本次冷下载或真实个人服务。验收后strict review22E/21F/21P、8WI/39事件零错误/警告。无新原生后端/依赖，清洁归档/push/对应iOS27待；发现完整分页/参考运行、全部A/F/J与真实服务/签名/手机继续。

## 2026-10-18 EQ清洁归档与push回执

`be16e10b52919a0a5a97f56ecb487ba9fcb94535`已正常push，远端main一致。清洁归档manifest dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `815aaa35f2e71efbed227ad13b237490d3b7f04f1c6a4113b1d99854fcae57e3`，留存`build/local-eq-state-be16e10`。350业务/类型、完整native和App184.998秒及两项失败基线见下；验收后strict review22E/21F/21P、8WI/38事件、零错误/警告。此条覆盖本批归档/push待办。

push后API实核39065099990/be16e10唯一pending，39058310652/332cac5继续运行（核心App已过，歌词/匹配/健康/发现组执行中），1运行/1排队。背景旧pending39063744433/e8941b0由single自动取消，不算通过；未手动取消运行或重派旧版。最新完整成功且IPA已核验仍为76c9cd0/39050349015，仅覆盖其祖先，不覆盖AM2/mini/字体/背景/EQ。下一A08发现/歌单/历史已有E022静态证据与严格review，独立模型/UI审查继续，未采纳日期分组/完整分页或新后端；全部A/F/J、真实服务/签名/手机目标保持active。

## 2026-10-18 EQ权威状态与启用校验（本地通过）

reverse-skill E021→F020→P020采纳前strict review21E/20F/20P、7WI/34事件，独立重放4433原始指令/18BL/manifest哈希通过；五参考固定HEAD及维护/Android/许可比较见[0047](decisions/0047-eq-state-validation.md)。音枢原创validate补eqEnabled布尔校验：非法更新在持久化/订阅前拒绝，坏记录沿既有原始隔离；缺失旧字段默认false，关闭/写入失败保留曲线和前级。两项独立失败基线保留，修正后350业务/类型通过。首轮check被build内临时基线TS文件相对导入阻断，改为留存.txt后完整检查通过，未改工程编译排除规则。

正式入口SourceUITests-1792266325928的EQ专项184.998秒通过、零失败/跳过：实际前级/曲线选中、独立归零不改频段、关闭后重启保留设置、禁用仍按实际预设选中、重置十频段与前级为0且保持启用、自定义重应用/删除及睡眠。已亲看平直曲线和选中卡截图，零网络请求；完整native-eq-state.log exit0，真实RMS/逐样本旁路/解码PCM等通过（既有Swift Sendable警告）。UI开关不冒充实际声音证据；无新原生后端/依赖，清洁归档/push/对应iOS27待，真实服务/签名/手机及完整参考运行另验。

下一发现/歌单/历史E022已形成2033原始指令/15BL/5分配头证据；暂未产品采纳。重跑case-init误覆盖案例记录，已从原工具输出恢复完整36事件/7原工作项、补回状态并记录事故，原始Evidence未改；恢复strict review22E/21F/21P、8WI/37事件零错误/警告，禁止既有案例再次初始化。全部A/F/J目标继续active。

## 2026-10-18 背景Sheet清洁归档与push回执

`e8941b014eac04f9f84e38dcb0e81a20b7605d26`已正常push，远端main一致。清洁归档manifest dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS对归档字节一致、正式入口隔离/私人参考及签名资源排除通过。IPA SHA256 `18857ebea41640ce2308f38ae2bba0a2bb7b6ac042e553a10ca9ed2bdea8d644`，留存`build/local-background-sheet-e8941b0`。348业务/类型和最终分项Files102.911秒/大字86.835秒及首轮实际背景/外观回归见下；验收后strict review21E/20F/20P、7WI/35事件，零错误/警告。

push后API实核39063744433/e8941b0唯一pending，39058310652/332cac5继续运行，1运行/1排队。字体旧pending39061650305/b79edb6由single自动取消，不算通过；未取消运行或重派旧版。最新完整成功且核验产物仍为76c9cd0/39050349015，只覆盖其祖先，不覆盖AM2/mini/字体/背景。下一EQ已完成E021静态review/独立字节重放与两项原创失败基线，补齐布尔校验/独立归零/重置/旁路持久化专项继续；全部A/F/J、真实服务/签名/真机保持active。

## 2026-10-18 主题与背景设置 Sheet（本地通过）

reverse-skill mobile-reverse E020→F019→P019与E009共用模态链已在采纳前严格review通过（20E/19F/19P、7WI/33事件，零错误/警告）。3044条原始指令字节支持主题包装/颜色字段/对话返回边界；本批仅按[0046](decisions/0046-theme-background-sheet.md)将现有背景设置放入原生Sheet，保留图片导入/移除、原子偏好、独立全局/播放动效及音枢功能，不新增未验证HSV/默认值。最终348业务/类型检查通过。首轮正式入口1792264933860四项通过（外观89.222秒、大字77.053秒、实际全局背景260.441秒、真实Files图片105.813秒），但截图发现大字预览裁切/按钮越界；已改为预览随内容增长、窄屏/大字纵排及44点触控。最终代码1792265663902图片导入/删除/重启102.911秒通过；该组新增预览查询因父子同名失败，保留失败并限定firstMatch后，1792265870384大字/预览边界/两按钮实际修改恢复/关闭下滑/分类滚动/重启86.835秒通过，零失败/跳过，最终截图已亲看。未改动原生后端或新增依赖。本批清洁归档/push/对应云端iOS27仍待，完整参考HSV/默认值/运行及全部A/F/J、真实服务/签名/真机范围保持。

## 2026-10-18 字体与歌词Sheet清洁归档/push回执

`b79edb6e81fd01f9511ed0eb13a461c1db3f8b64`已正常push；清洁归档manifest dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned。ZIP CRC/附带摘要、可执行及JS对归档字节一致、正式入口隔离/私人参考及签名资源排除通过，IPA SHA256 `5059f0229d3435351233f828f43b7f122df674c5e329b94cea6e2c265c94ae82`，留存`build/local-font-sheets-b79edb6`。348业务/类型及App3/3见下；验收后严格review19E/18F/18P、7WI/32事件、零错误/警告。

push后API实核39061650305/b79edb6唯一pending、39058310652/332cac5继续运行，1运行/1排队。mini旧pending39059968173/23bc73c由single自动取消，不算通过；未手动取消运行或重派旧版。最新完整成功仍为76c9cd0/39050349015，不覆盖AM2/mini/字体；新终态继续。下一背景设置批次已新路由并补E020原始证据、严格review20E/19F/19P、33事件通过；尚未实施，不计功能完成。真实服务/签名/真机与全部A/F/J继续。

## 2026-10-18 字体角色与歌词显示 Sheet（本地通过）

reverse-skill mobile-reverse E019→F018→P018已在采纳前严格review：19E/18F/18P、7WI/31事件，零错误/警告；2057条原始指令字节、BL、池偏移与模式字段支持独立歌词显示/参数化字体模态和全局/歌词setter分支。按[0045](decisions/0045-font-display-settings-sheets.md)原创拆分现有全局字体、歌词字体、显示设置入口；同一原生Sheet切换，保留分类滚动与现有原子导入/继承/删除回退、全部显示控件及八布局唯一播放意图。348业务/类型检查通过；正式入口`SourceUITests-1792263616441.xcresult`三项通过、零失败/跳过：最大辅助字号/三角色/关闭下滑/分类滚动73.984秒，字体真实Files导入/全局与歌词继承系统选择/居中模糊重启/八布局实音PCM/播放器内角色入口/删除回退344.580秒，分组导航与草稿/滚动保留109.934秒。已亲看三种大字Sheet与导入原创三角字体截图；大字长内容仍需滚动，关闭与操作可达。本轮鉴权8次成功、0失败，无新stream请求，允许既有临时音频缓存，不能称本次冷下载。未修改原生音频/脚本后端，无新依赖；清洁归档/push/对应iOS27继续，真实服务/签名/手机及完整参考运行等价仍待。完整参考选项/默认值/动态运行、清洁归档/push/对应iOS27及真实服务/签名/手机继续；全部A/F/J目标保持active。详见[报告](2026-10-18_reverse-sollin-font-settings-report.md)。

## 2026-10-18 mini／底栏 Sheet 清洁归档与push回执

`23bc73c4570e91eba7c3ae539b3512c759cfd3e8`已正常push，远端main一致。`archive-mini-navigation-sheets-clean.log`成功；manifest dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned。ZIP CRC、附带摘要、可执行及JS与归档字节一致、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `e23b0ac10ea77ca79e283f6b5b829e1c9e1fce540b2b656583de82fe438d3483`，留存`build/local-mini-navigation-23bc73c`。本条覆盖本批清洁归档/push待办；348业务/类型、正式App3/3和严格review18E/17F/17P、30事件、零错误/警告见下，不能代替参考运行、真实服务、签名与手机验收。

push后API核对：[39059968173](https://github.com/RhsR1024/nexus-music/actions/runs/39059968173)/23bc73c唯一pending，[39058310652](https://github.com/RhsR1024/nexus-music/actions/runs/39058310652)/332cac5继续运行，1运行/1排队；未取消运行中或重派旧版。76c9cd0/39050349015完整iOS27成功并核验IPA见下，不能覆盖AM2/mini。下一字体/歌词显示设置离线批次已重新路由mobile-reverse并通过前置门禁，仅有本机限定原始调用探查，尚无新不可变功能证据或采纳review；全部A/F/J目标保持active。

## 2026-10-18 舞台及生命周期修正版 iOS27 成功与产物核验

`76c9cd0ad069455893833face9060ef9e2eb1950` / [39050349015](https://github.com/RhsR1024/nexus-music/actions/runs/39050349015) 已完整成功：checks、完整native、核心App、歌词/匹配/发现、离线断服务播放、iPad窗口/旋转、设备归档与上传均成功。IPA artifact12110443053已实际下载，ZIP10335717字节、API SHA256 `917e258f1da78fa4e684ed217d94a2132345126ad68f85b2b3e56293295fe54b` 与完整CRC通过；内部IPA附带摘要/CRC、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `09aa12fa4c3f62f773f2cddec14bd25051a3c45864801d3e3452489b0eada082`，留存`build/ci-39050349015`。

manifest为Xcode27.0/27A266a、iphoneos27.0、arm64、min15.1、设备族[1,2]、unsigned；dirty=true唯一`ios/Podfile.lock`。成功只覆盖76c9cd0及祖先，包含有界舞台与生命周期测试修正，不包含后续AM2、EQ滚动测试修正或mini设置Sheet。AM2运行39058310652已开始，当前1运行/0排队；本批mini仍未提交。旧失败不改写，签名、真实服务、手机和完整参考运行等价继续独立验收。

## 2026-10-18 mini／底栏设置模态本地验收通过

reverse-skill mobile-reverse E-018→F-017→P-017采纳前严格review18E/17F/17P、7WI/29事件、零错误/警告；实施验收后严格review为30事件、零错误/警告。原始BL/1844条指令的原始字节核验支持两设置调用共用模态包装、mini最多4项和添加/排序/移除汇入同一标准化保存入口；完整参考选项/几何/异步失败/运行仍待。音枢仅将现有mini和底栏设置改为原生pageSheet，保留外观滚动、当前按钮/原子保存/唯一播放意图，未新增伪样式；五参考固定HEAD/维护/Android/许可及验收见[0044](decisions/0044-mini-navigation-settings-sheets.md)。348业务/类型检查通过；正式入口`SourceUITests-1792262213912.xcresult`三项通过、零失败/跳过：mini/底栏最大辅助字号关闭/下滑/重开/滚动/重启159.603秒，主题46.171秒，Navidrome合成实音/PCM/八布局/暂停定位/mini四项上限排序/原曲收藏/实际录音歌词/重启/恢复默认并关闭后验证队列按钮消失/凭据清理242.101秒。已亲看mini与底栏大字Sheet和真实四按钮mini截图；大字长内容仍需滚动。未修改原生播放/脚本后端，无新依赖。清洁归档/push及对应iOS27继续；真实服务、签名、真机和完整参考运行等价仍待。

## 2026-10-18 AM2 清洁归档与push回执

`332cac51b12ba26fe28f0df69f7c1af16c5eaeb4`已正常push，远端main一致。`archive-am2-clean.log`成功；manifest dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned。ZIP CRC、附带SHA256、可执行及JS与归档字节一致、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `aa1c4f1722a0f3c925804d8b0db02d1d635b29587964dd900362acf36bd30727`，留存`build/local-am2-332cac5`。本条覆盖本批清洁归档/push待办；348业务/类型、手机/iPad/共享歌词评论/最终字体EQ分项及严格review28事件见下，不代表参考运行等价或真实服务/签名/真机通过。

push后API核对[39058310652](https://github.com/RhsR1024/nexus-music/actions/runs/39058310652)/332cac5为唯一pending，[39050349015](https://github.com/RhsR1024/nexus-music/actions/runs/39050349015)/76c9cd0继续运行，1运行/1排队；未取消运行中或重派旧版。新云端终态继续跟进。下一mini控件/底栏证据批次重新路由mobile-reverse并通过前置门禁，尚无新功能证据/采纳结论；全部A/F/J和真机范围保留。

## 2026-10-18 AM2 本地阶段验收通过

reverse-skill mobile-reverse E016/E017采纳门禁保持，本轮严格review17E/16F/16P、7WI/28事件、零错误/警告。原创第八种AM2接入独立封面/歌词/队列/评论、前台可见空闲计时及独立true/5秒/音量隐藏默认值，保留原七布局与音枢唯一队列/意图；348业务及类型检查通过，见[0043](decisions/0043-responsive-am2.md)。

`SourceUITests-1792258015969`正式入口3/3通过、零失败/跳过：横屏101.944秒、大字152.285秒、八布局综合播放245.337秒。覆盖真实合成流/PCM、歌词双击0:06、滚动/长按不误定位、自动展开、互斥队列/评论、独立音量30%不改变进度、设置、mini、重启统计及凭据清理。亲看全屏横屏分栏、大字及音量截图；XCTest app.screenshot旋转裁切与XCUIScreen完整显示分开记录。大字仍需滚动阅读长行和有界控制，不能冒称完整参考几何等价。

iPad原生窗口导航48.214秒通过；AM2首轮因系统保持窄浮窗而旋转断言失败，复用已有真实系统窗口展开流程后，`SourceUITests-1792259075572`横竖/定位/长按/凭据清理111.209秒通过、零失败/跳过。AX分栏/可达断言与截图分开记录，保留XCTest旋转捕获异常，不称精确参考几何。独立夹具入口`1792259401988`歌词145.611秒/公开评论18.021秒2/2通过。

代码复核补齐AM2显式歌词居中传递后，348业务/类型通过；正式入口`SourceUITests-1792260743427`最终2/2通过、零失败/跳过：字体导入/居中重启/八布局实音367.814秒，EQ预设103.517秒。亲看AM2自定义字体、居中/模糊和EQ卡片附件。早期触摸、字号、AX及中断残留偏好的失败均留存；清洁IPA/push和本批iOS27继续。云端76c9cd0/39050349015已过checks/native/核心App/歌词匹配发现，正在离线断服务播放，后续iPad/归档未验。参考cover-flight/连续手势/完整特效/手机性能及全部其他A/F/J、真实服务/签名/真机范围保留。

## 2026-10-18 旧 EQ 云端失败定位与本地定向复验通过

39042804499/fcffd28诊断artifact12106576521完整373189303字节已下载，SHA256 `43a36a68d0e3c1c05415ae9ea3b202bad5f20e0ef7c3ad928d038c0a3b182621`和1834条目ZIP CRC通过。xcresult为17通过/1失败/零跳过；唯一失败`testGraphicalEQPresetPersistence`159.001秒，旧Swift1075为`Control not fully visible: "Nexus EQ Test" Button`。`ui-catalog.log:49360`及亲看录屏150秒帧确认重启后测试一直停在EQ顶部；不能说预设丢失、音效失败或已完成产品修复。

测试滚动改为实际`settings-viewport-*`的外侧padding坐标，避开曲线/滑杆响应区，保留完整可见、预设应用/删除/重启、精确增益与睡眠全部断言，并增加失败截图/层级。最终本地EQ专项103.517秒通过；76c9cd0/39050349015核心App的同一旧EQ已通过，歌词发现组也已通过，正在离线断服务播放；不将一次成功解释为间歇滚动根因闭环，不重派旧版或取消运行。

字体新增居中检查两次在重启后的XCTest selected trait失败（83.899/81.717秒）；第二次保存前selected断言通过，重启后的录屏可见“居中 ✓”、只读查询持久化值center。现在以实际可见“居中 ✓”断言重启选择，保留保存前selected/字体实音/删除恢复；无新增存储修补。第二组样式最大辅助字号258.491秒通过，包含AM2独立选择及重启。最终字体/八布局实音367.814秒与EQ103.517秒在1792260743427中2/2通过；不将此前失败组改写为通过。

## 2026-10-18 生命周期测试与 CI 失败摘要修复

39046035422/ad784b5在native生命周期第38行失败，App/归档均未执行。取消测试不再用150ms固定休眠推断脚本已完成；改由同一脚本的完成屏障确认延迟任务结算，再核对计数和取消回调仅一次。产品ScriptRuntime与播放后端未改。完整本地native-am2-resumed.log exit0，JSC/生命周期/DSP/真实合成解码/系统媒体/缓存/DAV/图片均通过；scripts/test-ui.mjs语法检查通过。脚本新增xcresult摘要和逐项失败文本输出，保持xcodebuild原退出码与完整日志，避免尾100行只显示最后一个通过项。

39042804499/fcffd28核心组18项17通过/1失败，唯一testGraphicalEQPresetPersistence；Navidrome播放191.015秒通过，EQ具体断言还在下载诊断核对。该失败不计成功，不重派旧提交。当前修复阶段只改测试/诊断，无新增产品IPA或AM2验收声明；AM2工作树与全部A/F/J、真实服务/签名/手机继续。76c9cd0已正常push并核对远端main一致；新39050349015已通过checks和完整native，正在App前准备，1运行/0排队。此结果只证明原生阶段修复，App/归档终态另记。

## 2026-10-18 00:39 前的云端失败诊断与 AM2 首轮记录

API实核39046035422/ad784b5失败于native：LifecycleTests.swift:38在取消后固定等待150ms再断言计数，未进入App；现改为脚本完成屏障并校验取消回调仅一次，完整native-am2-resumed.log本地通过。39042804499/fcffd28核心18项17通过/1失败，唯一testGraphicalEQPresetPersistence，Navidrome播放191.015秒通过；完整作业日志ZIP CRC已验，诊断包仍下载中，EQ具体断言尚待。当前0运行/0排队，没有重派旧提交。

AM2首轮正式入口1792253672581于140.115秒失败：自动展开已出现，双击真实歌词后进度仍1:00，未达到0:06；日志/summary/counts/附件保留，不能计作通过。第二轮已过最大辅助字号样式205.908秒，播放项仍在执行。业务检查曾尝试不受当前RN类型支持的delaysContentTouches属性，已撤回；最终检查与AM2定位/大字播放/iPad/归档/push仍待。test-ui新增xcresult摘要与具体失败输出，保持原xcodebuild退出码，避免云端只显示最后100行遗漏前项断言。真实服务/签名/手机及其余A/F/J继续。

## 2026-10-18 00:31 心跳：两批云端失败分开跟进

API及作业日志实核：环形定位 `fcffd28` / [39042804499](https://github.com/RhsR1024/nexus-music/actions/runs/39042804499) 的checks/native成功，首组核心App为18项中17通过、1失败，唯一失败 `testGraphicalEQPresetPersistence`；末尾摘要未包含具体断言，不能推定为环形定位或DSP故障。原始作业日志留存 `build/ci-39042804499/job-logs`，诊断artifact12106576521（373189303字节）尚待完整/条目校验后定位；600秒诊断收集超时发生在测试失败之后，不是已知首因。

歌词舞台 `ad784b5` / [39046035422](https://github.com/RhsR1024/nexus-music/actions/runs/39046035422) 的checks成功，native在旧 `LifecycleTests.swift:38` 取消后固定150ms等待的计数断言失败，exit133；尚未进入App/iPad/归档。当前AM2工作树已有真实Promise settle屏障及取消回调仅一次断言，`build/logs/native-am2-resumed.log`记录本地native通过，但修正尚未提交/上云，不能计为云端修复完成。两批均无新云端IPA。

当前本地AM2正式App专项正在另一执行上下文运行；本心跳不修改其实现、不启动竞争构建、不提交混合工作树或重派旧运行。下一功能批次须闭环EQ具体失败、保留原断言，结合生命周期修正完成本地专项/清洁IPA/diff及隐私检查后正常提交push，再验新iOS27。最新完整云端成功仍仅为 `35e6f2f` /39034909819；全部F/J/A余项与真实服务/签名/手机验收继续。

## 2026-10-17 AM2静态证据阶段检查

本批只有逆向证据和文档，没有产品/原生/依赖变更；未重复宣称新的App、native或IPA通过。E016/E017均以固定样本原字节验证，最终reverse-skill严格review17E/16F/16P、7WI/26事件、零错误/警告；见[AM2报告](2026-10-17_reverse-sollin-am2-report.md)。文档链接/一致性及diff检查按本批风险执行。音枢七布局保持，AM2实施与完整横竖/内容/自动计时/控件排除验收继续；舞台ad784b5本地实测沿下方记录，对应iOS27仍待终态。

## 2026-10-17 有界歌词舞台清洁归档与push回执

`ad784b539869b9380eee2cc1ee504428236acd6d`已正常push并核对远端main一致。`archive-lyric-stage-clean.log`成功，manifest dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned。ZIP CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离和私人参考/签名资源排除均通过；IPA SHA256 `33f49a94a5cf038ef038c667c8192502de77e6af493174ee47e35c527026cc09`，留存`build/local-lyric-stage-ad784b5`。342项业务/类型及分项App结果见下；采纳前review23事件，实施验收后review24事件、15E/14F/14P、7工作项、零错误/警告。此条覆盖本批清洁归档/push待办，不能代表完整参考特效、真实服务、签名或手机验收。

push后当前GitHub Actions HTML嵌入状态实核：[39046035422](https://github.com/RhsR1024/nexus-music/actions/runs/39046035422)/ad784b5为唯一pending，[39042804499](https://github.com/RhsR1024/nexus-music/actions/runs/39042804499)/fcffd28继续运行，1运行/1排队。未取消运行中任务或重派旧版；本批对应iOS27终态继续跟进。下一AM2离线分析已重新路由mobile-reverse并通过前置门禁，仅有本机限定字节探查，尚未建立新功能收据/review或实施；不能计作第八布局或完成。全部A/F/J余项持续。

## 2026-10-17 舞台设置最终复测通过

`SourceUITests-1792251015965.xcresult` 2/2通过、零失败/跳过：分组导航与草稿109.951秒；最大辅助字号样式146.224秒，覆盖wave原断言和新增stage重启持久化。亲看`build/stage-settings-final-attachments/0CBA56CF-4E80-45D1-8B03-20CF96826B1F.png`，大字标题换行、关闭与列表选择可达。日志/summary/附件留存；首轮失败未抹去。最后将首个真实词起点晚于行起点的间隔保留为等待，并添加独立边界测试；`check-stage-onset-final.log`342/342及类型通过。既有App合成词起点与行一致，前述App结果分别记录，不虚称延迟首词已在App实跑。本批清洁归档/push与对应iOS27继续。

## 2026-10-17 舞台正式入口播放与大字失败修正

`SourceUITests-1792250677865.xcresult` 为1通过/1失败，不能写整组通过。正式入口`testZNavidromePlaybackAndCredentials`206.720秒通过：真实合成流/PCM、七布局、暂停/播放环形定位、共享进度、歌词、统计、mini/重启与凭据清理；舞台在60秒选中`two`，亲看`build/stage-production-first-attachments/88075121-D1C8-4EE9-8877-31E82FB83B94.png`的部分原生扫色与暂停控制。无音频/歌词原生后端实现变化。

大字样式项17.153秒失败于`openSettings`旧Swift16：整屏0.7→0.35拖动后设置分类从AX消失，剩下经典播放页。日志/层级和亲看的录屏15秒帧`build/stage-style-first-failure.png`确认打开了播放器；根据整屏手势坐标和页面变化，判断与大字mini上滑入口被命中一致；未将其写为生产设置导航故障。测试改在`settings-viewport-*`实际区域按行frame双向拖动，样式页类别滚动也限定在外观viewport；未改产品手势或移除恢复/可点击断言。新增舞台选择并重启恢复断言，分组导航和大字专项最终复测继续，不能预记修正通过。此前206.720秒播放结果先于测试辅助函数变更，产品实现相同，仍单独列明。

## 2026-10-17 有界舞台第一轮与歌词最终专项

`check-stage-reviewed.log` 341/341业务与类型检查通过。首次 `SourceUITests-1792250181854.xcresult` 在85.608秒失败于新增查询：`NativeLyricLine` 的绘制子视图明确 `accessible=false`，不可通过AX查询`native-word-lyrics`；当前舞台组已出现。保留首次日志/计数/summary/录屏，不将其记为通过。测试改查真实组文本及用户可理解的“逐字歌词”能力值，维持原生绘制，未暴露隐藏子视图或新增测试后门。另为长组添加独立滚动并将舞台高度约束与AM一致，控制条保留可达空间。

最终 `SourceUITests-1792250453318.xcresult` 的增强`testCrossPlatformLyrics`141.407秒、1/1通过，零失败/跳过；舞台真实词组、暂停意图、完整歌词/本曲偏移及原有自动/人工选择、录音/收藏身份、重启/清理均通过。亲看`build/stage-rich-final-attachments/2A0DE831-A254-429A-ABE0-26BDBC319485.png`：独立当前组、歌词来源、偏移入口、真实暂停进度及控制在屏内。它是合成逐字数据与已结束填色截图，不是参考画面/实际逐帧性能验证。首轮附加simctl工具路径诊断与主失败分别保留。

正式入口Navidrome/七布局和最大辅助字号样式专项正在执行；本批尚未清洁归档、提交push或对应iOS27验收。无新增原生模块/音频后端/依赖，未重复宣称完整native新跑；真实服务/签名/手机与完整舞台特效另验。见[0042](decisions/0042-bounded-lyric-stage.md)。

## 2026-10-17 设置分类批次 iOS27 成功与产物核验

`35e6f2fefcb5812d8d6cfdcbdc763b576b02ad07` / [39034909819](https://github.com/RhsR1024/nexus-music/actions/runs/39034909819) 的checks、native、核心App、歌词/匹配/发现、离线断服务播放、iPad、设备归档及上传全部成功，API已实核。IPA artifact12103974275，ZIP10324662字节，API SHA256 `d04a521e5925bdaa78f0d25491c5c40e9c249c6cd1739ada2ca92284859f12b0`；实际下载/完整ZIP CRC、包内IPA附带摘要/CRC、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `9a8c85851ae80ed32f2dc69a35d0743bbb72a9495900cdda3fbb025227c29ebd`，留存`build/ci-39034909819`。manifest为Xcode27.0/27A266a、iphoneos27.0、arm64、min15.1、设备族[1,2]、unsigned；dirty=true唯一`ios/Podfile.lock`。该成功只覆盖设置分类批次及祖先，不覆盖后续主题/背景/样式/环形定位或当前舞台。环形定位39042804499已过native、正在核心App；不取消或重派。真实服务/签名/手机另验。

## 2026-10-17 环形定位清洁归档与push回执

`fcffd286ebe61baee3b4f389fab995f8a254996d`已正常push并核对远端main一致。`archive-ring-seek-clean.log`成功，manifest dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS对归档字节一致、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `3648b46f776288557f620f0f625ecd45d44896cd36fef3e0dda38c1973d37930`，留存`build/local-ring-seek-fcffd28`。本条覆盖下方本批归档/push待办，真实服务/签名/手机独立验收。

push后API实核[39042804499](https://github.com/RhsR1024/nexus-music/actions/runs/39042804499)/fcffd28唯一pending，[39034909819](https://github.com/RhsR1024/nexus-music/actions/runs/39034909819)/35e6f2f继续运行，已过checks/native/核心App/歌词发现/离线断服务播放，正在iPad；旧pending39040601042/261cd66由single自动取消，不计通过。1运行/1排队，未取消运行/重派；本批对应iOS27终态继续。

## 2026-10-17 A09 声波核环形定位本地专项通过

335项业务检查与类型检查通过，日志`build/logs/check-ring-seek-final.log`。正式App `build/SourceUITests-1792248125950.xcresult` 的 `testZNavidromePlaybackAndCredentials` 198.360秒、1/1通过，零失败/跳过；暂停拖环到60秒且线性进度一致，播放拖环保留意图，中心按钮/真实PCM、六布局/歌词/mini/重启与凭据清理通过。亲看`build/ring-seek-attachments/6F7B53E7-5D8A-41D5-AAC2-9C465A283BCE.png`。本机Xcode26.3/SDK26.2、x86_64模拟器26.3.1；无本批新增原生模块或音频后端改动，未重复宣称native套件新跑。

reverse-skill E-013→F-012→P-012经限定指令/字段/闭包核验与严格review后采纳交互职责，见[报告](2026-10-17_reverse-sollin-renderer-ring-report.md)。App多指/后台/VoiceOver/拖中切歌尚未逐项注入；真实服务、签名、手机及完整参考效果独立验收。清洁归档、正常push及对应iOS27终态继续记录。

## 2026-10-17 样式Sheet清洁归档与push回执

`261cd660d4f730540874133fa89d4bb442e32ec7`已正常push并核对远端main；`archive-player-style-clean.log`成功，manifest dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned。ZIP CRC/附带摘要、可执行及JS对归档字节一致、正式入口隔离与私人参考/签名资源排除通过。IPA SHA256 `c21ea1a1a3bc071be9c0e840f78f57e1345dc49a2319f6a6af56615da383f212`，留存`build/local-player-style-261cd66`。本条覆盖下方本批清洁归档/push待办，不代表真实服务/签名/手机已验。

push后API实核[39040601042](https://github.com/RhsR1024/nexus-music/actions/runs/39040601042)/261cd66为唯一pending，[39034909819](https://github.com/RhsR1024/nexus-music/actions/runs/39034909819)/35e6f2f继续运行；旧pending39038052599/b32ac94由single自动取消，不计通过。1运行/1排队，未取消运行/重派；前批已通过核心App，歌词/发现组执行中，本批对应iOS27终态继续。全部其他A/F/J余项保留。

## 2026-10-17 播放样式选择 Sheet 本地专项通过

reverse-skill E-011→F-010→P-010采纳前严格review通过；E-012→F-011→P-011只补充host分派，未新增参考布局。`check-player-style-sheet-final.log`为331/331业务及类型通过，最终`typecheck-player-style-delivery.log`亦通过。正式App `SourceUITests-1792246136327.xcresult`最终3/3、零失败/跳过：分组/草稿96.095秒，样式最大辅助字号/保存后关闭/分类滚动/重开选中/显式关闭/下滑/重启91.027秒，主题37.948秒；亲看最终样式选中截图。保存失败只沿既有原子仓储测试，不宣称App磁盘失败注入、VoiceOver或手机已验。

首轮 `SourceUITests-1792245697380.xcresult`为3通过/1失败：大字下样式摘要宽度变化造成分类行midY从644.500到674.833，超出原有±2断言。已将大字摘要移到标题下方，保持断言后上述最终复验通过。原失败log/counts/summary与附件保留；首轮Navidrome/合成流/PCM/多皮肤/暂停重启/mini185.508秒通过，发生在摘要修正之前，不冒充最终三项或真实服务结果。首轮附加simctl诊断路径错误与主测试失败分别保留。

本批无原生音频/依赖变更，未重复宣称完整native已新跑。原生pageSheet、六种真实布局、权威队列、会话隔离及许可/Android/实现边界见[0040](decisions/0040-player-style-sheet.md)与[专项报告](2026-10-17_reverse-sollin-player-style-report.md)。清洁unsigned归档/正常push与本批云端iOS27继续；AM2/歌词舞台等renderer、全部其余F/J及真实服务/签名/手机待办保留。

## 2026-10-17 全局背景批次清洁归档与push回执

`b32ac94b30315ca12bf9ba679f87d70f1c186d4f`已正常push并核对远端main。`archive-global-background-clean.log`成功，manifest dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned；ZIP CRC/附带SHA、可执行及JS对归档字节一致、正式入口隔离/私人资源排除通过。IPA SHA256 `3bd13c1d90ae3b7c13162cda113ac76ce913a030e3999cdd7041e11cb20ad504`，留存`build/local-global-background-b32ac94`。本条覆盖下方本批清洁归档/push待办；手机功耗、实际动画帧率、系统后台/减少动态效果、真实服务/签名仍单独验收。

push后API实核39038052599/b32ac94唯一pending，39034909819/35e6f2f继续运行；旧pending39036339256/b82aeba由single自动取消，不计通过。1运行/1排队，未取消运行/重派旧版；新云端终态继续。A03/A06–09和全部F/J余项仍保留。

## 2026-10-17 全局背景独立控制：本地专项通过

E-010采纳前reverse-skill严格review通过10E/9F/9P、7WI/15events，零错误/警告。`check-global-background.log`类型与331项业务通过，首轮两项新增断言失败保留`check-global-background-first-failed.log`，已修正语义色/空快照后完整复验通过。正式App1792244188543.xcresult两项通过、零失败/跳过：全局红蓝/跨页/独立开关/暂停重启189.767秒，Files图片导入/播放背景持久化112.398秒；亲看全局流动单开设置与发现页截图。测试证明颜色/优先级/保存行为，不冒称实际动画帧率或参考shader等价。日志`ui-global-background-passed.log`，counts/summary和附件已留存；最终typecheck通过。本批清洁归档/push/iOS27继续。云端39034909819/35e6f2f已通过checks/toolchain/native，核心App运行，39036339256/b82aeba唯一pending；未取消/重派。

## 2026-10-17 主题Sheet清洁归档与推送回执

`b82aeba2cb7ffc29e35eba7c7d0dbd5654d70c27` 已正常push，远端main核对一致；`archive-theme-sheet-clean.log`成功，清洁manifest dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned。ZIP CRC、附带SHA256、包内可执行/JS对归档字节一致、正式入口隔离与私人参考/签名资源排除通过；IPA SHA256 `15fbe875bc23a3554654fe2e4da173a3a651c60045e89bc4de18efeffd6eb687`，留存`build/local-theme-sheet-b82aeba`。

push后API实核[39036339256](https://github.com/RhsR1024/nexus-music/actions/runs/39036339256)/b82aeba唯一pending，[39034909819](https://github.com/RhsR1024/nexus-music/actions/runs/39034909819)/35e6f2f唯一运行，1运行/1排队；未取消运行/重派。下载批次ab98682的完整iOS27成功及产物核验见下条，不能代替本批新云端结果。A04全局背景链与其余对齐、F/J全部余项及真实服务/签名/真机继续。

## 2026-10-17 21:11 下载批次 iOS27 完整成功

`ab98682c2262e633f2789a9a38ce0aad87a605c8` / [39027501515](https://github.com/RhsR1024/nexus-music/actions/runs/39027501515) 已成功：checks24秒、iOS任务1小时45分1秒；native、核心App50分2秒、匹配/歌词/发现18分14秒、离线断服务播放16分25秒、iPad窗口/旋转9分钟、设备归档3分21秒及两项上传均成功。包含恢复调度和下载任务页，不包含后续EQ卡片、设置分组或本批主题Sheet。

IPA artifact12101498126，10321245字节，网页/API ZIP摘要 `ec483c30905ea550da626e2d5a960bd923de46c94186b6d938b5e7f5d458dd1b`；诊断12101624381。浏览器实际下载完成，完整ZIP摘要/长度/CRC、内部IPA附带摘要/CRC和正式入口隔离、私人资源排除通过。IPA SHA256 `1af6201ce87ad3003f472b636774b83273ad3d5a77b3b45d3af8e0877e54c63b`，留存`build/ci-39027501515`；manifest为Xcode27.0/27A266a、iphoneos27.0、arm64、min15.1、设备族[1,2]、unsigned，dirty=true唯一`ios/Podfile.lock`。真实服务、原生后台下载、签名与手机仍独立验收。21:19 API核对设置批次39034909819/35e6f2f为唯一运行、0排队，继续跟进，不重派旧运行。

## 2026-10-17 软件主题Sheet本地验收

reverse-skill IPA E-009→F-008→P-008采纳前严格review通过，原始BL确认两个主题包装→共用包装→Flutter showModalBottomSheet。音枢软件主题改为原生pageSheet，复用三态/原子持久化，显式关闭/系统dismiss保留外观分类和滚动，底层AX/触摸隔离；328项业务/类型通过；正式App1792242348845两项通过（外观持久化71.145秒、分组导航95.341秒，零失败/跳过），1792242792269最大辅助字号/下滑关闭/重新打开保持选择37.400秒通过。首轮新增测试因XCTest拖拽参数类型编译失败已修正并保留日志；最终文案收口后1792242979329同专项38.790秒再次通过并亲看截图，类型复验通过；清洁归档与本批云端继续记录。背景编辑器及其他叶页暂按既有实现，A04全局封面链未证明；全部F/J和真实服务/签名/真机边界保留。详见[决策0038](decisions/0038-theme-mode-sheet.md)。

## 2026-10-17 设置分类批次清洁归档与推送回执

`35e6f2fefcb5812d8d6cfdcbdc763b576b02ad07` 已正常push，远端main核对一致。清洁本机设备归档成功：manifest dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned；正式入口隔离、ZIP CRC、包内可执行文件/JS对归档字节一致和私人参考/签名资源排除均通过。IPA SHA256 `c9b172e63e0da697649c60f1013826f27b68864e3451e08ad6a38dc10b0ae664`，留存 `build/local-settings-objects-35e6f2f`。最大辅助字号32.744秒截图已亲看，卡片单列/选中可达。

push后网页实核最新[39034909819](https://github.com/RhsR1024/nexus-music/actions/runs/39034909819) /35e6f2f为唯一pending；[39027501515](https://github.com/RhsR1024/nexus-music/actions/runs/39027501515) /ab98682继续运行，核心App、歌词/匹配/发现和离线下载/断服务播放步骤均exit0，正执行iPad。旧pending39030063384/88850c1由single自动取消，不计通过；1运行/1排队，未取消运行或重派。新批云端终态、真实服务、签名与手机仍待。此回执覆盖本批“清洁归档待做”，不提前勾选全功能完成。

## 2026-10-17 设置对象关系与分类入口阶段

reverse-skill mobile-reverse IPA E-008→F-007→P-007严格review通过（8E/7F/7P、7工作项、12事件、零错误/警告）。固定Blutter/Dart双端隔离构建与断网解析已完成；IPA独立容器检查24,298入口、1,455骨架重放及限定原始BL支持设置分类分派、二级页创建和播放→EQ。NO_CODE_ANALYSIS骨架不等于完整反编译/运行图；A03仍有Sheet/默认值待查。A04纠正：resolve/load/applyCoverTheme属于ArtworkSummaryState，尚未证明全局主题取色链，三个动态provider仍分开。

音枢设置首页四分类同组，EQ移到播放分类下独立页；当前音质/布局摘要、来源独立、草稿/滚动/隐藏AX和原有功能保留。328项业务/类型通过；正式App1792240097837两项通过（EQ97.259秒、分组85.620秒，零失败/跳过），亲看首页/草稿截图。最大辅助字号、清洁设备归档与本批云端结果继续记录。详见[本批报告](2026-10-17_reverse-sollin-settings-objects-report.md)。先收敛A03/A04及A06–A09，再推进平台能力，全部F01–F37/J01–J59及真实服务/签名/真机边界保留。

## 2026-10-17 EQ 卡片清洁设备归档回执

实现提交 `26bc65eb6189ed6137200dc309c83484e94d3276` 的 `archive-eq-cards-clean.log` 为ARCHIVE SUCCEEDED。manifest为dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned；正式入口/测试adapter排除、ZIP CRC、可执行文件和JS对归档字节一致、私人参考/签名资源排除均通过。IPA SHA256 `cfad16789e918f6e735c92e81d1226b7e33eac8d24cd06d39288a54a14dcaff0`，留存 `build/local-eq-cards-26bc65e`。本回执覆盖下方本批“清洁归档待做”，push/对应云端结果继续记录；不等于iOS27/签名/真机通过。

## 2026-10-17 A07 EQ 预设卡片本地验收

reverse-skill mobile-reverse 的本批 IPA E-007→F-006→P-006 采纳前严格review通过（7E/6F/6P，零错误/警告），只确认EQ模块词汇，亲看截图02/07补充视觉；没有恢复对象调用关系或参考运行参数。原创双列曲线卡片、按实际曲线与前级计算选中、自定义计数/空态和大字单列，保留音枢七预设、24自定义和唯一DSP/队列。浅色主题旧深色面板与输入对比度问题已修正，卡片/重置/归零/保存/删除操作至少44点。

328项业务/类型通过，最终配色补修后类型再次通过。正式App1792237003989预设切换/只改前级取消选中/曲线拖动/保存/重启/删除/睡眠92.800秒、1792237149089最大辅助字号单列30.615秒分别通过，均零失败/跳过；亲看最终附件，大字专项加入原云端回归组。清洁设备归档与本批云端终态待做，真实音效/签名/手机仍独立验收。报告见 [EQ专项](2026-10-17_reverse-sollin-eq-report.md)。

Ryderwe固定源码已继续追踪到平台扫码状态/账号核验、Cookie刷新、日推与FM，补齐音枢HTTP响应头和隔离会话缺口/测试清单；无许可Youmi只行为参考，不采纳敏感日志/明文Cookie/外部代理。详见 [Ryderwe追踪](RYDERWE_REPOSITORY_REVIEW.md)。仍先完成A06–A09，再推进真实平台能力；F01–F37/J01–J59范围保留。

## 2026-10-17 下载批次清洁本地归档回执

`ab98682c2262e633f2789a9a38ce0aad87a605c8` 已正常push；本机归档 `archive-download-ui-clean.log` 为ARCHIVE SUCCEEDED。manifest对应ab98682、dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned。正式入口隔离、ZIP CRC、包内可执行文件/JS与归档字节一致、私人参考/签名资源排除及SHA256核验通过；IPA摘要 `9c37b2b030d5840af8521d2b234f933e9fc77614142d80f9a44f0bbb9587505e`，留存 `build/local-download-ui-ab98682`。本条覆盖下方“本批清洁归档/push待做”的历史状态，iOS27/真实服务/手机后台/签名仍独立验收。

主执行上下文又核对c999049云端成功与artifact12099502248的页面摘要；浏览器下载跳转被Chrome以ERR_BLOCKED_BY_CLIENT阻断，未绕过，未取得ZIP，故仍不宣称该产物已核验。ab98682云端39027501515继续运行、0排队，未取消或重派。

## 2026-10-17 19:26 心跳：推荐批次 iOS27 完整成功

`c999049` / [39022411440](https://github.com/RhsR1024/nexus-music/actions/runs/39022411440) 于19:25:26完成：checks、native、两组App测试、iPad窗口/旋转、unsigned IPA归档及上传全部成功。它包含1cc9e39本地推荐/FM fallback，但不包含后续c1a4605/c098eeb恢复调度或ab98682下载任务页；成功仅覆盖实际提交，真实平台推荐/FM、签名、手机/后台/灵动岛仍待验收。

API返回IPA artifact `12099502248`（10309262字节），ZIP摘要 `03239aa0b887be4d214914d44d1a4c2c635152bd35de8a6bffaa622c24820c74`；诊断artifact `12099059107`。状态摘录留存忽略目录 `build/ci-39022411440/STATUS.txt`，再次获取原始JSON时API限流，未保存原始JSON；尚未下载本批ZIP或核验包内manifest/CRC/IPA摘要，不能写成产物已核验。前批920d193的完整产物核验沿18:06既有记录，不重复下载。

19:26 API实核最新 `39027501515` / `ab98682` 已运行，0排队；旧pending `39024707349` / c098eeb已由single队列自动取消，不计通过。未取消运行或重派旧版。本心跳只更新状态，不介入另一执行上下文的功能/工具工作或独立提交push。

## 2026-10-17 19:02 下载设置与离线容器修复App验收

正式入口App `SourceUITests-1792234656950.xcresult` 2/2、零失败/跳过通过：下载/重启/条件Range/断服务后真实PCM/取消与确认删除172.175秒，分组导航/草稿/隐藏AX77.454秒。合成服务full=1、resumed=1、blocked=0；播放前临时音频缓存为空，离线播放前后stream计数不增。亲看暂停、完成、确认删除空态附件；328项业务/类型、完整native及无障碍补修后类型检查通过。附加simctl诊断收集exit72路径警告保留，不影响测试exit0。本批清洁归档、push与对应云端终态仍待，真实服务/签名/手机/原生后台边界不变。

日志/计数为`build/logs/ui-download-settings-final-passed*`，附件`build/download-ui-final-attachments`；前三次失败及诊断沿决策0037保留。当前编译工具的ICU下载已遭连接重置而失败，固定提交重试仍在本机进行，不将工具准备计为对象图恢复。

## 2026-10-17 18:23 恢复调度修正版已push与清洁归档回执

`c1a4605` 恢复调度和 `c098eeb252e3ca7c916c66d2d3e6d773c6340121` 暂停竞态修正已正常push到RhsR1024/nexus-music，远端main核对一致。最终清洁归档日志 `build/logs/archive-offline-recovery-pause-final.log` 成功，manifest对应c098eeb、dirty=false/workingTreeChanges=[]、Xcode26.3/iphoneos26.2、arm64、min15.1、设备族[1,2]、unsigned。IPA SHA256 `a14baac7e11ae8a117c7d593d24b183f318fab1e7cb38348665b1bcd03a353a4`，附带摘要/ZIP CRC、包内可执行与JS对归档一致、正式入口隔离和私人资产排除通过，留存 `build/local-offline-recovery-c098eeb`。c1a4605初版另存，不误称含后续暂停修正。

本批326/326业务/类型通过；完整native和正式App两项（58.310/204.425秒、零失败/跳过）在c1a4605已通过，后续仅TS暂停补修以两项新增竞态测试及清洁归档验证，未将此前App测试写成修正版下载/后台实测。Sollin E-005严格review通过，仍只支持模块边界；原生后台、App内下载/杀进程、跨服务长期、真实私人服务、签名和手机验收待办保留。

push后实时队列核对：最新[39024707349](https://github.com/RhsR1024/nexus-music/actions/runs/39024707349)（c098eeb）唯一pending，[39022411440](https://github.com/RhsR1024/nexus-music/actions/runs/39022411440)（c999049）唯一运行中，1运行/1排队；未取消运行中、未重派旧提交。最新终态继续跟进，pending不计通过。全部F01–F37/J01–J59目标active；下一阶段回到A03/A04对象关系与已有UI/交互收口，平台登录/真实推荐/FM/识曲、原生后台下载等仍依赖各自证据与验收。Ryderwe参考盘点沿既有RYDERWE_REPOSITORY_REVIEW，不复制未核验许可或私有服务。

## 2026-10-17 M10 恢复暂停竞态补修

`check-offline-recovery-pause-final.log` 326/326、类型检查通过；新增立即暂停与状态写入期间暂停两项回归，均验证网络请求0次且显式resume后1次。此前最小复现为请求1次/错误completed，补修没有降低断言。正式App两项回归及完整native为c1a4605阶段证据；该后续仅TS状态机补修未重复执行没有下载暂停断言的App测试，App下载/系统后台验收仍待。

c1a4605初版清洁归档成功，IPA SHA256 `baba217ce1d4ad5318409075990cc53db30cebb185596ef801cbc2c953a099e5`，留存 `build/local-offline-recovery-c1a4605`；它不含暂停补修，不作为最终交付包。补修后另行清洁归档再push。

## 2026-10-17 M10 恢复批次App回归通过

本批 `build/SourceUITests-1792231667947.xcresult` 正式入口App回归2/2、零失败/跳过：源管理/实际Files选择取消/启停删58.310秒，Navidrome合成实音/PCM/歌词/五皮肤/定位/统计/mini/重启204.425秒。日志与计数保存为 `build/logs/ui-offline-recovery-passed*`，xcresult summary已读取。测试结束的附加诊断收集报simctl路径警告（exit72），不影响测试exit0，但不宣称附加诊断收集成功。324项业务/类型及完整native均通过；App测试不等同于下载在挂起进程或真实服务中的验收。

## 2026-10-17 M10 恢复批次本地检查

`check-offline-recovery-final.log` 324/324、类型检查通过；`native-offline-recovery.log` 完整检查 exit0（既有 Swift Sendable 警告保留）。本批未修改原生实现；正式 App 源管理与 Navidrome/五皮肤/PCM/歌词/mini/重启专项运行中，结果未预记。E-005严格review为5 evidence/4 findings/4 paths、0 error/warning。下载调度业务测试不代替 App 内下载、系统后台、签名或手机验收。

18:11 通过实时 Actions HTML嵌入状态及 job API核对：最新 `39022411440`（c999049，包含1cc9e39本地推荐）为唯一运行中、0 pending；checks/native已通过、核心App执行中。`fetch_commit_workflow_runs`连接器只过滤PR触发运行，返回空数组不能当作push没有运行；公共API速率受限及网页缓存旧状态均未作为当前队列证据。实时HTML与去标识队列记录在 `build/logs/actions-current*`。不取消运行或重派旧版本。

## 2026-10-17 18:06 云端 920d193 完整成功与产物核验

`920d193` / [39016561400](https://github.com/RhsR1024/nexus-music/actions/runs/39016561400) 已完整成功：checks、native、核心App、匹配/歌词/发现/健康、iPad窗口与旋转、设备归档和上传均成功。IPA artifact `12097510843` 已实际下载，ZIP 10304736字节、API SHA256 `089011035aa457b94d55c33442ff4460a7985d37b392956b9514121a39de226e` 与CRC通过；内部 IPA 附带摘要一致，SHA256 `9077562313697430f745665cbef08ac876770964dd353063fd965dc95b38667d`。核验正式入口无 `nexus-ui-test-online-adapter`、arm64、Xcode27.0/27A266a、iphoneos27.0、min15.1、设备族[1,2]、unsigned；manifest dirty=true 唯一 `ios/Podfile.lock`。本机产物与核验记录在忽略目录 `build/ci-39016561400`。

本次覆盖920d193及其祖先，包含95c2e03匹配测试源清理修正；不覆盖后续1cc9e39本地推荐或尚未提交恢复调度。早先失败/取消仍保留历史；iOS27成功不替代个人服务、签名、真机后台/灵动岛验收。

## 2026-10-17 A09 播放器身份/频谱及关联回归阶段回执

实现提交 `3898592c7d9ec76e59ba21513e9f0930b62d33dc` 已正常push并核对origin/main一致。现代播放器收藏读写原队列身份，视觉/歌词沿实际匹配录音；声波核仅在播放、DSP支持且频带完整时显示真实环形频谱，暂停隐藏；歌词窗口补为三行，收起手柄可达。稳定查询补充账号、EQ曲线、歌单提交与备份独立滚动区；没有新增队列/播放器或修改原生DSP。

本地业务/类型303/303、完整native通过。分段UI：现代PCM/原曲收藏1792213327138（126.691秒），同步1792212451041（238.399秒），字体/正式ND286.201秒、主题111.350秒、EQ79.053秒、DAV76.248秒在1792213572669通过；该组备份149.421秒失败于AX类型查询，改用实际Other元素后1792214374827备份单项226.595秒通过（取消/恢复/坏JSON/重启/清理）。失败保留，不宣称同次全套或真实服务通过；日志ui-player-identity-final-passed、ui-player-related-final-first、ui-cloud-backup-final-passed与counts均在build/logs。

`archive-player-identity.log`为ARCHIVE SUCCEEDED。清洁manifest对应3898592、dirty=false/workingTreeChanges=[]，Xcode26.3/iphoneos26.2、arm64、min15.1、设备族[1,2]、signed=false。正式index无测试adapter、ZIP CRC、包内可执行文件/JS与归档一致、私人参考/签名资源排除及SHA256核验通过；IPA SHA256 `9f15c56275ce76c03f5975497333e04df16f5d0d7ed2a1f49bf05a0ffbe95056`，留存`build/local-player-identity-3898592`。不等于iOS27/签名/真机验收。

push后API核对：最新iOS27 `39006353281`（3898592）为唯一pending，`39003956417`（c64c43b）继续in_progress；1运行/1排队，没有取消运行中或重派旧版本。继续跟进实际终态/失败。reverse-skill两案例严格review、IPA播放器E-003和APK布局E-003关联完整；只提供静态标记，不宣称A03/A04对象/调用图或完整对齐。A06–A09剩余UI与F/J全范围、真实服务/签名/真机仍保留。

## 2026-10-17 reverse-skill 安装与门禁阶段

`c64c43b` 已正常push并核对远端main；用户新增强制要求已经落实到AGENTS、任务/交接/范围与Sollin参考文档。项目安装入口、固定提交、工具缺口、两个离线案例与严格review、门禁拒绝路径详见[REVERSE_SKILL_WORKFLOW](REVERSE_SKILL_WORKFLOW.md)。云端 `39003956417` 对应安装阶段，已运行，当前1运行/0pending，尚不算成功；既有播放器未提交代码不由该运行覆盖。旧38984903551/38988046090均自然失败，未生成IPA，不继续把历史pending写为当前状态。

本轮原播放器批次已通过303项业务/类型、完整native、跨平台歌词/现代收藏124.460秒专项（1792212072221）；其余受影响流程和本批IPA仍在验证，未计全部功能完成。新的APK snapshot E-003只确认平台/压缩指针差异，不声称对象/调用关系已恢复。未改变真实服务/签名/真机待验边界。

## 2026-10-17 云端队列收敛已实际验证

策略提交 `d9317f2` 已正常push。策略提交时GitHub API核对：原40个旧pending均自动取消，运行中`38934924631`未取消，最新`38983886757`对应d9317f2为pending。同工作流/分支使用 `queue: single`、`cancel-in-progress: false`，以后push必须核对运行≤1/排队≤1。取消旧运行不计作通过，旧成功产物/失败诊断保留；本条覆盖下文历史“不取消排队/queue:max”执行约定。说明及真实88分钟job耗时分解见[GITHUB_ACTIONS.md](GITHUB_ACTIONS.md)。

## 2026-10-17 A10 云端外观测试导航修复

旧云端38934924631核心14/15通过，唯一失败在openSettings寻找settings-open-background的可点击断言；完整诊断ZIP摘要/CRC及录屏末帧已核验。设置页按页恢复滚动位置是既有产品行为，测试只向上滑无法到达上方目标。现按目标frame双向滚动，保留可点击/目标页断言，并在失败时保存截图与AX层级。本地正式入口1792197616945两项通过：外观持久化/主导航60.141秒、分组设置/草稿恢复74.290秒，零失败/跳过；日志ui-settings-direction-final.log。仅XCTest与文档修改，不增加功能完成度；提交07870a4ca49bc530b6ba90c1a8a676cb56f74f0b已正常push并核对远端main；archive-settings-direction-clean.log为ARCHIVE SUCCEEDED，manifest dirty=false/workingTreeChanges=[]、arm64、SDK26.2、min15.1、设备族[1,2]、unsigned，正式入口隔离、IPA摘要/ZIP CRC/二进制一致性均通过。SHA256 a0a52f5902523e18858839a4877de75ece16ab25059467fdeb6c2a222b47e6c2，副本build/local-settings-direction-07870a4。08:48 API核对：38984903551继续运行，最新38988046090为唯一pending，旧pending38987122647已自动取消；再次实证single策略，取消旧运行不算通过。新云端/签名/真机仍待。

## 2026-10-17 A09 播放器收藏身份与声波核门控代码批次

- `ModernPlayer` 接收独立 `favoriteTrack`：匹配录音继续负责播放器视觉/歌词，收藏读取和写入回到队列原曲。
- `FrequencyHalo` 仅在播放中、DSP 支持且收到至少32个频带时绘制频谱条；暂停/无PCM保持中心控制，声波核歌词区域改为最多三行。
- `SourceSettingsTests.testCrossPlatformLyrics` 增加现代播放器收藏状态和暂停后 `wave-spectrum-bars` 不存在断言。
- 本批尚未把代码检查、本地归档或云端终态写成通过；旧云端运行仍按队列规则单独记录。

## 2026-10-17 A08 发现页面板归属与紧凑歌曲行

发现详情的封面、歌曲文字和44点更多按钮改为同行。歌曲操作Sheet归属其发现页；从搜索打开的完整发现Modal不再把操作Sheet挂在页面外。加入歌单复用同一Sheet内的PlaylistPicker内容，取消/保存返回原详情，保留收藏身份、完整导入、已加载搜索/排序、权威队列和重复歌单条目。IPA只提供主题化Sheet名称线索，紧凑行视觉另参考补充截图；不宣称恢复Sollin私有调用图。

修复前合成公开歌单真实UI回归1792196022730于69.228秒失败（完整发现页菜单未呈现）；修复后1792196266236于81.940秒通过。303项业务/类型检查通过。独立e2e入口注入公开wire响应，正式入口和matching音频隔离保留；云端第二测试组新增此专项。 首次交叉组1792196419567的歌词项101.107秒通过，发现项11.749秒失败；恢复后的mini也有“下一首”，原全局查询不能区分面板控件。容器范围查询复验1792196670777仍失败（歌词101.763秒通过、发现23.508秒失败）；实际AX附件3B70A71E的63行是mini-next，83–94行显示操作容器与四个按钮被展平为同级，故容器子查询不能找到按钮。现对操作按钮使用唯一标识，保留实际可点击断言，交叉组继续复验。最终交叉组1792196898246两项零失败/跳过通过（歌词97.353秒、发现90.423秒）；本批69f57a4已正常push并核对远端main；清洁本地SDK26.2 unsigned IPA通过，manifest dirty=false/workingTreeChanges=[]、arm64、min15.1、设备族[1,2]，正式入口隔离、ZIP CRC及二进制/摘要一致性通过。SHA256 e6a3f81f3d9f94af5e61cd4bc929ead8c79993ee58a71d8ca0f3bc5a8b1a77a0。最新iOS27 38987122647为pending，38984903551为运行中，队列保持1运行/1等待；旧38934924631自然结束失败（非取消）。本条为08:36历史回执，最新状态以A10/08:48回执为准，云端/签名/真机仍待，不以合成界面通过替代真实平台、真机或完整对齐。决策及范围边界见[0027](decisions/0027-track-list-identity-and-views.md)，详细证据见[BUILD_STATUS.md](BUILD_STATUS.md)。

最终日志`build/logs/ui-discovery-final.log`及计数`ui-discovery-final-counts.json`：公开列表4次、详情2次，两种发现入口均经过真实provider归一化；本轮没有Navidrome请求，匹配播放复用正常合成音频缓存，不冒充新增真实平台流。已亲看`build/discovery-final-attachments`中的紧凑行/mini与完整发现页歌曲Sheet截图；菜单切换、收藏往返、新建/取消/加入已有歌单、2个独立重复条目及删除本测试歌单均通过。303/303见`check-discovery-final.log`。此前全局/容器范围查询失败保留，最终使用唯一动作标识避免mini同名与AX展平。本地归档已核验，云端运行已由A10最新pending覆盖。

归档日志`build/logs/archive-discovery-clean.log`为ARCHIVE SUCCEEDED，清洁manifest对应完整提交69f57a45648e0c4f3464b949f83e6e7f7810cfb0；IPA/摘要/manifest副本保留`build/local-discovery-69f57a4`。当时运行[38987122647](https://github.com/RhsR1024/nexus-music/actions/runs/38987122647)等待，08:48已由A10最新pending替换并取消，dba0669的38984903551已自然接续运行，未取消运行中任务。旧c555d1e/38934924631于08:31:25失败：checks/native通过，核心15项14项通过，仅testAppearancePersistenceAndPrimaryNavigation失败，ND项160.728秒通过；未进入第二组/iPad/归档。iOS job实际51分33秒，测试1673.542秒（27.89分钟），失败后诊断另超时600秒。诊断artifact12083810710已完整下载，219864929字节、SHA256 0cf2d95a9a32786cd184c0d92c30b9191836a75a24280e58fae2d017056324fe、1758条目CRC均通过。完整ui-catalog.log:44369为旧Swift14的settings-open-background不可点击；44329–44368显示连续6次向上滑。已亲看录屏最后一秒导出帧build/ci-38934924631/appearance-failure-frame.png：页面停在“软件图标/字体/mini/强调色”下半部，目标“主题与背景”在上方。SettingsScreen明确按页恢复滚动位置，测试辅助函数只会向上滑导致目标越界；现按真实frame双向滚动并补失败截图/层级，定向1792197616945两项通过（60.141/74.290秒）。不把已知图片故障套用到本次不同失败项，云端修复仍待新提交实际验证。

## 2026-10-17 A09 Sheet呈现与图片失败诊断

正式ND入口`SourceUITests-1792194068675.xcresult`实际复现歌词显示设置Sheet不出现；原来的`testCrossPlatformLyrics`不经过该路径，不能证明所有样式/设置Sheet已验。现将同级三个原生Modal收敛为一个pageSheet内的菜单/样式/歌词/完整选项面板，并区分从菜单或播放器直达样式后的返回目标。首次联合`SourceUITests-1792194453156.xcresult`图片项120.306秒通过，ND继续到全部歌词时因两个`+100ms`偏移控件暴露到AX失败；已在展开时移除底层重复设置控件并完成后述复验，不将首次联合写成全通过。

最终正式ND专项`build/SourceUITests-1792195122896.xcresult`193.454秒、1/1通过，零失败/跳过：合成ND连接/PCM、2:00、暂停定位、AM/沉浸/写真/黑胶/声波核、歌词显示面板返回/独立样式入口、全部歌词偏移/重置/定位、统计与mini配置/重启/收藏/队列/恢复默认/凭据移除。此次复用正常临时音频缓存，不冒充新增真实平台请求；前次冷读取4次stream另有计数证据。`ui-sheet-final.log`/`ui-catalog.log`及`ui-server-counts.json`保存本轮结果。与图片专项、303项业务及完整native共同构成本批本地验收；清洁IPA及对应新云端继续，真机仍未验。

提交`dba06699fb6700876887591bed7bce1ff0506250`已正常push并核对远端；清洁`archive-sheet-routing-clean.log`为ARCHIVE SUCCEEDED，正式入口隔离验证通过，manifest dirty=false/workingTreeChanges=[]、Xcode26.3/iphoneos26.2、arm64、min15.1、设备族[1,2]、signed=false。IPA SHA256 `b575d2f218762979d985f953aa5efdb0f72bc408a783e2f2efb6bfac7d6c2171`与附带摘要重新核验一致。最新iOS27[38984903551](https://github.com/RhsR1024/nexus-music/actions/runs/38984903551)为pending；前一pending38983886757自动取消，38934924631仍运行，队列保持运行1/最新排队1。取消旧运行不计作通过；新云端/签名/真机仍待终态。

`check-sheet-final.log`为303/303及类型通过；`native-sheet-duration-full.log`完整原生套件通过，新增ready/后续时长断言覆盖实际WAV/AAC/MP3/16/24bit FLAC、HTTP/缓存、暂停/定位/自然结束。原生按asset解码时长作有限回退，并监听当前item时长变化；不使用歌曲元数据冒充实际时长。原测试设备有旧12秒缓存，旧失败没有stream请求；120秒合成录音改用版本化身份后首次正式读取4个stream请求、解码2:00断言通过。该证据不把原生回退说成旧时长失败的唯一根因。

iPad云端`38924137682`完整诊断artifact12082140356已下载，245463140字节，API SHA256 `4ed13057d9f34db1700eba57f87eaa4890edf3af2e7c839036b7e554d3e24b84`及ZIP全条目CRC/长度通过；13项核心UI中12通过，仅写真导入失败，未进入iPad专项/IPA。`build/ci-38924137682/verified/logs/ui-catalog.log:49200`为旧Swift786行文件名断言；附件`CACDE2ED-EAB4-45D1-81B1-7BFD643359F1.txt:112`仍未导入，142行保存错误。图片流程现以固定V01系统选择/复制、V02原生读取/处理、V03结果校验、V04落库区分错误，不回显路径/原始异常；业务测试验证失败保持旧槽位、清理/重试和脱敏。错误分段是新增取证能力，尚不能宣布间歇故障根因修复。

## 2026-10-17 F33 云端 38913246781 完整成功 / IPA 已核验

- 提交 `26830dfde3e8243ae8eb845a98f54f792dbc6756`；北京时间 2026-10-17 06:43:30 结束 success。checks job `117199175174`、iOS job `117199401360` 均成功；原生检查、两组 App 测试、归档及上传步骤全部成功。
- IPA artifact `12079596559` 已保存于忽略目录 `build/ci-38913246781/ipa-artifact.zip`，9787533 字节。完整 ZIP SHA256 `d774e909fd4885430d1de85791a2de0863c850e9dd6d244c952463c3443e8622` 与 API digest 一致，ZIP CRC 通过；内部 IPA CRC/附带摘要通过，SHA256 `999b4748335faabcbaafc12c907799aae5d22c495083a9f85ca69a9da608530d`。
- manifest：Xcode27.0 / 27A266a、iphoneos27.0、arm64、min15.1、signed=false；dirty=true 且唯一 `M ios/Podfile.lock`。实际包 bundle ID `com.nexusmusic.app`、设备族 `[1]`、lipo arm64，正式 JS 无 `nexus-ui-test-online-adapter`。
- 诊断 artifact `12079531804`，333337303 字节，API digest `10e24815183619d2aba0d6a17eed28068fde130be8ea483adf2e59d6fb5b260b`；仅查 API 元信息，未下载/校验整个诊断包。
- 本次闭环仅覆盖 F33 对应提交的云端构建与测试；自动触发、真实双设备/私人服务、签名、真机仍待验收，不覆盖后续 iPad/UI 增量，也不消除 `38902977651` 图片导入间歇失败根因缺口。`38924137682` 已进入运行，最新功能批次仍正常排队，未取消或重派。

## 2026-10-17 A08 音乐库歌曲行更多操作 Sheet 代码与本地归档

- 提交 `b0139bbf79bce900fb0b46dd5bd13531c4a8ec8a` 已 push；歌曲行改为省略号入口和图标行 Sheet，保留全部音枢歌曲动作；分段控件按钮角色修复既有 UI 查询。
- `npm run check`：302/302；`git diff --check`：通过。
- 本地 UI：`build/SourceUITests-1792188928262.xcresult`，`testPlaylistSearchSortAndDuplicateRemoval` 1/1 通过，121.062 秒，0 failures。
- 本地 Release archive：成功；manifest `dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`，Xcode 26.3 / SDK 26.2。
- IPA：`build/distribution/NexusMusic-unsigned.ipa`，SHA256 `1adf6d5587bf81135ef2cbf7e86a039fb5dcc7e176e590e1e0f71e1f7ed87532`。
- 云端 iOS 27：[38975058418](https://github.com/RhsR1024/nexus-music/actions/runs/38975058418)，当前 `pending`，未计作通过；签名与真机仍待验收。

## 2026-10-17 A09 迷你播放器上下滑手势

- 提交 `3e3a7311ac5b76a3187f1cdf35b9c539e52eafb0` 已 push；`npm run check` 302/302。
- 本地 UI：`testCrossPlatformLyrics` 1/1 通过，覆盖迷你播放器上滑打开、完整播放页手柄下滑收起及后续歌词/暂停/定位。
- 本地 Release archive：成功；manifest `commit=3e3a731`、`dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`，Xcode 26.3 / SDK 26.2。
- IPA：`build/distribution/NexusMusic-unsigned.ipa`，SHA256 `69dee96f8c4e462b960fb42c24f93b393470341219c4ba3afed1d2e6dee7ac4b`。
- 云端 iOS 27：[38972668259](https://github.com/RhsR1024/nexus-music/actions/runs/38972668259)，当前 `pending`，未计作通过；真机、签名、手势长时体验和后台/功耗仍待验收。

## 2026-10-17 A09 播放器样式 Sheet 列表化

- 提交 `27d3200189846bdc70574953568041b22b264951` 已 push；`npm run check` 302/302。
- 本地 UI：`build/SourceUITests-1792185873313.xcresult`，`testCrossPlatformLyrics` 1/1 通过，137.929 秒，0 failures。
- 文档提交后清洁本地 Release archive 成功；manifest `commit=5d0a0a3`、`dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`。
- IPA：`build/distribution/NexusMusic-unsigned.ipa`，SHA256 `0db5818fd2a3d774b8c7cf995a61b75cfc585155ff8b687f0d3b4db9c19f69ee`。
- 云端 iOS 27：[38969653905](https://github.com/RhsR1024/nexus-music/actions/runs/38969653905)，当前 `pending`，未计作通过。

## 2026-10-17 A05 封面背景动态门控与清洁本地归档

- 提交 `d47d680a2b8ac0c67e6eb273bac9674ccc9e15f7` 已 push；`npm run check` 302/302。
- 本地 UI：`build/SourceUITests-1792185052140.xcresult`，`testGlobalCoverThemeChangesAcrossPages` 1/1 通过，113.112 秒，0 failures。
- 本地 Release archive：成功；manifest `dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`，Xcode 26.3 / SDK 26.2。
- IPA：`build/distribution/NexusMusic-unsigned.ipa`，SHA256 `e9f01a5e0c565223930be0b7af3415e5ef97f1f3eb7473f6c0c89dcd8b3bebc4`。
- 云端 iOS 27：[38968408649](https://github.com/RhsR1024/nexus-music/actions/runs/38968408649)，当前 `pending`，未计作通过；真机、签名、后台/功耗和动态效果长时验收仍待完成。

## 2026-10-17 A09 歌词列表性能修正与清洁本地归档

- 提交 `8b4332ae43ae1af46b660ec71bf44b5144198d34` 已 push；`npm run check` 302/302。
- 本地 UI：`build/SourceUITests-1792184153003.xcresult`，`testCrossPlatformLyrics` 1/1 通过，iOS 26.3.1 模拟器，0 failures。
- 本地 Release archive：成功；manifest `dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`，Xcode 26.3 / SDK 26.2。
- IPA：`build/distribution/NexusMusic-unsigned.ipa`，SHA256 `dedc365e58dc5e6d6bd1c33f4741a06ee6424bd0f9394f6b075007cd8ada769e`。
- 云端 iOS 27：[38966241336](https://github.com/RhsR1024/nexus-music/actions/runs/38966241336)，当前 `pending`，未计作通过；真机、签名、后台/功耗仍待验收。

## 2026-10-17 iOS27 38902977651 失败诊断（尚未修复验收）

- 运行 `38902977651` / `698c502d7331b70538a46e583f7718f388ac4eaf`，iOS job `117140200643`，北京时间03:48结束 failure。checks与完整 native通过；核心 App 11通过/1失败/0跳过。第二组与IPA归档未执行。
- 诊断 artifact `12071785252`，255892429字节，API digest `a95b73d8f227bd0223466e0a14ce26364a2fbb88848a9a20ba44ad28a2212b88`。本次仅按条目 CRC/长度提取 `logs/ui-catalog.log`、服务计数及1705个xcresult小对象，不称完整ZIP摘要已验证。忽略目录：`build/ci-38902977651`。
- `verified/logs/ui-catalog.log:45347`：`testVisualImagesAndPlayerBackgroundPersistence` 旧第716行写真文件名断言失败。已导出 `failure-hierarchy`：第112行写真仍为空，第142行有“图片或设置未保存”错误。需继续定位文件复制/原生导入/持久化实际错误；不能仅凭当前文件名等待修改宣称修复。Navidrome/云备份/DAV计数认证失败均0，Navidrome播放项通过，不将本次归因为音频解码或认证故障。
- 原生诊断收集600秒超时发生在测试失败之后，属于额外开销。当前其他执行上下文继续UI批次，未启动冲突本地构建，也未重派/取消正常云端队列。
- 工具链纠正：本轮实际执行 `source scripts/environment.sh` 后，Xcode26.3 / 17C529、iphoneos SDK26.2可用。近期“本机无完整Xcode/仅Command Line Tools”表述无效；对应增量本地UI/IPA仍待补，不能以默认xcode-select结果跳过，也不能把本地SDK26.2计作iOS27。

## 2026-10-17 A08 发现详情歌曲动作代码批次

- 详情歌曲行增加收藏状态与加入本地歌单，复用现有存储和选择器。
- `npm run check`：302/302；`git diff --check`：通过。
- 本机仅 Command Line Tools，未执行本批 XCTest/IPA；云端运行 `38958299530`（`6fc6123`）当前 `pending`，真实平台长列表和真机待终态。

## 2026-10-17 A05 切歌后封面失败缓存隔离代码批次

- 切换歌曲时清空 `ArtworkBackdrop` 的失败 URI 列表，防止旧错误影响后续同封面重试。
- `npm run check`：302/302；`git diff --check`：通过。
- 本机仅 Command Line Tools，未执行本批 XCTest/IPA；云端运行 `38957768659`（`06a75bf`）当前 `pending`，背景专项和真机待终态。

## 2026-10-17 A09 播放器内部面板 page sheet 代码批次

- 现代播放器三个内部面板使用 iOS `pageSheet`，其他业务 Modal 不变。
- `npm run check`：302/302；`git diff --check`：通过。
- 本机仅 Command Line Tools，未执行本批 XCTest/IPA；云端运行 `38957174551`（`8ba901a`）当前 `pending`，page sheet 手势/旋转、IPA 和真机待终态。

## 2026-10-17 A08 音乐库长列表分批加载代码批次

- 音乐库正文增加每次 20 项的“加载更多歌曲”，长歌单 UI 回归覆盖入口；完整批量管理弹层与既有筛选/排序不变。
- `npm run check`：302/302；`git diff --check`：通过。
- 本机仅 Command Line Tools，未执行本批 XCTest/IPA；旧云端运行 `38954944378` 仍为 `pending` 且无 jobs，不能替代本批验证。新运行 `38955950405`（`21bb000`）已创建，当前 `pending`，不能记为 iOS27 通过。

## 2026-10-17 A08 播放历史时间轴 UI 回归批次

- `SourceSettingsTests` 增加真实播放后进入“最近播放”并检查 `history-item-0` 时间轴首行。
- `npm run check`：302/302；`git diff --check` 通过。
- 新云端运行 `38954944378`（`47bd458`）当前为 `pending`，本机只有 Command Line Tools，未执行本批 XCTest/IPA。

## 2026-10-17 A08 播放历史时间轴代码批次

- 最近播放列表按真实 `playedAt` 增加时间轴节点、连接线和时间文本，保留原有播放、移除、批量管理和清空动作。
- `npm run typecheck`、`npm test`：302/302；`git diff --check` 通过。
- 新云端运行 `38954453106`（`770da5e`）当前为 `pending`，本机只有 Command Line Tools，未执行本批 XCTest/IPA。

## 2026-10-17 A08 音乐库快捷入口代码批次

- 移除与顶部图标快捷入口重复的搜索和音乐来源文字按钮，保留动作与无障碍入口。
- `npm run check`：302/302；`git diff --check` 通过。
- 新云端运行 `38953221057`（`1e3eb61`）当前为 `pending`，本机没有完整 Xcode，未执行本批 XCTest/IPA。
- 既有本地专项结果已核对存在：`build/SourceUITests-1792168820230.xcresult` 全局封面主题 120.478 秒通过；`build/SourceUITests-1792169130948.xcresult` 设置分组/返回草稿/滚动 74.688 秒通过。它们不覆盖本批音乐库改动，也不代表云端 iOS27 或真机通过。

## 2026-10-17 A08 音乐库随机播放代码批次

- 音乐库收藏、历史和本地歌单新增“随机播放”，复用 `shuffle` 偏好和权威队列；业务来源、匹配和重复条目逻辑保持。
- `npm run check`：302/302；`git diff --check` 通过。
- 新云端运行 `38952740517`（`618ff68`）当前为 `pending`，本机只有 Command Line Tools，未执行本批 XCTest/IPA。

## 2026-10-17 A09 歌词显示设置 Sheet 代码批次

- 现代播放器“播放选项”增加独立“歌词显示设置”Sheet，对应 Sollin IPA `_showLyricDisplaySettingsSheet` 静态线索；复用现有 `FontSettings`，保留歌词来源/偏移/原生逐字和播放意图。
- `npm run check`：302/302；`git diff --check` 通过。
- 本机 `xcode-select` 仍为 Command Line Tools，未执行本批本地 XCTest/IPA；新云端运行 `38952134532`（`d2b698f`）当前为 `pending`，没有把排队状态当作通过。

## 2026-10-17 设置与全局封面主题阶段

## 2026-10-17 A09 播放器样式 Sheet 代码批次

- 现代播放器“更多播放控制”现在先显示播放选项菜单；“播放界面样式”进入独立 Sheet，队列/歌词/匹配/收藏等内容通过“队列与播放选项”进入。`play-skin-*` 标识和立即保存行为保持不变。
- `npm run check`：类型检查通过，自动测试 302/302 通过；`git diff --check` 通过。
- 本机只有 Command Line Tools，未能重新执行本地 iOS UI 专项或 unsigned IPA 归档；此前 IPA/模拟器结果不代表本批。
- 本批提交后必须触发新的 iOS 27 云端运行并读取最终检查、IPA artifact、manifest 和 SHA256；pending 不记为通过。真机、后台和减少动态效果仍待验收。

## 2026-10-17 A07 EQ 页面视觉层级代码批次

- 独立 EQ 页按参考画面重排为开关状态、前级卡、频率曲线卡、声音预设和自定义预设区；新增曲线整体重置，真实 PCM/DSP 与现有拖动和预设存储保持不变。
- `npm run check`：类型检查通过，自动测试 302/302 通过；`git diff --check` 通过。
- 本机仍只有 Command Line Tools，未重新执行本地 iOS UI/IPA；本批提交后以新云端 iOS27 运行验证。

- 前级滑杆补充 `-12 / +12` 视觉边界和无障碍名称；`npm run check` 继续为 302/302，未改变原生 DSP 或播放状态。

## 2026-10-17 A08 歌单详情刷新入口代码批次

- 发现歌单详情头部增加 `刷新歌单` 控件，复用已有分页/取消/失败保留逻辑；加载期间禁用。
- `npm run check`：302/302；`git diff --check` 通过。完整 Xcode UI/IPA 与云端 iOS27 仍待本批提交验证。

- `testDiscoveryAndAppearance` 已补充详情头部 `刷新歌单` 的存在、可点击和刷新后继续导入断言；本机无完整 Xcode，等待云端执行。

## 2026-10-17 A09 mini 排序控件视觉代码批次

- 迷你播放器设置的排序操作改为上下箭头图标，原有无障碍命名、testID、禁用边界和持久化保持。
- `npm run check`：302/302；`git diff --check` 通过。完整 Xcode UI/IPA 与云端 iOS27 仍待验证。

## 2026-10-17 A06 外观选择行视觉代码批次

- 主题、背景和播放界面样式的选择控件改为纵向列表行，选中状态使用图标表达；保留图片未导入时禁用、即时保存和错误恢复。
- `npm run check`：302/302；`git diff --check` 通过。本机完整 Xcode UI/IPA 和云端 iOS27 仍待验证。

## 2026-10-17 A08 音乐库快捷入口与分段控件代码批次

- 音乐库首页增加搜索、创建歌单、音乐来源图标快捷入口，收藏/历史/歌单改为选中态分段控件；UI 回归覆盖创建歌单快捷入口。
- `npm run check`：302/302；`git diff --check` 通过。完整 Xcode UI/IPA 与云端 iOS27 仍待验证。

- `npm run check`：类型检查通过，自动测试 **302/302** 通过。
- `git diff --check`：通过。
- 本地 UI：`build/SourceUITests-1792169130948.xcresult` 分组设置导航/草稿/滚动恢复与发现/外观专项通过；`build/SourceUITests-1792168820230.xcresult` 的实际全局封面专项通过，最终结果以对应 result bundle 记录。专项覆盖红/蓝封面跨音乐库、发现、外观页切换，关闭恢复及重启恢复。
- 本地归档：`build/logs/archive-cover-settings.log` 为 `ARCHIVE SUCCEEDED`；`build/distribution/build-manifest.json` 记录 Xcode 26.3、iOS 26.2、arm64、unsigned、min iOS 15.1。IPA SHA256 为 `fb5cc2c3e3b1558e3669f870b54317b3b45f1521d90bbcd8d0ffa80f59fb5e06`。该归档在提交前生成，manifest 的 dirty 状态只反映待提交工作区，不能当作清洁交付包。
- 云端 iOS 27：待本阶段提交后由 GitHub Actions 运行；未将排队或本地 SDK 26.2 结果记作云端通过。
- 仍待：真机、减少动态效果/后台、低电量与功耗、真实私人封面，以及 Sollin 动态流动/视频背景的行为观察。

## 2026-10-17 设置Tab根页回归修复

- 发现：在设置二级页再次点击当前设置Tab时，页面未回到设置首页；同时需要保留未提交的设置草稿。
- 修复：主壳增加设置根页请求代次；`SettingsScreen` 只重置导航 history，保留 visited 页面、草稿和滚动快照。UI 测试新增断言，覆盖从外观/字体页返回设置首页。
- 本地 `testGroupedSettingsNavigationAndDrafts`：通过，iOS 26.3.1 模拟器，`build/SourceUITests-1792169818700.xcresult`，1/1，约 178.9 秒。
- 当前 `build/distribution/build-manifest.json` 仍是提交前 dirty 归档，不能作为本修复的交付包；修复提交后重新归档。

## 2026-10-17 独立图形均衡器设置页

- 按 Sollin 设置分组把 EQ 从“播放与歌词”拆为独立 `图形均衡器` 二级页；播放页保留音质、音量、睡眠与歌词入口。原生 PCM/EQ、前级、10 段曲线、内置预设和自定义预设继续共用原偏好存储与播放后端。
- `npm run check`：类型检查与 302 项业务测试通过；`git diff --check` 通过。`testGraphicalEQPresetPersistence` 已改为通过 `settings-open-equalizer` 进入，并继续覆盖拖动、重启、删除预设和睡眠定时。
- 本机当前只有 Command Line Tools，没有完整 Xcode，因此本轮未能重新执行本地 iOS UI 专项或 unsigned IPA 归档；不能把上一批 IPA 当作本轮交付包。提交后以新的 iOS 27 云端运行验证。
- 本批提交 `7684701` 已推送；新的 iOS 27 云端运行 [38939941769](https://github.com/RhsR1024/nexus-music/actions/runs/38939941769) 当前 `pending`。旧运行 `38937690077` 继续排队，不作为本批结果。

## 2026-10-17 播放器匹配录音视觉身份修正

- 修正现代播放器将原始队列曲目传给封面/标题组件的问题；存在跨平台匹配时，现代播放器现在与背景、歌词和系统媒体使用同一个实际匹配录音。原始曲目仍是队列、收藏、评论和匹配记录的权威身份。
- `npm run check`：302/302 通过；`git diff --check` 通过。本机仍无完整 Xcode，未能重跑 iOS UI/IPA；本次提交后以新的 iOS 27 云端运行验证。

## 2026-10-17 外观入口清理

- 移除外观总览中只有静态文案、没有实际设置能力的“软件图标”行，避免形成伪入口；可用主题、背景、字体、皮肤、底栏和 mini 设置保持不变。
- `npm run check`：302/302 通过；本机无完整 Xcode，未重跑本地 UI/IPA。

- `SourceSettingsTests` 已补充图片背景可用性断言：未导入主题图片时 `background-image` 必须禁用，导入后才能选择；该断言待云端 iOS27 UI 运行执行。

## 2026-10-17 音质设置错误反馈回归

- 独立 EQ 拆分后恢复音质按钮的保存失败提示；失败时保留旧偏好并显示可重试状态，不影响 EQ、播放或队列。
- `npm run typecheck` 与 `npm test`：302/302 通过；本机无完整 Xcode，未重跑本地 UI/IPA。

## 2026-10-17 图片背景选择入口收口

- “图片”现在是主题与背景页的正式背景类型；未导入主题图片时控件明确禁用并提示先导入，导入后可在同一层选择。图片管理区不再重复提供第二个选择按钮。
- `npm run check`：302/302 通过；本机无完整 Xcode，未重跑本地 UI/IPA。

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
## 2026-10-17 A08 发现详情更多操作菜单代码批次

- 详情歌曲行将四个文字动作收敛为 `ellipsis-horizontal` 图标，复用既有下一首、加入队列、本地收藏和加入歌单。
- 更多操作使用 `SheetModal`（iOS `pageSheet`），保留 44pt 点击区域、无障碍标签和失败保留提示。
- `npm run check`：302/302；`git diff --check`：通过。
- 本机仅 Command Line Tools，未执行本批 XCTest/IPA；云端运行 `38959060803`（`4ccbb25`）已创建，当前 `pending` 且 jobs=0，不能记为 iOS27 通过。
## 2026-10-17 A08 发现详情分页失败重试代码批次

- 追加页请求失败时保留已加载歌曲，并让“重试”继续请求失败页；首次加载和刷新失败仍回到第一页。
- `npm run check`：302/302；`git diff --check`：通过。
- 本机仅 Command Line Tools，未执行本批 XCTest/IPA；云端运行 `38959674512`（`b11328d`）已创建，当前 `pending`，不能记为 iOS27 通过。
## 2026-10-17 A08 发现详情更多操作图标行代码批次

- 更多操作 Sheet 使用 `play-skip-forward`、`list`、`heart`、`albums-outline` 图标行和右箭头，保持 56pt 行高与无障碍标题。
- `npm run check`：302/302；`git diff --check`：通过。
- 本机仅 Command Line Tools，未执行本批 XCTest/IPA；云端运行 `38960235054`（`6962dc5`）已创建，当前 `pending`，不能记为 iOS27 通过。
## 2026-10-17 A09 全部歌词 page sheet 代码批次

- 完整歌词展开层统一使用共享 `SheetModal`，保留歌词来源、偏移、双击定位、逐字绘制和 `FlatList` 有界渲染。
- `npm run check`：302/302；`git diff --check`：通过。
- 本机仅 Command Line Tools，未执行本批 XCTest/IPA；云端运行 `38960563962`（`40faff5`）已创建，当前 `pending`，不能记为 iOS27 通过。
## 2026-10-17 A08/A09 本地 UI 与设备归档验证

- 工具链更正：`source scripts/environment.sh` 后为 Xcode 26.3（17C529）/iOS 26.2 SDK。
- `build/SourceUITests-1792181776488.xcresult`：`testCrossPlatformLyrics`、`testDiscoveryAndAppearance` 2/2 通过，0 failures，iOS 26.3.1 iPhone 15 Pro Max 模拟器。
- 当前 HEAD `31f1ebc` 的 `npm run ios:archive` 成功；manifest `dirty=false`、`workingTreeChanges=[]`、arm64、`iphoneos26.2`、min iOS 15.1、设备族 `[1,2]`、signed=false。
- `build/distribution/NexusMusic-unsigned.ipa` SHA256：`b22761ef58c4252f0ae4d711f98228c46763be3d775fc3cc077b65eb7da1ed74`。该包不代表 iOS 27、签名或真机通过。
## 2026-10-17 A09 歌词展开回归与清洁归档

`dd2a1eb` 已提交并 push。`npm run check` 302/302；`build/SourceUITests-1792182510520.xcresult` 中 `testCrossPlatformLyrics`、`testDiscoveryAndAppearance` 共 2/2 通过，iOS 26.3.1 模拟器，0 failures。`source scripts/environment.sh && npm run ios:archive` 成功，manifest 为 `dirty=false`、arm64、`iphoneos26.2`、min iOS 15.1、设备族 `[1,2]`、signed=false；IPA SHA256 `11ce4fda9e4517b3058a89b920cbc9d0f0d985e1b69cbc6b335cd2d0492d2d37`。对应云端 [38963298132](https://github.com/RhsR1024/nexus-music/actions/runs/38963298132) 当前 `pending`，不记为 iOS27 通过；签名、真机、后台/功耗仍待验收。

## 2026-10-17 A09 播放器独立样式入口

`7c8075c` 已提交并 push。现代播放器“调整播放界面”直接进入样式 `pageSheet`，“队列与播放选项”仍进入完整菜单；本地 `build/SourceUITests-1792183369784.xcresult` 1/1 通过，`npm run check` 302/302。清洁归档 manifest 为 dirty=false、arm64、`iphoneos26.2`、min iOS 15.1、设备族 `[1,2]`、signed=false；IPA SHA256 `5ec7ec1f64698cb61da74a9e3403da6615f348a6838d92ce4aea297639f3c933`。对应 [38964697049](https://github.com/RhsR1024/nexus-music/actions/runs/38964697049) 当前 pending，签名、真机、后台/功耗待验收。
## 2026-10-17 云端 38903549077 完整成功 / IPA 已下载核验

运行 `38903549077` / `c4422bc7359f7f20bf594aa5b94f506632147df8` 于北京时间05:14结束success。jobs快照在 `build/ci-38903549077/jobs.json`：checks和iOS job `117164364843`、完整native、两组App、设备IPA归档和上传全部成功。

IPA artifact `12076096155` 为9769140字节；完整ZIP SHA256 `9212ab3dca22a2054838581ef064a3304e5005af37332dc0115d19d1bbc0fbc6` 与API digest一致，ZIP CRC通过。内部IPA SHA256 `fdc0696bdab9b87f75ece602e7abb20a64f162a2c670c6e489b69f9bf0b1430f` 与随包sha256一致，内部ZIP CRC通过；已检查bundle ID、正式JS无测试adapter、arm64、iphoneos27.0、最低15.1。manifest为Xcode27.0/27A266a、signed=false、dirty=true且仅 `M ios/Podfile.lock`。设备族仍为[1]，不算后续iPad原生窗口或近期UI改动通过。

诊断artifact `12075332518`（353132621字节）仅保存API元信息，未下载，不能声称其摘要已核验。旧38902977651写真导入错误仍保留根因定位项；本次成功不证明间歇性错误已被修复。F33 `38913246781` 正常执行，最新功能提交排队；没有取消/重派或干扰其他上下文的修改。
## 2026-10-17 A08 音乐库动作 Sheet 最终本地归档

- 提交 `bea1fbdd2e05468977ae98c8ecb987aae78c8dcb` 已 push；在 `b0139bb` 的歌曲行更多操作 Sheet 基础上，补充 UI 回归对“加入队列”和“本地收藏”入口的断言。
- `npm run check`：302/302；`git diff --check`：通过。
- 本地 UI：`build/SourceUITests-1792189642512.xcresult` 的 `testDiscoveryAndAppearance` 1/1 通过；本轮最终音乐库专项结果见下条。
- 本地最终音乐库 UI：`build/SourceUITests-1792189902252.xcresult`，音乐库歌曲行/歌单搜索排序/重复移除/滑动删除/更多操作覆盖通过，1/1，123.773 秒，0 failures。
- 本地 Release archive：成功；`build/distribution/build-manifest.json` 为 commit=`bea1fbdd2e05468977ae98c8ecb987aae78c8dcb`、`dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`。
- IPA：`build/distribution/NexusMusic-unsigned.ipa`，SHA256 `9da2021825fad953b5cf37b8400d02456d67edf520d63209f2613bf492c90642`。
- 云端 iOS 27：[38976733431](https://github.com/RhsR1024/nexus-music/actions/runs/38976733431) 对应 `bea1fbd`，截至 2026-10-17 仍为 `pending`，不计作通过；签名、真机、后台/功耗和大字手势仍待验收。
## 2026-10-17 A09 外观样式子页图标行

- 设置→外观→播放界面样式改为图标列表行，增加每个布局的行为说明、选中态、箭头/勾选；继续保留六个实际布局，不把 IPA 静态文案推断成完整新枚举。
- `npm run check` 302/302；`git diff --check` 通过。
- 本地设置分组 UI `build/SourceUITests-1792191433812.xcresult`：`testGroupedSettingsNavigationAndDrafts` 1/1 通过。播放器 `testZNavidromePlaybackAndCredentials` 两次运行均在既有合成流 `2:00` 时长断言失败，未将其记为本批播放器通过；失败日志保留在 `build/logs/ui-catalog.log`。
- 清洁本地归档成功：Xcode 26.3 / iOS 26.2 SDK、arm64、最低 iOS 15.1、设备族 `[1,2]`、unsigned；manifest 在归档前包含本批工作树改动，IPA SHA256 `c0c8adf3ed6cac2befa33948688217b42d627ff3e06082c67bffb889db44d588`。本地包不代表 iOS27、签名或真机通过。
- iOS27 运行 [38979554313](https://github.com/RhsR1024/nexus-music/actions/runs/38979554313) 已对应 `77d58e0`，当前 `pending`；旧 `38976733431` 仍为 `bea1fbd`，不沿用其结果。

## 2026-10-17 15:24 匹配清理修正版本地通过

`build/SourceUITests-1792220258492.xcresult` 的 `testOnlineMatching` 已结束：100.832秒、1项零失败，`TEST SUCCEEDED`。日志留存 `build/logs/ui-matching-cleanup-passed-1792220258492.log`，请求计数为同名前缀 `-counts.json`；实际日志确认到达并点击匹配夹具、删除确认后“完成1项”断言通过，自动匹配/人工版本/PCM/重启与开关持久化断言保留。修正已随95c2e03进入提交，52a0aaf对应最新云端39012949974仍pending；运行39010767320对应更早3e56d4d，不包含清理修正，继续执行核心App测试。未取消/重派。此为本地SDK26.2合成服务专项，不能替代云端iOS27、真实服务或真机；旧本地Files列表失败仍保留。当前其他离线开发改动未由心跳提交。

## 2026-10-17 M10 摘要校验批次（本地检查）

## 2026-10-17 M10 传输完整性与下载竞态修正

本批在上一批摘要校验/在播保护基础上，新增 `src/storage/offlineTransfer.ts` 的纯校验层，并让真实文件适配器使用 Expo `fetch` 流式响应。断点续传必须收到匹配的 `206 Content-Range` 起点；`Content-Length`、总长度和实体校验器（`ETag` 或 `Last-Modified`）不一致时不会把内容标记为完成，并通过 `If-Range` 保护跨请求实体。任务记录的保存和发布变更串行化；删除尚未启动的排队任务会先阻止其运行，删除活动任务会等待其终止后再清理文件。

本地 `npm run check`：317/317；类型检查通过。新增真实 HTTP/磁盘流、传输响应长度/范围/实体校验测试，以及删除排队任务的竞态测试。此前 `26d3675` 的清洁 unsigned archive 仍是上一批产物，不能覆盖本批代码；本批需提交后重新生成清洁归档并跟踪 iOS27。

提交 `920d193` 的本地清洁归档已成功：`build/logs/archive-offline-transfer-920d193.log` 为 `ARCHIVE SUCCEEDED`；manifest `dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`，正式入口校验和 ZIP CRC 通过；IPA SHA256 `451c98c59cfb0fde012cb2c887f608550ca5733522ed366f0b3b5973f51d7ebc`。该包不替代 iOS27、签名、真机或真实服务。

`920d193` 已正常 push 到 `RhsR1024/nexus-music`。push 后 GitHub API 核对（2026-10-17 16:09 Asia/Shanghai）：`39016561400`（`920d193`）为最新 `pending`，`39010767320`（`3e56d4d`）仍为唯一 `in_progress`；`39014868431`（`7cc176c`）和 `39012949974`（`52a0aaf`）均已自动取消。队列为 1 个运行、1 个最新排队，未取消运行中任务，也未重派旧版本；pending/取消不计为通过。

本轮新增本地离线文件摘要、恢复校验、当前播放文件删除保护和 `.part` 大小读取；`npm run check` 311/311，`npm run test:native` 通过，`git diff --check` 通过。摘要只证明本地文件在完成与恢复时的一致性，不能证明远端传输完整或真实服务长期可用。当前没有 iOS27、签名或真机结果，待提交后按 `queue: single` 核对云端运行/排队。

本轮 `26d3675` 本地 unsigned device archive 已成功：Xcode 26.3 / iOS 26.2 SDK、arm64、最低 iOS 15.1、设备族 `[1,2]`，manifest `dirty=false`，IPA SHA256 `393fb8c8008b41dd1e450e61951721645078e12a3f33aaf0a932faa637ce3dcb`。该包不替代 iOS27、签名、真机或真实服务验收。


## 2026-10-17 16:30 心跳：容量旧批次失败已核对，最新批次继续

`39010767320` / `3e56d4d` 已失败：checks、native 与首组核心 App 步骤通过；第二组 4/5 通过，唯一 `testOnlineMatching` 在旧 Swift337 的测试音源清理可点击断言失败（142.689秒）。`build/ci-39010767320/logs/ui-catalog.log:26609` 及前文确认连续向下滑仍未触达夹具，与上一运行同一问题；歌词141.685秒、发现97.446秒、评论25.491秒、健康89.239秒通过。iPad 与云端 IPA 被跳过，失败后的600秒诊断超时不是首因。

诊断 artifact `12094896784` 的 ZIP 目录已解析，单独日志条目解压长度2898100字节及CRC32校验通过；未下载/核验完整ZIP摘要，详见忽略目录 `build/ci-39010767320/FINDINGS.txt`。修正提交 `95c2e03` 不在失败的旧 `3e56d4d` 中，已由 Git 祖先及文件核对确认包含于最新 `920d193`；本地专项1792220258492此前100.832秒通过，不重复修改/重派旧版。

最新 `39016561400` / `920d193` 当前运行中，checks/native已通过，首组核心App步骤执行中；实际队列为1运行/0排队，未取消运行。新iOS27终态、iPad/云端归档及真实服务/签名/真机仍待。心跳仅追加状态证据，未提交或覆盖另一执行上下文正在编写的E-004文档及后续功能工作。

最大辅助字号补记：1792240831918.xcresult，经新首页→播放→EQ入口，单列卡片32.744秒通过，1/1、零失败/跳过。清洁归档/本批云端仍待。

本批实音回归鉴权8次成功、0失败，未新增stream请求，允许命中既有临时音频缓存；不称本次冷下载。
## 2026-10-18 E032原生配色本地专项通过

[0058](decisions/0058-native-ambient-color-composition.md)接入原始色板、HSL字节量化、双色基底、共享柔光和混合外主题覆盖层；pending/主题重建/后台/减少动态/两场所有权保持。368业务/类型、完整native及32独立颜色向量通过。`SourceUITests-1792293700730`背景专项434.412秒、1通过/0失败/0跳过；视频62帧、10中间色帧、红切换0.481667秒，加载中红/迟到蓝/失败清场、明暗、PCM/Home/重启/开关/凭据清理通过。19合成鉴权/0失败、无新stream、复用缓存；不替代真实服务、iOS27、签名或真机。`ce192a4`已正常push，远端main一致；清洁归档dirty=false/changes=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned，IPA SHA256 `9739b02a7fc68ae213be0147801875cdf7c758ec14310a2c3724488cd1825c06`，留存`build/local-ambient-color-ce192a4`。新iOS27运行`39094486501`当前pending。

## 2026-10-18 平台账号安全底座归档回执

提交 `09480afbeb1f3b9f34abc755e868b39548849622` 已完成本地 clean unsigned archive：Xcode 26.3、iOS SDK 26.2、arm64、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`、`dirty=false`、`workingTreeChanges=[]`。`build/verify-presentation-archive.py` 已通过 ZIP CRC、归档可执行文件与 `main.jsbundle` 字节一致、正式入口及私人资源排除；IPA SHA256 为 `792ef3cad6b3aad97bee716a235e5e4759bfb95f8a5d21dbac908e94cb879d5e`。本地归档不证明真实平台登录、签名或真机验收。

## 2026-10-18 平台授权状态机归档回执

提交 `8b217c9aa891dcb06e2db5875bab74279e779c04` 的本地 clean unsigned archive 已成功：Xcode 26.3、iOS SDK 26.2、arm64、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`、`dirty=false`、`workingTreeChanges=[]`。`build/verify-presentation-archive.py` 通过 ZIP CRC、归档可执行文件与 `main.jsbundle` 一致、正式入口和私人资源排除；IPA SHA256 `11566adb7b0f092bdafb631437b9887ad5a87758397288523a32c4179b1d0e8f`。该归档不替代真实平台授权、签名或真机验收。

## 2026-10-18 授权清理异常修复归档回执

提交 `fd376cc82dd5afa0023d247d7c4f0c5b1e7e3ddc` 在原生清理回调异常保护修复后重新完成 clean unsigned archive；`npm run check` 384/384。归档校验通过，arm64、iOS SDK 26.2、最低 iOS 15.1、设备族 `[1,2]`、signed=false、dirty=false；IPA SHA256 `c74b8d5fb6377d4d50874e730f5bf58d57eadf9d511dd8fdada79327458cd180`。真实平台授权、签名和真机仍未验收。

## 2026-10-18 评论Sheet与用户新图标：本地通过，按要求停止

评论Sheet387业务/类型检查通过，公开评论专项1792316042818：40.307秒、1通过/0失败/0跳过，覆盖滚动固定头、横竖屏、失败留旧/重试/刷新和系统下滑关闭。正式入口综合1792316242352：267.694秒、1通过/0失败/0跳过，覆盖合成Navidrome/PCM、八布局及AM2内嵌、队列/歌词/统计/重启/凭据清理；日志与摘要留`build/logs/ui-comments-am2-*`。测试后模拟器诊断采集报告simctl路径错误，实际xcresult与测试终态均通过，不冒称完整诊断已收集。

新用户图标尺寸/无alpha/两份PNG字节一致已核对；`npm run ios:build`本地Release Simulator `BUILD SUCCEEDED`，包含AppIcon资源编译，日志`build/logs/build-comments-user-icon.log`；包内CFBundleIcons指向AppIcon并生成iPhone/iPad图标。未因资源替换重跑播放测试。本批清洁unsigned归档、提交/push与新代码iOS27尚未执行：用户要求完成工具/图标及文档后停下，保留工作区供下次接续。既有云端39111966447/23090d0运行、39115107158/4797970排队是最后已核对快照，未取消或重派。真实服务、签名及真机结论没有增加。

2026-10-18最终补验：Release构建已安装到既有iPhone模拟器，SpringBoard新红色图标显示正确、无外侧白边或安装进度遮罩；截图`build/user-icon-springboard-final.png`已亲看。此为模拟器桌面图标验证，非手机/签名验收。

## 2026-10-18 恢复持续实施（当前有效）

用户本轮明确恢复全部计划，覆盖此前完成工具/图标后停止的临时要求；识曲本期不实现、漫途持续/双向同步排除等范围决定继续有效。先完成评论Sheet/用户图标/专项APK门禁这批的验证、清洁归档与正常push，再继续A03–A09既有UI/交互缺口，随后新增功能；F/J逐项验收不变。

新路由master-route-20261018-175924命中R2/mobile-reverse；未覆盖既有case。IPA/APK严格review及E033独立原字节核验通过，业务/类型复跑387/387。GitHub API实核39111966447/23090d0核心组22通过/2失败/0跳过，checks/iOS27工具链/完整native通过；字体测试样式自动关闭竞态及深色重启暂停三色边缘缺绿分别跟进，不将失败改写。小日志artifact12132866875已下载，515010字节及SHA256/ZIP CRC通过；完整诊断792056801字节超连接器536870912上限，尚未取得。字体导航新增明确等待Sheet消失，原断言保留，本地联合回归1792317751597中的字体专项已383.819秒通过（含八布局/PCM/重启），完整背景仍在执行；清洁归档/云端终态仍待。真实服务/签名/真机没有新增证据。

## 2026-10-18 失败截图与文本独立产物

39111966447核心组22通过/2失败，小日志515010字节已实际下载并通过API摘要/完整ZIP CRC；完整诊断792056801字节超过连接器512MiB上限，尚未取得其截图/录屏。为保留可用取证，test-ui在结果摘要确认失败后按失败testIdentifier导出该测试附件（含断言前具名截图），仅复制PNG/JPEG/文本/manifest到独立目录，单文件32MiB、合计128MiB上限，export-index逐项记录纳入与排除。视频和原始xcresult仍由原完整诊断产物保存；导出失败只报告诊断错误，保留原测试退出码。

新步骤独立上传ios-failure-evidence；single/保留运行中/所有原测试不变。以本机已有失败结果1792300131198实际验收：导出426条附件、46文件纳入48548651字节，包括失败前具名PNG与manifest；视频未复制。此证明本地导出能力，不冒称已取得旧云端完整包或新云端上传成功。

## 2026-10-18 清理规则与本轮回归终态（最新）

用户新增要求：临时诊断包、日志和缓存使用后定期清理，避免占满磁盘。已写入AGENTS与BUILDING，并更新既有ios27跟进任务，每天首次可用运行/阶段收尾检查；临时7天、普通日志14天、已解决完整结果30天轮换，活动构建目录/最新两批有效产物/未解决关键证据/reverse-skill样本与Evidence保护。首轮仅删除重复failure-exports与无使用者DeviceDerivedData-color，共1932582912分配字节（约1.93GB）；回执build/logs/cleanup-2026-10-18.json。原始xcresult、必要PNG与所有逆向案例保留，不把清理计作功能进度。

阶段提交056459c已形成，尚待本批清洁归档/push。387业务/类型、评论40.307秒及既有AM2/八布局/PCM267.694秒通过，用户图标Release资源编译/两份RGB1024摘要通过。新联合1792317751597最终1通过/1失败/0跳过：字体383.819秒通过（明确等待样式自动关闭，全部原断言保持）；完整背景414.693秒失败于深色重启后暂停三色。原日志/summary/counts已另存ui-resume-font-background-*，xcresult及附件build/resume-background-failed保留；失败PNG71C94B03已亲看，独立Pillow读原14点均opaque但只有红/蓝主色；本轮测试采样同时返回空数组。不能仅归因于捕获瞬态，也未确定场景seed/几何或色板根因；保留三色门槛、PCM和全部断言，下一优先定位。评论/图标和字体修复按各自专项验收，不将整组失败计通过。

云端39111966447/23090d0已completed/failure，核心22通过/2失败；小日志SHA/CRC通过，完整792MB包仍未取得。后续39115107158/4797970已自动运行，checks/iOS27工具链/完整native成功，核心App仍进行；未取消或重派。新独立失败截图/文本导出已用既有失败结果实际核验，下一代码CI验证上传；原始完整诊断保留。真实服务、签名、真机没有新增结论；本轮未完成全部A/F/J，继续按既定顺序推进。

## 2026-10-18 评论/图标及清理规则：清洁归档与push回执

产品/诊断056459c及规则/回执8aefb2399744ba8977140e7ed80a0fe05918c2bb已正常push到RhsR1024/nexus-music，ls-remote确认main一致。8aefb23清洁unsigned归档ARCHIVE SUCCEEDED：dirty=false/changes=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]；79条目ZIP CRC、附带SHA、包内可执行/JS与原归档字节、正式入口及私人/签名资源排除通过。IPA SHA256 `3d96654726ccef96b01e81c4115674e88d87e38604556ff3e08a00ad873fcaff`，收据与包留build/local-comments-icon-8aefb23，日志archive-comments-icon-resume-clean.log。

push后API实核新iOS27运行39119277363/8aefb23为唯一pending，39115107158/4797970继续in_progress，保持1运行/1排队；未取消或重派。新云端终态待，原背景本地1失败及23090d0云端2失败不改写。下一优先深色重启暂停实际场景/三色缺绿的取证与修复，全部其余A/F/J继续，真实服务/签名/真机无新结论。临时清理已加入项目规则和既有跟进任务，本轮约1.93GB回收及保留原始证据见下方清理记录。

## 2026-10-18 背景暂停基线与下一黑胶证据（待最终App）

[0065](decisions/0065-paused-background-pixel-baseline.md)记录合法几何反例、PNG读取及精确暂停恢复验收。387业务/类型、PNG/native几何专项通过；首轮1792319723943在480.111秒只因最后移除连接后立即查mini失败，深浅暂停恢复和原PCM/异步/播放态三色已执行，整项不计通过。只读后态确认合成账号已删、queue/cursor currentId均null，补实际完成消息/mini消失屏障并保留原断言，完整复验继续。独立失败导出及时清理自己的staging，原始结果和必要PNG保留。

下一黑胶/唱针E034→F033→P033已独立重放1544原始指令/138BL/114池引用，strict review34E/33F/33P、12WI/78事件零问题；两控制器构造/同步/释放及有限分支见[静态报告](2026-10-18_reverse-sollin-vinyl-motion-report.md)。完整标志/参数/几何/手势与产品采纳未完成，不提高进度；没有目标运行/私有服务/签名/真机新证据。

## 2026-10-18 背景暂停基线最终本地通过

[0065](decisions/0065-paused-background-pixel-baseline.md)最终完整专项1792320461405：467.221秒、1通过/0失败/0跳过。保留原PCM/活动恢复/异步挂起与迟到/失败回退/播放态三色；深色暂停重启14点RGBA与原基线完全相同，恢复浅色与浅色暂停基线相同，明暗差/暂停稳定/独立开关/实际移除成功后mini清理通过。16次合成鉴权/0失败、无新stream（复用缓存），视频59帧/7中间色，红阈值0.528333秒，不计FPS/功耗或真实服务。日志/summary/counts留ui-background-baseline-passed-*；四张关键PNG与独立Pillow14点opaque精确比较收据留build/background-baseline-passed，深浅截图已亲看；重复完整导出在finally删除。480.111秒的首轮最后清理失败仍保留，不改写为通过。

387业务/类型、PNG往返/坏数据及几何native专项通过；独立失败导出成功/出错均删除自己的临时目录，原结果保留。34E/33F/33P严格review通过，下一黑胶控制器静态报告已补齐，标志/参数/手势与产品采纳仍待。本批尚待清洁归档、正常push及对应新iOS27，全部其余A/F/J和真实服务/签名/真机缺口保持。
## 2026-10-20 iOS27 三项失败测试导航补修

对应 run 39305209267 的 `testPlayerStyleSheetWithLargeTextAndPersistence`、`testEQPresetCardsWithLargeText`、`testClassicPlayerWindowSafeArea` 已完成测试层修复，产品代码和视觉断言未改。根因分别收敛为：样式 Sheet 已自动 dismiss 后仍点击陈旧 close；上一测试残留全屏经典播放器导致 EQ 设置导航落错；隐藏 `tab-settings` 的无限临时 frame 被直接查询 hittability。

修复后先等待有限可见 frame，再判断可点击；`openSettings` 仅在真正需要时关闭残留播放页；样式 Sheet 打开/关闭使用存在、可点击、消失三段屏障；经典用例经真实“查看播放队列”入口打开并关闭队列宿主后再验 safe viewport。

Release 结果：播放样式 + EQ 同批 2/0/0（`SourceUITests-1792500633689`，259.199 秒）；经典安全区 1/0/0（`SourceUITests-1792500411868`，约208.4秒）。两者均在 NexusMusic iPhone 15 Pro Max / iOS26.3.1 x86_64 模拟器。`npm run check` 401/401、Swift parse、diff check通过。iOS27 新 run、clean IPA 与真机仍待。

测试提交`1df056234c756ed3349067cb93aafb6096d50ce7`的清洁unsigned归档已完成：manifest dirty=false/changes=[]、arm64/iphoneos26.2/min15.1/设备族[1,2]、signed=false；ZIP CRC、产品JS字节、正式入口及私人/测试/签名排除通过。IPA SHA-256 `9b5fd83a23573fa91227114cbc3c72d17033f4721c9e1c60f58466a5b25cd9a0`，留`build/local-appearance-test-nav-1df0562`。推送后仍需实际iOS27终态；不能由本地归档代替。

另复核舞台面板正确附件：IMG_4872与`Stage style panel`为局部SSIM81.81%/MAD16.26；此前44.91%是收起的运输页，不能当面板状态。E-045严格review通过45E/41F/41P、17WI/96 timeline。该测量不改变产品字节或IPA，动效及真机仍未验收。

## 2026-10-20 局部 SSIM 度量批次与干净 unsigned IPA
## 2026-10-21 Files双用例通过、云端失败与本机Hermes ABI阻断

- `SourceUITests-1792526082262.xcresult`：Files/千首/本地音频双用例2通过、0失败、0跳过，253.378秒。日志`build/logs/ui-catalog.log`；失败前的多次双击诊断结果另存`SourceUITests-1792526459346`、`1792526810680`等，不覆盖。
- iOS27 `39463281458/de0d820`：checks、native、模拟器创建成功；第10步App UI失败，在线/离线/归档跳过。公开API实核完成，job step见上述；compact/failure artifact元数据分别为531052/26495308字节，但下载均401，未取得内容。
- `npm run check` 407/407通过；Swift parse通过；`npm run test:native`完整通过（实际AVPlayer/PCM、睡眠、缓存、WebDAV、本地音频、系统媒体和视觉契约）。
- 本机Release UI回归被RN0.81 x86_64预编译产物阻断：Release Hermes缺`RuntimeAdapterD2Ev`导致dyld启动失败；Debug Hermes含符号但与Release预编译React组合触发SIGBUS。crash reports留`~/Library/Logs/DiagnosticReports/app-2026-10-21-043735.ips`、`044324`、`045538`和`050059`。不据此判断产品UI失败。
- 本机Pods/React缓存仅为验证环境，不属于仓库改动；提交前恢复lock/manifest，云端以实际iOS27 Release终态为准。
- 清洁unsigned IPA待本批提交后重做；真实服务、Apple签名和真机无新增证据。

## 2026-10-23 27e19b7本地归档与云端启动

27e19b7清洁unsigned设备归档通过：arm64/SDK26.2/min15.1/families1,2，dirty=false/changes=[]；IPA SHA256 7fd6184c1f451f5fe13d00aa8ee6ab9a11d86fe4dc78727b317eda8980fec772，12,276,065字节/83项CRC通过，生产JS SHA cd0b5e98a646c42c9c985738aaed1e5d64fc865025774165dff36826ddee5fd0与归档一致，测试标记和私人资源路径排除通过。版本产物留build/local-classic-27e19b7-20261023。已正常push，云端39879388063/27e19b7运行，0排队；不计iOS27成功、签名或真机。

阶段磁盘复核17GiB余量，新版本产物12MiB、案例原始核验44KiB；当前构建及全部哈希引用证据保留，无删除动作。前两有效本地阶段6f2e413与27e19b7均有版本IPA/manifest/verification；不把build/distribution旧6f内容继续标成当前版本。

## 2026-10-23 LX P4/P5 本地 App 验证

`npm run check` 480/480（日志 `build/logs/check-parse-p4-p5-20261023.log`，SHA256 `3a9c8c0c97e5cf648872a295a31995bfd060d439f425c1988264a958bca453d4`）。P4/P5 业务专项 14/14（`build/parse-p4-p5-20261023/p4-p5-tests.log`）。

`testLXMCImportCancelAndRestart` 在 `NexusMusic English Files`（iPhone 17 模拟器，iOS 26.3.1，x86_64）Release 1通过/0失败/0跳过（`SourceUITests-1792724009293.xcresult`），manifest `build/parse-p5-lxmc-r4-20261023/run-manifest.json`：exitCode 0、sourceUnchanged true、resultInfoSha256 `0fa4dbbc41b763fe92cbf6e7d4b77255293286a486cd5790511eb0ed9f33df99`、安装包 digest `926ba0e107a2e44be0297a29b7d9d88773f22f3ab990d9e68f642c693a959119`。这是模拟器+合成 LXMC 证据，不是真实 LX 导出、云端 iOS 27、签名或真机验收。

P4/P5 与经典歌词 r49 批次已分别提交为 `5c524a0`、`cf31064` 并正常 push。`cf31064` 清洁 unsigned 归档：dirty=false/changes=[]、arm64/iphoneos26.2/min15.1/设备族[1,2]、signed=false；IPA 12,280,208 字节、SHA256 `ae141c5a01f835dec521586cc5a179ef73904b251668da346f5f51b3c00425de`，ZIP CRC 通过，产物留 `build/distribution/`，日志 `build/logs/archive-parse-p4-p5-20261023.log`。推送后云端 `39892842558/cf31064` pending，`39879388063/27e19b7` 仍运行，队列 1/1；旧 pending `39886076532/cdfba10` 自动取消。云端 iOS 27 终态待验。
