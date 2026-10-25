# 搜索全状态机与统一播放意图（批次2，2026-10-25）

本批落地 IMPLEMENTATION_PLAN 批次顺序中的批次2：全局搜索的五态状态机（加载/失败/空结果/结束/加载更多）、搜索历史与键入联想、清除输入，以及单条结果的统一播放意图。功能口径沿[0079](decisions/0079-functional-spec-and-ui-quality.md)，UI按体验与质量验收，不做像素门槛。

## 来源与门禁

- 功能依据为[功能清单 §3 搜索](SOLLIN_ANDROID_FEATURE_INVENTORY.md)与[状态契约](SOLLIN_ANDROID_STATE_CONTRACTS.md)已采集的可见能力（Q96–Q101、Q111/Q114、Q117/Q118：五状态互斥、显式"加载更多"、历史清空无确认且上限10条、无单条删除、行点击重搜、联想项查询替换重搜、单条点击以该查询结果集重建队列）。按[0080](decisions/0080-sollin-capability-capture-scope.md)不追加规格、性能或后台采集。
- 本轮未新增逆向证据：`master-route` 路由 APK（R1 apk-reverse）；`sollin-reverse-gate.mjs ipa`/`apk` 及 `--review` 均 PASS（case-guard OK、固定样本 SHA256、离线 scope），沿用 Q1–Q125 结论。门禁通过不等于功能证据。
- 五参考固定 HEAD 未变；本批未复制参考源码、依赖或资源，全部为音枢既有组件与原生 API 的原创组合。

## 实现

- `src/domain/searchHistory.ts`：查询归一（trim/折叠空白）、历史上限10条去重前插、清空、键入联想（前缀优先、包含次之、排除当前草稿、上限5条）。
- `src/storage/searchHistory.ts`：`SearchHistoryStore` 串行 mutation、仓储键 `search.history.v1` 持久化、恢复时坏数据整体拒绝、订阅通知。
- `src/app/services.ts`：启动恢复 `search.history.v1`，`searchHistory` 进入服务面。
- `src/ui/Search.tsx`：
  - 每平台组五态互斥渲染：`search-loading-*`（加载指示）、`search-error-*`（首屏"暂时无法加载内容/搜索失败，请稍后重试/重试"；加载更多失败"加载更多失败，已保留当前结果"+重试）、`search-empty-*`（"未找到结果，请更换关键词或平台"）、`search-end-*`（"没有更多结果了"）、显式 `search-load-more-*` 按钮追加（不再用上一页/下一页分页）。
  - 搜索历史区：全局"清空"（无确认、即时消失）、行点击重搜；无单条删除入口；历史为空显示开始提示文案。
  - 键入联想区：草稿≠当前查询时显示，点击以建议词替换查询并重搜（E-1297 查询替换语义）。
  - 清除输入按钮；输入清空即回落地页状态。
  - 平台筛选切换时保留当前查询并立即按新平台重查（不重复记录历史）。
  - 搜索页不再内嵌发现流（发现已有独立Tab，搜索为独立页语义）。
- `services.playTracks(items,index)`：单条点击以该平台组已加载结果集重建权威队列（统一播放意图），多选态下点击切换勾选。
- 用户指令：验证不使用合成测试数据截图，采用 `resources/V261020` 真实音源。

## 验证

- `npm run check` 528/528（新增搜索历史域5项、存储持久化/清空/失败恢复、协调器清空中止在途/失败重试/结束态3项）。
- 真实音源UI验收（用户要求的验证口径）：`NEXUS_LX_SOURCE_DIRECTORY=resources/V261020 node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLiveSourceSearchStates`，最终 `SourceUITests-1792880741581.xcresult` 1通过/0失败/0跳过：真实公开搜索"Shape of You"（网易云，30/302）→ 显式"加载更多"后 `search-track-wy-30` 出现（第二页真实追加）→ 单条点击（自动选择与第0行标题不同的行）后打开全屏播放页，其暴露的标题文本与所点行完全一致（统一播放意图驱动当前曲，且可区分恢复会话）→ 清除输入后历史行 `搜索历史：Shape of You` → 键入"Shape"出现联想 `搜索建议：Shape of You`，点击后查询替换并重查 → 清空历史即时生效回到空态提示。6张截图导出 `build/ui-screenshots-search-states-20261025` 并亲看。
- 两轮负证据保留：`SourceUITests-1792879802797` 首版强化断言试图读取 mini 播放器标题，但该标题被"打开播放页"按钮的显式 accessibilityLabel 折叠、不在无障碍树中，断言必然失败；其失败截图进一步暴露滚动惯性会使行点击落在相邻行（mini 显示第0行曲名）。修复为：停顿稳定后重验可点性、优先选择标题与第0行不同的行、并以全屏播放页暴露的标题断言。首次成功运行 `1792879102410`（弱断言版）保留为历史，不作为最终验收口径。
- 合成fixture测试 `testSearchHistoryAndStates` 作为确定性回归保留（结束态/联想/历史闭环，不作验收截图来源）：`SourceUITests-1792887315059` 1通过/0失败/0跳过。
- 既有CI第一组本地全量复现：`SourceUITests-1792881595653` 21/1/0——唯一失败 `testGlobalCoverThemeChangesAcrossPages` 源于本批移除搜索页内嵌发现后其"经搜索页打开非播放器全屏发现"步骤失去入口；已改为保留队列模态所有权断言并在普通Tab直接断言根层背景运动，修复后 `SourceUITests-1792886356552` 1/0/0（含169帧真实过渡视频核验）。此修复说明远端 1401657/e392096 的CI失败在本地只能部分复现；云端终态以新推送为准。

## 未验边界

- 断网失败/重试UI只有协调器单测与fixture渲染路径，真实音源运行未断网（不影响状态机正确性结论，但真实网络下的失败文案未截图）。
- 聚合（全部）平台与其余四平台的真实空态/近似/结束矩阵未逐组合截图；热搜词列表无真实数据源，未伪造入口（Sollin热搜词为独立入口，音枢暂以开始提示文案替代）。
- 五类型搜索（歌曲/歌单/专辑/艺术家/MV 筛选与对应详情/简化详情）属于搜索模块后续增量，本批未实现。
- 真机、Apple签名、后台/锁屏行为未验。
