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

清洁未签名归档、git 提交、远端队列和 T7 回执在后续核验后补录；补录前不把本功能记为完整交付。
