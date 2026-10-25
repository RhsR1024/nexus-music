# 音乐库双歌单体系（批次4，2026-10-25）

本批按 IMPLEMENTATION_PLAN 批次顺序落地批次4：[功能清单 §6](SOLLIN_ANDROID_FEATURE_INVENTORY.md) 的"本地歌单（仅本机）"设备域与自建歌单补强。核心是双体系隔离：本地歌单与音乐库自建歌单（云同步域）互不可见、互不混用。功能口径沿[0079](decisions/0079-functional-spec-and-ui-quality.md)。

## 来源与门禁

- 功能依据为已采集的可见能力（E-1247–E-1251 双体系隔离/默认"我喜欢的（仅本机）"/新建声明/本地删除无确认/本地选择器提交关闭、E-852–E-856 三字段与键盘语义、E-1240 删除确认+撤销）；按[0080](decisions/0080-sollin-capability-capture-scope.md)不追加采集。
- `master-route` 路由 APK（R1 apk-reverse）；本会话 `sollin-reverse-gate.mjs ipa`/`apk` 及 `--review` 均 PASS；未新增逆向证据。
- 均为音枢既有组件与域逻辑的原创扩展，未复制参考源码。

## 实现

- `src/domain/devicePlaylist.ts`：设备歌单域——`devicePlaylistEntries`（mint条目ID+校验）、`withDefaultDevicePlaylist`（默认 `我喜欢的` 恒在）、`normalizeDevicePlaylists`（版本/结构/默认歌单强校验）、创建/重命名/删除（默认拒删）/加歌/移除；与音乐库 `LocalPlaylist` 完全独立类型。
- `src/storage/devicePlaylists.ts`：`DevicePlaylistStore`，仓储键 `device.playlists.v1`——该键永不进入音乐库 JSON（云同步/WebDAV 备份导出），双域即使同库也隔离；串行 mutation、恢复时坏数据整体拒绝；uuid/now 注入可测。
- `src/app/services.ts`：`devicePlaylists` 挂入服务面并启动恢复。
- `src/ui/LocalPlaylistPicker.tsx`：本地选择器——只列本地歌单、排除默认 `我喜欢的`、无可用时提示新建、提交后关闭（与搜索页选择器保留面板不同）；新建声明"只保存在当前设备，不参与云同步"。
- `src/ui/LocalAudioLibrary.tsx`：新增"歌单"视图（默认歌单恒在显示"（仅本机）"、新建/详情/重命名/删除无确认/逐曲移除/行播放）；行"加入歌单"改用本地选择器（不再误用云同步域选择器）；打开歌单/新建时收起键盘。
- `src/ui/LibraryHome.tsx`：自建歌单新建与详情补 描述/封面URL 字段（三字段语义）；删除后捕获快照，经 Toast"撤销"恢复（`restorePlaylist`，同ID冲突时保留现状不破坏列表）；保存信息合并重命名+元数据。
- `src/storage/library.ts`：`LocalPlaylist` 可选 `description`（≤512）/`coverUrl`（≤2048）入校验；`createPlaylist` 接受元数据、`updatePlaylistMeta`、`restorePlaylist`。
- `src/ui/Toast.tsx`：支持可选动作按钮（撤销），动作存在时延长展示并保持可点。

## 验证

- `npm run check` 537/537（新增4项：域默认歌单/拒删/坏数据、存储持久与隔离键结构、删除/空名/未知ID、库三字段+撤销恢复+元数据校验）。- 真实音源UI验收：`testLocalPlaylistDualSystem` 最终 `SourceUITests-1792894967968.xcresult` 1通过/0失败/0跳过（模拟器，真实导入音频文件）——默认歌单恒在、新建唯一名歌单进详情、创建歌单可删而默认不可删、本地选择器排除默认、提交关闭并提示、加歌后计数、删除无确认弹窗、默认歌单幸存、音乐库"我的歌单"看不到该名（双体系隔离）。3张截图导出 `build/ui-screenshots-device-playlists-20261025` 并亲看（默认列表态/提交后选择器关闭+确认文案/添加后列表）。
- 本地导入回归 `testYLocalAudioFileImport` `SourceUITests-1792893739359` 1/0/0：本页改动未破坏既有导入/分组/播放/删除链路。
- 负证据保留：`1792889588708` 断言位置错误（在新建详情断言默认不可删）；`1792890181372` 键盘遮挡列表行点击（打开/新建已收起键盘修复）；`1792891985562` 选择器按钮无障碍树重复需 firstMatch；`1792892464891` 消息查询误用 buttons 且跨运行残留同名歌单（改 staticTexts+运行唯一名修复）。

## 未验边界

- 本地歌单的批量多选动作（本地页批量面板含"删除"入口矩阵）属批次5本地扫描五视图范围，本批未做。
- 撤销 Toast 5.2秒窗口的录屏观感、iOS 27 云端终态、真机/签名/后台未验。
- 本地歌单不参与 WebDAV 备份/云同步是设计决定（设备域），未做反向验证（导出JSON不含该键由单测断言键结构）。
