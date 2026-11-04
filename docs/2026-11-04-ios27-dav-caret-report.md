# iOS 27 字段输入残留与 DAV、发现页回归

本批最终本地验收：正式表单长URL→短URL回归1/0/0、36.867秒；完整发现页1/0/0、249.715秒；同步/备份第四轮合计2/0/0，分别269.809秒、202.631秒，全部exit0且sourceUnchanged=true。1016项类型/业务检查通过。仅修改XCTest真实键盘输入辅助器并增加非空字段回归，保留所有产品校验和业务断言；未改产品代码或扩大功能完成度。clean归档和T7交付已完成，精确结果见末节；新云端终态仍开放。

发现页结果包`SourceUITests-1793776816019.xcresult`，DAV为`SourceUITests-1793777325910.xcresult`。两轮源码digest均为`cc069fec7ae6970adcc8d8340dbdf480b2447737441e52a93ac59aa7f36d02a4`；发现fixture实际安装bundle为`2420671963972a9529a0347e8b1e12864301386e64223bb1ba2139247b1c7a81`，正式生产入口DAV安装bundle为`559e50cf72ff3d243c600b3164da413fc3d1ebb9d2c286ecc38ed6514335ef74`。发现页17PNG记录哈希并亲看3张，DAV3PNG全部亲看；前者无效域名提示位于截图视口下方，拒绝结果由断言证明，不宣称该图完整显示错误文案，也不声明Sollin等价。

历史失败与未完整运行均保留，以下按当时状态记录；第四轮成功不将此前失败或不完整结果改写为通过。iOS27新运行、真实私人服务、实体机和签名仍独立验收；动画等待的系统根因仍开放，本轮未再复现不等于根因已消除。

`41657795877/eeae8c4` 核心组为24通过、1失败、0跳过。同步测试通过；备份测试在实际地址与期望地址精确比较时失败：`http://127.0.0.1:18439/backup-dav/-dav/`，尚未执行备份业务操作。日志先记录未找到全选菜单、Command-A、整串输入，再记录清除重试。原重试在点击后直接退格，没有先定位末尾或验证空值；点击可能把插入点放在字符串中间，不能据退格数量证明整串已删除。证据定位于输入辅助器，不据此宣称 WebDAV 网络或存储产品故障。

替换辅助器现在最多尝试两次：读取有界当前值、通过原生方向键移动至末尾、原生退格清除、确认空值或占位文本，然后整串输入并提交，最终仍要求精确相等。清空失败立即记录失败并返回，不把残留文本与新值拼接。没有修改产品代码、凭据、服务校验、同步冲突或备份恢复断言，也不使用剪贴板或直接注入组件状态。

## 云端证据

- `41657795877` 紧凑产物 `13249739992`：573,390字节，SHA-256 `143d3b47f151323c4a0322d3cad207e4e207165d855f9572156f76c117a30e78`，ZIP CRC通过。摘要明确为iOS 27.0 / iPhone 17模拟器、24/1/0；`ui-catalog.log:62554`为失败断言。
- 最新 `41662090745/ee9c8ec` 并非仅在排队时取消：工具链及native步骤通过，核心App步骤取消，后续在线、离线、归档步骤跳过。紧凑产物 `13264829446`：535,052字节，SHA-256 `ac1222c8285ed1eaa8620fbe74bb42e5046a4590cbb348581b36a7623adf4ba0`，ZIP CRC通过。同步测试出现92次约60秒动画等待，日志结束时仍在该测试，没有最终测试摘要；不能记通过，也不能把取消原因直接等同于上一轮备份地址失败。

两份紧凑原件分别保存在T7 `NexusMusic/BuildArchive/2026-11-04-ios27-41657795877-diagnostics/` 与 `2026-11-04-ios27-41662090745-diagnostics/`。本轮没有下载或宣称核验两轮完整诊断包。动画等待的系统/产品根因仍未确定，不改预算、不跳过测试，不手动重派旧版本。

## 本地验证与交付

`npm run check`为1009通过、0失败。Release专项、精确归档与交付结果待本批实际完成后补录；不能以本地SDK26.2/iOS26.3.1模拟器替代云端iOS27、实体机、私人服务、签名安装或全部项目验收。

本轮`SourceUITests-1793750249655.xcresult`已完成Release构建并启动备份测试，地址精确比较通过；随后用户名点击也出现60秒动画等待，运行尚未结束，不计通过。当前调用误带不存在的同步selector `testUCloudSyncConflictRestartDelete`，因此不能声称本轮覆盖同步；正确selector为`testUCloudSyncPreviewConflictRestartAndDeletion`，须在稳定源码下独立验证。构建期间并行出现`artists.ts`、`Discovery.tsx`、热门歌手测试、Xcode工程及测试脚本变更，保留且未混入本批提交，最终必须复核`sourceUnchanged`。本批没有提交或push，也没有中止活动测试。

候选patch、运行中回执及亲看的现场截图已逐文件哈希核验复制到第一份T7诊断目录的`candidate/`；现场截图只证明当前显示的精确备份地址和表单状态，不替代完整恢复结果。`3215002`已有clean IPA回执为17,851,852字节、SHA-256 `67d3ad50048e4d83754a21f38ec6a2014b0dce10e5700dfb6a17757aeb526752`，来源为此前咪咕专辑提交，不含本批候选或并行热门歌手改动，不能用于验收当前混合工作区。

## 首轮失败与第二轮修正

首轮最终exit65、0通过/1失败，2835.057秒，`sourceUnchanged=false`；失败为备份相对目录的“必须先观察为空”断言，上传/恢复尚未执行。原始xcresult和运行目录另复制到T7 `2026-11-04-ios27-dav-caret-r1-failed`，不将其作为成功来源。该轮方向键经`typeText(rightArrow.rawValue)`提交，日志记录为普通`→`字符串；不能将方向键字符串视为已发送光标事件。第二轮改用`typeKey(rightArrow.rawValue, modifierFlags:.command)`，再退格、检查空值，保留最终精确相等。

新增正式表单回归`testWebDAVTextReplacementClearsExistingValue`，只在既有WebDAV根目录输入框内先输入长URL再替换成短URL，不验证/保存连接或修改凭据，用以先独立证明非空字段替换。之后仍需正确名称的同步、备份完整业务专项，不能用该短测试替代。第二轮运行目录为`build/ios27-dav-caret-20261104-r2`。云端新`41749569579/fdf225a`正在运行，未取消或重派；热门歌手clean交付不含本轮未提交候选。

第二轮最终`SourceUITests-1793753666554.xcresult`为1通过/0失败/0跳过、36.867秒、exit0、`sourceUnchanged=true`，两次输入精确校验均通过。全量类型/业务检查1016通过、0失败，diff检查通过。首轮失败T7映射105份/112,683,641字节、0差异，源证据保留。第三轮`build/ios27-dav-caret-20261104-r3`已使用正确selector启动同步与备份完整业务，结果、归档与提交/push仍待；本批暂不据短输入回归关闭云端故障或动画等待原因。

## 磁盘回执补充

2026-11-04检查内盘可用77,745,250,304字节、T7可用616,676,982,784字节，`build/`约11.34GB、`work/`约417MB。诊断下载后T7意外掉载，停止写入，`diskutil`确认外置物理盘后恢复真实挂载并重新核验ZIP哈希；没有在`/Volumes`建立回退目录。空间充足，无删除、无个人文件搬移；活动构建、最新有效阶段、未解决失败原件和reverse-skill受保护证据保留。忽略目录的小型回执为`build/logs/cleanup-2026-11-04-ios27-dav-caret.json`。

## 最新云端发现页输入失败

`41749569579/fdf225a`最终failure：工具链/native与核心组通过，`ui-core.log`明确25通过/0失败、5353.330秒；在线组6通过/1失败、908.241秒，后续离线与归档跳过。唯一失败`testDiscoverySongActions`在旧`replaceText`最终等值断言，实际为`https://music.163.com.attacker.invalid/playlist?id=101attacker.invalid/playlist?id=`，期望末尾只有`101`。测试尚未点击链接预览，不推断产品域名校验或导入存在漏洞。核心DAV通过只证明该轮旧辅助器恰好成功，不足以否定输入替换的间歇故障。

紧凑产物13291119865为706,992字节，SHA-256 `1a6ac5415dda616c0230358342e7e71e8558c0ef0a0a297f4655662bdb2c0562`，ZIP CRC与安全路径通过，保存到T7 `2026-11-04-ios27-41749569579-diagnostics`。完整759,200,447字节诊断包没有下载。独立回执`build/logs/ios27-41749569579-diagnostic-receipt.json`保存来源及计数。

本地第三轮同步/备份进程已消失，日志停在同步测试77.34秒，run-manifest没有finishedAt/exitCode，xcresult缺Info.plist；本轮结果不完整，不计通过或断言失败，不臆测进程结束原因。使用当前候选原生键盘事件辅助器启动独立`testDiscoverySongActions`，目录`build/ios27-input-20261104-discovery-r1`；保留原无效域名/端口及全部业务断言。该项和完整DAV重验、clean归档及push仍按实际终态补录。

## 提交前设备包核验

提交前dirty manifest绑定基线`6fdf8f8`并如实标记工作区变化。unsigned IPA为17,853,350字节，SHA-256 `c98f46aea7e5f6d6cb7f473949433cc6a3259c6c615074c9bd8dbee89d9c2776`；178项ZIP CRC、151项archive/IPA载荷逐字节一致，arm64/iphoneos26.2/min15.1/[1,2]及未签名确认通过。生产热门歌手/咪咕/注音标记、测试入口/私人夹具/签名排除均通过。独立回执`build/logs/ios27-input-replacement-dirty-archive-verification.json`；T7预提交目录`2026-11-04-ios27-input-precommit`逐项复制IPA/manifest/日志/回执并核验一致，源保留，不宣称已复制完整dirty xcarchive。随后从提交后的clean HEAD重新归档，正式交付另记。

## 清洁交付与并行增量合并

修复提交`6030604d11e028eb245b72b931cb4faa4d49f222`的clean归档已独立核验，IPA为17,853,350字节、SHA-256 `8743633b8b4dc86074a2e60faa435e3c39a958ae8a444e70dafc01890cc23440`；T7阶段271份映射/134,058,877字节0差异。随后正常合并并行`cc7f2cc`的咪咕副本测试，保留双方三份顶部交接记录；没有覆盖其独立测试或重写远端历史。

合并提交`d9ebaed9664d3daaae057a2095a3f1b97a22aed7`与`6030604`之间产品src/modules/App/配置/依赖和本批SourceSettingsTests均无差异。调度脚本只增加显式MiguAlbumImportTests专项的独立条件及默认跳过，不改变本批DAV/发现目标的端口、fixture入口或输入实现。合并后1016检查、Node语法及工程plist通过；之前真实UI来源仍绑定各自运行清单，不冒充在新源码摘要上重跑。

重新从clean `d9ebaed`归档，manifest commit精确一致、dirty=false/workingTreeChanges=[]；IPA为17,853,349字节、SHA-256 `ebbdefd471fe8cfa843e2b2c54af28c43a2ffbf32e432e94c07aa4f5e11cd069`，manifest SHA-256 `d2a23e4c294283ec2d99d2bbab3e67017a1d45ce89b5a861e88eecf0d6de7210`。178项ZIP CRC、151项archive/IPA载荷逐字节一致，arm64/iphoneos26.2/min15.1/[1,2]、未签名、生产/私人/测试排除全部通过；另确认原生可执行文件与JS均不含三个UITest类名及本批回归方法名。

T7正式阶段`2026-11-04-ios27-input-d9ebaed`保存完整clean archive/IPA/manifest、固定源码tar、精确三轮成功结果、第三轮不完整日志、20张截图与索引及核验工具/回执。279份映射/139,249,547字节逐文件SHA-256一致、0差异、源保留，SHA256SUMS复核PASS（清单SHA-256 `188e56dd930c956cdd8231db4d39ac2815a0555943e32f18259580603585ceba`）。首轮失败原件与三轮云端原始证据在各自先前目录独立保留，不删除。

之后合并`5abd0e0`只涉及三份交付/状态Markdown；未改变上述设备包或已验代码。默认SSH22连接关闭，使用443端口并保持既有github.com主机密钥严格校验读取同一远端；不关闭HostKey校验或更换远端。正常push与最终队列由本批后续实核补记，保留原`41794665316/cc7f2cc`运行，不手动取消或重派。真实iOS27新代码终态、实体机、签名与私人服务仍开放。
