# AMLL 与标准 TTML 注音解析及原生绘制

## 范围

本批为音枢原创 TTML 能力增量，使用本地合成 XML 和正式 Release 测试夹具，没有新增 Sollin 样本、目标运行时观察、私有请求或参考视觉语义。解析器继续使用项目现有的有界 XML、时间和数量预算。

支持范围：

- AMLL 风格的 `<span tts:ruby="container">`，限定一个 `base` 与一个 `textContainer/text` 子结构。
- 标准 TTML `<ruby>` 中的基础文字、`<rb>`、`<rt>` 与作为阅读回退的 `<rp>`；注音只进入 `LyricWord.ruby`，不进入演唱文字。
- 时间可以来自注音节点或父容器；注音为空、缺基础文字、游离文字、重复或缺失容器、`rtc` 分组等畸形结构会拒绝，并沿用现有歌词来源回退。
- 无障碍标签在可见基础歌词后追加唯一的 `注音：...`；保留读音语义供 VoiceOver/文本阅读使用。
- 原生歌词视图为含注音的歌词行预留紧凑上方空间，并在基础字形范围上单独绘制小字注音。先前试验的 `CTRubyAnnotation` 在现有 TextKit 绘制路径中不出图，因此没有把它冒充为可用实现。

## 验证

`npm run check` 为 991/991，日志 `build/logs/amll-ruby-check-20261103.log`，SHA-256 `6c4ad42ae0791d0635b41806f0d3098bad57a688184ca294aae84b9ee1a9103f`。新增单元测试覆盖 AMLL 容器、标准 ruby、注音与演唱文字分离、无障碍读法及三类畸形结构；991 项中 0 失败、0 取消、0 跳过。

完整 `npm run test:native` 退出码为 0，覆盖原生播放、缓存、系统媒体、WebDAV、脚本运行时、视觉资产、动态背景、音频导出及现有隐私边界。日志 `build/logs/amll-ruby-native-20261103.log`，SHA-256 `540e9cd7efd1fa0d31c9c2db9725f26d7b70325f1354c26cab4a3c0ad623623e`。日志仍包含既有 `NativePlaybackEngine` Sendable 捕获和 `AmbientSceneTests` weak-variable 警告；本批没有新增失败，未把这些历史警告写成通过或已修复。

正式 Release 专项 `SourceSettingsTests/testAMLLProfileLyrics()`：

- xcresult：`build/SourceUITests-1793661968282.xcresult`
- 结果：1 passed / 0 failed / 0 skipped；`resultInfoSha256=156332a76492a4f1e73998a12bed6de10ebbe2f4d0a6dac1da1104de98d2b941`
- 环境：iPhone 15 Pro Max 模拟器，iOS 26.3.1 / build `23D8133`
- `sourceUnchanged=true`；测试前提交 `70c0b13457447ea75f4af84d4240d01b4384a506`，工作区 diff SHA-256 `7013a5f13bf54a553a8ff586b2dbd93961277d035fc547aa0f1a424eb3aaa55d`
- 安装 bundle digest：`c0162847423db883b8a1965803390de698d137e4058bfd566991a44b3464359f`
- 夹具计数：`wy=2`、`tx=4`、`ttmlAmll=2`
- 注音截图：`build/amll-ruby-final-1793661967/attachments-1793662231/1B3641EA-B7DF-4C94-A569-7958B3D2FA05.png`，1290×2796，SHA-256 `3611de595091de79d14fff49002c1bc67cc845bb8d8a8be62ed530ed17d76315`

截图中 `kanji` 实际绘制在“漢字”上方；同一行的“ruby tail”仍是普通演唱文字。XCTest 同时通过 `CONTAINS "注音：kanji"` 找到歌词行，证明合成注音进入既有可访问标签。该断言证明标签存在，不替代实体机 VoiceOver 发音验收。

## 构建状态与边界

提交前未签名 archive 为故意保留的工作区构建，manifest 为 `dirty=true` 且列出八个待提交文件：

- IPA：17,831,759 字节，SHA-256 `b433beb38b1a8e185bcf6e2e292528fc12e6e0f27885af1da9cefdf0eaae07df`
- manifest SHA-256：`49a69a9cc46030f1f00c0958908f82025198a902c480b5a6c8b166bb5afe61ef`
- 已复制到 T7 `NexusMusic/BuildArchive/2026-11-03-amll-ruby-precommit-70c0b13/`；IPA/manifest 哈希一致，archive 目录逐文件比较无差异。

该 dirty archive 只证明 precommit 源码可构建，不能作为产品提交产物。功能提交后必须从干净工作区重新 archive，独立检查 manifest commit、`dirty=false`、IPA/archive 字节、ZIP CRC、架构、SDK、最低系统、设备族、未签名状态以及生产注音标记和测试/私人数据排除。

当前明确未覆盖：

- AMLL 只支持一个 `base` 加一个 `textContainer/text`，不覆盖多注音、嵌套注音或任意 TTML2 ruby 布局。
- 标准 `<ruby>` 不覆盖 `rtc` 分组、多个并列注音、跨行基础文字、注音换行及复杂注音定位；`rp` 只被忽略，不作为可见回退。
- 未实现完整 TTML2 样式、字体回退和复杂 ruby 排版。
- 标准结构只有解析单测；当前 App 渲染夹具使用 AMLL 结构。
- 验证只到 iOS 26.3.1 模拟器、合成歌词和可访问标签存在；实体 iPhone、实际 VoiceOver 操作、动态字号/小屏、真实歌词库、签名、安装、续签及 iOS 27 Actions 终态继续开放。

本批不关闭完整 TTML2、S4/J35–42、iOS 27 或项目总目标。
