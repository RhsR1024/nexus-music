# `withBase` 注音跨行布局

当前状态：实现、业务检查、正常字号正式 UI、XXXL 长段滚动及清洁设备 unsigned 构建通过，产品提交已推送、证据已在 T7 核验；云端终态、完整 J37/F27 及全项目目标保持开放。

## 问题与修复

此前所有注音基础组都插入 WORD JOINER。对超过阅读区宽度的长 `withBase` 基础组，该策略阻碍自然换行，旧绘制逻辑又只在首个 TextKit 行绘制全部注音。

本轮仅对基础与注音组合字素数相同的 `withBase` 允许换行。`LyricRubyLayout.withBaseSegments` 将基础字素分配到真实 TextKit 行，要求有序、无重叠、完整覆盖且不切断组合字素；原生视图按分段基础矩形绘制相应注音。其他模式及数量不等的回退继续防拆。原权威队列、歌词时间与 React 更新方式保持。

场景和验收条件见[UI 规格](ui-spec/ttml-withbase-wrap-2026-11-05.md)。本批是音枢自有缺陷修复，无新增 Sollin 采集、逆向结论或商业实现采纳。

## 已执行检查

`npm run check`：1022 项通过、0 失败，包含 TypeScript 类型检查。`npm run test:native` 完整退出 0。补充布局测试覆盖三行逐字素配对、重叠行、缺失基础及不完整组合字素拒绝；普通字号行间距修改后的 TypeScript 类型检查亦通过。正式 Release UI 结果待运行结束后补录。

正常字号运行 `SourceUITests-1793840532574.xcresult` 使用独立目录 `build/ttml-withbase-wrap-20261105-r2`。运行期间修改了源码注释及分段合法性检查，因此本次即使通过也只作诊断，不能作为最终同源验收；最终需要以源码固定后的新运行复核。

该运行实际为 0 通过 / 1 失败：16 字夹具与六字对齐样本均高 56pt，未触发常态跨行，失败于严格高度断言。已将样本扩为 20 字，不放宽断言；另补普通字号 `withBase` 行间注音预留。r3 尝试同时提交两个 TTML selector，被调度器的单目标保护拒绝，未构建或运行用例。随后 r4 按单目标重验正常字号，再独立执行 XXXL。

## 正常字号正式结果

r4 `SourceUITests-1793841108064.xcresult` 最终为 1 通过 / 0 失败 / 0 跳过、exit0、`sourceUnchanged=true`。设备为 iPhone 15 Pro Max / iOS26.3.1 模拟器、Release；source digest 为 `a8ce173cabe68a5a697bbad7a329632aae150360e821afd4d8a8294d2919235e`，实际安装 bundle 为 `3b3d970c5bb6d39fb17c02a13dda30a65511d890330c0d4b9c9363e668e37e7a`，入口 fixture 为 `564e821a7703ba8ea6a011ae6df6668c8df6a91b9d0ca0840f3ee215d812c709`。

精确附件 `Wrapped with-base ruby across multiple base lines` 已导出，PNG SHA-256 为 `9d197ef79117a148a54c6dabc180c06633e22c5734ba982fdb8eeff6babd1891`，来源核验 `ready=true/failures=[]`。人工亲看：前 19 字与 a–s 同处首行，末字“癸”与 t 对应到第二行；注音未挤回首行，未与基础字重叠，两行均完整可见。既有 kanji/yin/duo/ji、shuang/sou 与 st/md/ed 同屏保留。

XXXL 首轮 `SourceUITests-1793841445387.xcresult` 最终 0 通过 / 1 失败，失败于“完整 20 字段同时进入视口”的新增断言。未改生产代码、字号或缩短内容；第二轮先固定长段滚动验收：原有短样本仍整段可见，超高长段必须首末分别可达并用两张重叠画面覆盖全段，段高上限和端点位置由断言严格检查，另附真实框架尺寸。正常字号的整段可见条件保留。首轮失败原件保留，不将其写为通过；第二轮与正常字号的产品源码相同，但测试源码摘要不同，分别绑定各自运行清单。

第二轮 `SourceUITests-1793841869911.xcresult` 为 1 通过 / 0 失败 / 0 跳过、exit0、`sourceUnchanged=true`。source digest 为 `f6644a532ecd66b566d63aa8cc6235390ea45b5eacb70575ea26cfcf01bd7cb1`；实际安装 bundle 与正常字号完全相同，为 `3b3d970c5bb6d39fb17c02a13dda30a65511d890330c0d4b9c9363e668e37e7a`。真实几何附件记录长段高 559pt、阅读视口高 418.6667pt，说明首轮同帧条件对该长内容不成立；本轮使用正常滚动，无缩字号、缩内容或改生产布局。

两张 1290×2796 PNG 均 provenance ready、failures 为空，已逐张亲看。首端图显示 a–e/一至五、f–j/六至十与第三行部分；末端图显示 f–j/六至十、k–o/甲乙丙丁戊、p–t/己庚辛壬癸。中间两行有重叠覆盖，四行基础和注音均可读，未挤到首行。首端图 SHA-256 `a289d4544939efe664cfe2983d1fcc75ab71cd6eef6101d2c91cb5fdaf6e5f18`，末端图 `8d18904cee90249ad6245eecab266552936d3d80c8f5fc8e1d05700796c43f73`。顶部设置区在该压力字号下独立滚动，其当前裁切不作为设置页美术验收。

## 设备构建

本批工作区 dirty unsigned archive 完成，manifest 绑定基线 `4034a8eb142dc96a080c91a1ee3f2eb73aea1624`、`dirty=true`；含既有独立下载测试改动，不作为清洁发布提交。arm64 / iphoneos26.2 / 最低 iOS15.1 / 设备族 `[1,2]`，`signed=false`。

IPA 为 17,859,254 字节，SHA-256 `e83583bb1f33b210e373ee0776c45db9477124d9e0b03becc0c91579301616b1`。独立核验 ZIP CRC、151 项 archive/IPA 普通文件逐字节、测试标记及私人/签名材料排除通过；`codesign` 确认为未签名。回执在 `build/ttml-withbase-archive-verification-20261105.json`。构建不替代 XXXL 渲染、实体安装、签名或 iOS27 结果。

## 外置保存

真实挂载且可写的 T7 阶段 `NexusMusic/BuildArchive/2026-11-05-ttml-withbase-wrap-e83583bb-precommit/` 保存四轮成功/失败 xcresult、运行清单、导出截图/几何附件、检查日志、dirty archive/IPA/manifest、工作区补丁及 CI 只读摘要。清单先列出 669 份普通文件、263,098,738 字节，确认无活动 xcodebuild 后复制；复制前后逐项 SHA-256 核验为 0 差异，ready=true、sourcePreserved=true、deleted=0。

恢复按目标下 `transfer-inventory.json` 的相对路径映射回仓库；所有源原件仍在，不需要覆盖或清理即可查阅。`transfer-receipt.json` 与本机 `build/ttml-withbase-transfer-receipt-20261105.json` 保存回执。本阶段为预提交 dirty 证据，补丁包含已明确隔离的既有下载测试改动，不冒称清洁发布产物。

后续下载测试候选已独立验收/提交，clean `56c8ac5` 包包含本批注音修复，IPA SHA-256 `83ff147e8fc490ca99c61167f67b92608ae91fa6b868ec73d0827b17e1ecc2ea`，manifest清洁及151项载荷等核验通过；详见[独立交付回执](2026-11-05-download-batch-selection-report.md)。公共 `build/distribution/` 已由clean构建更新，旧dirty完整archive/IPA应从上述T7预提交阶段读取，本机hash命名history另保留旧IPA/manifest；“源保留”指当次复制时状态，不将当前公共目录误记为旧dirty包。

## 保留边界

当前只实现一对一组合字素的横排 `withBase` 跨行。任意比例注音重排、其他注音组超宽分割、完整 TTML2、真实歌词库、实体 VoiceOver、签名安装、iOS27 和项目其他 F/J 保持开放。工作区下载批量选择测试属于其他改动，不混入本批提交。未删除或迁移原始证据，内盘初检可用约 64GiB。

下一独立实现候选为 J25 搜索跨主导航的类型、平台与查询草稿保留。[公开专辑持久化回执](2026-11-04-migu-album-import-persistence-report.md)已记录搜索页重建边界；静态复核 `App.tsx` 条件卸载 Search，`src/ui/Search.tsx` 将类型和平台初始化为歌曲/全部平台，可导致返回上下文丢失。建议把会话内输入状态提升至应用层，结果与分页继续由五个既有协调器管理；返回本身不得重发搜索。此项尚未实施或现场验收，不将静态发现计作功能通过。

## 云端跟进

2026-11-05 通过 GitHub 官方只读接口核对：最新产品运行 `41800375748/f9121ca` 已于 11 月 4 日失败，当前最近五次均已结束，独立 running 过滤查询为 0；queued 查询遭 403，未据此确认完整排队终态。checks job 成功，ios job `126503672062` 在离线下载组失败。通过 GitHub 连接器读取该 job 的解码日志，明确为 `testDownloadTaskBatchActions` 等待“已取消 2 / 2 个任务”失败（原提交 `SourceSettingsTests.swift:3712`），不是本批注音测试失败。

工作区已存在独立的下载第二项选择与 2/2 屏障候选，但本批没有验证或接管它，也不据此关闭该云端故障。注音批次之后，优先独立验证这段候选及下载业务，再继续 J25；不取消或重派旧运行。只读 API 快照保存在 `build/ttml-withbase-ci-*-20261105.json`；未将连接器的截断展示复制成“完整日志”，完整诊断包尚未下载。

产品提交 `a328ee66c7de693898d0f298aade101523a85598` 已正常 push，远端 main 逐项核对一致；只包含注音与本批文档，下载测试候选仍未提交。API 后续列表查询返回 403，改用 GitHub 官方工作流 HTML 的实际 25 条运行清单核对：新运行 `41949520533/a328ee6` 唯一运行，0 条排队，未取消或重派。HTML 与解析回执为 `build/ttml-withbase-actions-after-push-20261105.html`、`build/ttml-withbase-ci-queue-after-push-20261105.json`。此为队列快照，不是 iOS27 终态；本机仍有独立未提交下载测试，未宣称工作区清洁或 dirty 设备包是清洁产物。
