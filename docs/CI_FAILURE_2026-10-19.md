# iOS 27：2026-10-19 失败诊断

## run 39305209267 / 2cd956b

运行 [39305209267](https://github.com/RhsR1024/nexus-music/actions/runs/39305209267) 对应 `2cd956b3a143a114f4c8c11960d738c4777c2d7b`，于 2026-10-19 20:43Z completed/failure。checks、原生检查通过，首组App测试28通过/3失败/0跳过；后续测试、iPad、归档未执行。失败后模拟器诊断收集超时为次生现象。GitHub REST核对最新运行状态，无queued或in_progress任务；没有重派旧提交。

已保留失败证据artifact `12220915812`，本地ZIP `build/ci-39305209267/ios-failure-evidence-2cd956b3a143a114f4c8c11960d738c4777c2d7b.zip` SHA-256 `89f3fc7ccf55264943763a42cf4e4ecf61c74b09f31bd518f603c4d6275f831f`（与artifact摘要相同）。其中 `SourceSettingsTests/testPlayerStyleSheetWithLargeTextAndPersistence` 的失败附件报告tap `skins-sheet-close` 时无匹配按钮，当前可访问层级已是外观分类页，说明Sheet已关闭且UITest helper对旧元素继续点击。EQ大字用例的失败层级为全屏经典播放器，缺少预期EQ viewport；症状是导航/恢复状态不符，当前导出不能确定触发步骤。`testClassicPlayerWindowSafeArea` 失败附件未包含，具体断言待日志。

日志artifact `12220162151` 为587877 bytes，完整诊断artifact `12220381594` 为683680572 bytes；公开API可列出artifact元数据，但下载API返回401，本机无可用GitHub凭据。故本次不将推测写作确证根因，不改生产代码或放宽断言。取得有权限的compact log/full diagnostics后定位三项失败，再按当前实施批次做专用本地检查；本机只有Xcode26.3/iOS26.3 runtime，无iOS27 runtime，已启动的用户模拟器不用于重跑。真实服务、签名、真机不由模拟器结果代替。

## 2026-10-20 完整播放器源码重编译回归

此前混合复验中，背景测试1/0/0（148.083秒）通过，播放器因实际编译进测试二进制的旧 `循环：off` 断言失败；当时工作树源码已删除此断言，但对应 `SourceSettingsTests.o` 仍早于源码时间，旧失败准确反映二进制内容，未据此修改产品循环逻辑。先保存原日志/summary/counts和源码摘要，强制源码重编译后单独执行 `SourceSettingsTests/testZNavidromePlaybackAndCredentials`。结果 `build/SourceUITests-1792432689070.xcresult`：416.640秒，1/0/0，完整播放/暂停/恢复、经典到AM、AM互斥封面/歌词/队列、顺序→单曲→随机→顺序选中、完整队列返回、歌词/主题设置截图及结束清理断言通过。summary SHA256 `9833858e9c14d7b58786bda4b0758f593d67d5c6cc048679ab48906dc66caceb`；完整日志、服务计数和result bundle保留 `build/ci-regression-2026-10-20/review-player-passed` 及原xcresult。模拟器为iOS26.3.1/Xcode26.3，不代表iOS27、真实Navidrome、签名或真机。

最后采集的默认blush/rose 4855、4861截图已亲看；`visual-diff --ignore-top 180` 4855为5.76%/29.53，4856为-1.95%/31.60（SSIM/MAD），两者未达90%。当前轮UI功能测试通过不改变像素/动效未达标清单。完整E-043摘要与三张图的哈希在`work/sollin-ipa/evidence/E-043.md`；门禁需在该E追加到workitem/timeline后重新strict review。

## 2026-10-20 共享批次审查补修（验证中）

首次完整播放器最终回归 `build/SourceUITests-1792430101016.xcresult` 461.303秒、1/0/0通过；日志/摘要/计数已保留于 `build/ci-regression-2026-10-20/final-player`。随后主代理审阅共享代码发现滑块首渲染闭包和新经典歌词副本缺少原完整阅读能力，故未据此提交未审代码。

滑块改为读取最新回调/disabled；步进保留当前值的增量，拖动才量化，避免25%/55等默认值被错误舍入。截图恢复使用真实恢复默认按钮，去掉soft颜色评分，所有颜色采集回到blush/rose。经典歌词的来源/偏移/完整阅读复用原Lyrics，保留版本、翻译/音译、双击/VoiceOver和长按入口；共享请求按服务隔离、只合并进行中请求、最后消费者退出即取消，不再保存绕开服务缓存失效的模块级文档。新增3项真实异步请求生命周期测试，400业务/类型检查通过（check-reviewed.log）；新偏好迁移/原子失败检查随后补充。

首次复验命令误用 `SourceUITests` 目标，1792431705102在执行测试前退出70，0/0/0；错误日志保留rejected-target，没有作为通过。随后改为实际 `NexusMusicUITests` 目标，1792431748824在完整播放/暂停/后台恢复后失败于停转盘面两张截图间唯一一个颜色分量相差1。源码rotation在暂停时请求原生stopAnimation取相位；同一PNG重复100次取样完全相同，差异发生在两次屏幕抓取之间，但底层物理原因未证明，未猜测修改产品旋转。现用连续3次完全一致的采样等待保留零容差并加强稳定性条件。失败完整xcresult、截图、日志、summary/计数保留reader-failed；该结果未作为整项通过。已另加队列模式真实单曲→随机→顺序交互覆盖；新完整播放器及真实背景大字测试正在串行复验。中途一次重复启动被夹具端口EADDRINUSE拒绝，未启动第二个Xcode；以原运行的xcresult和ui-catalog为准，不依赖被覆盖的父日志。

## 2026-10-20 本地顺序回归与新增回归补修

本机 `build/SourceUITests-1792427637090.xcresult` 按背景大字→舞台→WebDAV→本地导入顺序执行，2通过/2失败/0跳过。舞台127.012秒、WebDAV88.940秒通过；后者在舞台保存布局后，经真实设置恢复经典，保留频谱、歌词、重启和凭据移除断言，支持布局隔离补修有效。它仍不是iOS27或真实私人服务验收。

背景61.173秒在Swift2095失败：增加按钮minX=380、减少按钮minX=22，原大字纵向排列断言失败。新 `SliderControl` 没有接回 `VisualSettings` 既有 `width<390 || fontScale>1.4` 响应式条件，属于当前未提交批次新增回归。已恢复窄屏/大字号纵向标签与步进布局、44pt步进区域，并保留普通字号滑轨；未放宽几何断言。这是本项目既有无障碍行为的修复，无新增Sollin逆向或对齐结论。

本地导入114.534秒在Swift807队列“移除”处失败；此前两轮实际频谱、重启及在播文件删除保护断言已执行，不记整项通过。最后层级 `build/failure-evidence/SourceUITests-1792427637090/1/3EF80AC0-C622-42BC-B497-B53CCB25D2B4.txt` 有经典页“查看播放队列”/“播放队列”，无“移除”；源码的队列变更位于content面板，经典页已改为显式打开。测试补上真实“查看播放队列”入口，再执行原移除与删除断言，未修改队列/播放产品逻辑。

补修后 `build/SourceUITests-1792428220170.xcresult` 两项2通过/0失败/0跳过：背景144.791秒、本地导入81.528秒。背景保留原大字几何、动效开关、关闭/滑动关闭与重启持久化断言；本地导入保留两轮实际频谱、重启、在播删除保护、队列移除后实际删除成功断言。已亲看大字纵向步进截图 `build/ci-regression-2026-10-20/background-controls/001-Theme-background-sheet-image-controls-at-accessibility-XXXL.png`；该截图不作为Sollin像素或动效对齐达标证据。

原始结果、失败附件及首轮日志/计数保留于上述xcresult、`build/failure-evidence/SourceUITests-1792427637090`、`build/ci-regression-2026-10-20/first-*`，复验日志/摘要/计数为同目录`retest-*`。397项业务/类型、真实夹具release竞态回放及diff通过。封面跨淡化专项正在执行；清洁IPA和新云端仍待。

封面专项首轮 `build/SourceUITests-1792428575660.xcresult` 397.250秒失败在通用reveal（Swift1554）：日志6409起已完成实际取色、动效偏好/重启、原生PCM与经典安全区断言，随后寻找“完整队列与拖动排序”旧位置直至失败；不是设置开关失败，也尚未到HTTP释放/跨淡化。原计数只有themeControlPolls=1，无release命令或录屏。源码确认该按钮在经典“查看播放队列”content面板中。补上真实入口，关闭全屏队列后再关闭content面板、等待消失，继续原背景像素恢复与后续断言。没有放宽颜色、动效、身份隔离或HTTP屏障条件；Swift语法/diff通过，复验正在串行执行。原日志/摘要/计数保留`build/ci-regression-2026-10-20/cover-first-*`，原xcresult和失败附件保留。

封面最终复验 `build/SourceUITests-1792429453424.xcresult`：498.890秒、1通过/0失败/0跳过，完整取色/持久化、原生PCM、全屏队列关闭后的父背景恢复、HTTP held/release、迟到蓝色身份隔离、当前失败回退和三色流动等原断言均通过。独立录屏 `build/logs/ambient-transition-1792429453412.mp4` 核验58帧/10中间色帧、blueTime=0、redTime=0.503333秒；before/middle/after PNG已亲看，实际蓝→中间色→红，不是单张终态。计数12控制轮询、red/blue/missing各有实际release；日志/摘要/计数保留`build/ci-regression-2026-10-20/cover-passed-*`。该模拟器录屏证明本项目此次跨淡化，不能冒充Sollin动效真机一致或云端SDK27恢复。全UI批次最终回归/清洁IPA/合入远端及新提交云端仍待。

远程已核对并fetch：`origin/main=35ddf58207c8cff32ea88ca01472a2beeaac72f9`，本地HEAD仍d2d24e2，仅落后一笔Beans-Music比较/交接文档提交。尚未合入，不在共享脏工作树上直接pull或push。后续阶段提交前须保留该远端提交并合入交接，禁止force；文档提交没有新Actions运行，最新产品运行仍39210631200失败。每日清理回执 `build/logs/cleanup-daily-2026-10-20.json`，约36GiB可用，无删除。

## 最新运行 39210631200 / d2d24e2

[39210631200](https://github.com/RhsR1024/nexus-music/actions/runs/39210631200) 于 09:00Z 失败：checks/原生通过，首组 App 28通过/3失败/0跳过，后续组及归档未执行。当前 0运行/0排队，没有重派。全局封面跨淡化本轮 520.363秒通过、完整八布局 328.862秒通过；这不等于前轮夹具竞态已消失，该提交尚不含本地修正。

两项来源仍在原 Swift623/780（日志67741/68009）等频谱失败，分别66.005/56.883秒。新包最后层级 `failure-evidence/SourceUITests-1792394555401/1/DE101BA2-7D51-41BF-8507-64174CFFF85D.txt` 和 `2/F81E4EA0-64E5-4BDF-A798-4ED2B4B6DA85.txt` 均有 `stage-player`/`stage-vertical`，与前轮布局污染一致；不重复改产品或放宽 PCM。本地经典基线修正待正式顺序回归和提交。

新增背景大字用例126.535秒失败：Swift1995 是通用 reveal 最终可点击断言，日志46295，目标 `visual-motion`。此前背景预览与不透明度增减断言已执行；日志显示对 `background-sheet-scroll` 的35次循环在横向98%处拖动。亲看已保存的控件截图，Sheet圆角/大字号与内容延伸可见；包里无最终不可达截图/层级，不能据此宣称原生滚动失效的物理根因已完全证明。

本地将该用例的拖动改为 scroll.frame 与 App 窗口交集的中心线，沿用已验证 Mini 夹具做法，增加最终失败截图、层级和实际frame诊断；等待次数、可点击、偏好持久化与预览几何断言保留，产品代码未因本次诊断改变。Swift前端语法和diff通过；本地Xcode仍在当前UI批次回归，未启动竞争App运行。**滚动补修效果、三项正式App复验、清洁IPA、提交push和新云端仍待**。

本机忽略目录 `build/ci-39210631200`：日志ZIP artifact12173424594 /576287字节/SHA256 `b1c6ecb583f69ead99efa6d054a40dca711c18b3b6760a6ca619c76d11465559`，失败包artifact12173394569 /1018747字节/SHA256 `96b011e44b7c91edb09916cf97c249960cc67eb7c05b3c498f71e96a9d45b513`，均核验SHA与ZIP CRC后安全解压并移入该目录。完整676MB诊断包未下载。清理收据 `build/logs/cleanup-ci-d2d24e2-2026-10-19.json`，约40GiB可用，活动Xcode下未清缓存、无删除，前轮失败/最近两有效阶段/逆向原始证据保留。

## 前轮 39204735117 / 56f37c0

运行 [39204735117](https://github.com/RhsR1024/nexus-music/actions/runs/39204735117) 对应 `56f37c0df2871b859c5523326e283d71451692c0`，checks 和原生检查通过，首组 App 28 通过、3 失败、0 跳过。Navidrome 完整播放用例通过；后续匹配、离线、iPad、归档未执行，不能记为通过。600 秒 simulator diagnostics 超时发生在三项断言失败之后，不是首因。

| 用例 | 原提交 Swift 行 / 日志行 | 已取得的事实 |
|---|---|---|
| 全局封面取色 | 1505 / 50276 | `Current red scene after bounded crossfade` 未在 20 秒内达到实际红色像素条件 |
| WebDAV | 623 / 65339 | 播放页已打开，等待 `实时音频频谱` 失败；密码建议已识别并关闭 |
| 本地文件 | 780 / 65615 | 文件选择及歌曲导入后播放页已打开，等待同一频谱标签失败 |

本机必要证据位于忽略目录 `build/ci-39204735117`，原始日志在 `logs/ui-catalog.log`，结果和服务计数在 `logs/ui-summary.json`、`logs/ui-server-counts.json`。原始 ZIP 不提交。

## 封面夹具释放竞态

云端计数有同一新红色封面的 11 次请求、4 次控制请求、录屏路径，但没有 `transitionReleases`，说明没有响应被 `send()` 实际释放。原生 `fetchCover` 请求超时为 10 秒；夹具在看到 held 后还会截图、启动录屏，然后执行 release。原实现只释放此刻仍连接的响应；连接提前关闭时 release 丢失，后续重试又被无限 hold。

用实际 `scripts/test-ui.mjs` 分支复现“请求关闭→release→重试”确认该缺陷。修正为每个本轮颜色的持久释放状态，重试立即响应；其他未释放颜色继续阻塞。增加 `transitionReleaseCommands` 区分控制命令和真正响应释放。没有修改产品封面超时、取色、跨淡化、身份隔离或像素门槛。

诊断回放 `node build/ci-39204735117/reproduce-fixture-release.mjs` 验证关闭后释放、释放后重试及其他颜色隔离；`node --check scripts/test-ui.mjs`、`git diff --check` 和 397 项业务/类型检查通过。本批正式 App 专项、本地清洁 IPA、提交/push 和对应 iOS 27 尚待，不把夹具回放写成 App 或云端修复通过。

## 两项来源用例的布局隔离

已取得并核验失败截图/文本包。WebDAV 最后层级 `failure-evidence/SourceUITests-1792388553001/1/CF583E17-52E6-4923-B89E-6B58E8C03072.txt` 的 15/42 行是 `stage-player`/`stage-vertical`，47 行进度为 `0:16 / 0:31`，55 行为“暂停”；本地文件最后层级 `2/0172828F-A26E-4F10-B0D7-1B75942E109D.txt` 同位置是舞台、`0:12 / 0:31` 和“暂停”。两项均未渲染频谱标签，不能据此认定解码失败或记 PCM 已通过。

原提交 `Player.tsx` 只在经典正文或打开的内容面板中挂载 `Spectrum`；舞台专项保存了舞台布局，来源测试启动后未选择自己的布局基线。根因为跨测试持久偏好污染了页面前提。新增 `selectClassicSourcePlayback`，WebDAV / 本地导入均在真实设置页选择经典并等待保存后的 Sheet 退出，再走原流程；原频谱、歌词、重启、删除与凭据断言全部保留。当前经典页也在重构，该补修须和当前批次共同做正式 App 专项，不改产品布局偏好语义。

亲看的 WebDAV 唯一 PNG 是此前的“Save Password?”建议，日志确认其后已点 Not Now；它不是失败时截图。本地文件无 PNG，最后层级可证明舞台页面前提。未声称取得最终失败画面或完整动态轨迹。

Swift 前端语法解析通过；夹具回放、JS 语法与 diff 检查通过，397 项业务/类型检查通过（早于 Swift 隔离补修，不能替代其 App 验收）。正式顺序回归应至少先运行 `testStageStylesAndWindow` / `testStageStylesWithLargeText` 留下舞台，再执行两项来源用例；同时复验全局封面跨淡化。共享工作区还有经典播放器/歌词未完成改动，本次不提交该未验批次、不启动竞争构建。App 专项、本地清洁 IPA、隐私/diff/远程核对后提交 push，以及包含修正的 iOS 27 结果均待。

精简日志 ZIP：artifact `12168274225`，561229 字节，SHA256 `e9bdab1923206c878bc93966682591ee9b71bf406f3a5808b6f523e795d565a9`。失败截图 ZIP：artifact `12169271028`，26497760 字节，SHA256 `d555fac7db8dba1fa4ffb6cb631bdbc27d7f8a47cd92b58b1e5fa1de843d3a0c`。两包本机 SHA 与 ZIP CRC 均通过，已从 Downloads 移至上述本机诊断目录保留唯一原始包；1.86GB 完整 xcresult ZIP 未下载。清理回执 `build/logs/cleanup-ci-failure-2026-10-19.json`，约 42GiB 可用，无删除、无缓存清理，必要失败/最近两阶段产物及逆向证据均保留。

当时最新的 `d2d24e2` / [39210631200](https://github.com/RhsR1024/nexus-music/actions/runs/39210631200) 保留运行中，0 pending；这条状态已由本文顶部的39305209267后续运行覆盖。真实服务、签名和真机仍独立待验。
