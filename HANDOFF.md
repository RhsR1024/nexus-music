## 2026-10-18 评论/图标及清理规则：清洁归档与push回执

产品/诊断056459c及规则/回执8aefb2399744ba8977140e7ed80a0fe05918c2bb已正常push到RhsR1024/nexus-music，ls-remote确认main一致。8aefb23清洁unsigned归档ARCHIVE SUCCEEDED：dirty=false/changes=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]；79条目ZIP CRC、附带SHA、包内可执行/JS与原归档字节、正式入口及私人/签名资源排除通过。IPA SHA256 `3d96654726ccef96b01e81c4115674e88d87e38604556ff3e08a00ad873fcaff`，收据与包留build/local-comments-icon-8aefb23，日志archive-comments-icon-resume-clean.log。

push后API实核新iOS27运行39119277363/8aefb23为唯一pending，39115107158/4797970继续in_progress，保持1运行/1排队；未取消或重派。新云端终态待，原背景本地1失败及23090d0云端2失败不改写。下一优先深色重启暂停实际场景/三色缺绿的取证与修复，全部其余A/F/J继续，真实服务/签名/真机无新结论。临时清理已加入项目规则和既有跟进任务，本轮约1.93GB回收及保留原始证据见下方清理记录。

## 2026-10-18 清理规则与本轮回归终态（最新）

用户新增要求：临时诊断包、日志和缓存使用后定期清理，避免占满磁盘。已写入AGENTS与BUILDING，并更新既有ios27跟进任务，每天首次可用运行/阶段收尾检查；临时7天、普通日志14天、已解决完整结果30天轮换，活动构建目录/最新两批有效产物/未解决关键证据/reverse-skill样本与Evidence保护。首轮仅删除重复failure-exports与无使用者DeviceDerivedData-color，共1932582912分配字节（约1.93GB）；回执build/logs/cleanup-2026-10-18.json。原始xcresult、必要PNG与所有逆向案例保留，不把清理计作功能进度。

阶段提交056459c已形成，尚待本批清洁归档/push。387业务/类型、评论40.307秒及既有AM2/八布局/PCM267.694秒通过，用户图标Release资源编译/两份RGB1024摘要通过。新联合1792317751597最终1通过/1失败/0跳过：字体383.819秒通过（明确等待样式自动关闭，全部原断言保持）；完整背景414.693秒失败于深色重启后暂停三色。原日志/summary/counts已另存ui-resume-font-background-*，xcresult及附件build/resume-background-failed保留；失败PNG71C94B03已亲看，独立Pillow读原14点均opaque但只有红/蓝主色；本轮测试采样同时返回空数组。不能仅归因于捕获瞬态，也未确定场景seed/几何或色板根因；保留三色门槛、PCM和全部断言，下一优先定位。评论/图标和字体修复按各自专项验收，不将整组失败计通过。

云端39111966447/23090d0已completed/failure，核心22通过/2失败；小日志SHA/CRC通过，完整792MB包仍未取得。后续39115107158/4797970已自动运行，checks/iOS27工具链/完整native成功，核心App仍进行；未取消或重派。新独立失败截图/文本导出已用既有失败结果实际核验，下一代码CI验证上传；原始完整诊断保留。真实服务、签名、真机没有新增结论；本轮未完成全部A/F/J，继续按既定顺序推进。

## 2026-10-18 恢复持续实施（当前有效）

用户本轮明确恢复全部计划，覆盖此前完成工具/图标后停止的临时要求；识曲本期不实现、漫途持续/双向同步排除等范围决定继续有效。先完成评论Sheet/用户图标/专项APK门禁这批的验证、清洁归档与正常push，再继续A03–A09既有UI/交互缺口，随后新增功能；F/J逐项验收不变。

新路由master-route-20261018-175924命中R2/mobile-reverse；未覆盖既有case。IPA/APK严格review及E033独立原字节核验通过，业务/类型复跑387/387。GitHub API实核39111966447/23090d0核心组22通过/2失败/0跳过，checks/iOS27工具链/完整native通过；字体测试样式自动关闭竞态及深色重启暂停三色边缘缺绿分别跟进，不将失败改写。小日志artifact12132866875已下载，515010字节及SHA256/ZIP CRC通过；完整诊断792056801字节超连接器536870912上限，尚未取得。字体导航新增明确等待Sheet消失，原断言保留，本地联合回归1792317751597中的字体专项已383.819秒通过（含八布局/PCM/重启），完整背景仍在执行；清洁归档/云端终态仍待。真实服务/签名/真机没有新增证据。

## 2026-10-18 历史停止点（已由本轮恢复指令覆盖）

用户明确：先完成补充第1项APK工具、第3项用户图标，以及范围/任务/交接同步，然后停止。现已完成：指定APK仓库固定1b94651与项目skill-installer安装/许可证/字节门禁核验，原IPA流程保留且APK仅按需补充，见[逆向工作流](docs/REVERSE_SKILL_WORKFLOW.md)；用户图标两份资产已替换，1024 RGB及Release资源编译通过，安装后模拟器SpringBoard新图标已亲看，见[0064](docs/decisions/0064-user-app-icon.md)。全矩阵doctor如实记录缺口，未声称设备/Hook/签名工具全齐或新增APK功能证据。

识曲本期不实现、后续有需求再触发；播放统计保留。漫途持续/双向歌单同步不实现，公开歌单一次导入和音枢WebDAV同步保留。按[进度重估](docs/PROGRESS_ESTIMATE.md)，排除未开发漫途同步0.30与识曲暂估1.00单位后，开发80.65/98.70≈81.71%（对外约82%），剩余18.29%；不含后期真机反馈修改。完整交付约59%，没有新增真实服务/签名/真机证据。

评论Sheet业务/类型387通过、专项40.307秒通过、正式入口AM2/八布局/PCM267.694秒通过；新图标Release Simulator构建通过。当前代码、图标、门禁和文档改动均保留工作区，**本批尚未提交/push或clean archive**。按用户要求停止，不再继续其他功能或新构建；没有取消既有云端任务。下次恢复先检查工作区和实际CI状态，再验证/分批提交归档正常push，不能把当前本地结果写成iOS27或真机通过。详细回执见[BUILD_STATUS](docs/BUILD_STATUS.md)。下方active/待做/识曲待决/旧81%是历史，受此最新范围与停止要求覆盖。

# 2026-10-18 用户补充：APK工具、识曲本期不实现与新图标

识曲来源/方案/维护/限额/准确率见[评估](docs/RECOGNITION_ASSESSMENT.md)，用户最新明确决定本期不实现识曲，后续有需求再触发；统计继续。未开发识曲暂估1.00单位从分母排除后，当前开发约81.71%（约82%）、剩余18.29%，不包含后期真机反馈修改。漫途持续/双向歌单同步已明确不实现，一次性公开歌单导入及音枢WebDAV同步保留。新图标按[0064](docs/decisions/0064-user-app-icon.md)替换临时漫途图标。IPA继续原reverse-skill，APK按需使用用户指定RhsR1024/apk-reverse作补充，证据门禁与私人服务边界保留。

## 2026-10-18 评论 Sheet 对齐阶段（本地App通过）

reverse-skill新R2/mobile-reverse路由、既有离线scope/case-guard后，E033→F032→P032独立核验827原始指令/70BL/60池条目及Row/Expanded/Column子节点；采纳前strict review33E/32F/32P、11WI/75事件零错误/警告。按[0063](docs/decisions/0063-comments-sheet.md)完成五固定参考/许可/维护/Android比较后，原创接入原生Sheet、固定标题/刷新行及热门/最新SectionList，保留原曲归属、分页/错误留旧/取消、内嵌AM2与唯一播放意图；不声称精确参考几何或真实协议通过。

387业务/类型通过，公开评论App1792316042818以40.307秒1通过/0失败/0跳过；原分页失败留旧/重试/刷新保留，并增滚动固定头/横竖可达、按钮关闭和系统下滑收起。合成端点首屏3/追加2（含首次追加失败）；无音频请求/播放启动。两张横竖截图已亲看，留build/comments-sheet-passed。正式入口AM2/八布局/PCM综合回归1792316242352以267.694秒1通过/0失败/0跳过；保留日志及xcresult，合成服务不代表真实服务；本批清洁归档/正常push/对应iOS27仍待，全部其余A/F/J及真实服务/签名/手机保持。报告见[评论静态报告](docs/2026-10-18_reverse-sollin-comments-report.md)。

## 2026-10-18 漫途排除项与进度计算复核

漫途持续/双向歌单同步明确不实现，一次性多平台公开歌单导入保留；音枢自身WebDAV多设备同步范围不变。复核修正旧80.95%算法：取消前已开发80.65单位保持不变，只从100单位分母移除暂估0.30单位未开发同步量，当前80.65÷99.70≈**80.89%（对外约81%）**，剩余**19.11%（约19%）**。排除后期真机反馈调试；完整交付归一化约58.25%，无新服务/签名/真机结论。账号底座/状态机及隐私修正不提高本轮评分，评论探查尚未采纳。依据和14工作包见[进度估算](docs/PROGRESS_ESTIMATE.md)。历史80.95%记载由本条更正。

## 2026-10-18 账号隐私修正版构建回执

产品提交 `4797970ec9fc386a9d7ac9ba5e39482966d327b6` 已在 387/387 检查及 clean unsigned archive 校验后正常 push。manifest dirty=false/changes=[]、arm64/iphoneos26.2/min15.1/设备族[1,2]/signed=false，ZIP CRC、归档可执行文件与 JS 字节一致、正式入口及私人资源名称排除通过；IPA SHA256 `dfaaa1c0964dc298d6d512e24ed335aca8bb7cd20b401b2b76eb56346b7f5d8b`。日志留 `build/logs/archive-auth-privacy-final.log` 与 `verify-auth-privacy-final.json`。

push 后 API 核对新运行 `39115107158`/4797970 唯一 pending，`39111966447`/23090d0 仍 in_progress；后者 checks、iOS27 工具链和完整 native 已通过，核心 App 步骤尚在运行。single 自动替换旧 pending，未手动取消或重派，保持 1 running/1 pending。无新增云端成功、真实平台授权、个人签名或真机结论。下一批须继续既有 Sollin UI/交互未完成项的 reverse-skill 门禁及平台具体授权适配，不能将账号底座当完整登录。

## 2026-10-18 平台账号隐私与迟到读取修正

账号元数据改为显式字段白名单，保存与恢复不发布额外运行时字段，能力数组与调用方分离；恢复拒绝重复账号 ID。Keychain 读取返回后复核原账号实例，已退出或替换的账号不能返回迟到会话。授权错误状态改为固定提示，原始协议错误不进入可订阅快照。新增三项账号回归及错误脱敏断言，`npm run check` 387/387；日志 `build/logs/check-auth-privacy.log`。此前状态机的错误脱敏描述在本批前并不完整，本批明确补齐。无真实账号/日推/FM、签名或真机新证据，进度不增加。

## 2026-10-18 漫途同步范围变更与工作量重估

用户明确取消“音枢与漫途歌单之间的同步功能”。漫途能力标记为不实现持续/双向歌单同步，定位为多个平台公开歌单的一次性导入来源；保留解析、预览、顺序/去重、汽水原始身份和跨平台匹配。已同步 PRODUCT_SCOPE、TASK_PLAN、IMPLEMENTATION_PLAN、FEATURE_STATUS 和 PROGRESS_ESTIMATE。排除后期真机反馈调试后，当前代码开发量按工作量重估为 **80.95%（约81%，剩余19.05%）**；含真实服务、签名、真机及交付验收约 **57.93%（约58%）**。

本轮新增 WebDAV 前台自动预览：初始化及回到前台时刷新已配置目录的合并预览，冲突仍需逐项确认，不自动提交或覆盖本地数据。`npm run check` 376/376；真实服务、双设备和真机验收仍待。

## 2026-10-18 当前接续：经典独立专项通过，完整背景继续

session43157的正式联合回归SourceUITests-1792310358432正在运行；testClassicPlayerWindowSafeArea已98.693秒通过，包含实际合成播放、滚动/队列返回、横屏cutout及转回。完整testGlobalCoverThemeChangesAcrossPages仍运行，原像素/PCM/异步/三色/明暗重启断言保持，尚不记整批通过。日志build/logs/ui-classic-separated-final.log及ui-catalog.log；终态先保存catalog/counts/summary再启动下一Xcode。

云端39104211437/b6f66a2已failure：checks/iOS27工具链/完整native通过、核心22通过1失败0跳过，EQ开关滚动触达失败；后续步骤跳过，无该批云端IPA。原始官方日志转录和下载限制留build/ci-39104211437/FINDINGS.txt。下一复现并修复EQ触达，保留全部原断言；0运行0排队，不重派旧版。下方旧session14771和“云端运行中”仅为历史。

## 2026-10-18T16:06 心跳：背景批次云端唯一EQ触达失败

39104211437/b6f66a2已在07:47:49Z结束failure，checks/iOS27工具链/完整native成功，核心App22通过/1失败/0跳过。唯一testGraphicalEQPresetPersistence在reveal“启用均衡器”时失败：官方层级viewport(0,138,402,622)，开关(315,-639.7,63,28)，滚动条100%；只确认滚动触达失败，尚不认定EQ持久化/DSP或具体手势根因。600秒诊断超时发生在断言之后；后续在线/离线/iPad/归档跳过，无本批云端IPA，当前0运行/0排队。官方View raw logs已浏览器亲读，关键原文/行号和API回执留本机忽略目录build/ci-39104211437/FINDINGS.txt；日志ZIP下载被Chrome ERR_BLOCKED_BY_CLIENT阻止，小artifact下载超时，没有绕过或声称ZIP/摘要/xcresult核验。新小日志已实际上传527330字节、完整诊断432392823字节，尚待取得。

当前另一执行流程正在跑1792310358432的经典安全区/完整背景联合回归，本心跳未改测试源码、启动竞争Xcode、提交或push。下一批需取得EQ实际catalog/附件或忠实复现，保留全部曲线/前级/开关/重启/选中状态断言再修触达；随当前功能批次验证、清洁IPA与正常push后验新iOS27，不重派旧版。下面旧“云端运行中”已被本条终态覆盖，其余A/F/J和真实服务/签名/手机缺口继续。

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

## 2026-10-18 平台登录与每日推荐参考调整（用户明确补充）

QQ、酷狗、网易云三平台登录与每日推荐改以 [Nshpiter/Q-music](https://github.com/Nshpiter/Q-music) 的 **android 分支**为实现参考，不再要求先逆向 Sollin 的这部分后端。酷我、咪咕的登录与每日推荐不进入该批范围，既有五平台搜索/公开数据能力继续保留。参考源码必须固定提交、核对文件级许可与认证/日推调用链，再适配音枢 provider、iOS 网络/登录呈现及 Keychain；不整包复制 Android 工程或凭据存储。登录、日推、个人歌单/收藏及 FM 分别验收，不因找到源码即记完成。其他 Sollin IPA/APK 分析、UI/交互对齐仍完整执行 reverse-skill 门禁；先已有UI/交互、后新增功能顺序不变。评论请求、分页与数据解析也可参考该安卓源码；评论UI、弹层、层级和交互继续按Sollin IPA优先/截图补充并执行reverse-skill，不照搬Q-music界面。源码核对与后续接入证据见 [Q-music安卓接入记录](docs/Q_MUSIC_ANDROID_REFERENCE.md)。

## 2026-10-18 最终背景失败取证与采样修正（下一轮待验）

session99551/PID90227已终态exit65，不能继续当live；1792300131198在深色重启后暂停的三色断言失败，392.492秒。完整日志/counts/summary另存ui-presentation-final-failed-*，附件build/presentation-final-failed已导出、失败截图已亲看。记录的14组RGBA全零与实际三色不透明PNG不符；独立Pillow/CoreGraphics读取确认实际alpha255/红绿蓝。同时证实旧Set精确相等把一个近中性−1点当额外颜色，误拒绝已含三色的截图。

按[0061](docs/decisions/0061-background-pixel-sampling.md)改用独立屏幕捕获、物理像素裁切/sRGB RGBA8及“三种有效色必须齐全”的原要求，保留14位置/2与6色差/20秒及全部音频/异步/重启断言。只属于UITest的BackgroundPixels.swift及原生像素单测已接入维护工程/脚本；6确切像素、非法坐标/中性过渡/缺每一种颜色/透明拒绝及实际失败PNG均独立通过，目标归属已核验无生产引用。产品场景和0060可见拥有关系不变；不将本机原因直接推广到旧云端557999a，下一完整App/跨页面/iPad/归档/提交push仍待。

## 2026-10-18T13:12:50+08:00 持续目标当前执行检查点（未提交，勿重复启动UI）

当前f7ccab0之上有本批0060/正确overlay修正/小日志上传的未提交改动。375业务/类型通过；完整native-presentation-ownership-full.log已exit0，包含正确显式CGFloat覆盖层与全部原生套件。初轮App1792299470328两项全通过、零失败/跳过：扩展背景459.205秒（实际嵌套队列/独立发现关闭恢复运动及原PCM/异步/明暗/重启），设置草稿111.019秒；62视频帧/9中间色、15合成鉴权/0失败、无新stream。日志/counts/summary已保存ui-presentation-first-*，附件build/presentation-first，队列关闭后的截图已亲看；未声称此轮包含随后一行重开重新登记及RGBA失败文字调整。

**最终生产入口背景回归正在session99551/PID90227运行，结果包build/SourceUITests-1792300131198.xcresult、汇总build/logs/ui-presentation-final-background.log、实时ui-catalog.log；已用ps确认真实live。** 下轮先复查该handle或PID，不因观察超时重开。没有其他活跃本地构建；旧UI86379/native38651均已exit0。当前手机BD3F486B-04DE-4BA7-9E58-64F10166B39D booted，iPad50499F11-A62A-4A97-B47F-5C6549190766 shutdown。终态后先另存ui-catalog/counts/summary，再做跨平台歌词/发现操作及iPad窗口/AM2旋转相关回归；本批最终App/清洁归档/提交push/新iOS27仍待，不覆盖日志或同时启动Xcode。

逆向新R2路由master-route-20261018-124839、E024原字节重放与采纳前review保持；当前case strict review32E/31F/31P、10WI/69事件零错误/警告。39098201855/dfd304b旧云端已失败，实际overlay推断表达式已更正，不能称首轮中心像素拆分修复首因。此次后续提交再验证云端，仍single/保留运行中、不重派旧版。全部F/J目标active；下一已有UI缺口明确为经典ScrollView滚动内容进入状态栏（见SOLLIN_UI_ALIGNMENT新证据），及独立发现等全屏业务自身背景样式，尚未记完整A04/A09。

## 2026-10-18 全屏业务层背景拥有关系（验收中）

按[0060](docs/decisions/0060-presentation-background-ownership.md)，reverse-skill新R2路由、既有离线scope、E024独立2358原始指令/28BL/9池加载及采纳前严格review通过，五固定参考已亲读。原创实例内层级注册表/Context接入全屏Modal、全局原生背景、图片动效与黑胶；page/form/透明Sheet不抢父背景，iOS等实际onDismiss释放，保留唯一播放意图。375业务/类型（含7项层级/竞争/清理）通过；原版背景基线1792298919988为422.277秒1/0/0、65视频帧/10中间色、15合成鉴权/0失败且无新stream，明暗截图已亲看。新版含嵌套队列/独立发现关闭恢复的背景与设置回归仍运行，不能提前记本批App完成。

39098201855/dfd304b已在原生测试再次失败。完整官方源码上下文定位实际是overlay alpha的CGFloat/zip推断；前次仅按行号误改中心像素，没有修到首因，历史失败保留。现按[0059](docs/decisions/0059-swift-color-oracle-inference.md)显式CGFloat逐项验证，原alpha/明暗/阈值与32向量保持，本地原生场景专项通过，新云端待提交；未执行该失败批次App/归档。独立小日志artifact新增但保留完整诊断/全部测试和single队列，实际下载待新CI。旧三色云端失败仍未完整取证，不放宽断言；新增失败RGBA数值诊断。全部A/F/J与真实服务/签名/真机目标继续。

## 2026-10-18 当前总工作量表与编译修正回执

用户询问的总工作量已按[进度表](docs/PROGRESS_ESTIMATE.md)核对：保守开发约81%/剩余约19%，完整交付约58%。14工作包新增剩余总量百分点与执行顺序，保留原权重/评分，合计100/80.95/19.05/57.93已复算；[功能状态表](docs/FEATURE_STATUS.md)当前总览已更新为八布局、原生背景、启动/前台恢复及最新云端边界，移除当前表中“无完整Xcode”等过时说明。未因测试数/提交数自动上调进度，全部F01–F37/J01–J59继续。

dfd304bb8e3323bf2d00846a4b96266d6d58ea31已正常push，远端main一致；368业务/类型、完整native及清洁unsigned归档/CRC/附带SHA/包内可执行与JS字节/正式入口和私人签名资源排除通过。manifest dirty=false/changes=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]；IPA SHA256 `7df9faac9c3a4b2fbe231532645ba9ea7297a244f617e342e6000869c0d8d3d1`，留build/local-ambient-swift-inference-dfd304b。新iOS27运行39098201855当前queued；API核对旧运行均已结束，无人为取消/重派，至多1运行/1排队。真实服务/签名/手机与三色旧云端失败诊断继续，不能以该本地包或排队称云端修复通过。

## 2026-10-18 iOS27 配色测试编译修正（本地通过）

[0059](docs/decisions/0059-swift-color-oracle-inference.md)：最新ce192a4/39094486501在原生测试Swift106类型推断超时，未执行App/归档。仅拆分中心像素偏移/切片/期望为显式类型，保留全部32颜色向量与字节相等断言。368业务/类型及完整native通过；E032独立862原始指令/7BL/10池加载/20向量重放和strict review32E/31F/31P、10WI/67事件零错误/警告通过。清洁归档/正常push/新iOS27继续，不以本地SDK26.2证明云端修复。

较早e6d9d11/39086161205仍失败于旧统计断言；557999a/39091013423统计264.919秒通过，核心22/23，唯一三色边缘像素失败，根因未定。625107504字节诊断包超过连接器536870912上限，Chrome诊断入口未附加成功，尚未下载或宣称hash/CRC/录屏核验；官方日志摘录留build/ci-39091013423。最新完整成功且IPA核验仍为76c9cd0/39050349015。全部A/F/J、真实服务/签名/真机目标继续。

## 2026-10-18 原生主题配色实施（本地通过）

[0058](docs/decisions/0058-native-ambient-color-composition.md)沿E032采纳前strict review与五参考比较，已接原始色板/dark、HSL软化字节量化、双色浮点基底/共享柔光和混合外单次主题覆盖层，消除额外.42；pending主题变化只重建显示中的旧色板，活动/后台/异步/两场守卫保持。368业务/类型与完整native、20+12颜色/阈值向量通过；正式App1792293700730背景专项434.412秒1/0/0通过，视频62帧/10中间色、红切换0.481667秒，明暗/加载/重启/PCM/异步/清理通过。截图已亲看；19合成鉴权/0失败、无新stream、复用缓存。`ce192a4`已正常push，远端main一致；清洁归档dirty=false/changes=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned，IPA SHA256 `9739b02a7fc68ae213be0147801875cdf7c758ec14310a2c3724488cd1825c06`，留存`build/local-ambient-color-ce192a4`。新iOS27运行`39094486501`当前pending；完整A04、云端终态、真实服务/签名/真机仍待。

## 2026-10-18 统计验收修正清洁归档与push

557999acfbbd892e9dd6841d7e97b64df4acfc75已正常push，远端main一致。清洁归档dirty=false/changes=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned，ZIP CRC/附带SHA、归档可执行及JS字节一致、正式入口和私人/签名资源排除通过；IPA SHA256 `67a92440f91cc8975739f9bf027a83fe61f30bed449090ae50814bbcb3c2f296`，留存build/local-statistics-557999a。正式App270.029秒与368业务/类型沿0057，不代替iOS27/真实服务/签名/手机。

push后API实核39091013423/557999a唯一pending、39086161205/e6d9d11仍运行；24aafa4旧pending39089783874由single自动取消，不算通过。最多1运行/1排队，无人为取消或重派。最新完整成功且IPA已核验仍为76c9cd0/39050349015；下一E032原生配色实施继续，全部A/F/J目标active。

## 2026-10-18 配色静态补证与统计验收修正（本地通过）

reverse-skill新R2/mobile-reverse路由及既有离线scope后，E032→F031→P031核验四辅助函数862原始指令、7BL/10池加载；独立有限RGB算术与20组HSL量化向量通过。采纳前strict review32E/31F/31P、10WI/66事件零错误/警告。软化列表同时供给贴图/基底、先字节量化再浮点双色插值、覆盖层在两场混合外；现有安全三色/.42仍待产品下一批接入，未增加A04完成度，详见[报告](docs/2026-10-18_reverse-sollin-ambient-scene-report.md)。

旧统计失败已原样本地复现1792290260206，189.708秒、实际41/预期1；初始缺行被当0，最近五条和标题匹配无法建立基线。按[0057](docs/decisions/0057-statistics-ui-baseline.md)仅修测试：通过真实清空统计确认建立显式0，缺行/解析失败不再当0，保留一会话+1和重启等全部断言。368业务/类型通过；正式App1792290648455专项270.029秒、1通过/0失败/0跳过，显式清空确认/零基线及一会话+1/重启、八布局/歌词/mini/凭据清理均通过。已亲看重置前41次、统计历史、AM2与四按钮mini截图；8合成鉴权/0失败，无新stream、复用临时音频缓存。未据此认定云端全部根因已定；清洁归档/push及新云端继续。旋转24aafa4清洁包/正常push见下；07ead65文档已push且未触发竞争构建，1运行/1排队。

## 2026-10-18 随机旋转清洁归档与push回执

`24aafa4ec7bad6b419e55b8c9822f287e28cee44`已正常push到RhsR1024/nexus-music，远端main一致。清洁归档dirty=false/changes=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS与归档字节一致、正式入口和私人/签名资源排除通过。IPA SHA256 `68f71527ff7736839dda2eccebed17495d2a62002248c4f2284384bb8d3ee661`，留存build/local-ambient-rotation-24aafa4。368业务/类型、完整native、正式背景406.668秒及59帧/6中间色验收见下；本地SDK不代表iOS27或真机。

2026-10-18 10:22 API实核39089783874/24aafa4唯一pending，39086161205/e6d9d11仍执行核心App，checks/native成功，1运行/1排队；未取消运行或重派旧版。最新完整成功且IPA核验仍为76c9cd0/39050349015。下一原始色板/HSL/双色/主题覆盖层与云端统计失败复核继续，全部A/F/J、真实服务/签名/手机/性能目标保持active。

## 2026-10-18 随机与全场旋转（本地通过）

最终本地结果覆盖本段“运行中”：368业务/类型、完整native和正式App1792289108066通过，406.668秒、1/0/0；原三色两页/像素活动停止/PCM/Home/异步保留迟到失败/开关重启清理均保持。独立视频59帧/6中间色帧、蓝0/红0.581667秒阈值；截图已亲看。15合成鉴权/0失败，无新stream，复用临时缓存。native首轮系统封面固定0.2秒等待失败，原样重放成功，改为最多5秒等真实artwork后独立及完整native通过，失败留存；UI附属simctl诊断定位错误保留。清洁归档/提交push/对应云端继续，详见0056。

新reverse-skill R2/mobile-reverse路由、既有离线scope、E031→F030→P030及采纳前严格review31E/30F/30P、9WI/63事件零错误警告通过。226原字节/5函数与独立unsigned64公式8种子/272unit一致，补齐混洗/四次预热/MWC/高26低27与全场方向。按[0056](docs/decisions/0056-seeded-ambient-rotation.md)重新比较五固定参考后，已原创接入已核锚点、随机、绕中心1.12旋转和旋转渐变物理投影；368业务/类型及独立数值专项通过，完整native和正式背景App尚在运行。本批HSL/双色/主题覆盖层明确留下一配色批次，不计A04完整对齐或参考运行等价。云端统计失败沿下条继续复核，不以SDK26.2本地结果代替iOS27/签名/手机。

## 2026-10-18 09:58 心跳：云端统计断言失败待复核

`25b1e05` / [39077179759](https://github.com/RhsR1024/nexus-music/actions/runs/39077179759) 已失败，checks及完整native步骤成功；核心App为23项中22通过，唯一 `testZNavidromePlaybackAndCredentials` 在旧Swift1052断言实际播放次数4、预期1，177.317秒。后续600秒诊断收集超时不是首因；在线组/离线/iPad/归档跳过，无本批云端IPA。官方原始job日志已下载，证据见本机忽略目录 `build/ci-39077179759/FINDINGS.txt` 与job-logs.txt:877、955–974。

诊断artifact12120974173已登记495628911字节及发布摘要6af1665c；浏览器下载被Chrome以ERR_BLOCKED_BY_CLIENT阻止，未绕过，未称ZIP/xcresult/录屏已下载或校验。测试初始count在导航后无等待、条目不存在即返回0，UI仅展示前五个统计且按标题匹配；这些只属基线/身份疑点，尚不能认定统计重复或测试问题，需补看基线/完整诊断或本地复现再修复，不改预期为4或删会话/重启断言。后续39086161205/e6d9d11已自动运行，保持1运行/0排队，无重派/取消；当前旋转批次在开发，本心跳未启动竞争构建或提交。全部功能与真实服务/签名/手机验收继续。

## 2026-10-18 两场过渡清洁归档与push回执

`e6d9d113bbd6b55966fa66c98ea09ca77c521d5d`已正常push到RhsR1024/nexus-music，远端main一致。清洁归档dirty=false/changes=[]，Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带SHA、可执行及JS与归档字节一致、正式入口及私人/签名资源排除通过。IPA SHA256 `7a7d865ab3fde2f3b267b5838f7ccf81b56e898dba4f99ceba898475edc0d38f`，留build/local-ambient-transition-e6d9d11。368业务/类型、最终完整native、正式App388.381秒及65帧/11中间色画面验收见下；验收后strict review30E/29F/29P、8WI/61事件零错误/警告。

push后API实核39086161205/e6d9d11唯一pending，39077179759/25b1e05继续运行核心App，1运行/1排队。旧ea4f5d6 pending39083490325由single自动取消，不算通过；未取消运行或重派旧版。最新完整成功且IPA核验仍为76c9cd0/39050349015，只覆盖其代码。下一已有背景旋转/原始运动复核继续按新路由及严格门禁，再逐页收敛A03/A06–A09；全部F/J与真实服务/签名/手机/性能目标保持active。

## 2026-10-18 两场过渡与加载回退（本地通过）

reverse-skill新R2/mobile-reverse路由及既有离线scope，E028/E029/E030独立原字节重放与采纳前严格review通过；按[0055](docs/decisions/0055-bounded-ambient-transition.md)五参考比较后原创实现显式pending、显示层暂留、最多两场/0.6秒Cubic整体混合和停止/失败清理。媒体URI/色板仍立即清旧，abort/当前URI守卫保持；原生属性一次应用，渐变按宽高比保留原物理投影。

368业务/类型和最终完整native通过。正式入口SourceUITests-1792285502088完整背景388.381秒、1通过/零失败/跳过；本机HTTP屏障验证旧蓝/红保留、迟到蓝隔离、当前失败回退，原三色两页/暂停稳定/播放变化/跨页重启/经典PCM/Home→激活/开关与底色恢复/凭据清理均通过。独立视频65帧/11中间色帧，蓝0至红0.563333秒阈值穿越；这是连续画面证据，不推断精确时长、FPS/能耗或参考运行。截图亲看；15次合成鉴权成功/0失败，无新stream，复用临时音频缓存。

首次完整流程暴露三色像素回归，物理/单位渐变投影纠正后原断言通过，失败留存；Pods探查上游失效转源码/生成文件未就绪的零测试构建失败也保留，已用本机已有预编译包恢复且锁文件不改。日志/摘要/counts为build/logs/ui-transition-passed*，视频/CSV/预览/核验为build/logs/ambient-transition-1792285502074.mp4*，附件build/transition-passed。清洁归档/本批push/对应iOS27继续；完整旋转/参考Random/逐页复核及全部A/F/J、真实服务/签名/手机仍待，目标active。

## 2026-10-18 原生柔光清洁归档与push回执

产品提交9b13459及静态/构建文档提交 `ea4f5d66f608a307d19af91815b11daaf88880b6` 已正常push到RhsR1024/nexus-music，远端main一致。最终干净归档dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离及私人/签名资源排除均通过。IPA SHA256 `61441439204e2b57cfaa59173cda67c560fff5322ee1b4b507ba17eea4046259`，留存build/local-ambient-scene-ea4f5d6。首轮9b13459归档成功但期间心跳追加文档，另存首包；最终ea4f5d6全程干净，未混用两份收据。366业务/类型、最终完整native、正式背景354.349秒与截图验收见下。

push后API实核新运行39083490325/ea4f5d6唯一pending，39077179759/25b1e05继续运行，1运行/1排队；未取消运行或重派旧版。8f865af旧两小时运行超时取消不算通过；最新完整成功且IPA核验仍为76c9cd0/39050349015。E030静态补证后的strict review30E/29F/29P、8WI/59事件零错误/警告。下一批先解决切歌加载空态与最多两场过渡的可见所有权，再做实际帧/快速切换/停止回退验收；不得弱化CoverThemeStore旧请求/迟到结果守卫。完整A/F/J、参考运行及真实服务/签名/手机/性能仍待，目标保持active。

## 2026-10-18 A04异步场景静态补证

reverse-skill新R2路由、离线scope和独立重放后E030→F029→P029核验7函数954原始指令/107BL/15池加载，世代成功守卫、监听器一次消费、图片所有权清理及计数<2/raw3000000Duration重试已核。严格review30E/29F/29P、8WI/58事件零错误/警告；外层resilient catch没有立即比较世代，不声称所有错误路径迟到保护。内部网络/helper协议、参考运行和完整异常语义仍待；无新产品采纳，见[报告](docs/2026-10-18_reverse-sollin-ambient-scene-report.md)。原生柔光9b13459本地通过/首轮归档已成功；期间心跳追加构建文档，保留首包并在文档提交后的干净状态重做归档。全部A/F/J及云端、真实服务/签名/手机保持active。

## 2026-10-18 08:28 心跳：背景批次旧预算超时

API核实 `8f865af` / [39072820731](https://github.com/RhsR1024/nexus-music/actions/runs/39072820731) 已结束为cancelled；官方Annotations明确“exceeded the maximum execution time of 2h0m0s”。checks、native、核心App和歌词/匹配/健康/发现步骤成功，离线步骤被取消，iPad/设备归档/IPA上传跳过；不能计完整成功，也不能据此判定离线产品失败。诊断上传另报创建ZIP失败，artifact API为0项，没有可下载核验的诊断包或本批云端IPA；API原始回执与边界留忽略目录 `build/ci-39072820731/FINDINGS.txt`。

后续 `25b1e05` / [39077179759](https://github.com/RhsR1024/nexus-music/actions/runs/39077179759) 已开始运行，checks成功、native进行中，当前1运行/0排队；它已包含180分钟预算，等待实际终态，不重复修改预算或重派/取消。最新完整成功且IPA核验仍为76c9cd0/39050349015。当前A04原生柔光本地验收及清洁归档/提交工作继续由现有执行流程推进，本心跳未启动竞争构建或提交；全部剩余功能、真实服务/签名/手机和性能验收缺口保留。

## 2026-10-18 A04原生四场柔光（本地验收通过）

按[0054](docs/decisions/0054-native-ambient-soft-lights.md)原创实现144×144预乘贴图、四个复用CGImage的CALayer与有界几何，tick只更新矩形/透明度，不逐帧重绘整屏或传入React。366业务/类型和最终完整native通过；正式入口SourceUITests-1792282616128完整背景流程354.349秒、1通过/零失败/跳过：具名原生视图、暂停实际像素稳定/播放像素变化、两页三色、红蓝切歌/跨页/开关/重启、经典页PCM、Home→激活、收起/暂停，以及播放中打开独立动效再关闭全局动效、恢复底色/独立偏好和凭据清理。截图已亲看；12次本机合成鉴权成功/0失败，本轮无新stream，复用临时音频缓存，不计冷下载或真实个人服务。

前五轮完整流程及播放中短探针失败、两个独立短专项通过、图层首个短探针缺队列而未到目标步骤均保留；最终自建连接/队列的完整流程通过，不推断实测CPU/FPS或全部根因。日志/摘要/counts留build/logs/ui-ambient-layer-*，附件build/ambient-layer-passed。reverse-skill新R2路由/离线scope后E026–E029原字节独立重放通过，严格review29E/28F/28P、8WI/57事件零错误/警告；E029仅核有限交接/释放，当前产品同步替换，完整异步load/retry/参考运行仍待。见[报告](docs/2026-10-18_reverse-sollin-ambient-scene-report.md)。清洁归档/提交push/对应云端继续；全部A/F/J、真实服务/签名/手机及性能边界保持active。

## 2026-10-18 A04柔光与四场合成（静态阶段）

reverse-skill新R2/mobile-reverse路由、固定离线scope/case-guard及严格review27E/26F/26P、8WI/54事件零错误/警告。E026→F025→P025核验900原始指令/10BL/16池加载，E027→F026→P026核验1296指令/109BL/58池加载；独立重放通过。恢复HSL软化、144×144预乘柔光、code-unit种子及四场运动/呼吸、独立全场旋转与渐变/贴图合成边界。完整锚点纵坐标、部分颜色、精确Random和完整过渡/运行仍未知；Cubic未打印控制量的推断明确未采纳。详见[静态报告](docs/2026-10-18_reverse-sollin-ambient-scene-report.md)。

本批无产品变更、不增加A04完成度。下一步先亲读五参考并记录原生场景设计取舍，再原创实施与独立数学/原生/App验收；保留语义对比度、可见性/后台/减少动态效果、唯一播放意图。云端39072820731/8f865af仍运行、39077179759/25b1e05唯一pending，1运行/1排队；未取消或重派旧版，未新增云端成功。全部A/F/J、参考运行、真实服务/签名/手机保持active。

## 2026-10-18 三色背景清洁归档与push回执

`25b1e0538c4c9a0e7221f14fdf87c29e0eca71ef`已正常push，远端main一致。清洁归档dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离和私人/签名资源排除通过。IPA SHA256 `50371f64901f6414dab4762768fa0d75890c2a8dc8a5fdfcfca2e4b3d9f3b14c`，留存build/local-flow-palette-25b1e05。366业务/类型、完整native、正式背景App329.540秒及两页三色截图见下；验收后strict review25E/24F/24P、8WI/51事件零错误/警告。

push后API实核39077179759/25b1e05唯一pending，39072820731/8f865af仍运行，1运行/1排队；未取消运行或重派旧版。新三小时iOS预算随本提交生效，未计新云端通过；最新完整成功且IPA核验仍为76c9cd0/39050349015。下一A04柔光/场景构造已新路由及前置门禁，初步原字节探查仅留忽略notes，尚无新功能Evidence/产品采纳。完整A/F/J、参考完整运行、真实服务/签名/手机目标保持active。

## 2026-10-18 06:59 心跳：历史批次超时与后续队列

API实核 `6c8be2f` / [39066065139](https://github.com/RhsR1024/nexus-music/actions/runs/39066065139) 已因原120分钟预算结束为cancelled：checks/native、核心App、歌词匹配健康发现和离线断服务播放步骤成功，iPad步骤被取消，设备归档/IPA上传跳过；不能计完整成功。官方Annotations及实际作业日志的2h上限与分项证据见 [GITHUB_ACTIONS](docs/GITHUB_ACTIONS.md)。这与pending被single替换及人为取消分别记录。

当前 `8f865af` /39072820731仍在核心App，1运行/0排队，继续保留；其工作流仍为120分钟。新三色批次 `25b1e05` 已包含180分钟预算，checks仍15分钟，全部原生/手机/离线/iPad/归档断言及single策略保留；尚待该批清洁归档/push和新云端终态，增加预算本身不算通过。完整目标及真实服务/签名/手机缺口保持，本心跳未启动竞争构建或重派旧版。

## 2026-10-18 A04三色取样（本地验收通过）

reverse-skill R2/mobile-reverse、离线scope/case-guard与E025→F024→P024采纳前strict review通过；2307原始指令/9BL/11池加载独立重放通过。按[0053](docs/decisions/0053-three-color-flow-palette.md)五参考比较后原创接入24×24 HSV三色、灰阶亮度分位、40°分离/补齐、有界缓存和三色背景，保留单色语义主题及唯一播放意图。366业务/类型与完整native通过；正式入口SourceUITests-1792277163729背景全流程329.540秒通过，1通过/零失败/跳过：两页实际红绿蓝像素、原红蓝切歌/跨页/开关/重启、经典页PCM、系统Home→激活、收起/暂停/开关恢复和凭据清理。截图已亲看；12次本机合成鉴权成功/0失败，本轮无新stream，复用已有临时音频缓存，不计真实私人服务或冷下载。

首轮编译及两轮导航/像素排序失败保留；第四轮1792276291425在清理阶段中断、xcresult缺Info.plist，无最终状态，不计通过。JPEG重编码影响等宽条排名，真实JPEG原生专项和排序无关三色集合断言均通过，未放松三色必须同时存在。验收日志/counts/摘要与截图留build/logs/ui-flow-palette-passed*、build/flow-palette-passed。清洁归档/push/对应iOS27继续；8f865af/39072820731当前唯一运行、0排队，最新完整成功且IPA核验仍为76c9cd0。完整参考场景/动态/功耗、真实服务/签名/手机以及全部A/F/J保持active。

## 2026-10-18 背景可见性清洁归档与push回执

`8f865af0569a9fa5b53a65cdd70a2126580a25e7`已正常push；359业务/类型、正式背景App308.007秒及截图通过见下。清洁设备归档dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离/私人及签名资源排除通过。IPA SHA256 `28af9fffc93b082c8333b0849aa3d7022f8a0d70c73f26cbd6325cdb340d5807`，留存build/local-background-visible-8f865af。

push后API实核39072820731/8f865af唯一pending，39066065139/6c8be2f仍运行，1运行/1排队；2db0872旧pending39070885003由single自动取消，不算通过。未取消运行或重派旧版。采纳后strict review24E/23F/23P、8WI/47事件零错误/警告；手写验收时间提前一分钟已追加更正，结果未改。最新完整成功且IPA核验仍为76c9cd0/39050349015。下一A04 palette权重/回退已新路由与前置门禁，只读现有原字节，未形成新Evidence或产品采纳；全部A/F/J、完整参考运行、真实服务/签名/手机保持active。

## 2026-10-18 A04背景可见性（本地验收通过）

新reverse-skill R2/mobile-reverse路由、既有离线scope/case-guard与E024独立重放通过；采纳前strict review24E/23F/23P、8WI/44事件零错误/警告。按[0052](docs/decisions/0052-background-visible-owner.md)亲读五参考并原创增加全屏播放页呈现状态：隐藏根背景移除MotionImage，保留静态渐变，关闭/清空条目后恢复；经典/现代背景偏好与原生音频不变。359业务/类型通过，正式入口SourceUITests-1792273286451背景专项308.007秒、1通过/零失败/跳过；红蓝像素/跨页/独立开关/重启、经典页实际PCM、系统Home→激活、收起恢复/暂停和凭据清理通过。截图已亲看；20鉴权成功/0失败、8次本机合成stream，不计真实个人服务。

首轮遗漏UITest目标前缀以70退出、0测试，日志单独保留。日志/counts为build/logs/ui-background-visible-passed.log及ui-background-visible-counts.json；截图build/background-visible-passed。本批清洁归档/push/对应iOS27继续，不把测试标识当作帧率/遮挡功耗或参考运行证据。云端API实核6c8be2f/39066065139核心App成功、歌词匹配健康发现运行，2db0872/39070885003唯一pending，仍1运行/1排队。完整A/F/J与真实服务/签名/手机保持active。

## 2026-10-18 A04共享取色与背景活动边界（静态阶段）

新reverse-skill R2/mobile-reverse路由、固定离线scope/case-guard通过；E024→F023→P023核验2358原始ARM64指令、28BL、9池加载及manifest，独立重放通过。全局createScene调用共享extractPalette后进入自身柔光/场景；24×24/HSV分桶及路由当前态/生命周期/活动id/面积选择/计时器守卫边界已确认。严格review24E/23F/23P、8WI/44事件零错误/警告。完整权重/回退、字段名、遮挡/运行/功耗仍未恢复，无新产品采纳，不增加实现完成度。详见[报告](docs/2026-10-18_reverse-sollin-cover-flow-report.md)。初次手写总数2458误记触发断言，修正13范围合计2358后才创建不可变Evidence，原字节未改。

下一步比较五参考生命周期，核验音枢根层及经典播放器的背景可见性/恢复；继续已有对齐后再扩展功能。当前2db0872本地清洁归档/完整发现145.119秒已验且push；云端39066065139/6c8be2f仍运行核心App、39070885003/2db0872唯一pending，最新完整成功且IPA核验仍为76c9cd0/39050349015。全部A/F/J、完整参考运行、真实服务/签名/手机保持active。

## 2026-10-18 分页恢复清洁归档与push回执

`2db0872a18a41b692ef620a7fedc894fc5a3f577`已正常push并核对远端main一致。359业务/类型、完整发现App145.119秒及两次失败/页序列核验、截图亲看通过；验收后strict review23E/22F/22P、8WI/43事件零错误/警告。清洁归档dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；CRC/附带摘要、归档可执行及JS字节一致、正式入口隔离/私人及签名资源排除通过。IPA SHA256 `d326ac91c04a8c6834ca8d74031a20944bcbdef564a92575329b4a3054272682`，留存`build/local-discovery-pager-2db0872`。此条覆盖本批归档/push待办，不扩展真实服务/签名/手机结论。

push后API实核39070885003/2db0872唯一pending、39066065139/6c8be2f仍运行核心App，1运行/1排队；07a6de3旧pending39069432881由single自动取消，不算通过，代码包含于最新。未取消运行或重派旧版。最新完整成功且IPA核验仍为76c9cd0/39050349015，只覆盖实际代码。下一A04背景算法/生命周期已新路由并过前置门禁，尚未新Evidence/产品采纳；全部A/F/J、完整参考运行、真实服务/签名/手机目标active。

## 2026-10-18 发现分页与刷新恢复（本地验收通过）

reverse-skill新R2/mobile-reverse路由、既有离线scope和E023→F022→P022采纳前严格review通过23E/22F/22P、8WI/42事件；610原始指令/10BL/3池加载与回边独立核验。五参考固定HEAD及维护/Android/许可取舍见[0051](docs/decisions/0051-discovery-pager-recovery-validation.md)。仅支持静态入口边界，不推断参考失败界面/缓存时效/运行协议。

359业务/类型、完整发现App1792271857949的145.119秒零失败/跳过：追加失败保留100/101、同页重试到101/101，刷新失败保留两页/数量/筛选，成功重试替换身份并复位下一页；独立服务器页序列[0,1,1,0,0,1]、两次失败。原取消/完整读取截断/收藏/重复项/两种Sheet/清理均通过；已亲看失败保留与替换截图。22次本机合成请求、无音频，不计真实provider；未修改产品/后端/依赖。清洁归档/push/对应iOS27继续，全部A/F/J、完整参考运行、真实服务/签名/手机保持active。

## 2026-10-18 完整读取校验清洁归档与push回执

`07a6de313e8b4483471491c7a171ba34f95f7cb1`已正常push，远端main一致。359业务/类型、完整发现App125.372秒零失败/跳过和截断2/3保留截图通过；验收后strict review22E/21F/21P、8WI/41事件、零错误/警告。清洁归档dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `3ecc1d8da2592225ac36b40d0f4fa2e215f82f8b33eba4ebc1e45e21b89eaa20`，留存`build/local-discovery-completeness-07a6de3`。此条覆盖本批归档/push待办，不扩展真实服务/签名/手机验收。

push后API实核39069432881/07a6de3唯一pending、39066065139/6c8be2f继续运行，1运行/1排队；0b57726旧pending39068540573由single自动取消，不算通过，最新提交包含其修正。未取消运行或重派旧版。最新完整成功且IPA核验仍为76c9cd0/39050349015，只覆盖其实际代码。下一发现刷新/pager缓存关系已新路由并过前置门禁，5函数610原始指令的初步探查只留忽略notes，尚未新增不可变功能Evidence或采纳结论；全部A/F/J与参考完整运行、真实服务/签名/手机保持active。

## 2026-10-18 完整歌单数量与取消校验（本地通过）

reverse-skill新R2/mobile-reverse路由、既有离线scope/case-guard及E022→F021→P021采纳前40事件严格review通过；五参考固定HEAD/实现/维护/Android/许可及原创取舍见[0050](docs/decisions/0050-complete-playlist-count-validation.md)。E022只证明数量helper和独立loadAll边界，参考完整计数/分页/取消语义未恢复。

5项独立失败基线复现终页截断/超量、非法/变化/遗忘已知数量及取消后末页返回。原创complete每页返回后检查abort，保留并核对声明总数，终页严格数量相等；未知总数、顺序/重复项与原分页上限保持。359业务/类型通过，App1792270600285完整发现专项125.372秒零失败/跳过：截断拒绝确认、重试完整结果预览2首、原导航取消/收藏/重复项/两种Sheet/清理通过；2/3计数与错误/两首歌曲保留截图已亲看。16次合成wire请求、无音频，不计真实服务。清洁归档/push/对应iOS27继续，全部A/F/J、参考完整运行、真实服务/签名/手机保留。

## 2026-10-18 发现取消修复清洁归档与push回执

`0b57726995f5fb8de92f6c9f1823a470108d50b5`已正常push，远端main一致。352业务/类型、发现114.383秒/离线200.468秒实际PCM与Range专项通过，strict review22E/21F/21P、8WI/40事件零错误/警告。清洁归档dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `9817c8e2da16ef5d55c6a931b0a739fcdf6e870d07bda68b43b9f83fe0134b1f`，留存`build/local-discovery-cancel-0b57726`。初次归档核验参数误写完整提交号触发断言；从git/manifest取得实际完整SHA后核验通过，产物未改。此条覆盖本批归档/push待办。

push后API实核39068540573/0b57726唯一pending，39066065139/6c8be2f继续运行，1运行/1排队；未取消运行或重派旧版。AM2/39058310652失败诊断完整ZIP已验SHA256/4804条目CRC，本批本地离线修正通过仍不能代替iOS27。最新完整成功且IPA核验仍为76c9cd0/39050349015。下一已有发现完整分页/截断保护继续审查；全部A/F/J、真实服务/签名/手机及完整参考运行保持active。

## 2026-10-18 离线云端失败定向复验（本地通过）

AM2/39058310652的首因仍是旧测试查询屏幕外暂停按钮isHittable抛Activation point invalid，未推断产品下载/音频故障。仅测试加入exists/正尺寸/整框可见短路后才查询isHittable，保留原中心拖动和全部实际音频/Range/阻断服务/清理断言；选经典后显式等待样式Sheet消失，避免自动关闭与下一导航重复点击。首轮1792268779844已完成full1/resumed1/blocked0但边缘拖动无法收起，219秒失败；恢复中心拖动后1792269279648在准备阶段22.878秒遇Sheet自动关闭竞态，均保留失败与截图/层级。

最终SourceUITests-1792269442492完整离线专项200.468秒通过、零失败/跳过：真实下载暂停/重启1024MB保持、条件Range继续、完整文件、清空临时缓存、阻断服务器后的离线PCM播放不新增stream/blocked=0、删除取消/确认和凭据清理。服务计数full1/resumed1/blocked0，鉴权14成功/0失败，stream累计6（含播放阶段请求；断服务前后相等另有实际断言），已亲看11.0MB已完成文件截图。没有改产品播放/下载后端或新增依赖；本地SDK26.2不能代替iOS27，修正待随本批清洁归档/push进入新队列，旧云端失败不改写。真实服务/签名/手机及全部A/F/J保持。

## 2026-10-18 发现完整读取的导航取消（本地通过）

reverse-skill新路由R2/mobile-reverse，既有离线scope/case-guard及E022→F021→P021严格review保持；采纳前39事件，验收后22E/21F/21P、8WI/40事件零错误/警告。五参考固定HEAD/生命周期/维护/Android/许可与边界见[决策0049](docs/decisions/0049-discovery-read-navigation-cancellation.md)；不把参考静态loadAll名称解释为完整取消语义。

音枢原问题是完整读取abort后旧finally保留importing，返回再入详情时导入入口一直禁用。服务器hold/release屏障确认held=1，旧代码1792268341340在22.380秒精确失败于入口未恢复；仅在上下文变化复位局部读取状态/旧提示，保留Abort/迟到guard。352业务/类型通过，最终1792268529189完整发现专项114.383秒通过、零失败/跳过，包含重入/重新读取预览并取消/无迟到确认和原收藏/重复歌单项/两种Sheet归属/清理；截图已亲看。3列表/5详情为本机合成服务，不计真实provider；无新原生后端/依赖，清洁归档/push/对应iOS27继续。并行跟进AM2云端离线测试可见性失败，详见最新构建回执；全部A/F/J、真实服务/签名/手机保留。

## 2026-10-18 04:28 云端 AM2 离线专项失败回执

API核实 `332cac5` / [39058310652](https://github.com/RhsR1024/nexus-music/actions/runs/39058310652) 已失败：checks/native/核心App及歌词匹配健康发现均成功，离线专项72.281秒在旧Swift176获取“暂停”按钮isHittable时抛出Activation point invalid，尚未执行恢复Range/阻断服务播放断言。后续600秒诊断超时不是首因；iPad/归档被跳过，无本批云端IPA。经浏览器步骤日志核对的证据与下载状态留存 `build/ci-39058310652/FINDINGS.txt`；诊断artifact12113032789完整483716929字节已下载，SHA256 `05d0f657a8bf35b9e2ede47027cd988483775f8d1fea9beee3dcd9577f4eabe8`与4804条目全ZIP CRC通过；本地xcresult摘要独立复核同一首因，已亲看录屏70秒帧；失败层级中暂停y875.3超出窗口底874点。不能宣称产品下载/音频故障。

该导航辅助逻辑增加exists/正尺寸/整框入屏后才查询isHittable与失败截图/层级；最终保留原中心拖动，并等待样式Sheet完成自动关闭。原PCM、Range、暂停重启、断服务和清理断言保留，产品播放/下载实现未改；最终本地专项200.468秒通过详见上文，待本批清洁归档后提交上云。后续 `6c8be2f` /39066065139已开始核心App，未包含本次未提交的导航修正；当前1运行/0排队，未取消或重派。最新完整成功仍为76c9cd0/39050349015；全部A/F/J与真实服务/签名/手机验收保持。

## 2026-10-18 历史日期分隔清洁归档与push回执

`6c8be2ff4724a721e62e536cad4ceae2c5eaff5d`已正常push并核对远端main一致。清洁归档manifest dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `8bfdf0f7b3b1c5195d5f8b4d5ce3685b8f99e39e312f99e6ac08b284ef7dcf7d`，留存`build/local-history-calendar-6c8be2f`。352业务/类型与正式App260.169秒、日期截图/重启及39事件严格review见下；此条覆盖本批归档/push待办。

push后API实核39066065139/6c8be2f唯一pending，39058310652/332cac5继续运行（核心App及歌词/匹配/健康/发现已过，断服务离线组执行中），1运行/1排队。EQ旧pending39065099990/be16e10由single自动取消，不算通过；未手动取消运行或重派旧版。最新完整成功且IPA已核验仍为76c9cd0/39050349015，仅覆盖其祖先。下一发现完整读取取消/导航的原创状态边界审查继续，尚未产品修复或采纳新参考动态结论；全部A/F/J与真实服务/签名/手机目标保持active。

## 2026-10-18 播放历史本机日期分隔（本地通过）

reverse-skill E022→F021→P021采纳前strict review22E/21F/21P、8WI/38事件零错误/警告，2033原始指令/15BL/5分配头及池偏移已独立核对。五参考固定HEAD/维护/Android/许可与原创取舍见[决策0048](docs/decisions/0048-history-calendar-sections.md)。仅现有最近播放增加本机日历日期标题，不排序或改变歌曲索引/身份/前20项加载更多及唯一播放入口；无效日期回退，epoch0有效，不把未知参考时区/文案当作已还原。

352业务/类型检查通过，含UTC/上海/纽约午夜/跨年/闰日及夏令时跳时与重复时刻。正式入口SourceUITests-1792267559956的实际Navidrome合成播放/PCM/八布局/歌词/统计/mini/凭据清理260.169秒通过，零失败/跳过；新增日期标题可达与重启保持断言通过，日期/时间轴/歌曲截图已亲看。鉴权8次成功、0失败，无新stream请求，使用既有临时音频缓存，不能称本次冷下载或真实个人服务。验收后strict review22E/21F/21P、8WI/39事件零错误/警告。无新原生后端/依赖，清洁归档/push/对应iOS27待；发现完整分页/参考运行、全部A/F/J与真实服务/签名/手机继续。

## 2026-10-18 EQ清洁归档与push回执

`be16e10b52919a0a5a97f56ecb487ba9fcb94535`已正常push，远端main一致。清洁归档manifest dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `815aaa35f2e71efbed227ad13b237490d3b7f04f1c6a4113b1d99854fcae57e3`，留存`build/local-eq-state-be16e10`。350业务/类型、完整native和App184.998秒及两项失败基线见下；验收后strict review22E/21F/21P、8WI/38事件、零错误/警告。此条覆盖本批归档/push待办。

push后API实核39065099990/be16e10唯一pending，39058310652/332cac5继续运行（核心App已过，歌词/匹配/健康/发现组执行中），1运行/1排队。背景旧pending39063744433/e8941b0由single自动取消，不算通过；未手动取消运行或重派旧版。最新完整成功且IPA已核验仍为76c9cd0/39050349015，仅覆盖其祖先，不覆盖AM2/mini/字体/背景/EQ。下一A08发现/歌单/历史已有E022静态证据与严格review，独立模型/UI审查继续，未采纳日期分组/完整分页或新后端；全部A/F/J、真实服务/签名/手机目标保持active。

## 2026-10-18 EQ权威状态与启用校验（本地通过）

reverse-skill E021→F020→P020采纳前strict review21E/20F/20P、7WI/34事件，独立重放4433原始指令/18BL/manifest哈希通过；五参考固定HEAD及维护/Android/许可比较见[0047](docs/decisions/0047-eq-state-validation.md)。音枢原创validate补eqEnabled布尔校验：非法更新在持久化/订阅前拒绝，坏记录沿既有原始隔离；缺失旧字段默认false，关闭/写入失败保留曲线和前级。两项独立失败基线保留，修正后350业务/类型通过。首轮check被build内临时基线TS文件相对导入阻断，改为留存.txt后完整检查通过，未改工程编译排除规则。

正式入口SourceUITests-1792266325928的EQ专项184.998秒通过、零失败/跳过：实际前级/曲线选中、独立归零不改频段、关闭后重启保留设置、禁用仍按实际预设选中、重置十频段与前级为0且保持启用、自定义重应用/删除及睡眠。已亲看平直曲线和选中卡截图，零网络请求；完整native-eq-state.log exit0，真实RMS/逐样本旁路/解码PCM等通过（既有Swift Sendable警告）。UI开关不冒充实际声音证据；无新原生后端/依赖，清洁归档/push/对应iOS27待，真实服务/签名/手机及完整参考运行另验。

下一发现/歌单/历史E022已形成2033原始指令/15BL/5分配头证据；暂未产品采纳。重跑case-init误覆盖案例记录，已从原工具输出恢复完整36事件/7原工作项、补回状态并记录事故，原始Evidence未改；恢复strict review22E/21F/21P、8WI/37事件零错误/警告，禁止既有案例再次初始化。全部A/F/J目标继续active。

## 2026-10-18 背景Sheet清洁归档与push回执

`e8941b014eac04f9f84e38dcb0e81a20b7605d26`已正常push，远端main一致。清洁归档manifest dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、实际min15.1/设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS对归档字节一致、正式入口隔离/私人参考及签名资源排除通过。IPA SHA256 `18857ebea41640ce2308f38ae2bba0a2bb7b6ac042e553a10ca9ed2bdea8d644`，留存`build/local-background-sheet-e8941b0`。348业务/类型和最终分项Files102.911秒/大字86.835秒及首轮实际背景/外观回归见下；验收后strict review21E/20F/20P、7WI/35事件，零错误/警告。

push后API实核39063744433/e8941b0唯一pending，39058310652/332cac5继续运行，1运行/1排队。字体旧pending39061650305/b79edb6由single自动取消，不算通过；未取消运行或重派旧版。最新完整成功且核验产物仍为76c9cd0/39050349015，只覆盖其祖先，不覆盖AM2/mini/字体/背景。下一EQ已完成E021静态review/独立字节重放与两项原创失败基线，补齐布尔校验/独立归零/重置/旁路持久化专项继续；全部A/F/J、真实服务/签名/真机保持active。

## 2026-10-18 下一 EQ 状态链静态证据

reverse-skill重新路由mobile-reverse并补E021→F020→P020，4433条原始指令和18条BL/池偏移支持控件汇入单一update及实际前级/频段预设匹配；strict review21E/20F/20P、7WI/34事件、零错误/警告。仅静态审查前提，尚未采纳新参数/默认值或修改EQ产品行为，独立审查/验收继续，见[专项报告](docs/2026-10-18_reverse-sollin-eq-controller-report.md)。原生后端/运行与存储失败语义未恢复，不计新功能完成。

## 2026-10-18 主题与背景设置 Sheet（本地通过）

reverse-skill mobile-reverse E020→F019→P019与E009共用模态链已在采纳前严格review通过（20E/19F/19P、7WI/33事件，零错误/警告）。3044条原始指令字节支持主题包装/颜色字段/对话返回边界；本批仅按[0046](docs/decisions/0046-theme-background-sheet.md)将现有背景设置放入原生Sheet，保留图片导入/移除、原子偏好、独立全局/播放动效及音枢功能，不新增未验证HSV/默认值。最终348业务/类型检查通过。首轮正式入口1792264933860四项通过（外观89.222秒、大字77.053秒、实际全局背景260.441秒、真实Files图片105.813秒），但截图发现大字预览裁切/按钮越界；已改为预览随内容增长、窄屏/大字纵排及44点触控。最终代码1792265663902图片导入/删除/重启102.911秒通过；该组新增预览查询因父子同名失败，保留失败并限定firstMatch后，1792265870384大字/预览边界/两按钮实际修改恢复/关闭下滑/分类滚动/重启86.835秒通过，零失败/跳过，最终截图已亲看。未改动原生后端或新增依赖。本批清洁归档/push/对应云端iOS27仍待，完整参考HSV/默认值/运行及全部A/F/J、真实服务/签名/真机范围保持。

## 2026-10-18 字体与歌词Sheet清洁归档/push回执

`b79edb6e81fd01f9511ed0eb13a461c1db3f8b64`已正常push；清洁归档manifest dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned。ZIP CRC/附带摘要、可执行及JS对归档字节一致、正式入口隔离/私人参考及签名资源排除通过，IPA SHA256 `5059f0229d3435351233f828f43b7f122df674c5e329b94cea6e2c265c94ae82`，留存`build/local-font-sheets-b79edb6`。348业务/类型及App3/3见下；验收后严格review19E/18F/18P、7WI/32事件、零错误/警告。

push后API实核39061650305/b79edb6唯一pending、39058310652/332cac5继续运行，1运行/1排队。mini旧pending39059968173/23bc73c由single自动取消，不算通过；未手动取消运行或重派旧版。最新完整成功仍为76c9cd0/39050349015，不覆盖AM2/mini/字体；新终态继续。下一背景设置批次已新路由并补E020原始证据、严格review20E/19F/19P、33事件通过；尚未实施，不计功能完成。真实服务/签名/真机与全部A/F/J继续。

## 2026-10-18 字体角色与歌词显示 Sheet（本地通过）

reverse-skill mobile-reverse E019→F018→P018已在采纳前严格review：19E/18F/18P、7WI/31事件，零错误/警告；2057条原始指令字节、BL、池偏移与模式字段支持独立歌词显示/参数化字体模态和全局/歌词setter分支。按[0045](docs/decisions/0045-font-display-settings-sheets.md)原创拆分现有全局字体、歌词字体、显示设置入口；同一原生Sheet切换，保留分类滚动与现有原子导入/继承/删除回退、全部显示控件及八布局唯一播放意图。348业务/类型检查通过；正式入口`SourceUITests-1792263616441.xcresult`三项通过、零失败/跳过：最大辅助字号/三角色/关闭下滑/分类滚动73.984秒，字体真实Files导入/全局与歌词继承系统选择/居中模糊重启/八布局实音PCM/播放器内角色入口/删除回退344.580秒，分组导航与草稿/滚动保留109.934秒。已亲看三种大字Sheet与导入原创三角字体截图；大字长内容仍需滚动，关闭与操作可达。本轮鉴权8次成功、0失败，无新stream请求，允许既有临时音频缓存，不能称本次冷下载。未修改原生音频/脚本后端，无新依赖；清洁归档/push/对应iOS27继续，真实服务/签名/手机及完整参考运行等价仍待。完整参考选项/默认值/动态运行、清洁归档/push/对应iOS27及真实服务/签名/手机继续；全部A/F/J目标保持active。详见[报告](docs/2026-10-18_reverse-sollin-font-settings-report.md)。

## 2026-10-18 mini／底栏 Sheet 清洁归档与push回执

`23bc73c4570e91eba7c3ae539b3512c759cfd3e8`已正常push，远端main一致。`archive-mini-navigation-sheets-clean.log`成功；manifest dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned。ZIP CRC、附带摘要、可执行及JS与归档字节一致、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `e23b0ac10ea77ca79e283f6b5b829e1c9e1fce540b2b656583de82fe438d3483`，留存`build/local-mini-navigation-23bc73c`。本条覆盖本批清洁归档/push待办；348业务/类型、正式App3/3和严格review18E/17F/17P、30事件、零错误/警告见下，不能代替参考运行、真实服务、签名与手机验收。

push后API核对：[39059968173](https://github.com/RhsR1024/nexus-music/actions/runs/39059968173)/23bc73c唯一pending，[39058310652](https://github.com/RhsR1024/nexus-music/actions/runs/39058310652)/332cac5继续运行，1运行/1排队；未取消运行中或重派旧版。76c9cd0/39050349015完整iOS27成功并核验IPA见下，不能覆盖AM2/mini。下一字体/歌词显示设置离线批次已重新路由mobile-reverse并通过前置门禁，仅有本机限定原始调用探查，尚无新不可变功能证据或采纳review；全部A/F/J目标保持active。

## 2026-10-18 舞台及生命周期修正版 iOS27 成功与产物核验

`76c9cd0ad069455893833face9060ef9e2eb1950` / [39050349015](https://github.com/RhsR1024/nexus-music/actions/runs/39050349015) 已完整成功：checks、完整native、核心App、歌词/匹配/发现、离线断服务播放、iPad窗口/旋转、设备归档与上传均成功。IPA artifact12110443053已实际下载，ZIP10335717字节、API SHA256 `917e258f1da78fa4e684ed217d94a2132345126ad68f85b2b3e56293295fe54b` 与完整CRC通过；内部IPA附带摘要/CRC、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `09aa12fa4c3f62f773f2cddec14bd25051a3c45864801d3e3452489b0eada082`，留存`build/ci-39050349015`。

manifest为Xcode27.0/27A266a、iphoneos27.0、arm64、min15.1、设备族[1,2]、unsigned；dirty=true唯一`ios/Podfile.lock`。成功只覆盖76c9cd0及祖先，包含有界舞台与生命周期测试修正，不包含后续AM2、EQ滚动测试修正或mini设置Sheet。AM2运行39058310652已开始，当前1运行/0排队；本批mini仍未提交。旧失败不改写，签名、真实服务、手机和完整参考运行等价继续独立验收。

## 2026-10-18 mini／底栏设置模态本地验收通过

reverse-skill mobile-reverse E-018→F-017→P-017采纳前严格review18E/17F/17P、7WI/29事件、零错误/警告；实施验收后严格review为30事件、零错误/警告。原始BL/1844条指令的原始字节核验支持两设置调用共用模态包装、mini最多4项和添加/排序/移除汇入同一标准化保存入口；完整参考选项/几何/异步失败/运行仍待。音枢仅将现有mini和底栏设置改为原生pageSheet，保留外观滚动、当前按钮/原子保存/唯一播放意图，未新增伪样式；五参考固定HEAD/维护/Android/许可及验收见[0044](docs/decisions/0044-mini-navigation-settings-sheets.md)。348业务/类型检查通过；正式入口`SourceUITests-1792262213912.xcresult`三项通过、零失败/跳过：mini/底栏最大辅助字号关闭/下滑/重开/滚动/重启159.603秒，主题46.171秒，Navidrome合成实音/PCM/八布局/暂停定位/mini四项上限排序/原曲收藏/实际录音歌词/重启/恢复默认并关闭后验证队列按钮消失/凭据清理242.101秒。已亲看mini与底栏大字Sheet和真实四按钮mini截图；大字长内容仍需滚动。未修改原生播放/脚本后端，无新依赖。清洁归档/push及对应iOS27继续；真实服务、签名、真机和完整参考运行等价仍待。

## 2026-10-18 AM2 清洁归档与push回执

`332cac51b12ba26fe28f0df69f7c1af16c5eaeb4`已正常push，远端main一致。`archive-am2-clean.log`成功；manifest dirty=false/workingTreeChanges=[]、Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned。ZIP CRC、附带SHA256、可执行及JS与归档字节一致、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `aa1c4f1722a0f3c925804d8b0db02d1d635b29587964dd900362acf36bd30727`，留存`build/local-am2-332cac5`。本条覆盖本批清洁归档/push待办；348业务/类型、手机/iPad/共享歌词评论/最终字体EQ分项及严格review28事件见下，不代表参考运行等价或真实服务/签名/真机通过。

push后API核对[39058310652](https://github.com/RhsR1024/nexus-music/actions/runs/39058310652)/332cac5为唯一pending，[39050349015](https://github.com/RhsR1024/nexus-music/actions/runs/39050349015)/76c9cd0继续运行，1运行/1排队；未取消运行中或重派旧版。新云端终态继续跟进。下一mini控件/底栏证据批次重新路由mobile-reverse并通过前置门禁，尚无新功能证据/采纳结论；全部A/F/J和真机范围保留。

## 2026-10-18 AM2 本地阶段验收通过

reverse-skill mobile-reverse E016/E017采纳门禁保持，本轮严格review17E/16F/16P、7WI/28事件、零错误/警告。原创第八种AM2接入独立封面/歌词/队列/评论、前台可见空闲计时及独立true/5秒/音量隐藏默认值，保留原七布局与音枢唯一队列/意图；348业务及类型检查通过，见[0043](docs/decisions/0043-responsive-am2.md)。

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

## 2026-10-17 AM2 页面与内容切换证据阶段

reverse-skill新路由mobile-reverse，E-016→F-015→P-015严格review通过16E/15F/15P、7工作项/25事件、零错误/警告。原始BL/分配头确认独立AM2页面、横竖构建分支、歌词/封面节点及歌词/评论/队列共享切换；定位通过互逆字段和已存闭包接唯一控制器，另一个double回调确认为音量。随后E-017→F-016→P-016补证控件指针同字段排除分支、距离18门槛、声明音量关闭/自动歌词开启5秒及延迟句柄重查；最终严格review为17E/16F/16P、7工作项/26事件、零错误/警告。完整几何、SDK helper、多指/持久化有效状态和运行效果仍待，不据方法名新增第八选项。详见[专项报告](docs/2026-10-17_reverse-sollin-am2-report.md)。五参考固定HEAD及职责/维护/Android/许可已逐一复核，无复制源码/依赖。本批只新增静态证据与文档，音枢七布局和全部A/F/J保持；舞台ad784b5本地验收/清洁归档/push已完成，对应iOS27待终态，真实服务/签名/手机另验。

## 2026-10-17 有界歌词舞台清洁归档与push回执

`ad784b539869b9380eee2cc1ee504428236acd6d`已正常push并核对远端main一致。`archive-lyric-stage-clean.log`成功，manifest dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned。ZIP CRC/附带摘要、可执行及JS与归档字节一致、正式入口隔离和私人参考/签名资源排除均通过；IPA SHA256 `33f49a94a5cf038ef038c667c8192502de77e6af493174ee47e35c527026cc09`，留存`build/local-lyric-stage-ad784b5`。342项业务/类型及分项App结果见下；采纳前review23事件，实施验收后review24事件、15E/14F/14P、7工作项、零错误/警告。此条覆盖本批清洁归档/push待办，不能代表完整参考特效、真实服务、签名或手机验收。

push后当前GitHub Actions HTML嵌入状态实核：[39046035422](https://github.com/RhsR1024/nexus-music/actions/runs/39046035422)/ad784b5为唯一pending，[39042804499](https://github.com/RhsR1024/nexus-music/actions/runs/39042804499)/fcffd28继续运行，1运行/1排队。未取消运行中任务或重派旧版；本批对应iOS27终态继续跟进。下一AM2离线分析已重新路由mobile-reverse并通过前置门禁，仅有本机限定字节探查，尚未建立新功能收据/review或实施；不能计作第八布局或完成。全部A/F/J余项持续。

## 2026-10-17 设置分类批次 iOS27 成功与产物核验

`35e6f2fefcb5812d8d6cfdcbdc763b576b02ad07` / [39034909819](https://github.com/RhsR1024/nexus-music/actions/runs/39034909819) 的checks、native、核心App、歌词/匹配/发现、离线断服务播放、iPad、设备归档及上传全部成功，API已实核。IPA artifact12103974275，ZIP10324662字节，API SHA256 `d04a521e5925bdaa78f0d25491c5c40e9c249c6cd1739ada2ca92284859f12b0`；实际下载/完整ZIP CRC、包内IPA附带摘要/CRC、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `9a8c85851ae80ed32f2dc69a35d0743bbb72a9495900cdda3fbb025227c29ebd`，留存`build/ci-39034909819`。manifest为Xcode27.0/27A266a、iphoneos27.0、arm64、min15.1、设备族[1,2]、unsigned；dirty=true唯一`ios/Podfile.lock`。该成功只覆盖设置分类批次及祖先，不覆盖后续主题/背景/样式/环形定位或当前舞台。环形定位39042804499已过native、正在核心App；不取消或重派。真实服务/签名/手机另验。

## 2026-10-17 A09 有界歌词舞台本地专项通过

reverse-skill mobile-reverse E-015→F-014→P-014采纳前严格review通过15E/14F/14P、7WI/23事件、零错误/警告；只确认字符计数/四字符比较与均分时间算式，完整分段/偏移字段/视觉特效未恢复。依据[0042](docs/decisions/0042-bounded-lyric-stage.md)和[专项报告](docs/2026-10-17_reverse-sollin-stage-rules-report.md)原创接入第七种歌词舞台：真实词分组/原生扫色、普通LRC整行、半开空隙、原偏移与唯一控制器，保留六布局/黑胶及音枢功能。342项业务/类型通过；增强歌词141.407秒、正式入口Navidrome七布局206.720秒分别通过，修正测试滚动范围后分组导航109.951秒/最大辅助字号样式及舞台重启持久化146.224秒均通过，零失败/跳过。首词延迟起点另有单元覆盖。清洁归档/提交push/对应iOS27尚待，完整舞台等价未验。AM2、舞台背景人声专用绘制/特效/手机性能及全部其他A/F/J与真实服务/签名/手机继续。

## 2026-10-17 歌词舞台时间轴证据阶段

reverse-skill新路由mobile-reverse；E-014→F-013→P-013严格review通过14E/13F/13P、7WI/22事件、零错误/警告。原始字节核实初始化/文档变化分段、外层半开区间、组起点扫描/身份守卫及独立Karaoke绘制，完整分段阈值/时间偏移来源/视觉效果继续待核。本批仅收敛后续实现前提，音枢六布局保留，不计新舞台/AM2完成；详见[专项报告](docs/2026-10-17_reverse-sollin-stage-timeline-report.md)。环形定位fcffd28已清洁归档/push，云端新39042804499待验；全部A/F/J与真实服务/签名/手机范围继续。

## 2026-10-17 环形定位清洁归档与push回执

`fcffd286ebe61baee3b4f389fab995f8a254996d`已正常push并核对远端main一致。`archive-ring-seek-clean.log`成功，manifest dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned；ZIP CRC/附带摘要、可执行及JS对归档字节一致、正式入口隔离和私人参考/签名资源排除通过。IPA SHA256 `3648b46f776288557f620f0f625ecd45d44896cd36fef3e0dda38c1973d37930`，留存`build/local-ring-seek-fcffd28`。本条覆盖下方本批归档/push待办，真实服务/签名/手机独立验收。

push后API实核[39042804499](https://github.com/RhsR1024/nexus-music/actions/runs/39042804499)/fcffd28唯一pending，[39034909819](https://github.com/RhsR1024/nexus-music/actions/runs/39034909819)/35e6f2f继续运行，已过checks/native/核心App/歌词发现/离线断服务播放，正在iPad；旧pending39040601042/261cd66由single自动取消，不计通过。1运行/1排队，未取消运行/重派；本批对应iOS27终态继续。

## 2026-10-17 A09 声波核环形定位（本地专项通过）

reverse-skill mobile-reverse E-013→F-012→P-012采纳前严格review通过13E/12F/12P、7WI/20事件、零错误/警告；原始指令核实沉浸四渲染分支和ring预览/提交/取消，舞台创建独立LyricStagePage。音枢已有声波核补齐环带拖动预览/松手单次定位、切歌/时长/取消守卫与10秒无障碍动作；真实PCM、中心播放按钮、唯一队列及六布局保留，AM2/舞台完整绘制仍待。335项业务/类型通过；正式App1792248125950综合回归198.360秒、1/1通过且零失败/跳过，暂停/播放中拖环、进度同源、中心按钮/真实PCM、多皮肤/歌词/mini/重启和凭据清理通过，亲看最终截图。清洁归档/push/对应云端结果继续记录；详见[0041](docs/decisions/0041-wave-ring-seek.md)、[报告](docs/2026-10-17_reverse-sollin-renderer-ring-report.md)。全部A/F/J余项与真实服务/签名/手机范围保留。

## 2026-10-17 用户确认：模拟器优先，真机按需

用户明确要求当前继续用现有Xcode模拟器开发调试；到需要iPhone连接Mac时再告知具体目的。继续以IPA逆向证据优先、截图辅助；现有Sollin真机IPA不能直接在本机Intel模拟器运行，需要专门的模拟器构建。未进行Sollin真机启动/自动点击取证，也未安装音枢到手机。真机后续用于参考动态界面及签名、后台音频、锁屏/蓝牙、性能等验收，模拟器通过不替代这些结果。

## 2026-10-17 样式Sheet清洁归档与push回执

`261cd660d4f730540874133fa89d4bb442e32ec7`已正常push并核对远端main；`archive-player-style-clean.log`成功，manifest dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned。ZIP CRC/附带摘要、可执行及JS对归档字节一致、正式入口隔离与私人参考/签名资源排除通过。IPA SHA256 `c21ea1a1a3bc071be9c0e840f78f57e1345dc49a2319f6a6af56615da383f212`，留存`build/local-player-style-261cd66`。本条覆盖下方本批清洁归档/push待办，不代表真实服务/签名/手机已验。

push后API实核[39040601042](https://github.com/RhsR1024/nexus-music/actions/runs/39040601042)/261cd66为唯一pending，[39034909819](https://github.com/RhsR1024/nexus-music/actions/runs/39034909819)/35e6f2f继续运行；旧pending39038052599/b32ac94由single自动取消，不计通过。1运行/1排队，未取消运行/重派；前批已通过核心App，歌词/发现组执行中，本批对应iOS27终态继续。全部其他A/F/J余项保留。

## 2026-10-17 播放样式选择 Sheet（本地专项通过）

reverse-skill mobile-reverse E-011→F-010→P-010严格review通过（11E/10F/10P、7工作项/17事件，零错误/警告），原始BL/池引用确认独立模态、八标签及普通setStyle→pop；只采纳选择交互。音枢设置样式改为原生pageSheet，六种真实布局、原子保存后关闭/失败保留、重开session隔离与原分类滚动保持；不冒称八布局/参考运行完成。五参考比较、维护/Android/许可和边界见[决策0040](docs/decisions/0040-player-style-sheet.md)，脱敏[专项报告](docs/2026-10-17_reverse-sollin-player-style-report.md)。331项业务/类型检查通过；正式App最终三项回归通过、零失败/跳过（分组96.095秒、样式最大辅助字号91.027秒、主题37.948秒），亲看样式截图。首轮大字分类行跳变已修正并保留失败；修正前Navidrome综合185.508秒通过，未混称为最终复测。清洁归档/push及对应iOS27仍待；全部其他F/J与真实服务/签名/手机范围继续。

## 2026-10-17 全局背景批次清洁归档与push回执

`b32ac94b30315ca12bf9ba679f87d70f1c186d4f`已正常push并核对远端main。`archive-global-background-clean.log`成功，manifest dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned；ZIP CRC/附带SHA、可执行及JS对归档字节一致、正式入口隔离/私人资源排除通过。IPA SHA256 `3bd13c1d90ae3b7c13162cda113ac76ce913a030e3999cdd7041e11cb20ad504`，留存`build/local-global-background-b32ac94`。本条覆盖下方本批清洁归档/push待办；手机功耗、实际动画帧率、系统后台/减少动态效果、真实服务/签名仍单独验收。

push后API实核39038052599/b32ac94唯一pending，39034909819/35e6f2f继续运行；旧pending39036339256/b82aeba由single自动取消，不计通过。1运行/1排队，未取消运行/重派旧版；新云端终态继续。A03/A06–09和全部F/J余项仍保留。

## 2026-10-17 A04 全局背景独立控制（本地专项通过）

reverse-skill E-010→F-009→P-009采纳前严格review通过10E/9F/9P，零错误/警告；原始指令与分配头确认默认全局容器分别读取封面/有效流动设置，流动分支优先。此前摘要页链纠正保留；精确场景/媒体字段/动态视频仍待。音枢新增独立全局封面流动与旧偏好兼容，保留播放页动效/写真/主题图片及唯一播放器；331项业务/类型通过。正式App1792244188543.xcresult两项通过、零失败/跳过：全局红蓝/跨页/独立开关/暂停重启189.767秒，Files图片导入/播放背景持久化112.398秒；亲看全局流动单开设置与发现页截图。测试证明颜色/优先级/保存行为，不冒称实际动画帧率或参考shader等价。清洁归档/push及对应云端回执继续。见[0039](docs/decisions/0039-independent-global-background-motion.md)和[专项报告](docs/2026-10-17_reverse-sollin-global-background-report.md)。其余A03/A06–09、全部F/J和真实服务/签名/手机范围继续。

## 2026-10-17 主题Sheet清洁归档与推送回执

`b82aeba2cb7ffc29e35eba7c7d0dbd5654d70c27` 已正常push，远端main核对一致；`archive-theme-sheet-clean.log`成功，清洁manifest dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned。ZIP CRC、附带SHA256、包内可执行/JS对归档字节一致、正式入口隔离与私人参考/签名资源排除通过；IPA SHA256 `15fbe875bc23a3554654fe2e4da173a3a651c60045e89bc4de18efeffd6eb687`，留存`build/local-theme-sheet-b82aeba`。

push后API实核[39036339256](https://github.com/RhsR1024/nexus-music/actions/runs/39036339256)/b82aeba唯一pending，[39034909819](https://github.com/RhsR1024/nexus-music/actions/runs/39034909819)/35e6f2f唯一运行，1运行/1排队；未取消运行/重派。下载批次ab98682的完整iOS27成功及产物核验见下条，不能代替本批新云端结果。A04全局背景链与其余对齐、F/J全部余项及真实服务/签名/真机继续。

## 2026-10-17 21:11 下载批次 iOS27 完整成功

`ab98682c2262e633f2789a9a38ce0aad87a605c8` / [39027501515](https://github.com/RhsR1024/nexus-music/actions/runs/39027501515) 已成功：checks24秒、iOS任务1小时45分1秒；native、核心App50分2秒、匹配/歌词/发现18分14秒、离线断服务播放16分25秒、iPad窗口/旋转9分钟、设备归档3分21秒及两项上传均成功。包含恢复调度和下载任务页，不包含后续EQ卡片、设置分组或本批主题Sheet。

IPA artifact12101498126，10321245字节，网页/API ZIP摘要 `ec483c30905ea550da626e2d5a960bd923de46c94186b6d938b5e7f5d458dd1b`；诊断12101624381。浏览器实际下载完成，完整ZIP摘要/长度/CRC、内部IPA附带摘要/CRC和正式入口隔离、私人资源排除通过。IPA SHA256 `1af6201ce87ad3003f472b636774b83273ad3d5a77b3b45d3af8e0877e54c63b`，留存`build/ci-39027501515`；manifest为Xcode27.0/27A266a、iphoneos27.0、arm64、min15.1、设备族[1,2]、unsigned，dirty=true唯一`ios/Podfile.lock`。真实服务、原生后台下载、签名与手机仍独立验收。21:19 API核对设置批次39034909819/35e6f2f为唯一运行、0排队，继续跟进，不重派旧运行。

## 2026-10-17 软件主题Sheet本地验收

reverse-skill IPA E-009→F-008→P-008采纳前严格review通过，原始BL确认两个主题包装→共用包装→Flutter showModalBottomSheet。音枢软件主题改为原生pageSheet，复用三态/原子持久化，显式关闭/系统dismiss保留外观分类和滚动，底层AX/触摸隔离；328项业务/类型通过；正式App1792242348845两项通过（外观持久化71.145秒、分组导航95.341秒，零失败/跳过），1792242792269最大辅助字号/下滑关闭/重新打开保持选择37.400秒通过。首轮新增测试因XCTest拖拽参数类型编译失败已修正并保留日志；最终文案收口后1792242979329同专项38.790秒再次通过并亲看截图，类型复验通过；清洁归档与本批云端继续记录。背景编辑器及其他叶页暂按既有实现，A04全局封面链未证明；全部F/J和真实服务/签名/真机边界保留。详见[决策0038](docs/decisions/0038-theme-mode-sheet.md)。

## 2026-10-17 设置分类批次清洁归档与推送回执

`35e6f2fefcb5812d8d6cfdcbdc763b576b02ad07` 已正常push，远端main核对一致。清洁本机设备归档成功：manifest dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned；正式入口隔离、ZIP CRC、包内可执行文件/JS对归档字节一致和私人参考/签名资源排除均通过。IPA SHA256 `c9b172e63e0da697649c60f1013826f27b68864e3451e08ad6a38dc10b0ae664`，留存 `build/local-settings-objects-35e6f2f`。最大辅助字号32.744秒截图已亲看，卡片单列/选中可达。

push后网页实核最新[39034909819](https://github.com/RhsR1024/nexus-music/actions/runs/39034909819) /35e6f2f为唯一pending；[39027501515](https://github.com/RhsR1024/nexus-music/actions/runs/39027501515) /ab98682继续运行，核心App、歌词/匹配/发现和离线下载/断服务播放步骤均exit0，正执行iPad。旧pending39030063384/88850c1由single自动取消，不计通过；1运行/1排队，未取消运行或重派。新批云端终态、真实服务、签名与手机仍待。此回执覆盖本批“清洁归档待做”，不提前勾选全功能完成。

## 2026-10-17 设置对象关系与分类入口阶段

reverse-skill mobile-reverse IPA E-008→F-007→P-007严格review通过（8E/7F/7P、7工作项、12事件、零错误/警告）。固定Blutter/Dart双端隔离构建与断网解析已完成；IPA独立容器检查24,298入口、1,455骨架重放及限定原始BL支持设置分类分派、二级页创建和播放→EQ。NO_CODE_ANALYSIS骨架不等于完整反编译/运行图；A03仍有Sheet/默认值待查。A04纠正：resolve/load/applyCoverTheme属于ArtworkSummaryState，尚未证明全局主题取色链，三个动态provider仍分开。

音枢设置首页四分类同组，EQ移到播放分类下独立页；当前音质/布局摘要、来源独立、草稿/滚动/隐藏AX和原有功能保留。328项业务/类型通过；正式App1792240097837两项通过（EQ97.259秒、分组85.620秒，零失败/跳过），亲看首页/草稿截图。最大辅助字号、清洁设备归档与本批云端结果继续记录。详见[本批报告](docs/2026-10-17_reverse-sollin-settings-objects-report.md)。先收敛A03/A04及A06–A09，再推进平台能力，全部F01–F37/J01–J59及真实服务/签名/真机边界保留。

## 2026-10-17 EQ 卡片清洁设备归档回执

实现提交 `26bc65eb6189ed6137200dc309c83484e94d3276` 的 `archive-eq-cards-clean.log` 为ARCHIVE SUCCEEDED。manifest为dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned；正式入口/测试adapter排除、ZIP CRC、可执行文件和JS对归档字节一致、私人参考/签名资源排除均通过。IPA SHA256 `cfad16789e918f6e735c92e81d1226b7e33eac8d24cd06d39288a54a14dcaff0`，留存 `build/local-eq-cards-26bc65e`。本回执覆盖下方本批“清洁归档待做”，push/对应云端结果继续记录；不等于iOS27/签名/真机通过。

## 2026-10-17 A07 EQ 预设卡片本地验收

reverse-skill mobile-reverse 的本批 IPA E-007→F-006→P-006 采纳前严格review通过（7E/6F/6P，零错误/警告），只确认EQ模块词汇，亲看截图02/07补充视觉；没有恢复对象调用关系或参考运行参数。原创双列曲线卡片、按实际曲线与前级计算选中、自定义计数/空态和大字单列，保留音枢七预设、24自定义和唯一DSP/队列。浅色主题旧深色面板与输入对比度问题已修正，卡片/重置/归零/保存/删除操作至少44点。

328项业务/类型通过，最终配色补修后类型再次通过。正式App1792237003989预设切换/只改前级取消选中/曲线拖动/保存/重启/删除/睡眠92.800秒、1792237149089最大辅助字号单列30.615秒分别通过，均零失败/跳过；亲看最终附件，大字专项加入原云端回归组。清洁设备归档与本批云端终态待做，真实音效/签名/手机仍独立验收。报告见 [EQ专项](docs/2026-10-17_reverse-sollin-eq-report.md)。

Ryderwe固定源码已继续追踪到平台扫码状态/账号核验、Cookie刷新、日推与FM，补齐音枢HTTP响应头和隔离会话缺口/测试清单；无许可Youmi只行为参考，不采纳敏感日志/明文Cookie/外部代理。详见 [Ryderwe追踪](docs/RYDERWE_REPOSITORY_REVIEW.md)。仍先完成A06–A09，再推进真实平台能力；F01–F37/J01–J59范围保留。

## 2026-10-17 下载批次清洁本地归档回执

`ab98682c2262e633f2789a9a38ce0aad87a605c8` 已正常push；本机归档 `archive-download-ui-clean.log` 为ARCHIVE SUCCEEDED。manifest对应ab98682、dirty=false/workingTreeChanges=[]，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、unsigned。正式入口隔离、ZIP CRC、包内可执行文件/JS与归档字节一致、私人参考/签名资源排除及SHA256核验通过；IPA摘要 `9c37b2b030d5840af8521d2b234f933e9fc77614142d80f9a44f0bbb9587505e`，留存 `build/local-download-ui-ab98682`。本条覆盖下方“本批清洁归档/push待做”的历史状态，iOS27/真实服务/手机后台/签名仍独立验收。

主执行上下文又核对c999049云端成功与artifact12099502248的页面摘要；浏览器下载跳转被Chrome以ERR_BLOCKED_BY_CLIENT阻断，未绕过，未取得ZIP，故仍不宣称该产物已核验。ab98682云端39027501515继续运行、0排队，未取消或重派。

## 2026-10-17 19:26 心跳：推荐批次 iOS27 完整成功

`c999049` / [39022411440](https://github.com/RhsR1024/nexus-music/actions/runs/39022411440) 于19:25:26完成：checks、native、两组App测试、iPad窗口/旋转、unsigned IPA归档及上传全部成功。它包含1cc9e39本地推荐/FM fallback，但不包含后续c1a4605/c098eeb恢复调度或ab98682下载任务页；成功仅覆盖实际提交，真实平台推荐/FM、签名、手机/后台/灵动岛仍待验收。

API返回IPA artifact `12099502248`（10309262字节），ZIP摘要 `03239aa0b887be4d214914d44d1a4c2c635152bd35de8a6bffaa622c24820c74`；诊断artifact `12099059107`。状态摘录留存忽略目录 `build/ci-39022411440/STATUS.txt`，再次获取原始JSON时API限流，未保存原始JSON；尚未下载本批ZIP或核验包内manifest/CRC/IPA摘要，不能写成产物已核验。前批920d193的完整产物核验沿18:06既有记录，不重复下载。

19:26 API实核最新 `39027501515` / `ab98682` 已运行，0排队；旧pending `39024707349` / c098eeb已由single队列自动取消，不计通过。未取消运行或重派旧版。本心跳只更新状态，不介入另一执行上下文的功能/工具工作或独立提交push。

## 2026-10-17 下载设置与任务页本地专项通过

用户已明确批准独立Blutter构建与离线提取；已执行审阅脚本，首次session 20028已因GitHub连接重置/early EOF以128退出，保留日志`build/logs/blutter-isolated-build-approved.log`，授权/脚本摘要留`work/tooling/blutter-approval.json`。两平台前置门禁通过、固定Python依赖已安装，当前只重试同一ICU固定提交checkout（session 49192，build/logs/blutter-icu-fixed-checkout-retry.log），未改全局Git配置或源码版本，尚未产生对象恢复结论。0037第四次正式App下载/分组导航复测session 22499已exit0；仅网络重试并行，工具编译与App编译错开，后续恢复原构建脚本前先核实本机构建退出。不能重复请求已获批准。固定来源/限制见REVERSE_SKILL_WORKFLOW。

基于reverse-skill IPA E-006→F-005→P-005（严格review通过）与亲看补充截图11/34/36，现将既有离线能力从临时缓存组件拆到设置首页“下载管理→下载任务与文件”；下载偏好只提供实际生效的跟随播放音质说明、容量选择及任务入口。任务页使用SectionList区分未完成/已保存、真实单项/批量暂停继续取消和已保存播放/确认删除，复用原权威store与在播保护，不引入参考商业门槛或无实现偏好。

正式入口App `SourceUITests-1792234656950.xcresult` 2/2、零失败/跳过通过：下载/重启/条件Range/断服务后真实PCM/取消与确认删除172.175秒，分组导航/草稿/隐藏AX77.454秒。合成服务full=1、resumed=1、blocked=0；播放前临时音频缓存为空，离线播放前后stream计数不增。亲看暂停、完成、确认删除空态附件；328项业务/类型、完整native及无障碍补修后类型检查通过。附加simctl诊断收集exit72路径警告保留，不影响测试exit0。本批清洁归档、push与对应云端终态仍待，真实服务/签名/手机/原生后台边界不变。 详见决策0037，所有其余F/J范围与真实服务/签名/手机边界保留。

## 2026-10-17 18:23 恢复调度修正版已push与清洁归档回执

`c1a4605` 恢复调度和 `c098eeb252e3ca7c916c66d2d3e6d773c6340121` 暂停竞态修正已正常push到RhsR1024/nexus-music，远端main核对一致。最终清洁归档日志 `build/logs/archive-offline-recovery-pause-final.log` 成功，manifest对应c098eeb、dirty=false/workingTreeChanges=[]、Xcode26.3/iphoneos26.2、arm64、min15.1、设备族[1,2]、unsigned。IPA SHA256 `a14baac7e11ae8a117c7d593d24b183f318fab1e7cb38348665b1bcd03a353a4`，附带摘要/ZIP CRC、包内可执行与JS对归档一致、正式入口隔离和私人资产排除通过，留存 `build/local-offline-recovery-c098eeb`。c1a4605初版另存，不误称含后续暂停修正。

本批326/326业务/类型通过；完整native和正式App两项（58.310/204.425秒、零失败/跳过）在c1a4605已通过，后续仅TS暂停补修以两项新增竞态测试及清洁归档验证，未将此前App测试写成修正版下载/后台实测。Sollin E-005严格review通过，仍只支持模块边界；原生后台、App内下载/杀进程、跨服务长期、真实私人服务、签名和手机验收待办保留。

push后实时队列核对：最新[39024707349](https://github.com/RhsR1024/nexus-music/actions/runs/39024707349)（c098eeb）唯一pending，[39022411440](https://github.com/RhsR1024/nexus-music/actions/runs/39022411440)（c999049）唯一运行中，1运行/1排队；未取消运行中、未重派旧提交。最新终态继续跟进，pending不计通过。全部F01–F37/J01–J59目标active；下一阶段回到A03/A04对象关系与已有UI/交互收口，平台登录/真实推荐/FM/识曲、原生后台下载等仍依赖各自证据与验收。Ryderwe参考盘点沿既有RYDERWE_REPOSITORY_REVIEW，不复制未核验许可或私有服务。

## 2026-10-17 M10 暂停竞态补修（最新）

恢复调度后立即暂停的竞态已用最小复现确认并补修：同步暂停意图、状态写入前后守卫、等待活跃任务中断落定，显式恢复/重试再清除暂停。326/326业务/类型通过；两项新测试验证暂停前不发网络请求，resume后仅1次。c1a4605的正式App2/2、完整native及清洁IPA属于补修前证据；TS修正后最终清洁归档/push继续，App下载/杀进程/后台验收仍待。初版包在build/local-offline-recovery-c1a4605，不当作修正版。

## 2026-10-17 M10 启动/前台恢复当前批次

`resumeQueued()` 原创恢复自身 queued/中断下载，保留用户 paused/failed；启动和 AppState active 可重入去重，按持久化顺序继续后续队列。源初始化异步，恢复下载等待 LX 就绪，界面不等待慢源。326/326 业务/类型检查通过，见[决策0036](docs/decisions/0036-offline-recovery.md)。Sollin E-005严格review只确认模块边界，未证明恢复/后台算法，不宣称完整对齐。原生后台、系统重启策略、长期服务、漫途完整导入、签名与真机待办保持。

本批正式App回归1792231667947两项通过、零失败/跳过：源管理58.310秒、Navidrome/PCM/多皮肤/歌词/mini/重启204.425秒；326项业务/类型和完整native通过。附加诊断收集simctl路径警告保留。清洁归档、提交push及新云端终态继续记录；已成功920d193不覆盖本批。

## 2026-10-17 18:06 云端 920d193 完整成功与产物核验

`920d193` / [39016561400](https://github.com/RhsR1024/nexus-music/actions/runs/39016561400) 已完整成功：checks、native、核心App、匹配/歌词/发现/健康、iPad窗口与旋转、设备归档和上传均成功。IPA artifact `12097510843` 已实际下载，ZIP 10304736字节、API SHA256 `089011035aa457b94d55c33442ff4460a7985d37b392956b9514121a39de226e` 与CRC通过；内部 IPA 附带摘要一致，SHA256 `9077562313697430f745665cbef08ac876770964dd353063fd965dc95b38667d`。核验正式入口无 `nexus-ui-test-online-adapter`、arm64、Xcode27.0/27A266a、iphoneos27.0、min15.1、设备族[1,2]、unsigned；manifest dirty=true 唯一 `ios/Podfile.lock`。本机产物与核验记录在忽略目录 `build/ci-39016561400`。

本次覆盖920d193及其祖先，包含95c2e03匹配测试源清理修正；不覆盖后续1cc9e39本地推荐或尚未提交恢复调度。早先失败/取消仍保留历史；iOS27成功不替代个人服务、签名、真机后台/灵动岛验收。

# 2026-10-17 最新交接：3898592已验证推送，iOS27排队

本批3898592已正常push并核对origin/main一致；本地归档会话76346已exit0。清洁IPA、摘要与manifest留存build/local-player-identity-3898592，SHA256 9f15c56275ce76c03f5975497333e04df16f5d0d7ed2a1f49bf05a0ffbe95056；SDK26.2、arm64、设备族[1,2]、unsigned、dirty=false，正式入口隔离/CRC/二进制一致性通过。完整证据见BUILD_STATUS最新条目。303业务/类型、native与七个分段专项通过；前轮失败保留，不冒充同次全套通过。

归档已结束；本地15项云端同序正式入口整组正在执行会话86595，结果包1792214990725，汇总ui-core-player-identity-full.log、实际ui-catalog.log；外观62.175秒、图标12.697秒已通过，未完成，不得重开UI/归档覆盖日志。结束先保存日志/counts。最新云端39006353281（3898592）唯一pending，39003956417（c64c43b）仍运行。已API核对1运行/1排队，不能取消运行中/重派旧版本。接续优先跟进最新终态与失败；旧运行不覆盖3898592修正。阶段文档将另作docs-only回执提交，不应触发重复构建。

reverse-skill已固定安装并强制执行，两案例严格review通过。用户已回复批准独立工具安装；work/tooling/prepare-python-tools.sh已原样执行exit0，CMake3.31.6/Ninja wheel1.11.1.3/pyelftools0.32验证通过，日志reverse-python-tools-install.log。外部工具索引登记绝对路径/版本；另确认桌面自带Python3.12.14并设为索引主解释器。Blutter上游与iOS PR204的审查及Python3.9兼容前提见SOLLIN_IPA_ANALYSIS；尚未构建/恢复对象图。既有合法离线静态分析、应用核验与云端跟进可继续。A03/A04对象关系、A06–A09剩余完整对齐和F01–F37/J01–J59全范围保留；签名/真机/真实私人服务未验收，目标active。

# 2026-10-17 本轮进行中检查点（reverse-skill补充已交付）

用户补充已落实并正常push：`c64c43b` 安装/硬门禁，`d997737` 双端snapshot/验证状态；远端main=d997737。2026-10-17本轮API核实云端39003956417为唯一运行、0pending；docs-only d997737没有重复触发构建。目标仍active，不得因安装阶段结束标全功能完成。

当前本地303项/类型check-player-identity-final.log全通过，完整native-player-identity.log已通过；最新check-player-identity-reviewed.log再次303/303、零失败/跳过。首轮跨平台歌词/现代收藏1792212072221于124.460秒通过，但新增更强PCM/原曲收藏交叉断言后须另验。

关联整组1792212451041已经结束：同步238.399秒通过；全局背景96.954、EQ74.606、备份183.703、DAV79.878、ND73.157秒失败。日志/计数已保存ui-player-related-first*，附件player-related-failures。根因及未提交修正：主题跨Tab重挂载后显式重选fixture-theme；正式ND显式选fixture-user（避免另一账号同名album）；EQ转播放设置后改查settings-viewport-playback；备份restore在上方独立ScrollView，新增cloud-backup-settings测试标识并在该区域滚动，亲看预览截图确认此前误滚下方FlatList；DAV删除后核对连接数准确减一并保留无关连接，不再假定整机零账号。所有真实取色/PCM/持久化/恢复/取消/坏文件/删除断言保留，字体测试原先被删除的实际ND播放器调用已恢复。

**最新增强专项已通过**：`build/SourceUITests-1792213327138.xcresult`，126.691秒1/1、零失败/跳过。日志ui-player-identity-final-passed.log和ui-player-identity-final-counts.json；实际日志确认wave-spectrum-bars播放时存在、暂停后消失，现代收藏切经典核对原曲已收藏通过。

**五项已结束**：结果包1792213572669，字体286.201秒、主题111.350秒、EQ79.053秒、DAV76.248秒通过，备份149.421秒在第404行失败（app.scrollViews中找不到cloud-backup-settings；恢复尚未执行）。已保存ui-player-related-final-first.log/counts，4/5不冒充全通过。测试改用descendants(.any)按标识找上方设置区，保留取消/恢复/坏文件/持久化断言。

**备份修正版单项已通过**：1792214374827，226.595秒1/1零失败/跳过，日志ui-cloud-backup-final-passed.log/counts。日志确认cloud-backup-settings为Other；取消后保留新歌单、确认恢复旧快照、坏JSON不修改数据、重启确认歌单、连接清理均通过。最新303/303业务/类型通过，完整native此前通过且无native实现变更。本批共分段验证：现代PCM/原曲收藏126.691秒、同步238.399秒、字体286.201秒、主题111.350秒、EQ79.053秒、DAV76.248秒、备份226.595秒；不是全套同次运行，不代替云端/真机。

工具增补审批待用户回复：已审查忽略脚本work/tooling/prepare-python-tools.sh，只拟安装固定CMake/Ninja/pyelftools到Tools/Reverse独立venv，未执行；依据外部RULES.md:11的新安装副作用要求，详细披露已发async确认，现有应用回归继续。公开Blutter审查和IPA播放器静态E-003已记录SOLLIN_IPA_ANALYSIS；双端E-003→工作项/时间线关联已补全，严格review均通过，未声称对象图恢复。

本地最终清洁IPA、应用代码阶段提交/push与新iOS27仍待（所有上述本地专项已通过）：先验证、diff/隐私检查，提交后清洁归档和IPA摘要/正式入口隔离核验，再正常push；核对运行≤1/pending≤1，不取消运行中或重派旧版本。已有私密样本/工具索引/work/解包均在忽略目录。后续全部Sollin逆向/对齐先执行REVERSE_SKILL_WORKFLOW硬门；APK E-003只证明压缩指针布局不同，不证明对象/调用图已恢复。签名/真机/真实私人服务仍未验收。

# 2026-10-17 reverse-skill 阶段推送回执与后续验证

安装/硬门禁已正常push `c64c43bc06d516c1ce59fd159c4a1980a1e4dd04`，远端main一致；云端 `39003956417` 已运行、0pending，未完成，不算通过，也不覆盖仍未提交的播放器代码。APK PRIMARY流程新增E-003：Android3.12.2快照同hash但compressed-pointers，与IPA既有no-compressed-pointers不同，平台对象布局不能直接套用；严格review通过，原始证据/脚本留work，脱敏结论见SOLLIN_IPA_ANALYSIS。

关联UI当前运行的全局背景项96.954秒失败在返回音乐库后找blue cover tone（旧编译测试）；亲读NavidromeLibrary确认页面重挂载默认首账号，代码中现给返回路径和ND播放专项显式选择夹具账号，未降低取色/实音断言。当前其余专项继续运行，最终修正版需另复验；未把本次失败记为整组通过。根用户补充的reverse-skill硬门已落实；本批后续代码提交必须先完成测试/清洁IPA，并按新门禁给功能证据。

# 2026-10-17 本轮接续状态

已先落实用户新增 reverse-skill 硬门禁，安装和检查结果见下节与 docs/REVERSE_SKILL_WORKFLOW.md。后续 Sollin 对齐必须通过它，当前A03/A04对象/调用关系仍未完成。

接续前已有未提交播放器/列表/测试修改仍保留。本轮 `check-player-identity.log` 303/303及完整 `native-player-identity.log` 通过；`SourceUITests-1792212072221.xcresult` 的跨平台歌词/现代收藏/Sheet/手势专项124.460秒通过（零失败/跳过）。字体测试中被移除的真实播放器调用已恢复；该字体完整测试、其余受影响UI和最终本地IPA尚待本轮复验，不能因单项通过提交为全批验收。

API最新核对：dba0669/38984903551与07870a4/38988046090均已自然失败，checks/native通过，核心App失败，后续匹配/iPad/IPA跳过；当前没有运行或排队。后者核心15测试/7失败，前者15/8失败（失败断言数，未据尾部日志推导失败测试数）。job日志尾部可确认现代皮肤标题StaticText定位断言；完整诊断artifact 12086765354（542050200字节）超过连接器536870912字节下载上限，未下载成功，不能宣称完整摘要/CRC或全部根因已确认。新版本需继续收集诊断、定向修复后正常push；不得重派旧版本或冒称云端通过。

## 2026-10-17 用户新增硬门禁：reverse-skill

后续 Sollin IPA/APK 逆向分析及功能、UI、交互对齐**必须使用 reverse-skill**，先路由/PRIMARY、检查工具、校验离线 scope，再产生该批 Evidence→Finding→Path 并严格 review 后采纳；禁止绕过或以“已读”代替执行。包已克隆到 `/Users/ningli/WorkSpace/reverse-skill`，固定 `cab634bd855fc287f6e420c1f36fd1a6b9245960`，项目入口 `.agents/skills/reverse-skill-router`。开工运行 `node scripts/sollin-reverse-gate.mjs ipa|apk`，采纳前加 `--review`；功能证据须覆盖当前工作项，安装检查不能代替。安装/路由/两案例严格review已通过，高级反编译/动态工具缺口如实保留；当前不声称对象调用图或完整UI对齐完成。完整安装、命令、拒绝路径及工具结果见[强制工作流](docs/REVERSE_SKILL_WORKFLOW.md)，根 AGENTS.md 同步作为接手硬约束。IPA首要、APK互补、截图辅助、音枢特有能力、许可与隐私边界不变。

# 2026-10-17 A09 播放器身份与声波核真实性修复（当前工作批次）

用户补充 Sollin Android 参考：`/Users/ningli/WorkSpace/ReferenceProject/Sollin-60-v8a.Apk`，SHA256 `668f590753e5c9d79d6b8835f68ba702be6ce90f484d0af2bd721afd50fe4c7f`。已记录到 `docs/REFERENCE_COMPARISON.md`、`docs/SOLLIN_IPA_ANALYSIS.md`、`docs/PRODUCT_SCOPE.md`、`docs/TASK_PLAN.md` 和 `docs/IMPLEMENTATION_PLAN.md`：iOS IPA 仍是当前 iOS 对齐首要证据，Android APK 作为 UI/交互/功能及未来 Android 支持的互补静态证据，截图再次补充；本阶段只做 iOS，不以 APK 静态内容替代运行、签名、真机或真实服务验收，不复制 AOT/反编译代码/私有服务/品牌资源。

当前工作树在 `ba8bccd` 基础上有未提交代码：现代播放器把实际匹配录音与原曲收藏目标拆开；声波核频谱条要求播放中、原生 DSP 支持和完整32频带，暂停/无PCM不渲染静态环；声波核歌词区域为最多三行。UI 回归已增加现代收藏状态与暂停无频谱断言。下一步执行 `npm run check`、`npm run test:native`、定向 iOS UI/Release IPA，检查隐私和 diff 后提交并 push，再核对最新 iOS27 队列（保留运行中，仅最新 pending）。这些代码尚未代表云端、签名、真机或真实匹配服务验收。

# 2026-10-17 最新指令：云端只保留最新排队提交

当前队列回执（2026-10-17 08:48）：dba0669/38984903551运行，07870a4/38988046090为唯一pending；69f57a4/38987122647已被最新提交自动取消。07870a4本地两项设置回归与清洁SDK26.2 IPA通过，新云端仍待，取消旧运行不算通过。

用户已明确要求：保留正在运行的云端构建，取消被新提交覆盖的排队构建；本条覆盖下文所有“不取消排队/queue:max”的历史约定。`.github/workflows/ios.yml` 已改为同组 `queue: single`、`cancel-in-progress: false` 并正常push `d9317f2`。策略提交时API已核实40个旧pending取消，仅运行`38934924631`/最新排队`38983886757`，运行中未取消；以后每次push必须核对运行≤1/排队≤1。线性main的最新整套回归验累计状态，中间取消版本不算独立构建通过。38934924631实际07:39:52才启动iOS job，约7小时显示包含等待；完整成功38913246781的job实际88分钟，两组App编译/UI合计79分钟、归档3分钟，详见docs/GITHUB_ACTIONS.md。

按全部开发工作包加权的最新评估为代码约77%、整体开发/集成/真实服务/真机及交付约58%（52%–64%），不是功能项/测试/提交计数；14工作包权重及证据见docs/PROGRESS_ESTIMATE.md。取消队列本身不增加进度。

Sollin IPA优先、截图补充、保留独有能力/全部范围不变；新增功能有Sollin对应能力时先参考其实现/UI/交互，否则沿音枢风格实现。

## 2026-10-17 A08 发现页面板归属与紧凑歌曲行

发现详情的封面、歌曲文字和44点更多按钮改为同行。歌曲操作Sheet归属其发现页；从搜索打开的完整发现Modal不再把操作Sheet挂在页面外。加入歌单复用同一Sheet内的PlaylistPicker内容，取消/保存返回原详情，保留收藏身份、完整导入、已加载搜索/排序、权威队列和重复歌单条目。IPA只提供主题化Sheet名称线索，紧凑行视觉另参考补充截图；不宣称恢复Sollin私有调用图。

修复前合成公开歌单真实UI回归1792196022730于69.228秒失败（完整发现页菜单未呈现）；修复后1792196266236于81.940秒通过。303项业务/类型检查通过。独立e2e入口注入公开wire响应，正式入口和matching音频隔离保留；云端第二测试组新增此专项。最终交叉组1792196898246两项零失败/跳过通过（歌词97.353秒、发现90.423秒）；本批69f57a4已正常push并核对远端main；清洁本地SDK26.2 unsigned IPA通过，manifest dirty=false/workingTreeChanges=[]、arm64、min15.1、设备族[1,2]，正式入口隔离、ZIP CRC及二进制/摘要一致性通过。SHA256 e6a3f81f3d9f94af5e61cd4bc929ead8c79993ee58a71d8ca0f3bc5a8b1a77a0。最新iOS27 38987122647为pending，38984903551为运行中，队列保持1运行/1等待；旧38934924631自然结束失败（非取消）。本条为08:36历史回执，最新状态以A10/08:48回执为准，云端/签名/真机仍待，不以合成界面通过替代真实平台、真机或完整对齐。决策及范围边界见[0027](docs/decisions/0027-track-list-identity-and-views.md)，详细证据见[BUILD_STATUS.md](docs/BUILD_STATUS.md)。


## 2026-10-17 当前云端失败跟进

38934924631/c555d1e自然结束失败，核心14/15通过，失败为外观/主导航（不是图片项），后续匹配/iPad/IPA未执行。完整219864929字节诊断ZIP/API摘要及1758条目CRC通过；ui-catalog.log:44369和已亲看的录屏末帧确认外观页恢复在下方，而测试openSettings寻找上方background时连续向上滑6次。仅修正XCTest辅助函数按目标frame双向滚动，保留产品按页恢复位置及原可点击断言，并补失败截图/层级；本地1792197616945的外观持久化60.141秒、分组导航/草稿74.290秒2/2通过，零失败/跳过；提交07870a4ca49bc530b6ba90c1a8a676cb56f74f0b已正常push并核对远端main；archive-settings-direction-clean.log为ARCHIVE SUCCEEDED，manifest dirty=false/workingTreeChanges=[]、arm64、SDK26.2、min15.1、设备族[1,2]、unsigned，正式入口隔离、IPA摘要/ZIP CRC/二进制一致性均通过。SHA256 a0a52f5902523e18858839a4877de75ece16ab25059467fdeb6c2a222b47e6c2，副本build/local-settings-direction-07870a4。08:48 API核对：38984903551继续运行，最新38988046090为唯一pending，旧pending38987122647已自动取消；再次实证single策略，取消旧运行不算通过。新云端/签名/真机仍待。dba0669/38984903551在运行、07870a4/38988046090为唯一pending，69f57a4对应旧pending已自动取消。下一步继续跟进两运行及图片V码，推进A03/A04对象/调用图与A08/A09现有交互；新增功能继续后置，完整目标active。

## 2026-10-17 A09 Sheet呈现及图片失败诊断本地验收

Player的菜单/样式/歌词/完整选项改在同一pageSheet宿主内分别呈现，修复同级Modal争用后歌词设置不出现；样式支持从菜单返回菜单、播放器直达后返回播放器。全部歌词展开时移除底层重复偏移控件，避免AX命中两处。原生按实际asset时长有限回退并观察当前item变化；合成ND录音身份版本化，隔离旧12秒夹具缓存。图片错误采用不含原始路径的V01–V04阶段码，失败保留和安全重试有业务覆盖，仍不宣布间歇故障根因闭环。

本地：`check-sheet-final.log`303/303，`native-sheet-duration-full.log`完整通过；图片专项1792194453156为120.306秒通过，最终正式ND/五皮肤/面板/暂停定位/偏移/统计/mini重启/收藏队列专项`build/SourceUITests-1792195122896.xcresult`193.454秒1/1通过。已亲看完整歌词和四按钮mini截图。首次ND Sheet失败、首次联合重复偏移失败保留，不写成全组一次通过。iPad云端38924137682诊断完整ZIP/API摘要/CRC已验，仅图片项失败（12/13通过），未执行iPad专项/IPA；详细证据见docs/BUILD_STATUS.md。

本批已正常提交/push `dba06699fb6700876887591bed7bce1ff0506250`，远端main核对一致；`archive-sheet-routing-clean.log`成功，manifest dirty=false/workingTreeChanges=[]、arm64、SDK26.2、min15.1、设备族[1,2]、unsigned，IPA SHA256 `b575d2f218762979d985f953aa5efdb0f72bc408a783e2f2efb6bfac7d6c2171`已校验。新iOS27 `38984903551`为pending，旧策略提交`38983886757`自动取消，原`38934924631`继续运行；第二次确认single策略实际生效。云端/签名/真机仍待。下一步跟进最新运行及图片V码、继续A03–A09现有UI/交互对齐，再恢复新增功能，完整目标active。

# 2026-10-17 F33 云端 iOS27 成功与产物核验

`26830df` / `38913246781` 于北京时间 2026-10-17 06:43:30 完整成功：checks、原生检查、两组 App 测试、设备归档及上传全部通过。IPA artifact `12079596559` 已下载到忽略目录 `build/ci-38913246781`；完整 ZIP 长度 9787533 字节、CRC 和 API SHA256 `d774e909fd4885430d1de85791a2de0863c850e9dd6d244c952463c3443e8622` 一致；内部 IPA SHA256 `999b4748335faabcbaafc12c907799aae5d22c495083a9f85ca69a9da608530d` 与附带摘要一致。已核验 arm64、正式 JS 入口无测试 adapter、Xcode27.0/27A266a、iphoneos27.0、min15.1、signed=false；manifest dirty=true 唯一改动为 `M ios/Podfile.lock`。

该包设备族仍为 `[1]`，不覆盖后续原生 iPad 或近期 UI 增量。F33 自动触发、真实双设备/私人服务、签名及真机验收仍保留；旧 `38902977651` 图片导入失败根因未闭环，本次成功不等于该间歇问题已修复。iPad 批次 `38924137682` 已正常运行，后续批次继续排队；本轮未干扰其他上下文的代码和本地构建。详细证据见 `docs/BUILD_STATUS.md`。

# 2026-10-17 A08 音乐库歌曲行更多操作 Sheet

`b0139bb` 已正常提交并 push。收藏、最近播放和本地歌单歌曲行现在使用紧凑的 `ellipsis-horizontal` 更多操作入口，操作层复用 iOS `pageSheet`，以图标行提供下一首、加入队列、本地收藏/取消收藏、加入歌单、汽水/在线歌曲匹配、歌单上移/移除和历史删除；音枢原有队列、音乐库身份、匹配和失败保留边界不变。音乐库分段控件改为可查询的按钮角色并保留选中态，修复既有 UI 回归无法定位“我的歌单”的问题。

`npm run check`：302/302；`git diff --check`：通过。定向本地 UI：`build/SourceUITests-1792188928262.xcresult`，`testPlaylistSearchSortAndDuplicateRemoval` 1/1 通过，121.062 秒，覆盖歌单创建、1000 首长列表分批加载、批量搜索/排序、重复项移除和滑动删除。

清洁本地归档已成功：manifest 为 commit=`b0139bbf79bce900fb0b46dd5bd13531c4a8ec8a`、`dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`；IPA SHA256 为 `1adf6d5587bf81135ef2cbf7e86a039fb5dcc7e176e590e1e0f71e1f7ed87532`。对应 iOS 27 运行 [38975058418](https://github.com/RhsR1024/nexus-music/actions/runs/38975058418) 当前 `pending`，不能记为云端通过；签名、真机、后台/功耗和大字手势仍待验收。

下一步继续跟进 `38975058418` 终态，推进剩余 A08/A09 页面交互与真实服务/真机验收；保持 IPA 逆向证据优先，保留 LX、Navidrome、WebDAV、汽水匹配、PCM/EQ、权威队列和数据安全边界。

# 2026-10-17 A09 播放器样式 Sheet 列表化

`27d3200` 已正常提交并 push。现代播放器的六个布局选择从芯片式控件改为带图标、选中态和箭头/勾选的稳定列表行，继续使用独立样式 `pageSheet`、原有 `play-skin-*` testID、即时保存、失败保留、暂停意图和权威队列。`npm run check` 302/302；本地 `build/SourceUITests-1792185873313.xcresult` 的 `testCrossPlatformLyrics` 1/1 通过，137.929 秒，覆盖 AM、沉浸、写真、黑胶、声波核切换、样式/歌词 Sheet、暂停与定位。

文档提交后清洁归档已成功：`build/distribution/build-manifest.json` 为 commit=`5d0a0a3`、`dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`；`build/distribution/NexusMusic-unsigned.ipa` SHA256 为 `0db5818fd2a3d774b8c7cf995a61b75cfc585155ff8b687f0d3b4db9c19f69ee`。对应 iOS 27 运行 [38969653905](https://github.com/RhsR1024/nexus-music/actions/runs/38969653905) 当前 `pending`，不能记为云端通过；真机、签名、后台/功耗仍待验收。

# 2026-10-17 A09 迷你播放器上下滑手势

`3e3a731` 已正常提交并 push。迷你播放器容器现在支持上滑打开完整播放页；完整播放页顶部手柄支持下滑收起，原有点击打开、按钮顺序、队列和暂停意图保持。触摸事件使用起止位置和方向阈值，不把逐帧位置放入 React 列表更新。`npm run check` 302/302；本地 `testCrossPlatformLyrics` 1/1 通过，覆盖上滑、下滑及后续歌词/暂停/定位流程。

清洁本地归档已成功：manifest 为 commit=`3e3a731`、`dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`；IPA SHA256 为 `69dee96f8c4e462b960fb42c24f93b393470341219c4ba3afed1d2e6dee7ac4b`。对应 iOS 27 运行 [38972668259](https://github.com/RhsR1024/nexus-music/actions/runs/38972668259) 当前 `pending`，不能记为云端通过；真机、手势长时体验、签名和后台/功耗仍待验收。

# 2026-10-17 云端 38903549077 成功与 IPA 核验

`c4422bc` / `38903549077` 于北京时间05:14完整成功：checks、原生检查、两组App测试、设备归档与产物上传全部通过。IPA artifact `12076096155` 已下载到忽略目录 `build/ci-38903549077`，完整ZIP长度/CRC及API SHA256 `9212ab3dca22a2054838581ef064a3304e5005af37332dc0115d19d1bbc0fbc6` 一致；内部IPA摘要与附带sha256一致，为 `fdc0696bdab9b87f75ece602e7abb20a64f162a2c670c6e489b69f9bf0b1430f`。已检查正式JS入口无测试adapter、arm64、Xcode27.0/27A266a、iphoneos27.0、min15.1、signed=false；manifest dirty=true唯一 `ios/Podfile.lock`。该旧基线设备族仍为[1]，不算后续原生iPad验证，也不覆盖近期对齐增量或消除38902977651图片导入失败的根因缺口。F33 `38913246781` 已开始正常运行，后续功能批次保持排队；本次未修改其他上下文的播放器代码或启动冲突构建。

# 2026-10-17 A05 封面取色全局背景动态门控与清洁归档

`d47d680` 已正常提交并 push。全局封面背景在已有 `CoverThemeStore` 的封面身份/匹配录音边界上，复用 `MotionImage` 的低频平移层；只有打开“动态播放背景”、媒体已 ready、播放中且未缓冲时运动，原生/React 仍不读取 PCM 或逐帧更新列表，切歌、暂停、后台和减少动态效果会停止动画。`npm run check` 302/302；本地 `build/SourceUITests-1792185052140.xcresult` 的 `testGlobalCoverThemeChangesAcrossPages` 1/1 通过，113.112 秒，覆盖红/蓝封面切换、设置返回和音乐库路径。

`source scripts/environment.sh && npm run ios:archive` 已成功。`build/distribution/build-manifest.json` 为 commit=`d47d680`、`dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`；`build/distribution/NexusMusic-unsigned.ipa` SHA256 为 `e9f01a5e0c565223930be0b7af3415e5ef97f1f3eb7473f6c0c89dcd8b3bebc4`。对应 iOS 27 运行 [38968408649](https://github.com/RhsR1024/nexus-music/actions/runs/38968408649) 当前 `pending`，不能记为云端通过；真机、签名、后台/功耗和动态效果长时验收仍待完成。

下一步继续跟进 iOS 27 队列，推进 A09 播放器/歌词/mini 手势与 A08 列表缺口；动态背景仍按 IPA 静态线索和本地可观测行为逐步核验，不宣称已复刻 Sollin 私有 shader 或视频封面。

# 2026-10-17 A09 歌词列表事件驱动刷新与清洁归档

`8b4332a` 已正常提交并 push。`src/ui/Lyrics.tsx` 移除逐帧 `state.position` 对 `FlatList.extraData` 的依赖，仅在歌词行切换、暂停/播放、样式变化或明显 seek 时刷新列表；逐字动画仍由原生 `NexusLyrics` 处理，避免 React 列表每帧重渲染。`npm run check` 302/302；本地 `build/SourceUITests-1792184153003.xcresult` 中 `testCrossPlatformLyrics` 1/1 通过，iOS 26.3.1 模拟器，0 failures。

`source scripts/environment.sh && npm run ios:archive` 已成功。`build/distribution/build-manifest.json` 为 commit=`8b4332a`、`dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`；`build/distribution/NexusMusic-unsigned.ipa` SHA256 为 `dedc365e58dc5e6d6bd1c33f4741a06ee6424bd0f9394f6b075007cd8ada769e`。对应 iOS 27 运行 [38966241336](https://github.com/RhsR1024/nexus-music/actions/runs/38966241336) 当前 `pending`，不能记为云端通过；签名、真机、后台/功耗仍待验收。

下一步继续跟进 iOS 27 队列，并推进 A09 播放器/歌词/mini 手势与剩余 A08 缺口；保留 LX、Navidrome、WebDAV、汽水匹配、PCM/EQ、权威队列和数据安全边界。

# 2026-10-17 A09 歌词展开回归与清洁归档

`dd2a1eb` 已正常提交并 push。`npm run check` 通过（302/302），新增 `testCrossPlatformLyrics` 对完整歌词 page sheet 的展开、`收起全部歌词` 返回及歌词仍可见进行 UI 断言；本地 `build/SourceUITests-1792182510520.xcresult` 中 `testCrossPlatformLyrics` 与 `testDiscoveryAndAppearance` 共 2/2 通过，iOS 26.3.1 iPhone 15 Pro Max 模拟器，0 failures。`source scripts/environment.sh && npm run ios:archive` 成功，归档 manifest 为 dirty=false、arm64、iphoneos26.2、最低 iOS 15.1、设备族 [1,2]、signed=false；`build/distribution/NexusMusic-unsigned.ipa` SHA256 为 `11ce4fda9e4517b3058a89b920cbc9d0f0d985e1b69cbc6b335cd2d0492d2d37`。对应 iOS 27 运行 [38963298132](https://github.com/RhsR1024/nexus-music/actions/runs/38963298132) 当前 pending，不能记为云端通过；签名、真机、后台/功耗仍待验收。

下一步继续 A09 播放器/歌词/mini 对齐和剩余 A08 缺口，保持 IPA 逆向证据优先，保留音枢队列、匹配录音身份、LX/Navidrome/WebDAV、PCM/EQ 与数据安全边界。

# 2026-10-17 A09 播放器独立样式入口

现代播放器底部的“调整播放界面”现在直接打开已有“播放界面样式”`pageSheet`；“队列与播放选项”继续进入完整播放选项菜单，避免两个图标共享同一动作。`testCrossPlatformLyrics` 的本地 UI 专项 `build/SourceUITests-1792183369784.xcresult` 1/1 通过，`npm run check` 302/302。提交 `7c8075c` 已正常 push；清洁 unsigned IPA 归档成功，arm64、`iphoneos26.2`、min iOS 15.1、设备族 `[1,2]`，SHA256 `5ec7ec1f64698cb61da74a9e3403da6615f348a6838d92ce4aea297639f3c933`。对应 iOS 27 运行 [38964697049](https://github.com/RhsR1024/nexus-music/actions/runs/38964697049) 当前 pending，不能计为云端通过。

# 2026-10-17 iOS27 运行 38902977651 失败取证与本地工具链更正

`698c502` / `38902977651` 于北京时间 2026-10-17 03:48 结束失败；checks、完整 native 与核心 App 中 11/12 项通过，仅 `testVisualImagesAndPlayerBackgroundPersistence` 失败。已按 ZIP 条目 CRC/长度校验提取日志及 1705 个 xcresult 小对象，未下载完整诊断 ZIP，不宣称整体 SHA256 校验通过。`build/ci-38902977651/verified/logs/ui-catalog.log:45347` 为旧测试第716行写真文件名断言；`failure-hierarchy:112` 显示“尚未导入写真图片”，第142行明确显示“图片或设置未保存”错误。因此不只是等待控件内容的问题，系统文件复制、原生图片导入或持久化的具体失败环节仍需定位。当前测试虽已等待文件名实际更新，不能据此宣称该错误修复。后续功能批次须补准确错误证据、定向本地 UI/IPA 后重新上云，保留原断言；本次没有进入 IPA 归档或第二组测试。

本地环境再次实测：先 `source scripts/environment.sh` 后，`xcodebuild -version` 为 Xcode26.3 / 17C529，`xcrun --sdk iphoneos --show-sdk-version` 为26.2。近期“本机无完整 Xcode / 仅 Command Line Tools”描述有误；默认 xcode-select 不代表项目加载工具链后的状态。应补执行这些增量的本地 UI/IPA，不以该误判继续跳过。既有其他上下文仍在推进 UI，本次监控未修改其代码、启动冲突构建、提交或取消/重派云端队列。`38903549077` 正常运行，最新后续功能提交继续排队。

# 2026-10-17 A08 发现详情歌曲动作

发现歌单详情的已加载歌曲行补充“本地收藏/取消本地收藏”和“加入歌单”，复用音乐库身份、失败保留和 `PlaylistPicker`，保留下一首/加入队列与完整导入；不引入账号、推荐或伪音质入口。`npm run check` 302/302、`git diff --check` 通过。本机无完整 Xcode；云端运行 `38958299530`（`6fc6123`）当前 `pending`，IPA/真机待验证。

# 2026-10-17 A05 切歌后封面失败缓存隔离

`ArtworkBackdrop` 在歌曲身份变化时清空上一首的失败 URI 列表，避免一次临时图片错误污染后续同 URI 重试；既有 AbortController、实际匹配录音身份、取色/模糊/动态和无图回退不变。`npm run check` 302/302、`git diff --check` 通过。本机无完整 Xcode；云端运行 `38957768659`（`06a75bf`）当前 `pending`，真机仍待验证。

# 2026-10-17 A09 播放器内部面板改为 iOS page sheet

现代播放器的“播放选项”“播放界面样式”“歌词显示设置”三个独立面板改用共享 `SheetModal`（iOS `presentationStyle=pageSheet`），对应 Sollin IPA `_showThemedModalBottomSheet`/样式 Sheet 静态线索；音乐库、播放页和其他全屏业务 Modal 保持原行为。`npm run check` 302/302、`git diff --check` 通过。本机无完整 Xcode；云端运行 `38957174551`（`8ba901a`）当前 `pending`，IPA、真机和手势仍待验证。

# 2026-10-17 A08 音乐库长列表分批加载

音乐库正文不再永久截断前 20 首：收藏、最近播放和歌单在长列表下提供“加载更多歌曲”，每次追加 20 项，切换标签或歌单时重置；完整批量管理弹层、播放队列和失败保留逻辑不变。`npm run check` 302/302、`git diff --check` 通过；`testPlaylistSearchSortAndDuplicateRemoval` 增加长歌单入口断言。本机没有完整 Xcode；本批云端运行 `38955950405`（`21bb000`）已创建，当前 `pending`，IPA/真机待终态。

# 2026-10-17 A08 播放历史时间轴回归

`SourceSettingsTests` 现在覆盖真实 Navidrome 合成播放后返回音乐库、打开“最近播放”并断言 `history-item-0` 时间轴首行存在；`npm run check` 302/302、`git diff --check` 通过。测试提交 `47bd458` 对应云端运行 `38954944378`，当前仍为 `pending`，本机没有完整 Xcode，尚未执行本地 XCTest/IPA。

# 2026-10-17 A08 播放历史时间轴

音乐库“最近播放”现使用已有 `playedAt` 显示时间、节点和连接线，接近 Sollin 播放历史截图的时间轴结构；播放、移除、批量管理、清空历史和来源标识保持不变，并为历史行增加稳定 `history-item-*` testID。类型检查、302 项测试和 `git diff --check` 通过；新云端运行 `38954453106` 对应 `770da5e` 当前仍为 `pending`，本机没有完整 Xcode，未声称 UI/IPA 或真机通过。

# 2026-10-17 A08 音乐库快捷入口收口

移除音乐库正文中与顶部图标快捷入口重复的“搜索歌曲”和“音乐来源”文字按钮，保留顶部动作、无障碍标签和既有导航；减少小屏滚动负担并与 Sollin 紧凑入口结构一致。`npm run check` 302/302，`git diff --check` 通过。新云端运行 `38953221057` 对应 `1e3eb61` 当前仍为 `pending`。

补充本地证据：`build/SourceUITests-1792168820230.xcresult` 的全局封面主题专项 120.478 秒通过；`build/SourceUITests-1792169130948.xcresult` 的设置分组、返回、草稿和滚动专项 74.688 秒通过。这两份结果覆盖既有设置/背景代码，不覆盖本批音乐库改动，也不替代云端 iOS27 或真机验收。

# 2026-10-17 A08 音乐库随机播放入口

音乐库本地歌单、收藏和最近播放在已有“播放全部”旁新增“随机播放”，复用既有 `shuffle` 偏好和权威队列；来源身份、重复条目、收藏/匹配动作不变。`testPlaylistSearchSortAndDuplicateRemoval` 增加入口可达断言。`npm run check` 302/302、`git diff --check` 通过；新云端运行 `38952740517` 对应 `618ff68` 当前仍为 `pending`，本机无完整 Xcode，不能记为 iOS27 或真机通过。

# 2026-10-17 A09 歌词显示设置 Sheet

现代播放器“更多播放控制”菜单新增独立“歌词显示设置”入口，依据 Sollin IPA 的 `_showLyricDisplaySettingsSheet` 静态线索实现为单独 Sheet；复用现有 `FontSettings`，覆盖字体、字号、颜色、对齐、行距、模糊和逐字效果，所有写入仍走既有偏好存储与失败保留逻辑。新增 UI 回归覆盖入口、Sheet 标题和返回；歌词来源、偏移、双击定位、原生逐字绘制和播放意图不变。 `npm run check` 302/302，`git diff --check` 通过。本机仍只有 Command Line Tools，未声称本地 iOS UI/IPA 或真机通过；新云端运行 `38952134532` 对应 `d2b698f` 当前仍为 `pending`，不能记为 iOS27 通过。

# 音枢 NexusMusic 交接备忘录

## 2026-10-17 A09 播放器选项与样式 Sheet

现代播放器“更多播放控制”已按 Sollin IPA 的 `_showPlayerInterfaceStyleSheet` / `_PlayerInterfaceStyleSheet` 静态线索拆分：先进入播放选项菜单，再进入独立“播放界面样式”Sheet；队列、歌词、匹配、收藏和队列操作从“队列与播放选项”进入。经典布局仍保留直接样式选择，`play-skin-*` testID、立即持久化、实际匹配录音视觉身份、原曲队列身份和播放意图均保留。`npm run check` 302/302，`git diff --check` 通过。测试更新见 `ios/NexusMusicUITests/SourceSettingsTests.swift`。本机没有完整 Xcode，未重跑本批 UI/IPA；提交后跟踪新的 iOS27 云端运行，不把 pending 记为通过。

## 2026-10-17 A07 EQ 页面视觉层级

独立图形 EQ 页已按参考 EQ 画面的层级重排为顶部开关、前级面板、频率/增益面板、声音预设和自定义预设。新增曲线整体重置，保留原生 PCM/DSP、前级归零、频段精调、预设保存/删除和失败保留。现有 UI testID 未变，`npm run check` 302/302、`git diff --check` 通过。本机只有 Command Line Tools，未重跑本地 UI/IPA；后续新提交需跟踪 iOS27 云端终态和 IPA 校验。

前级滑杆补充 `-12 / +12` 边界标记，并保留独立无障碍名称；业务与类型检查继续为 302/302。

## 2026-10-17 A08 歌单详情刷新入口

发现歌单详情头部新增 `刷新歌单` 按钮，加载时禁用，复用既有分页取消与失败保留逻辑；不引入登录、推荐或统计伪入口。`npm run check` 302/302、`git diff --check` 通过。本机仍无完整 Xcode，提交后继续跟踪云端 iOS27 终态。

`testDiscoveryAndAppearance` 已补充刷新按钮可达、点击后继续导入的 UI 断言；本机未执行 XCTest，需以新云端运行结果为准。

## 2026-10-17 A09 mini 排序控件

迷你播放器设置的上移/下移操作改为上下箭头图标；无障碍标签、testID、边界禁用和偏好持久化不变。`npm run check` 302/302、`git diff --check` 通过。本机无完整 Xcode，云端 iOS27 仍排队。

## 2026-10-17 A08 音乐库快捷入口与分段控件

音乐库首页增加搜索、创建歌单、音乐来源三个已有能力的图标入口，并将收藏/历史/歌单切换改为选中态分段控件；UI 回归覆盖创建歌单入口。`npm run check` 302/302、`git diff --check` 通过。本机无完整 Xcode，提交后继续跟踪云端 iOS27。

## 2026-10-17 A06 外观选择行视觉收口

主题、背景和播放界面样式选择改为纵向设置行与选中图标，更接近 Sollin 外观页；既有选项、图片导入禁用门槛、即时保存、错误恢复和 testID 均保留。`npm run check` 302/302、`git diff --check` 通过。本机仍无完整 Xcode，云端 iOS27 运行继续排队。

## 2026-10-17 优先补充完成的执行清单

最新权威清单为[SOLLIN_ALIGNMENT_PLAN.md](docs/SOLLIN_ALIGNMENT_PLAN.md)，逐页映射见[SOLLIN_UI_ALIGNMENT.md](docs/SOLLIN_UI_ALIGNMENT.md)。用户要求先补齐文档，再开始对齐；后续执行严格按以下优先级：

- [x] 固定证据顺序：**IPA逆向信息优先，补充截图与已有九图辅助**；区分字符串/类型名、对象引用/调用、动态运行，不将截图或静态共存当实际调用关系。
- [x] 保留全部项目特有能力；先对齐已有UI/交互/音乐核心功能，再推进其他尚未实现的能力，不删原F/J总范围。
- [x] QQ补充图片复制、按画面命名并校验；69张中剔除1张非Sollin的Apple ID/签名验证图，项目最终保留**68张/35组**于`resources/sollin-reference/screenshots/`，本机INDEX和manifest，忽略Git/产品打包；原来源不改。
- [ ] 继续IPA设置分类→二级页/Sheet、样式枚举、歌词/音乐核心对象引用与调用关系分析；已知Dart3.12.2/snapshot及Category/Sheet名称只是阶段证据。
- [ ] **优先逆向并移植封面驱动软件背景**：封面主体色/模糊/静止或动态层/作用页面/切歌更新。现有固定全局渐变与仅播放页取色不足以勾完成。
- [ ] 对齐已有设置、外观/背景、EQ、发现/详情、音乐库/历史、播放器/歌词/mini/导航，逐项验证选择/取消/返回/手势/错误/持久化，不新增伪入口。
- [ ] 背景专项覆盖不同封面切歌、迟到图隔离、匹配录音、无图/错误回退、明暗可读性、减少动态效果/后台与重启；截图、本地IPA和对应云端分别验收。

## 2026-10-17 独立图形均衡器设置页增量

按 Sollin 的设置分组继续收口：新增 `图形均衡器` 二级页，保留原有原生 PCM/EQ、前级、10 段曲线、七个内置预设和自定义预设持久化；`播放与歌词` 只保留音质偏好、音量、睡眠与歌词入口。`testGraphicalEQPresetPersistence` 已切换到新页面并继续覆盖拖动、重启、删除预设及睡眠定时；`npm run check` 为 302/302，`git diff --check` 通过。

本轮机器没有完整 Xcode，`xcode-select` 指向 Command Line Tools，未能重新生成本地 iOS UI result bundle 或 unsigned IPA；上一批 `7cad8e8` 归档不代表本轮代码。提交后跟踪新的 iOS 27 云端运行，成功后再补齐云端 IPA/manifest 摘要。真机、签名、后台和动态背景边界保持不变。

本批已普通提交并推送 `7684701`；新的云端运行 [38939941769](https://github.com/RhsR1024/nexus-music/actions/runs/38939941769) 当前 `pending`，旧运行 `38937690077` 保持排队，不取消、不重复派发。

播放器对齐增量：修正现代播放器在跨平台匹配后仍显示原始队列封面的不一致。现代播放器现在接收实际匹配录音，与背景、歌词和系统媒体身份一致；收藏、评论、队列和匹配记录继续使用原曲身份。`npm run check` 302/302 通过，本机因缺少完整 Xcode 未重跑 UI/IPA；提交后需跟踪新的 iOS27 云端运行。

随后清理外观总览中的“软件图标”静态伪入口；该项没有可用设置或验证路径，已移除以保持入口与实际能力一致。`npm run check` 仍为 302/302。

外观入口继续收口：主题与背景页现在统一呈现“渐变 / 纯色 / 图片”三种背景类型；没有已导入主题图片时“图片”明确禁用并提示导入，导入后可在同一层选择，图片管理区不再重复放置选择按钮。`npm run check` 302/302；本机缺少完整 Xcode，UI/IPA仍待云端和后续本地环境复验。

对应 `SourceSettingsTests` 已补充未导入图片时 `background-image` 必须禁用的断言；云端 iOS27 执行后再记为 UI 通过。

独立 EQ 拆分后的音质按钮已恢复原有保存失败提示：偏好写入失败时保留旧值并显示可重试状态。类型检查与 302 项业务测试通过，播放器/EQ 数据模型未变化。

本阶段基础代码已推送 `49132b7`；随后发现并修正设置二级页再次点击设置Tab不会回首页的交互回归。修复通过本地 `testGroupedSettingsNavigationAndDrafts`（iOS26.3.1模拟器，约1792170000时间戳），并保留未提交 EQ 草稿。新的普通增量提交需重新生成清洁本地 IPA并触发云端 iOS27；不得把 `49132b7` 的旧排队结果当作修复结果。302 项业务/类型检查、分组设置 UI、全局封面主题 UI 与本地 arm64 unsigned 归档均通过；封面实现边界是原创静态主体色渐变+低透明模糊层，未宣称 Sollin 动态 shader/视频封面等效。下载管理、动态/视频背景、真机和减少动态效果/功耗仍待验收。先完成本节文档一致性与提交，再按A02–A09推进IPA优先对齐；不抢先做自动同步等新增功能。

## 2026-10-16 顺序调整记录（以2026-10-17清单为准）

证据优先级：先从固定IPA逆向提取UI/交互/设置与音乐核心结构，截图仅补充逆向暂不能确认的视觉信息；不以截图反推包内完整枚举或调用关系。

用户最新明确要求：先把音枢已有功能的页面、层级、控件、弹窗、手势和状态反馈对齐固定Sollin iOS IPA及九张截图，保留音枢特有的LX多源/质量路由、Navidrome、WebDAV、汽水匹配、来源诊断、真实PCM/EQ与数据安全边界；完成已有功能对齐后，再扩展音枢其他待实现能力。自动同步、平台登录推荐/FM、最后下载等未实现项仍在总范围；识曲已按2026-10-18最新决定排除，暂不抢在现有界面对齐之前新增。

当前执行顺序以2026-10-17清单为准：先深入IPA与封面驱动全局背景，继而设置/外观/EQ/发现详情/播放器歌词mini与导航对齐，专项验收后再继续剩余功能。实际皮肤枚举按IPA进一步核实，不固定为早期五皮肤。按页面维护截图/操作/前后状态/错误恢复证据；IPA静态字符串不当作动态运行或精确动画依据。每批仍验证、检查diff/隐私、提交push并跟进本地SDK26.2与云端iOS27；手机/签名/真实私人服务单独验收。

更新日期：2026-10-17，Asia/Shanghai。此文件是后续开发的基础上下文，接手者应完整阅读。

## 2026-10-16 Sollin IPA 参考范围变更（当前最新边界）

用户提供并固定参考包 `/Users/ningli/WorkSpace/ReferenceProject/Sollin-2.0.0 60-unsigned.ipa`（SHA256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`）。移动端 UI、交互、页面层级、弹窗、手势、错误反馈和设置组织按该包复核；固定证据见[IPA静态分析](docs/SOLLIN_IPA_ANALYSIS.md)，范围决策见[0033](docs/decisions/0033-sollin-mobile-scope.md)。参考包是行为规格，不是可复制的 Flutter AOT、私有服务、品牌资源或第三方资产来源。

四组设置现在是完整对齐重点：**播放与歌词、外观与界面、下载管理、数据与存储**。它们必须分别记录代码、自动测试、模拟器、真实平台和真机证据，并与音枢已有 LX 多源择源、Navidrome/Subsonic、WebDAV、汽水公开歌单匹配、漫途一次迁移、来源诊断、PCM/EQ、系统 Now Playing/灵动岛和数据安全边界合并。

明确不移植 Sollin 自有注册/登录、用户中心、设备管理、账号资料、后台会话及其 API；赞助、付费解锁、订阅门槛和商业权益；免责声明、服务与支持、QQ群/GitHub入口和自推广帮助；遥测、行为分析、诊断上传及未授权回传。这些排除项不计入开发进度分母，也不得复制到音枢下载、同步或备份流程。

网易云、QQ 音乐、酷狗等音乐平台自身账号登录仍保留为 provider 能力，用于平台实际支持的个人歌单、收藏、推荐、FM、云盘或受限播放。平台登录和音枢自身数据完全分离，凭据只进 Keychain，不进入备份、同步、日志或诊断；“登录成功”不等于“歌单同步完成”。后续接手者不得新增音枢自有账号体系。

## 当前任务与成果

当前持续目标仍为F01–F37/J01–J59全部并集及本地/云端双构建。最新已提交/push `678a5ef`：主App设备族1,2、所有Modal四方向、发现按内容列宽度排版；296项业务/类型、实际iPad窄窗口→宽屏侧栏/横竖屏/弹窗旋转与手机DAV播放通过。清洁本地IPA通过，SHA256 `f3c02028e0e3aaa5307ad43f2092b29a1f0114ee91d18a110890f4c789e9c286`；云端[38924137682](https://github.com/RhsR1024/nexus-music/actions/runs/38924137682)为pending。包保留build/local-ipad-678a5ef。Sollin IPA固定hash、四组设置和账号/商业排除文档也已随该批入库。

F32云备份 `a0ee5bb`/[38894434005](https://github.com/RhsR1024/nexus-music/actions/runs/38894434005)已全部成功；云端IPA实际下载/ZIP API digest、CRC、内部摘要和正式入口隔离通过，IPA SHA256 `9028c67e56d992fdc01710c0d19d446ad1edd4b0e7b8fb4da499ea107461c020`。Xcode27/iOS27/arm64/unsigned，dirty=true唯一Podfile.lock；旧设备族[1]不能用作新iPad证据。字体/图片/mini修复云端亦已通过且IPA校验。7c12023/38899071423当前核心App运行中，dc3bb66/38902069374、26830df/38913246781及后续正常排队，不取消/重复派发。

当前工作区继续按Sollin移动设置组织补齐设置首页、播放与歌词/外观与界面/数据与存储及独立音乐来源页，字体共用叶页；首次访问后保留草稿/滚动、隐藏页不进无障碍树，音乐库来源入口返回原上下文。音乐库与数据设置提取共用导入/恢复组件。296项业务/类型通过；首次UI暴露返回偏移46点，已补显式恢复并在第二轮90秒专项通过；EQ专项已按真实viewport修正可见区判断并在107.661秒专项通过；最终整批外观重排仍待复验。该批尚未提交/归档/云端，不提前计完整通过。决策0034记录五参考和维护边界。

工作量估算沿docs/PROGRESS_ESTIMATE.md约75%代码/57%整体，待本批验证后再核算。未完成仍包含F33自动触发及真实双设备、iPad分屏/键盘/大字/无障碍、平台登录推荐/FM/识曲、完整在线实体、真实TTML/深度视觉、S9下载及漫途/汽水完整导入实音、个人服务/签名/手机后台与灵动岛。本机仅Xcode26.3/SDK26.2，云端独立iOS27；尚无用户真机验收。

用户希望先确定功能清单、技术框架和实现边界，之后在自己的 MBP 上开发。初期形成交接文档；用户于2026-10-14明确要求列出详细任务计划并开始实施，现推进工程基线与领域模块。

远程仓库为 `https://github.com/RhsR1024/nexus-music.git`。本轮在 Windows 上将原本空的远程仓库克隆到 `Z:\Z-WorkSpace\NexusMusic`。Z 盘是网络映射盘，后续 Mac 建议在本机 SSD 单独克隆仓库，不在 SMB 共享目录中共用 node_modules、Pods、DerivedData 或同一套 Git 工作树。

开始实施前仅有文档；当前实施清单见 [TASK_PLAN.md](docs/TASK_PLAN.md)，实际构建与测试以记录为准，尚无真实服务/真机验收。任何文档中的能力描述都必须区分：源码可见、协议支持、建议实现、真机已验证。目前最后一项尚未完成。

## 初期确认的决定（历史基线，最新并集变更优先）

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
- 系统灵动岛媒体面板已于2026-10-16明确纳入F37/J59；独立小组件、自定义Live Activity和画中画歌词仍需分别核验，见最新决策0026。
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

## 真实LX与当前云端接续

真实LX App纵向测试已通过：build/SourceUITests-1792045322336.xcresult，实际导入本机脚本、网易搜索→解析→解码→PCM→暂停→删除。原测试失败暴露外层ScrollView吞键盘首击，已加keyboardShouldPersistTaps和显式收键盘。真实音源仅localhost可选探针读取，不提交也不上云。Native格式测试已覆盖WAV/AAC/16-bit FLAC/24-bit FLAC、定位、PCM/FFT、自然结束与无网络缓存；新增封面缩略图/配额/代次、KRC/gzip字节检查。当前97项TS测试通过。

云端99d3487运行 https://github.com/RhsR1024/nexus-music/actions/runs/38691008776 已失败：Linux、原生检查和Release模拟器编译通过，启动时iOS27因缺少UIScene生命周期终止App，两个UI测试失败，尚未进入IPA归档。诊断产物11953711775的xcresult已下载导出到忽略的build目录，标准错误明确为`UIScene life cycle is required for apps built with this SDK`。现维护AppDelegate.swift内单场景适配与Info.plist声明，窗口改由场景创建，保留同一React surface及链接/前后台转发；本地/云端复验分别记录到GITHUB_ACTIONS。之前bae412f因CFPropertyList3.0.9 Ruby上限失败，34cdbeb修复为3.0.8；随后Yoga动态podspec checksum不同，99d3487只放行已识别两种Yoga checksum，其余Pod锁变化仍失败。复验运行期间不要推送无关功能取消构建。用户已选择稍后连接手机。

新功能：封面缓存和Player/Navidrome专辑展示；音乐库虚拟列表/批量操作、LX v2 JSON/LXMC预览原子追加；源指纹快照固定防更新竞态；恢复只隔离格式错误，IO/原生故障不移动数据；MG榜单/艺术家和MRC字段修复。主功能仍需收尾QRC网络密文、KG分类/分类筛选及长列表，随后进入M10漫途迁移/离线下载。不得把原生PCM或云端编译代替手机锁屏十首、真实Navidrome账号和签名验收。

云端2e7da07运行38695984346已全部成功，iOS27 App界面/播放测试和设备IPA归档上传通过，UIScene启动崩溃已修复。用户要求消除upload-artifact的Node20弃用警告：两处上传Action改为官方v7.0.2固定SHA，原生node24；项目Node24不变。后续检查新运行的上传日志，不能仅因旧运行成功就声称升级后的Action已验收。工作树QRC/分类收尾已通过101项TS、33项原生utility及完整native检查；TX真实网络取得17行/82个字时间，KW专区/普通标签及MG分类分别返回17/30/30项，尚未随此环境修复提交。

最新范围变更：用户确认“加入汽水歌单导入，播放使用其他平台匹配”。覆盖此前首版排除汽水专用导入的决定；仍不接汽水账号/直接音频播放。F13/M6支持漫途同样的网易/QQ/汽水三平台，另保留现有KW/KG/MG；汽水原始ID/元数据必须保留，匹配不可靠显示待匹配，不擅自换同名曲。漫途备份内38条汽水也需保留并复用匹配流程。迁移初稿当前3歌单支持数1187/0/1209、4收藏，仍跳过38条，不能宣称迁移完整。105项TS检查通过，UI与汽水链路待验。8ed1393为本地功能阶段提交，暂未push以免取消2b78e43的Node24复验（运行38700544730）。

Node24复验38700544730已全成功：IPA11957042787与诊断11957302431由v7.0.2上传，日志无Node20弃用警告，可以继续正常阶段push。最新本地UI `build/SourceUITests-1792051658997.xcresult`通过漫途文件选择/取消及Navidrome播放回归；未实际选择私人备份导入。功能状态清单见FEATURE_STATUS，包含新增汽水与待实现持久离线。已补取漫途歌词显示类Java/权威Smali及导入源码，本机来源和结论见WAYFARER_LYRICS_REFERENCE：自定义Canvas/TextPaint/ValueAnimator，两条歌词绘制路径；不能把现有透明度动画说成已等价复现累计扫色/字强调。下一步：汽水身份/公开导入/匹配接入、漫途完整验收、持久离线；仍保留真机/真实Navidrome待用户外部输入。

汽水链路新进度：imported/qishui独立身份、官方公开接口完整分页/短链、预览追加、严格自动候选/人工MatchModal、音乐库匹配记录与备份、跨平台全局质量优先/目标隔离routeKey、目标歌词接入完成。原始队列身份不替换，不接汽水直接播放。真实接口读取38首；一首真实原曲搜索36候选、1可靠WY、无失败平台。漫途实际样本现在1187/38/1209、4收藏、unsupported0，不再跳过汽水；私人样本/原曲信息仍不入Git。115项TS检查通过；本地UI `build/SourceUITests-1792053290760.xcresult`通过汽水导入入口/空输入/关闭及Navidrome播放回归；不等于实际App导入/匹配实音已通过。新增Player/私人曲库本地收藏与歌单入口、长列表最多50项显示分页。40cc6a6（含8ed1393）已push，云端运行38704334418仍跟踪中，首次新原生封面/QRC验证不要随意取消。下一步重点持久离线/下载管理及完整导入、匹配/字体UI与逐字视觉验收；见FEATURE_STATUS和决策0011。


## 2026-10-15 SollinPlayer iOS 对齐范围更新

用户要求以 SollinPlayer 移动版 v2 为 UI 和功能对齐目标，提供九张截图（含补充 AM 风格）及功能清单，与音枢既有能力取并集。条目、状态、证据与实施顺序见 [Sollin iOS 对比](docs/SOLLIN_IOS_COMPARISON.md)。本次为对比/范围整理，未将新增功能标记为完成。

新增总目标包含设备媒体库/文件音频导入与本地曲库、WebDAV、经典/新拟态/粉粉主题、五种播放器皮肤、主题背景/强调色/字体完整设置、EQ曲线/独立前级/自定义预设、睡眠定时器；推荐/平台登录/评论、TTML与跨平台歌词、动态封面、云备份/同步、统计/识曲、iPad布局列入对齐扩展目标并逐项核验。此前本地文件管理、评论及持续同步的排除不再代表最终总范围。保留原有五平台、多LX优先级/同档跨源降档、汽水匹配、漫途迁移、真实频谱、Navidrome服务端编辑、本地/云端IPA。永久离线下载仍按已有安排最后完成。

九页为发现、歌单详情、EQ、写真歌词、封面沉浸、黑胶唱机、AM风格、声波核、外观设置。截图灵动岛不直接证明独立Live Activities，投屏入口不直接证明所有协议；不将桌面/Android专属能力混作iOS已证实能力。CarPlay/ECARX/Android正式版/SMB/商店发布没有因此自动新增。


2026-10-15：已拉取 Sollin-Music-Desktop 到本机 ReferenceProject，固定 c9d446f6ad3b7ea1aff64bd5ce290b6e7f9712a8。桌面 AMLL/TTML/背景/WebDAV 证据及 MIT/第三方边界见 REFERENCE_COMPARISON；不证明 iOS 同实现，不移植其全列表 30Hz 更新。增量任务已细分 S0–S9（TASK_PLAN，对应并集 J01–J58），S1 开始主题、一级发现页、悬浮导航与 mini 基础。旧本地文件/评论/同步排除已被本次并集目标覆盖；仍区分目标与已验收。


详细范围现在为 F01–F36，新增 F23本地/媒体库、F24 WebDAV、F25主题、F26九页五皮肤、F27深度歌词、F28图形EQ、F29定时、F30登录推荐、F31评论、F32云备份、F33同步、F34统计识曲、F35平板、F36匹配与诊断；不是只追加一句“参考外观”。任务已按S0–S9映射58项。S1实测发现ExpoBlur长期未完成animator导致自动化空闲超时，已移除并改原创静态NexusMaterialView；公开网易CDN旧HTTP按精确域名升级HTTPS，私人地址不改，详见决策0012。


### S1 本地验收完成与 S2 初稿

120 项 TS 测试及类型检查通过，包含设置迁移/失败原子性、CDN HTTPS精确匹配、封面4并发/64等待上限/取消和清理失效。新增静态 NexusMaterialView 已通过 Release 编译与交互；实际测试无之前每次60秒动画空闲问题。

- build/SourceUITests-1792063450926.xcresult：外观选择/重启持久化/一级导航、发现完整歌单读取确认、Navidrome合成服务实际播放/PCM/歌词/暂停/移除凭据，3项通过。
- build/SourceUITests-1792063716396.xcresult：封面排队改动后Navidrome合成播放回归通过。
- build/SourceUITests-1792063866709.xcresult：音源导入/启停删与汽水导入入口，2项通过。

S1 原生模糊/渐变、安全区域、语义色/强调色、悬浮导航/封面mini基础已实现；S2新增发现双列封面卡、平台/分段、歌单封面与计数/简介展开/随机已加载入口。尚未实现完整日推登录、全套详情操作、取色和五播放皮肤。截图仅为本地模拟器；真实ND账号/真机签名与后台仍待验。后续云端新提交单独跟踪。

S1已提交并push：2cb91a6605b0bf37704c007633d9bdbb8c5d5947。云端38728228483：Linux通过，iOS检查运行中；不要新push取消首次静态材质/渐变/SafeArea依赖验证。S3在本地继续：ModernPlayer/PlayerVisuals新增AM、沉浸、写真封面背景、黑胶和真实FFT声波核，保留经典；只改Preferences.playerLayout，不建第二播放器。120项TS通过。最终UI build/SourceUITests-1792065306216.xcresult：ND合成实音/PCM/歌词→暂停→五皮肤切换、AM进度拖动且仍暂停、按钮首屏可达→回经典→删凭据全部通过；已看截图并修复控件超屏/状态栏对比。照片目前来自歌曲封面，没有独立写真库/图片导入；无完整扫色/字强调/TTML、动态取色或真机性能验收。决策0013记录边界，不能写成已经全功能/视觉完全对齐。

S3已本地提交b7d7226b89869efbf90e49a29da5314025965e6a，并成功生成arm64/SDK26.2未签名IPA，manifest dirty=false，产物在build/distribution，SHA见BUILD_STATUS。为允许阶段push且保留S1云端证据，工作流按官方当前文档改为cancel-in-progress:false + queue:max，新阶段排队而非打断当前运行；未声称云端新包成功。

重要云端纠正：S1 38728228483失败，外观与ND合成实音两个测试通过，仅SourceManager失败；不是编译/通用播放故障。已下载11971211239，ui-catalog.log68351源启用按钮缺失，点击导入的hit point{-1,-1}，失败AX显示误进tab-library。实际是iPhone17较小视口的源导入按钮被浮动底栏遮挡，尾部大padding不足以约束ScrollView可见区域。当前工作树按chrome实际高度/安全区缩小滚动视口，并加导入后仍在设置tab断言；新建本地iPhone17模拟器CACFEADC-4D00-4BBF-AD37-503CDD1BE24A（iOS26.3.1）复验。原iPhone15ProMax测试模拟器暂时shutdown以节约Intel16GB内存。4db78c4已push，运行38732185670已启动，包含旧布局，不能称修复已上云。S3功能和本地IPA提交b7d7226已在远端。

紧凑视口复验已通过：新iPhone17模拟器源导入/启停删69.151秒，ND合成实音/PCM/歌词/暂停、AM拖动/五皮肤控制可达85.659秒，全部成功；120项TS通过。内容区实测chrome高度约束修复待随本批提交上云；旧基线云端成功不能替代新修复验收。九张截图本地持久保存在resource/reference-ui/sollin-v2（忽略Git），不作为打包资产。

最终本批状态：d96ea74d8e4d67c3de8426a7fa0af0613adaae5d 已正常push（无force）。紧凑视口最终证据 build/SourceUITests-1792066875571.xcresult 两项通过。修复版本地IPA再次成功，build/distribution/build-manifest.json记录d96ea74/dirty=false/arm64/iphoneos26.2/signed=false；SHA256 bd6ce7b6903915fbab041c52c2c75d64587156cfcb1d656add65ecef83615afe。修复云端运行38735111951已创建，当前pending；前面的4db78c4运行38732185670仍可能重现已知旧遮挡，不把它作为d96修复结果。两个本地项目测试模拟器均已shutdown节约Intel内存，UDID保留可再boot。

## S4/S5 增量接续（2026-10-15）

当前工作树已补图形EQ/精调/独立前级±12/七内置与命名预设，原生睡眠时长/本曲后停/App音量，TTML有界时间/背景声子集与原生TextKit累计裁切/字光晕，单曲偏移与全局叠加/双击/对齐。新模块NexusLyricsModule，已更新expo-module.config并pod install；无新增npm依赖。原生绘制不逐帧React，字体从既有App导入沙箱读取。130项TS通过，native完整套件及真正AVPlayer到点/本曲结束暂停通过。build/SourceUITests-1792070370380.xcresult：EQ实际增益改变/预设重启/删除/睡眠取消和ND合成实音/PCM/原生歌词/五皮肤通过。测试曾把半露出的curve坐标拖到底栏，已要求整个控件在视口内并断言增益改变，不以第一次“可点”成功代替拖动证据。决策0014/0015记录参考/范围；后续歌词最终改动另复验。S4候选/深度样式/真实TTML和字体、S6–S9仍未完成，不把新代码当作所有计划落地；手机和真实ND仍保留外部验收。云端d96运行38735111951目前仍在App测试阶段，不能提前标成功。

本批最终本地验收：build/SourceUITests-1792070741768.xcresult 110.910秒通过实音/PCM/五皮肤/逐字及单曲偏移重置/双击仍暂停；build/SourceUITests-1792071034072.xcresult 145.144秒通过曲线实际增益/预设重启删除/定时开启取消。已看原生逐字部分填色截图。130项TS及native-sleep-final全通过。CI已增加EQ/睡眠UI测试；d96ea74云端App步骤已通过，当前归档，不是本批新模块云端通过。

## 2026-10-16 持续目标与 S6 进行中

用户明确持续目标为“完成所有任务计划中的功能并集实现和测试调试，并通过本地和云端编译打包”，目标保持 active。不是仅完成S4/S5；S6设备媒体库/WebDAV、S7、S8、S9以及S4深度样式/候选、S2/S3视觉收尾、真机/真实ND验收均保留。

S4/S5已提交push bdb8018e85098026d920ca9ba5f636885035fc1a，本地IPA arm64/SDK26.2/dirty=false/signed=false通过，SHA256 8a799140bd5f59730f692975edc98c4ccd3cd7356da81954566be4c2825f4c0b。旧d96云端38735111951最终成功，包含App UI和iOS27设备IPA。新bdb运行38744057327在native-utilities子进程status=null失败，未进入App编译；d643cb6把工具CLI改Release优化/90秒有界预算/逐项耗时及进程错误诊断，下一运行38768357550已通过33项utility、JSC/lifecycle，随后ARM DSP测试finite==original失败。8a2e572仅将“启用平直滤波”的数值断言改为1e-6/1e-5误差界限，关闭EQ逐样本位同一性仍严格断言，已push待新云端；不能把新阶段标云端通过。

S6当前工作树：独立local来源/SHA256内容身份、LocalAudioStore原子批量导入、原创LocalAudioFiles/NexusFilesModule、原生标签/封面/内嵌歌词、App本地歌曲/专辑/艺术家/搜索/收藏歌单队列入口、原生在播文件保护。删除采用.pending-delete日志/暂存与SQLite提交、启动reconcile恢复；不导出绝对容器地址。135项TS及native格式检查通过，合成自制MP3已实际解码/PCM与提取ID3标题/艺术家/专辑/歌词/封面；WAV/M4A/AAC/AIFF/16和24FLAC也验证。测试脚本scripts/fixtures/silent-mp3.mjs为原创合成静音，无私人录音。设备媒体库/WebDAV尚未实现。

本地文件App真实导入UI还在复验。首次build/SourceUITests-1792081703955.xcresult因FilesProvider首次就绪较慢，3秒Browse存在判断跳过，停在Recents；已改等待系统Browse页签20秒并按实际AX定位。新一轮正在运行，不能将原生CLI成功当作App完整导入已验。随后发现Xcode默认克隆测试设备导致预放文件与实际UI不在同一设备；现test-ui关闭parallel testing，监测测试启动后在指定模拟器Files的group.com.apple.FileProvider.LocalStorage/File Provider Storage/Nexus UITest Fixtures放合成MP3，使用真实系统选择器，结束清理。UIFileSharing/LSSupportsOpeningDocumentsInPlace已撤回，避免将原有Documents/SQLite显示到文件App；生产没有夹具导入后门。

S6文件音频最终本批：137项TS检查通过（check-local-audio-final.log），包含缺失文件重新导入保留恢复副本和备份不带file://路径。native-local-journal.log全套通过。build/SourceUITests-1792082588688.xcresult：文件真实导入/重启再播放/在用拒删/移除当前队列后删除61.161秒，ND回归99.008秒通过；build/SourceUITests-1792082899195.xcresult再加专辑封面网格/艺术家分组67.575秒通过。未引入UIFileSharing。CI增加testYLocalAudioFileImport并关闭克隆，Files夹具是真实系统目录的合成数据、无生产后门。将本批提交push后生成本地IPA、跟踪云端新模块；不要将旧8a2e运行误认为S6云端结果。后续先设备媒体库/WebDAV，再继续全部未完成S2/S3/S4/S7/S8/S9，保持完整目标active。

文件音频阶段已提交并正常push c798ab4657e37d88347db322dcb6dfa4f6719b24。随后本地build/logs/archive-local-audio.log归档成功，manifest commit=c798ab4/dirty=false/arm64/iphoneos26.2/signed=false；IPA SHA256 22885744c59b72cbe960f4d7bd8d1d7a5c2284ed59a1d85b24ffc9f932cf29a7。云端S6运行38772611477创建并pending；前一8a2e运行38769479789已过native、在App UI步骤，不是S6结果。当前没有存量独立开发阻碍，下一步设备媒体库授权/独立身份/原生播放和WebDAV，继续完整目标，不要求用户再次说继续。

## S6 设备媒体库增量（2026-10-16）

已接入原创 MediaPlayer 原生模块、用户主动授权、歌曲/专辑/艺术家与分页搜索、内嵌歌词和共享封面缓存。device来源使用本机namespace + UInt64字符串ID + 元数据签名，播放时重新查询并检查授权/DRM/云端未下载；assetURL不进入曲库备份。权限撤销清空浏览并停止当前设备来源播放，失效引用显示可操作提示，仍使用同一队列/AVPlayer。参考与Android替代边界见[决策0017](docs/decisions/0017-device-media-library.md)。

145项TS/类型检查（build/logs/check-device-media.log）和native-device-media.log全套通过，覆盖长ID、跨设备碰撞、快照分页/迟到结果/权限变化、备份无URI及未授权ipod-library拒绝。Release build/SourceUITests-1792084293006.xcresult：真实权限拒绝界面16.053秒、ND合成实音/PCM/原生歌词/五皮肤96.506秒均通过，已查看截图。模拟器没有真实音乐库，设备歌曲/后台播放尚待手机，不将授权测试等同媒体库实音。

云端8a2e运行38769479789的native检查通过，App中ND播放通过、源管理失败；下载诊断11993526333，ui-catalog.log67209定位系统Files首启空白容器未出现取消按钮。测试改为中英文合并30秒有界等待，不跳过断言。c798文件阶段运行38772611477另在运行，不能以旧失败作为新阶段结论。S6 WebDAV仍待实施；全范围S2/S3/S4/S7/S8/S9和真机/真实ND验收继续，目标保持active。

音源选择器等待修订本地复验：build/SourceUITests-1792084866977.xcresult源管理实际Files打开/取消→URL导入→启停→删除56.553秒通过；最终check-device-media-final.log为145/145，无失败/跳过。新授权测试已加入CI，云端尚待新提交实际运行。

设备媒体库阶段已正常push ff84cc47183f9652994c657e4134498cd9a31258。本地archive-device-media.log归档成功；manifest commit=ff84cc4/dirty=false/arm64/iphoneos26.2/signed=false，IPA SHA256 861dfc6a95bf5c1fa17958107327ab490aca0c99e5db1ec6fa7c0d167e388ab8。新云端运行38776957927 pending，文件阶段38772611477 native通过/仍在App测试；不将其提前写为云端成功。

## S6 WebDAV 连接/协议基础（2026-10-16，未接App播放）

原创webdav.ts已实现根目录路径规范化/同源限制、DAV命名空间和成功propstat解析、Depth1目录及Depth0文件探测；webdavAccounts.ts提供多账号/Keychain隔离、验证后保存与写失败回滚。TTML的有界XML抽到formats/xml.ts，保留全部原TTML测试。原生DAVHTTP提供真实Basic/PROPFIND、2MiB响应预算、目录内重定向/5次上限、越界阻断/取消；已通过Mac合成HTTP实际请求及iOS15.1 simulator SDK类型检查。154项TS/类型检查通过（check-webdav-final.log），native-webdav-http-run.log原生HTTP通过。

参考与RFC决策见docs/decisions/0018-webdav.md。这是连接和协议基础，尚未接入Expo桥、App目录UI、webdav Track来源、受限音频Range Loader或远程AVFoundation元数据；不能写成WebDAV播放完成。下一批优先这些剩余，再验证App合成服务器播放/缓存/移除账号，随后继续S2/S3/S4/S7/S8/S9等全部未完成目标，goal保持active。

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

补充竞态修正：人工取消自动匹配记录也必须废弃已加载媒体；此前只对manual记录变化监听会使自动记录清除后仍resume旧URL。已将明确删除记录纳入失效条件（自动成功发布仍不取消自身），新增游标保留回归，179项检查通过，并扩展App自动记录取消→重新自动匹配的验收。

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

## S7 源健康、网易评论与临时图标本批证据

2ff7557已正常push，198项TS/类型检查与完整native套件通过。源健康使用独立诊断宿主，最多32源/2并发，按源/平台/质量报告；原生有界Range仅读取最多4096字节媒体头，不冒充实际解码。网易公开评论支持原曲身份、热门/普通分页、刷新/重试/取消，其他平台保留待做。参考与边界见决策0020/0021。

本地build/SourceUITests-1792120970586.xcresult：匹配200.115秒、评论18.848秒、源健康83.213秒通过。正式入口图标9.080秒、ND99.670秒通过。临时图标来自自有漫途8e47cdc的ic_launcher.png，适配1024方形RGB无alpha并同步Expo/原生Asset，见决策0022。清洁本地archive-icon-clean.log归档成功，manifest commit=2ff7557/dirty=false/arm64/iphoneos26.2/signed=false，IPA SHA256 00b7b273523118c4dba133e59cd1f01b70a85b3ecfdb64e72602924e5dab836f。新云端结果另行核对。

## Git 作者与旧备份清理（2026-10-16）

新身份阶段2ff7557已push并核对远端main哈希一致；清洁本地归档通过。再次逐条比较原32提交的tree、提交说明、作者/提交者时间与父子映射一致，仅作者身份更新。已删除refs/backup/before-author-rewrite、refs/author-rewrite/main及build/history-identity中的bundle/隔离review仓库，并清理main/远端/HEAD不可达旧历史reflog；CI页面证据迁至build/ci-38832172978/page-snapshots。Codex checkpoint为tree对象而非旧作者提交，完整保留。git log --all的33条提交作者/提交者均为RhsR1024 <497334557@qq.com>。全局/仓库配置与受版本控制pre-commit双重检查已生效；人工绕过hook不在自动防错保证内。

## 2026-10-16 最新云端失败复核与统计增量

最新已结束运行 38846783693（2ff7557）中 Linux、完整原生检查及八项核心 App UI（含 WebDAV）均通过，失败发生在第二组 `testSourceHealth`。诊断产物12025830936已下载至忽略目录 `build/ci-38846783693`；`diagnostics/logs/ui-catalog.log` 和附件 `3FEB8190-2597-41AC-815A-140539B5FCA7.txt:98–110` 显示 iOS27 分享为 Popover，并存在 `PopoverDismissRegion`，ActivityListView 的远程子层不可执行下滑。失败为测试第57行的滑动定位，匹配和评论通过；未执行本次 IPA 归档，不归因为原生编译/音频/密码窗口。修正为核对JSON预览后点击实际弹出面板上方的关闭区域并断言返回原报告。d67fe40 的后续运行38848961113仍在核心App验证，不包含此分享修正，不提前标通过。

工作区继承的F34/J55播放统计已继续完善：原生playing区间的单调时钟累计、会话ID、原曲归属、暂停/切歌末段、清空与备份恢复；共享串行写队列防止恢复和聆听/历史写入互相覆盖。205项TS/类型检查通过（`build/logs/check-statistics.log`）；新增实际AVPlayer暂停/定位/会话测试与本地App复验仍在执行。统计与识曲分开，识曲、其余S2/S3/S4/S7/S8/S9及真机/个人服务仍未完成。完整目标保持active，本机仍为Xcode26.3/SDK26.2，云端为Xcode27/iOS27；不称本机有iOS27工具链。

本批正式入口本地验收：WebDAV `build/SourceUITests-1792126312028.xcresult` 88.805秒通过。首次新增ND统计断言因仍停留私人曲库未显示本机统计，已定向切至library-local；原数据库两条统计均为正值。最终 `build/SourceUITests-1792126794994.xcresult` 113.663秒通过ND真实合成播放/PCM/歌词/五皮肤/暂停定位、会话计数只增加一次及重启保留；已导出并查看统计截图。`build/logs/check-statistics-final.log` 205/205，`build/logs/native-statistics.log`完整套件均通过，含实际AVPlayer暂停计时不增长、seek后不以进度跳变累加及媒体会话一致性。最终源健康/本批IPA和新云端仍继续，不提前标完成。

源健康最终修正版 `build/SourceUITests-1792127036156.xcresult` 82.956秒通过，包含取消/六项逐档结果/JSON分享与返回报告/删除测试源；本地旧SDK使用可命中的常规sheet关闭分支。iOS27 Popover分支仍必须由新提交对应云端实测，不以本地结果代替。完整native、205项TS、正式入口WebDAV/ND与统计重启已全部通过；本批开始归档/提交push。

播放统计/分享修复阶段901954ac1dc1e54ddc444e9f1cfc0a7e4e8cd0f9已正常push并核对远端main一致。本地 `archive-statistics.log` 归档通过，manifest为dirty=false/workingTreeChanges=[]/arm64/iphoneos26.2/min15.1/signed=false，正式JS bundle通过测试adapter隔离校验。IPA位于build/distribution/NexusMusic-unsigned.ipa，SHA256 `44320925583c882859fb7621906b183531b93c0c7cde251aa80da8f1b1533612`，重新校验通过。新云端[38854140339](https://github.com/RhsR1024/nexus-music/actions/runs/38854140339)对应901954a，已创建排队；不把旧d67fe40/38848961113结果作为本批结果。接着推进S4跨平台歌词候选/人工选择等剩余并集，完整目标保持active。

S4/J38增量进行中：新增独立歌词选择层/候选预览UI、原歌词/显式自动优选/人工指定、按实际录音签名的SQLite与备份，213项类型/业务测试通过（build/logs/check-lyric-selection.log）。原歌词与缓存失败保护、可靠版本与时间轴排名、选择变化/取消及清理后的迟到结果、私人搜索主动确认、歌词变更不改变播放控制器已覆盖。App合成实音切换/重启恢复正在执行；不能提前标J38或本批双构建通过。参考与Android边界见decisions/0024-lyric-selection.md。恢复队列默认暂停且没有已解析媒体；实际录音经用户继续播放确认后再恢复其歌词绑定，不借旧自动音频匹配记录给原录音误标歌词。完整其余并集继续。

S4歌词第二轮 `build/SourceUITests-1792128065182.xcresult` 119.756秒通过自动WY逐字、人工TX Live预览/保存、重启重新确认实际录音后恢复绑定及原歌词恢复。正式入口 `ui-lyrics-core.log` 对应ND/PCM/五皮肤（含歌词入口可达）/暂停定位/单曲偏移与统计重启111.294秒通过；完整候选/原匹配/评论/健康组继续复验。最新215项类型/业务检查通过，未修改原生音频/歌词渲染后端。

最终正式入口 `build/SourceUITests-1792128987602.xcresult` 127.277秒通过：五皮肤暂停/定位、声波核当前歌词可点、私人曲目无自动公开匹配且主动搜索确认可取消、原生逐字/偏移、统计重启。已查看最终声波核截图，当前行完整显示。最新218项类型/业务检查通过；额外覆盖WebDAV/设备文件版本变化废弃旧选择/原歌词缓存，以及WebDAV跨实例临时版本不重复。新歌词显式搜索与WebDAV最后联合复验仍在执行。
云端901954a/38854140339已通过checks、iOS27完整native检查（含统计/DSP），目前核心App UI。旧d67fe40/38848961113已结束失败，job116813728363日志明确旧第74行ActivityListView为空可见区无法Swipe down，testSourceHealth 62.777秒失败；诊断产物12026707975。与2ff已定位分享问题一致，不归因本次歌词。901的修复分支仍等待实际云端通过。

S4/J38最终本地交付验证：`build/SourceUITests-1792129333583.xcresult` 中歌词98.717秒、WebDAV70.552秒均通过。歌词测试显式点击真实搜索按钮，覆盖原曲解析失败后的TX实际录音→暂停→WY逐字歌词优选→TX Live歌词预览/保存→重启后继续播放确认录音并恢复人工选择→暂停/原歌词恢复及测试源清理；音频身份/意图独立保留。HTTP计数确认五平台搜索、WY/TX歌词均被请求，DAV13次PROPFIND/4次Range/认证失败0；合成音频可命中已有临时缓存，不称本次真实平台实音。已看人工选择与最终声波核截图。最终`check-lyric-selection-delivery.log`为218/218，无失败/跳过。全批未修改原生后端，无新依赖或许可资产；开始阶段提交/本地生产IPA及新云端验收。其余S2/S3/S4样式字体/S7登录推荐评论识曲/S8/S9/真机仍未完成。

S4/J38阶段已正常push `92f4836eaa29c4196c3f1de0b6e75831f96eeed2` 并核对远端main一致。本地`archive-lyric-selection.log`为ARCHIVE SUCCEEDED，manifest commit=92f4836/dirty=false/workingTreeChanges=[]/arm64/iphoneos26.2/min15.1/signed=false，正式bundle无测试adapter。IPA SHA256 `67f280d3eefcfa6a1f7793521bb18b6476b8c61f40e6f2623afa9b0f26b24d77`，重新校验通过，产物仍为build/distribution/NexusMusic-unsigned.ipa。网页已确认本批新运行[38857771291](https://github.com/RhsR1024/nexus-music/actions/runs/38857771291)对应92f4836、Pending；不把排队写成云端已通过，未重复派发或重启已有构建。901954a/38854140339当前已过完整native，核心App继续。接下来继续S4深度歌词样式/实际字体导入及全局字体，保留S2/S3/S7/S8/S9等全部剩余目标与手机/真实个人服务验收，goal active。

## 2026-10-16 云端统计批次通过与歌词批次运行

网页实际确认：901954a 对应运行38854140339全部成功，checks 28秒、iOS任务54分25秒，包含原生检查、核心App、匹配/评论/源健康及设备归档上传。IPA产物12029158092为9.24MB，ZIP摘要7849f97a0c9af63e33611bfd5fd69b99f20f7585492085faed2f00757856078c；此摘要不是内部IPA校验值。诊断产物12029310935为207MB。旧分享Popover失败已由本次实际云端回归闭环，不再把旧失败作为当前修复状态。

92f4836对应运行38857771291现已从排队进入执行：checks 30秒通过，原生检查1分28秒通过，iOS27核心App UI运行中，后续歌词选择/匹配组及IPA尚待实际结束。未取消、重启或重复派发。字体/样式批次工作树仍未提交，不能把这两个运行计作字体批次通过。本机Xcode26.3/SDK26.2与云端iOS27结果继续分别记录。

成功运行38854140339的IPA已实际下载至忽略目录build/ci-38854140339/ipa，ZIP摘要与网页一致，内部IPA校验文件匹配，SHA256 8c82be090b0099aae1bfc29e7f9d534cf5ffb849696ad75dc61fd3495173199c。manifest为arm64/macOS27.0.1/Xcode27.0 27A266a/iphoneos27.0/min15.1/signed=false；dirty=true明确仅列M ios/Podfile.lock（已知Intel/ARM Yoga校验差异），不称清洁云端工作树。Info.plist/JS包与正式入口隔离已复核。

## 2026-10-16 F37/J59 灵动岛范围与当前批次接续

用户新增两张图并明确要求后台封面/系统律动和展开的播放、切歌、收藏、路由操作，已同步PRODUCT_SCOPE、TASK_PLAN S10、IMPLEMENTATION_PLAN、FEATURE_STATUS、SOLLIN_IOS_COMPARISON和决策0026。图为标准系统Now Playing目标，通常长按展开/轻点回App；不能误判为必须写ActivityKit扩展。现有NativePlaybackEngine仅提供标题/歌手/进度/速率与基础媒体命令，无MPMediaItemArtwork、收藏反馈命令。系统布局/律动和按钮展示由iOS决定；收藏业务需自己接入，未展示入口不能标系统收藏通过。继续保持一个权威队列，用户手机iOS27单独验收。

字体批次最终本地Files字体/五皮肤/删除回退与重启通过（1792133300989），歌词候选/WebDAV回归通过（1792133893238），228项业务和完整native通过。云端92f4836/38857771291已失败，核心组8项仅图标测试失败，未到后续组/IPA。本地同项1792135144385于15:21通过12.108秒，尚不能解释云端根因；诊断下载到build/ci-38857771291进行中，不盲目重跑旧提交。字体批次仍未提交/未归档/未云端验证，后续修复随该批一起验收提交，完整目标保持active。

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

## 2026-10-16 S3 图片资源与播放背景中途交接

当前工作区继续实施 S3/F25–27/J45–50，尚未提交。本批已按决策0028实现原创视觉资产边界：用户从 Files 导入主题背景/写真，原生 ImageIO 在设备侧限制大小并缩放、重新编码为 JPEG、剥离 EXIF/GPS，按内容 SHA-256 去重，原子写入并拒绝路径穿越/符号链接；VisualAssetStore 只保存内容身份、名称和尺寸，不保存临时绝对路径，替换/删除失败保留旧槽位，启动回收孤儿副本。新增背景/写真槽位、透明度、播放背景模式、模糊/暗度/圆角、封面取色和动态背景偏好；动态变换在暂停/缓冲/后台/减少动态效果时停止，不使用 React 逐帧 PCM 或歌词列表刷新。

验证截至本交接：npm run check 已通过 249/249 TS 业务测试，npm run typecheck 通过；npm run test:native 已通过全部原生检查，包含 VisualAssets 实际图片导入、GPS 剥离、尺寸限制、内容身份、颜色和符号链接/引用清理。真实 Files 图片导入与外观设置重启/移除回退的本地 SourceSettings UI 测试仍在运行，尚未写入通过结论；本地 IPA 尚未为本批重新归档，云端 iOS27 尚未由本批提交触发。测试新增确定性 Nexus Visual Fixture.png，仅由 UI 测试夹具生成，未进入生产资源。

当前云端不重复派发或取消：38871835008（78e4827）已完成成功，38874981017（256e935）仍在运行，38878989928（82ad83c）排队等待串行构建；本批 S3 修改尚未提交，后续需先完成本地 UI/IPA、检查 diff 与隐私排除，再正常提交 push 并跟进新 iOS27 运行。若失败下载诊断并在下一功能批次修复。其余 S3 深度视觉/减少动态效果/大字及真机、系统灵动岛后台面板、真实账号与剩余 S2/S4/S7/S8/S9/M10 仍未完成。

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

当前未提交批次已接入WebDAV版本上传/回读SHA256、目录配置、列表/预览/明确事务恢复；复用Keychain，连接变化/取消丢弃迟到结果，提交后不提供假取消。按[决策0030](docs/decisions/0030-webdav-backups.md)比较五参考后原创实现。269项业务与完整native通过；首次正式App165.110秒通过上传/重启/取消预览/恢复/坏JSON/再次重启，最终云备份+DAV播放联合回归、本批清洁IPA/云端继续。详见[构建证据](docs/BUILD_STATUS.md)文末。F33同步、iPad及全部原有剩余范围继续，goal active。

2026-10-16 工作量进度估算：代码实现约74%，含集成/真实服务/真机与交付的整体进度约56%（50%–60%）；不是按功能项数量计算，权重与依据见[进度估算](docs/PROGRESS_ESTIMATE.md)。


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


## 2026-10-16 F33最终本地联合验收

正式入口`build/SourceUITests-1792158625194.xcresult`三项全通过、零失败/跳过：同步222.425秒（含实际全选替换目录及两侧版本预览）、云备份204.159秒、DAV实音70.122秒。计数备份/同步合计PROPFIND17/MKCOL2/PUT4/GET11、模拟远端编辑1，DAV PROPFIND15/Range6，认证失败均0。296项业务/类型及完整native通过；首次冲突截图亲看，最终附件已导出。修正版保留取消/恢复/坏文件/重启/PCM/移除断言。阶段提交、清洁本地SDK26.2 IPA和新云端继续，不将合成服务当真实双设备/私人服务。

按全部F01–F37/J01–J59工作量加权：代码约75%（75.35%），整体交付约57%（56.65%，区间51%–61%），见[docs/PROGRESS_ESTIMATE.md](docs/PROGRESS_ESTIMATE.md)。同步新增证据与iPad设备族缺口同时计入，不按功能项或测试数量计算；全部目标仍active。下一批先修正主App iPad设备族，再继续真实宽屏/旋转与其余S2/S3/S4/S7/S8/S9，永久下载最后。


## 2026-10-16 F33阶段提交与双构建

三方同步已正常提交/push `26830dfde3e8243ae8eb845a98f54f792dbc6756`，远端main复核一致。`archive-sync-clean.log`为ARCHIVE SUCCEEDED；manifest commit=26830df、dirty=false、workingTreeChanges=[]、arm64/iphoneos26.2/min15.1/signed=false，正式JS入口隔离通过。IPA SHA256 `b14c0f058a7904405a68795d972a602d0a465bb34f0e5c67e7d04a3f9d173f7e`已再次校验，另保留于忽略目录build/local-sync-26830df。新云端[38913246781](https://github.com/RhsR1024/nexus-music/actions/runs/38913246781)为pending；F32/38894434005运行中，既有串行队列不取消/重复派发。

下一批修正主App iPad设备族（目前仍仅1）与RN弹窗横屏支持，验证真实宽屏/旋转。代码约75%、整体交付约57%，不将新排队或unsigned包计作真机/签名验收；F33自动触发及真实双设备/私人服务、全部其他余项仍保留，目标active。


## 2026-10-16 原生iPad窗口与旋转阶段验收

主App Debug/Release设备族已改为1,2，共享Modal允许四方向，发现网格改按实际容器宽度；归档校验新增读取UIDeviceFamily防回归。296项业务/类型检查通过（check-ipad-delivery.log），脚本语法和diff空白检查通过。

本地Release专项 `build/SourceUITests-1792160728178.xcresult` 48.992秒通过：实际iPad idiom、635点系统窄窗口底部导航→通过系统真实Zoom-button扩大→宽屏侧栏/隐藏底栏→搜索内容与实际窗口横屏旋转→同步弹窗转回竖屏并关闭→发现区域在侧栏右侧且不越界。已查看竖屏侧栏、横屏搜索及弹窗附件（build/ipad-rotation-passed）。首次宽屏断言失败保留，系统AX窗口控制和实际交互完成前未将其记为通过。

手机交叉回归 `build/SourceUITests-1792161115531.xcresult` WebDAV83.124秒通过，含真实合成服务解码/PCM/暂停定位/重启/移除连接；PROPFIND15、Range4、认证失败0。未改音频/脚本原生后端，没有新依赖或复制参考资产；完整native沿本轮native-sync-full.log证据。CI新增独立iOS27 iPad专项，尚未由本批提交触发/执行，清洁本地IPA继续。真正分屏切换、大字/无障碍、硬件键盘和真机仍保留，不能称整个F35/J56完成。


## Sollin移动IPA直接参考（2026-10-16）

用户新增提供本机Sollin-2.0.0 60-unsigned.ipa，要求换思路查看实现并复刻UI/交互/移植功能。已只读静态分析，Flutter设备arm64编译版、cryptid0、约252个应用Dart文件路径候选和可读音频指纹HTML/JS；没有Dart源码/动态运行证据。hash/许可/技术栈/模块线索与下一步见docs/SOLLIN_IPA_ANALYSIS.md，原包与提取证据留ReferenceProject/忽略build，不提交资产。此证据优先于桌面推测，不改变F/J总范围或一个播放器/队列边界；后续对齐应以移动行为规格原创实现，服务端/账号/实际动态效果分别验证。
# 2026-10-17 A08 发现详情更多操作菜单

发现歌单详情的歌曲行已按 Sollin 的紧凑层级收口：主体行负责播放，右侧 `ellipsis-horizontal` 打开 `SheetModal`，其中保留下一首、加入队列、本地收藏/取消收藏和加入歌单。既有 `PlaylistPicker`、分页/完整导入、筛选排序、来源身份与失败保留逻辑不变。`npm run check` 302/302，`git diff --check` 通过。本机没有完整 Xcode，未执行本批 XCTest/IPA；云端运行 `38959060803`（`4ccbb25`）当前 `pending` 且 jobs=0，IPA/真机待终态，不能把 `pending` 当作通过。
# 2026-10-17 A08 发现详情分页失败重试

`Discovery` 现在区分首次/刷新和加载更多的失败页：追加页失败后“重试”继续请求同一追加页，首次加载或刷新失败仍请求第一页，已加载内容不丢失。`npm run check` 302/302，`git diff --check` 通过。本机没有完整 Xcode，未执行本批 XCTest/IPA；云端运行 `38959674512`（`b11328d`）当前 `pending`，IPA、真实平台弱网和真机仍待验证。
# 2026-10-17 A08 发现详情更多操作图标行

详情歌曲行的更多操作 Sheet 已改为图标、标题和箭头组成的统一动作行，保留下一首、加入队列、本地收藏/取消收藏、加入歌单和 56pt 触控高度。`npm run check` 302/302，`git diff --check` 通过。本机没有完整 Xcode，未执行本批 XCTest/IPA；云端运行 `38960235054`（`6962dc5`）当前 `pending`，真机和大字长列表仍待验证。
# 2026-10-17 A09 全部歌词 page sheet

播放器中的“全部歌词”展开层已改用共享 `SheetModal`，与其他播放器子设置保持 page sheet 层级；歌词来源、偏移、双击定位、原生逐字绘制、FlatList 有界渲染和播放队列不变。`npm run check` 302/302，`git diff --check` 通过。本机没有完整 Xcode，未执行本批 XCTest/IPA；云端运行 `38960563962`（`40faff5`）当前 `pending`，真机和大字/减少动态效果仍待验证。
# 2026-10-17 本机工具链更正与 A08/A09 本地验证

`source scripts/environment.sh` 后本机实际使用 Xcode 26.3（17C529）/iOS 26.2 SDK，不是仅有 Command Line Tools。当前 HEAD `31f1ebc` 已完成本轮增量本地验证：`build/SourceUITests-1792181776488.xcresult` 的 `testCrossPlatformLyrics` 与 `testDiscoveryAndAppearance` 共 2/2 通过；`build/distribution/build-manifest.json` 记录 `dirty=false`、arm64、`iphoneos26.2`、设备族 `[1,2]`、unsigned，IPA SHA256 `b22761ef58c4252f0ae4d711f98228c46763be3d775fc3cc077b65eb7da1ed74`。这仍不替代 iOS 27 云端终态、签名和真机验收。
# 2026-10-17 A08 音乐库动作 Sheet 最终证据

`bea1fbd` 已正常提交并 push。音乐库歌曲行更多操作 Sheet 的最终本地 UI 回归为 `build/SourceUITests-1792189902252.xcresult`，1/1 通过、123.773 秒，覆盖歌单创建、1000 首长列表分批加载、搜索排序、重复项移除、滑动删除及加入队列/本地收藏入口；`npm run check` 为 302/302，`git diff --check` 通过。清洁本地归档 manifest 为 commit=`bea1fbdd2e05468977ae98c8ecb987aae78c8dcb`、`dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`；IPA SHA256 为 `9da2021825fad953b5cf37b8400d02456d67edf520d63209f2613bf492c90642`。对应 iOS 27 运行 [38976733431](https://github.com/RhsR1024/nexus-music/actions/runs/38976733431) 截至 2026-10-17 仍为 `pending`，不计作通过；签名、真机、后台/功耗和大字手势仍待验收。
## 2026-10-17 A09 外观样式子页图标行

设置→外观→播放界面样式现在使用与播放器内部样式 Sheet 一致的稳定图标列表行：每项包含图标、行为说明、选中态和箭头/勾选；六个当前可运行布局、立即保存、失败保留、队列和暂停意图保持。IPA 只提供样式名称与独立 Sheet 静态线索，未据此增加未实现的 Apple Music 2 入口。

`npm run check` 302/302，`git diff --check` 通过。`build/SourceUITests-1792191433812.xcresult` 的 `testGroupedSettingsNavigationAndDrafts` 1/1 通过。播放器专项在既有合成流冷缓存时长断言失败，已保留失败证据且未宣称播放器专项通过。清洁本地 unsigned IPA SHA256 为 `c0c8adf3ed6cac2befa33948688217b42d627ff3e06082c67bffb889db44d588`，manifest 为 Xcode26.3/iOS26.2、arm64、设备族 `[1,2]`、signed=false。iOS27 运行 [38979554313](https://github.com/RhsR1024/nexus-music/actions/runs/38979554313) 已对应 `77d58e0`，当前 pending；签名、真机、后台/功耗仍待。
# 2026-10-17 M10 离线保存第一段

本轮新增 `OfflineDownloadStore`、Expo 文件适配、播放器“保存离线”入口和数据与存储页任务列表；来源身份去重、失败保留/重试/删除、临时文件完成后原子发布、缺失文件恢复和完整文件播放回退已实现。`npm run check` 306/306。当前工作树除既有 reverse-skill 文档改动外新增 `src/storage/offlineDownloads.ts`、`src/storage/offlineFiles.ts`、服务接线、Player/CacheSettings 及 `tests/offline-downloads.test.ts`，尚未提交或归档。

M10 仍未完成暂停/断点续传、后台调度、容量配额/清理、完整性校验、在播保护和真实服务/真机验收；本批只把永久下载工作包代码实现估计从0%调整到约10%，完整交付仍0%。按权重当前代码约77%、整体开发交付约58%，不是按功能数计算。`npm run check` 306/306、`npm run test:native` 通过（仅既有 Swift Sendable 警告）；本地清洁归档 `build/logs/archive-offline-download-final.log` 为 ARCHIVE SUCCEEDED，manifest 为 commit=`4169643`、dirty=false、arm64、iphoneos26.2、最低 iOS 15.1、设备族 `[1,2]`、signed=false，正式入口校验通过，IPA SHA256 `69f4c81fb4f3147d9fa4b681c13dd664490cc720922a5c1ec2dc160580192d85`。提交 `4169643` 已正常 push 到 `RhsR1024/nexus-music`，远端 `main` 已核对一致；新 iOS27 运行 `39009861484` 当前 pending，旧 `39006353281` 仍 in_progress，按 single 队列保留运行中并只留最新排队。云端 iOS27、签名、真机和真实服务仍不能据此宣称通过。
# 2026-10-17 M10 容量管理增量（未提交）

离线保存新增持久化总容量上限（512 MB–8192 MB）、已用/待处理统计、配额拒绝和已保存文件批量清理；307/307 业务检查通过。M10 代码实现估计约15%，完整交付仍0%；暂停/断点续传、后台、完整性校验、在播保护和真实服务/真机验收继续保留。

上面的第一段记录是容量管理前的 306/306 起始状态；以本增量记录和 `docs/PROGRESS_ESTIMATE.md` 的 307/307、约15% M10 代码估计为当前状态。

容量批次 `3e56d4d` 已正常 push，远端 `main` 一致；iOS27 运行 `39010767320` 当前 pending，上一提交的 `39009861484` 已由 single 队列自动取消，`39006353281` 仍 in_progress。取消旧 pending 不计通过，继续等待最新运行终态。

# 2026-10-17 14:59 心跳云端诊断与匹配清理专项

39006353281/3898592已结束失败：checks、native和首组核心App步骤通过；第二组4通过/1失败，唯一testOnlineMatching在Swift337清理测试音源时isHittable断言失败。完整第二组日志已按ZIP目录长度/CRC提取，build/ci-39006353281/logs/ui-catalog.log:25141；跨平台歌词120.183秒、发现87.187秒、评论18.275秒、健康70.851秒通过。匹配用例此前自动/人工版本/PCM/取消重启/开关持久化均已走过；末尾连续20次swipeDown无法触达音源。iPad/云端IPA被跳过，不能标完整成功。完整ZIP尚未下载/hash核验，只有提取日志条目校验。

心跳已仅修改SourceSettingsTests该清理循环为按sources视口与fixture实际frame双向滚动，保留删除确认和完成断言，增加失败截图/层级；本地testOnlineMatching正在会话28220运行，汇总build/logs/ui-matching-cleanup-fix.log，实际ui-catalog.log，结束前勿重开UI/覆盖日志。旧本地整组未完成日志另存build/ci-39006353281/local-core-1792214990725-partial.log，含先前Files列表失败，不能称全套通过。离线下载在改文件保持原样，本修正待专项结果后随当前功能批次验证/清洁IPA/提交push。最新39010767320正在运行，不取消/重派，尚未通过。
# 2026-10-17 当前接续：Sollin 通用后端范围与 M10 暂停续传增量

`52a0aaf` 已正常 push 到 `RhsR1024/nexus-music`。push 后 GitHub API 核对：`39010767320`（`3e56d4d`）仍为唯一运行中，`39012949974`（`52a0aaf`）为唯一最新 pending；满足最多 1 个运行/1 个排队，未取消运行中任务。pending/运行终态不计作本地功能或真机完成证据。

用户补充的范围规则已同步到 `docs/PRODUCT_SCOPE.md`、`docs/REFERENCE_COMPARISON.md`、`docs/SOLLIN_IPA_ANALYSIS.md`、`docs/TASK_PLAN.md`、`docs/IMPLEMENTATION_PLAN.md`、`docs/FEATURE_STATUS.md` 和 `docs/PROGRESS_ESTIMATE.md`：Sollin 中属于通用产品能力的后端逻辑也必须对齐，包括 provider 登录/鉴权、推荐/FM、识曲，以及离线暂停/继续、断点续传、后台任务、完整性校验、重启恢复、容量与在播保护。仅 Sollin 自有账号体系、用户中心、服务与支持、激活/赞助/商业权益、遥测和诊断回传排除。

Sollin 私有云端服务、专用链接或不可授权接口不复制；优先本地实现或复用音枢 provider。无法满足的能力记录为待决项，先完成其他开发，开发收尾和需要真机验证前再请用户选择合法落地方式。

上述能力的逆向分析与采纳统一经过 `reverse-skill` 路由、PRIMARY、离线 `case-init`/`case-guard`、工具索引、当前功能 Evidence→Finding→Path 和严格 review；静态字符串、安装检查或一次接口成功不能代替后端逻辑证据。

本批 M10 已补齐排队暂停/恢复、活跃下载 Abort 中断保留 `.part`、Range 偏移续传、Range 不可用/偏移不一致时安全全量回退、正式/临时文件删除；`npm run check` 为 309/309。后台任务、重启调度、完整性哈希、在播保护、漫途完整导入及真实服务/签名/真机仍待。

`95c2e03` 对应本地清洁 unsigned archive 已成功：`build/distribution/build-manifest.json` 为 `dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`；IPA SHA256 `02f6f94368d89247dfe89745d6b4df4fa22ee25e68d1f0a4570956e08c193742`。该证据只证明本地归档，不证明 iOS27、签名、真机或真实服务。

按工作量加权、排除真机反馈调试后的当前开发实现估计为 **78.15%（对外约78%，剩余约22%）**；包含真实服务、签名、真机和交付验收的完整交付口径仍为 **57.93%（对外约58%）**。主要剩余开发量在平台登录/推荐/FM/识曲、M10 后台/完整性/在播保护、Sollin 深层 UI/交互与对象关系、漫途完整导入、iPad/系统媒体收口和 WebDAV 自动同步逻辑。具体权重见 `docs/PROGRESS_ESTIMATE.md`。

## 2026-10-17 15:24 匹配清理修正版本地通过

`build/SourceUITests-1792220258492.xcresult` 的 `testOnlineMatching` 已结束：100.832秒、1项零失败，`TEST SUCCEEDED`。日志留存 `build/logs/ui-matching-cleanup-passed-1792220258492.log`，请求计数为同名前缀 `-counts.json`；实际日志确认到达并点击匹配夹具、删除确认后“完成1项”断言通过，自动匹配/人工版本/PCM/重启与开关持久化断言保留。修正已随95c2e03进入提交，52a0aaf对应最新云端39012949974仍pending；运行39010767320对应更早3e56d4d，不包含清理修正，继续执行核心App测试。未取消/重派。此为本地SDK26.2合成服务专项，不能替代云端iOS27、真实服务或真机；旧本地Files列表失败仍保留。当前其他离线开发改动未由心跳提交。

## 2026-10-17 当前接续：M10 摘要校验、临时偏移与在播保护

本轮在 `OfflineDownloadStore` 增加文件摘要持久化与恢复校验，完整文件摘要缺失或变更时转为失败且不进入离线播放；通过权威播放控制器队列识别当前曲目，删除和批量清理保留在播文件并向 UI 返回受控错误。Abort 失败路径改为读取 `.part` 临时文件大小，避免把正式文件大小误当作续传偏移；保存、恢复、暂停、续传、重试、在播保护均有业务覆盖。

验证：`npm run check` 为 311/311，`npm run test:native` 两套检查通过，`git diff --check` 通过；reverse-skill IPA strict review 仍为 PASS（3 evidence / 2 findings / 2 paths），没有把安装门禁当作 Sollin 后端功能证据。后台任务与重启调度、漫途完整导入、跨服务长期稳定性、真实服务、签名和真机仍待，unsigned 本地归档不替代这些验收。

本轮估算按工作量加权更新为当前开发约 **79%**、剩余约 **21%**；完整交付仍约 **58%**。主要开发余量是平台登录/推荐/FM/识曲、M10 后台任务与重启调度、Sollin 深层 UI/交互收口、漫途完整导入、iPad/系统媒体和 WebDAV 自动同步。详见 `docs/PROGRESS_ESTIMATE.md`。

`26d3675` 的本地清洁 unsigned archive 已成功：`build/distribution/build-manifest.json` 为 `dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`；IPA SHA256 `393fb8c8008b41dd1e450e61951721645078e12a3f33aaf0a932faa637ce3dcb`。这只证明本机归档，不证明 iOS27、签名、真机或真实服务。

## 2026-10-17 当前接续：M10 传输完整性与竞态保护

工作树当前包含未提交的 M10 增量：真实适配器切换到 `expo/fetch` 流式读取；新增 `Content-Range` 起点、`Content-Length`/总长度和 `ETag`/`Last-Modified` `If-Range` 校验；下载保存/发布变更串行化；删除排队任务会阻止其后续网络工作，活动任务删除会等待终止。纯校验层、真实本地 HTTP/磁盘流测试与竞态测试已加入，`npm run check` 需以本批最终运行结果为准。

本批仍未实现原生后台任务、重启调度和跨服务长期稳定性。摘要恢复校验会标记失败并保留文件，不应写成自动清理文件。当前按工作量加权的开发实现约 **79.95%（对外约80%，剩余约20%）**；完整交付约 **57.93%（对外约58%）**，不含真机反馈调试的开发口径见 `docs/PROGRESS_ESTIMATE.md`。需先完成本地 native/清洁归档，再提交并正常 push；push 后按 `queue: single` 核对最新运行/排队状态。

`920d193` 已正常 push 到 `RhsR1024/nexus-music`。提交后的本地清洁归档 `build/logs/archive-offline-transfer-920d193.log` 为 `ARCHIVE SUCCEEDED`，manifest `dirty=false`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、unsigned；IPA SHA256 `451c98c59cfb0fde012cb2c887f608550ca5733522ed366f0b3b5973f51d7ebc`，正式入口与 ZIP CRC 通过。该包不替代 iOS27、签名、真机或真实服务。

push 后 API 核对（2026-10-17 16:09 Asia/Shanghai）：`39016561400`（`920d193`）最新排队，`39010767320`（`3e56d4d`）运行中；旧 `39014868431`（`7cc176c`）和 `39012949974`（`52a0aaf`）自动取消。保持 1 运行/1 排队，不取消运行中、不重派旧版本，pending/取消不计通过。

# 2026-10-17 本地推荐/FM fallback 接入

已新增 `LocalRecommendationStore`，从本机收藏、历史、歌单、曲库和播放统计生成稳定身份去重的本地推荐；FM 会尽量打散连续同歌手，候选耗尽后循环。音乐库首页提供本地推荐列表和本地 FM 入口，服务层暴露该 store；业务测试覆盖评分原因、去重、歌手打散、循环和订阅刷新。该能力不读取或上传平台凭据、Sollin 私有服务或音频文件。

产品采用混合策略：用户已登录网易云、QQ 音乐或酷狗等 provider 且接口可用时，优先使用平台真实推荐、日推/FM、个人歌单和收藏；未登录、离线、未授权或接口失败时使用本地推荐/FM fallback。因此本地推荐可以在无账号时提供可用入口，但个性化准确度通常不及平台侧行为模型，不能把它记作平台推荐完成。平台 Keychain 登录、真实推荐/FM协议、失败回退和服务验收仍待实现；Sollin 私有账号体系、用户中心、服务支持、激活/赞助/商业权益及私有云端仍排除。

本批代码未改变 E-004 的证据边界，也未宣称真实平台、签名、iOS27 或真机完成。进度按工作量更新为：排除真机反馈调试的当前开发约 **80.65%（对外约81%，剩余约19%）**；含真实服务、签名、真机和交付验收约 **57.93%（对外约58%）**。在线扩展工作包由20%代码实现上调为30%，因为本地 fallback 已有实现和测试；平台登录/真实推荐/FM/识曲仍是该包的主要剩余开发量。
# 2026-10-17 E-004 provider/识曲边界严格复核回执

本批已按 reverse-skill `mobile-reverse` PRIMARY 完成 Sollin IPA provider/auth、推荐/FM/taste profile 与 audio-match 静态边界核查。`source scripts/environment.sh && node scripts/sollin-reverse-gate.mjs ipa --review` 通过，4 Evidence、3 Finding、3 Path，0 error/0 warning；E-004 case-local 哈希清单和报告保留在忽略目录 `work/sollin-ipa/`。结论仅支持音枢的 provider-neutral/本地实现边界：平台登录凭据走既有 provider/Keychain，推荐优先曲库/历史/平台公开数据，识曲只采纳本地 PCM 准备约束；没有远端 URL、鉴权交换、配额、结果协议或运行时调用图证据。

用户新增规则已落实到 `docs/SOLLIN_IPA_ANALYSIS.md`、`docs/IMPLEMENTATION_PLAN.md`、`docs/TASK_PLAN.md`、`docs/PROGRESS_ESTIMATE.md` 和 `docs/PRODUCT_SCOPE.md`：Sollin 私有云端、专用链接、账号体系、用户中心、服务支持、激活/赞助/商业权益、遥测/诊断回传不照搬；能本地替代则先实现，不能替代的登记待决，先完成其他开发，开发收尾并进入真实设备验收前再请用户决定合法落地方式。E-004 不提高当前开发完成度。


## 2026-10-17 16:30 心跳：容量旧批次失败已核对，最新批次继续

`39010767320` / `3e56d4d` 已失败：checks、native 与首组核心 App 步骤通过；第二组 4/5 通过，唯一 `testOnlineMatching` 在旧 Swift337 的测试音源清理可点击断言失败（142.689秒）。`build/ci-39010767320/logs/ui-catalog.log:26609` 及前文确认连续向下滑仍未触达夹具，与上一运行同一问题；歌词141.685秒、发现97.446秒、评论25.491秒、健康89.239秒通过。iPad 与云端 IPA 被跳过，失败后的600秒诊断超时不是首因。

诊断 artifact `12094896784` 的 ZIP 目录已解析，单独日志条目解压长度2898100字节及CRC32校验通过；未下载/核验完整ZIP摘要，详见忽略目录 `build/ci-39010767320/FINDINGS.txt`。修正提交 `95c2e03` 不在失败的旧 `3e56d4d` 中，已由 Git 祖先及文件核对确认包含于最新 `920d193`；本地专项1792220258492此前100.832秒通过，不重复修改/重派旧版。

最新 `39016561400` / `920d193` 当前运行中，checks/native已通过，首组核心App步骤执行中；实际队列为1运行/0排队，未取消运行。新iOS27终态、iPad/云端归档及真实服务/签名/真机仍待。心跳仅追加状态证据，未提交或覆盖另一执行上下文正在编写的E-004文档及后续功能工作。

# 2026-10-17 Ryderwe 作者仓库盘点

已遍历 Ryderwe GitHub 主页显示的 46 个公开仓库（包含 `Ryderwe` profile README 仓库），新增 [docs/RYDERWE_REPOSITORY_REVIEW.md](docs/RYDERWE_REPOSITORY_REVIEW.md)，并在 [docs/REFERENCE_COMPARISON.md](docs/REFERENCE_COMPARISON.md) 建立入口。重点仓库固定默认分支 HEAD、fork 上游、许可证和采纳边界已记录；完整清单不等于已复制或已验收。

当前最有用的源码参考是 `Sollin-Music-Desktop`（原始桌面源码，根 MIT）和 `Youmi-Music-IOS`（`7DaysMax/Youmi-Music-IOS` fork、未声明许可证）。Youmi 的网易登录、公开推荐/日推、私人 FM、缓存和 FM 预加载可用于 provider 行为对照；其 `APIConfig.swift` 指向外部网易服务，不能写入音枢，下载实现也不足以替代音枢已有的暂停/Range/摘要/在播保护设计。`lx-netease-music-mobile`、`api-enhanced`、`KuGouMusicApi`、`qqmusic_flac`、`meting` 可分别用于 provider 字段/协议研究；`QQMusicApi` 为 GPL-3.0，只做协议研究，不复制实现。

发布仓库 `Sollin-mobile-release` 只有包发布说明，`PrismMusic-Release` 主要是截图；如需从包补充行为证据，继续遵守 `reverse-skill` IPA/APK PRIMARY、离线 scope、Evidence→Finding→Path 与严格 review，不把仓库 README 或截图当功能证据。Sollin 私有云端、账号体系、用户中心、服务支持、激活/赞助、遥测和专用链接仍排除；无法本地替代的能力登记待决，开发收尾和真实设备阶段再由用户决定。

最大辅助字号补记：1792240831918.xcresult，经新首页→播放→EQ入口，单列卡片32.744秒通过，1/1、零失败/跳过。清洁归档/本批云端仍待。

## 2026-10-18 平台账号安全底座阶段

新增 `src/providers/musicAccounts.ts` 并由 `createServices()` 暴露 `musicAccounts`。QQ/网易云/酷狗账号元数据保存在 `music.accounts.v1`，会话 token/Cookie/设备材料仅保存到 `nexus.music.<id>` Keychain 项；保存替换、退出、恢复和仓库失败回滚已用 3 项测试覆盖，`npm run check` 379/379。当前工作树包含该阶段实现，真实平台授权、日推/FM、个人歌单/收藏、UI、签名/真机仍未验收；开发百分比维持 80.95%，待完成登录协议和实际服务证据后再重估。

## 2026-10-18 平台账号底座构建回执

`09480afbeb1f3b9f34abc755e868b39548849622` 已正常 push。`npm run check` 379/379；本地 clean unsigned archive 与 `verify-presentation-archive.py` 通过，Xcode26.3/SDK26.2、arm64、min15.1、设备族[1,2]、signed=false、dirty=false，IPA SHA256 `792ef3cad6b3aad97bee716a235e5e4759bfb95f8a5d21dbac908e94cb879d5e`。新云端运行 39113628537 对应该提交，当前 pending；旧 39111966447 仍运行，保持 1 running/1 pending，不取消运行中任务。

## 2026-10-18 平台授权状态机阶段

新增 `src/providers/musicAuth.ts`，服务暴露 `musicAuth.wy/tx/kg` 独立流程。新尝试会失效旧回调，取消会释放原生句柄，过期/失败不会泄露协议细节；4 项新增测试使 `npm run check` 达到 383/383。当前尚未接入 WKWebView、外部 App 回跳、酷狗二维码或真实账号。下一步按 Q-music 固定提交实现各平台授权适配，再做本地 UI、云端 iOS27 和真机/真实服务证据。

## 2026-10-18 平台授权状态机构建回执

`8b217c9` 已正常 push；`npm run check` 383/383，本地 clean unsigned archive 与归档校验通过，IPA SHA256 `11566adb7b0f092bdafb631437b9887ad5a87758397288523a32c4179b1d0e8f`，arm64/iOS SDK26.2/min15.1/设备族[1,2]/signed=false。账号授权流程仍未接真实平台。旧运行和本批 iOS27 队列以 API 实际状态为准。

## 2026-10-18 授权清理异常修复回执

`fd376cc` 已正常 push；授权状态机清理异常保护通过，`npm run check` 384/384，本地 clean unsigned archive/校验通过，IPA SHA256 `c74b8d5fb6377d4d50874e730f5bf58d57eadf9d511dd8fdada79327458cd180`。对应新 iOS27 运行以 API 实际队列为准；仍不能宣称真实平台授权或真机通过。
