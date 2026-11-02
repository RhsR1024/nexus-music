# 2026-11-02 粉调磁带封面样式

## 结论

外观设置新增默认关闭的“磁带封面”。启用后，经典、封面沉浸、声波核、AM 与 AM2 的主要封面会套用当前主题强调色的磁带外壳、双卷盘、定位点和 `SIDE A` 标签；封面加载、失败回退和歌曲身份继续复用既有 `Cover`。迷你播放器、列表缩略图、写真、黑胶和歌词舞台不使用该外壳。

需求来源为用户补充项 `U`。这是音枢原创的界面实现，不从 Sollin IPA 推导或宣称已观测到磁带视觉；既有 Sollin 证据只覆盖封面圆角和播放器皮肤分区。

## 实现边界

- `AppearanceOptions.tapeStyle` 默认 `false`，由版本化偏好原子保存。
- `tapeCoverLayout()` 保持原主封面正方形占位不变，并对圆角、内边距、卷盘胶片带与卷盘直径做边界收紧。
- `TapeCover` 只处理至少 112 pt 的主封面；更小区域继续使用普通 `Cover`，避免装饰遮住回退字符或增加不可读细节。
- 磁带只增加静态 React Native 视图，不增加位图、远程素材、传感器、动画、第二队列或播放状态。
- 主题配置和云备份显式包含 `tapeStyle`；旧主题/备份缺少该字段时保留接收设备当前值，不把本机选择重置为默认。

## 本地验证

`npm run check` 为 982/982；完整 `npm run test:native`、Swift 解析、工作流 YAML 解析、`git diff --check` 与 `node --check scripts/test-ui.mjs` 通过。最终 `npm run ios:build` 输出 `BUILD SUCCEEDED`。

正式 Release UI 专项 `SourceUITests-1793625940527` 为 1 通过 / 0 失败 / 0 跳过，耗时约 278 秒。运行清单记录 `exitCode=0`、`sourceUnchanged=true`，源码 digest 为 `63efa46d7bca957e5eaeb6d9a26d2a4ed64cf0d2b8c1847308fa337ed5920724`，安装 bundle digest 为 `e56883a5eb404c19e262c11997543db8b34ddacfa6ec1a2def5288b24459e27e`。

同态截图共 8 张，均为 1290 x 2796；截图索引与 provenance 检查通过，并已逐张亲看。测试用正式 Navidrome 合成服务加载真实三色光栅封面，验证：

- 开启后五种主要播放器封面均出现磁带壳，加载图片仍可见。
- 关闭后恢复普通封面。
- 终止并重启 App 后开关和磁带外观保持。
- 迷你播放器保持普通紧凑封面。
- 设置入口可滚动到达，外观开关实际翻转为开/关。

证据保留在：

- `build/SourceUITests-1793625940527.xcresult`
- `build/logs/tape-cover-real-r1-app/run-manifest.json`
- `build/ui-screenshots-tape-cover-real-1793625940527/`

## 未关闭范围

本批只证明 iOS 26.3.1 模拟器、合成 Navidrome 服务和未签名源码构建。iOS 27 云端终态、实体 iPhone、VoiceOver 实际手势、动态字号、小屏、连续动效/性能、真实私人服务与真实用户媒体、签名/安装/续签仍未完成。模拟器截图与编译成功不替代这些验收。

## 归档与云端

产品提交 `6785769` 已正常 push，远端 `main` 实核为
`67857694dcafaa203c3c2ddbfe46e61d7993405a`。clean unsigned archive 的 manifest
记录 `dirty:false`、`workingTreeChanges:[]`、同一 HEAD、
arm64/iphoneos26.2/iOS15.1/设备族 `[1,2]`、`signed:false`。IPA 为 12,903,359
字节、SHA-256
`1054d323d971c22f15cab79bf7697d05c6003867d629254f74737286eedcc15a`。

独立归档/IPA 核验 `ready=true`，27 项检查全部通过：ZIP CRC 无错误；57 个普通
payload 与 archive 的文件路径和逐文件字节一致；81 个 exFAT `._*` 元数据条目另行
计数；arm64、最低 iOS 15.1、设备族 `[1,2]`、bundle identity 及无签名/描述文件
契约通过；UI 测试 bundle、夹具账号/端点/口令、私人备份文件名、私钥和源映射排除
通过。核验回执 SHA-256
`c86c01497538e2b7eaa4b47fd95d76727914caabb5ae58d4b25928e08c297d2b`，manifest
SHA-256 `78c4b7de9fb4eb8c7611c0e35a6f8a239a5d61ff6e7113f8f56e38810fc641e4`。

push 后 `41449172204` 继续运行，`41455717983`/`6785769` 为本提交的唯一 pending；
实核队列为 1 运行 / 1 排队，未手动取消运行中任务或重派旧版本。

阶段文档提交 `f753efe` 已正常 push，远端 `main` 与本地一致；该提交只改
Markdown，Actions 列表没有为它新建运行。T7 阶段目录
`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-tape-cover-6785769/`
保留两份 xcresult、两套截图、归档、未签名 IPA、三份归档核验回执、2026-11-02
提交补丁、阶段文档、UI 规格与 Actions 页面快照。更新前的 `6785769` 文档与
生成的旧清单保存在 `history/6785769/`，没有用覆盖替代历史。当前 transfer
receipt 核对 184 个仓库映射文件逐字节一致、203 个普通文件入选校验清单，
mismatch 与 missing 均为空；exFAT `._*` 元数据另行计数。

阶段收尾时内盘可用空间仍在 30 GiB 阈值以上，没有 Xcode/Node 构建进程占用证据
目录，因此本批执行 `deleted=0`、`movedUserFiles=0`。最新两个有效阶段产物、
未解决失败回执、reverse-skill 样本/scope/Evidence 均继续保留；这只是一份清理
判断回执，不代表可以删除后续阶段仍需引用的数据。

iOS 27 GitHub Actions 的终态、实体 iPhone、VoiceOver 实际手势、动态字号、小屏、
连续动效/性能、签名/安装/续签，以及真实私人服务与真实用户媒体仍继续独立验收。
