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

用户最新明确要求：先把音枢已有功能的页面、层级、控件、弹窗、手势和状态反馈对齐固定Sollin iOS IPA及九张截图，保留音枢特有的LX多源/质量路由、Navidrome、WebDAV、汽水匹配、来源诊断、真实PCM/EQ与数据安全边界；完成已有功能对齐后，再扩展音枢其他待实现能力。自动同步、平台登录推荐/FM/识曲、最后下载等未实现项仍在总范围，暂不抢在现有界面对齐之前新增。

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
