# 动态字号注音与全部歌词可用性回执

本批修复音枢已有原生注音绘制及全部歌词阅读器的 Accessibility XXXL 可用性，不增加 Sollin 私有观察或完整 TTML2 排版声明。

## 根因

`drawRuby` 将上方注音的 y 限制到首行 `rubyInset-height`，即使 TextKit 已返回第二行基础字形坐标，也会把其注音拉回首行。移除这个首行限制后，按基础字形区域定位。放大字号时，注音字号上限由 12pt 扩为 24pt，原生与 React 测量共同增加上下两侧注音行距。

全部歌词的顶部设置原先与歌词列表争用高度。现在顶部独立滚动，在辅助字号超过 1.8 倍时最多占可用高度 46%；歌词列表保持 `flex:1`，可独立滚动。搜索 viewport 和歌词列表增加稳定测试标识，测试通过实际视口滚动并使用键盘 Search 提交。

## 验证与证据边界

`npm run check` 为 995/995、零失败；完整 `npm run test:native` 退出 0。Node 语法、固定 Xcode Swift parse 与 diff 检查通过；原生既有 Sendable 警告保留。

历史结果 `SourceUITests-1793674469700`、`SourceUITests-1793674949643` 自动通过，但截图上注音重叠，均未采纳。第一轮坐标修正 `SourceUITests-1793675388793` 自动通过，截图已解除首行重叠，但第二行在屏外，只算中间证据。最终用例增加整行必须小于列表视口、整行上下边界同时在视口内的断言，不以“部分可点击”替代可见性。

大字号坐标修正正式 Release `SourceUITests-1793675777980` 为 1 passed / 0 failed / 0 skipped，摘要总时长 332.688 秒，iPhone 15 Pro Max / iOS26.3.1（23D8133）模拟器。`sourceUnchanged=true`，源码 digest 为 `ea76453fb6c88d5a239582c0d84530fa52e7e9343f1b0db7ac61dcdadad9c40a`，安装 bundle digest 为 `d5ba8334343b5d72435cdd37206896c13049fcf1b468162bf13b42bdfa63efe0`。

运行清单、摘要、服务计数、catalog 固定在 `build/logs/dynamic-ruby-xxxl-1793675777980/`。最终截图 `build/ui-evidence/dynamic-ruby-20261103-final/001-AMLL-and-double-sided-ruby-at-accessibility-XXXL.png` 为 1290×2796，SHA-256 `0146dfd129c370f988baf3c30cf9f65e9ed1c0fe38373dd824b9dca50e3ad597`，独立 provenance 为 `ready=true`。人工亲看确认两行基础文字及上下所有注音完整可见：首行 `kanji/yin/duo/ji` 各就其位，次行 `shuang` 在“双”上、`sou` 在“双”下，行间不相交。顶部区滚动裁切边缘是视口边界，不声称全页美术完成。

正常字号 `SourceUITests-1793676162886` 虽然自动通过且 4PNG provenance ready，亲看却发现顶部 ScrollView 默认 grow 占用空白，把歌词推到下方，未采纳为正常字号布局通过。已把正常字号也设为 `flexGrow:0/flexShrink:1`，保留辅助字号分支原样，并补充正常字号顶部区不得占用 45% 屏高的断言。

布局修正后、测试导航补强前的正常字号 `SourceUITests-1793676526557` 为 1/0/0、摘要总时长 315.671 秒，`sourceUnchanged=true`、4PNG provenance 全部 ready。源码 digest `bfab8bc1182abb1ed6906339bbf305a229dea7a5111bd23ec698b2efc7249bbb`，安装 bundle digest `57ab7ea8f6e041ef42d70816c769abc7064db30e67b733aac87285851d239f8a`。运行目录为 `build/logs/dynamic-ruby-normal-final/`，截图目录为 `build/ui-evidence/dynamic-ruby-normal-final/`。人工亲看第003张注音截图确认顶部区按内容收缩、歌词紧随其后，原注音与上下位置保留，SHA-256 `098fa8aa3ac7a3b360fcfaa743ded0e9a97c373fddda00b89fc0c043b8bd6486`；第004张舞台截图也查看，但不据此宣称整个舞台视口或全部皮肤完成。其余两张只核验来源与哈希，不报告人工验收。

大字号 `SourceUITests-1793676847899` 为 0/1/0，失败在 Swift842 打开全部歌词后的关闭按钮等待，尚未到注音截图。失败 AX 层级证明经典播放器真实视口为 y59–898pt，而入口为 y818–977.7pt；部分可点击不足以保证默认点击点位于视口内。测试改用 `classic-player-scroll`，要求完整入口位于带 8pt 边距的真实视口再点击，不增加产品重试或放宽最终截图断言。失败 xcresult、附件和日志保留。

最终大字号 `SourceUITests-1793677269098` 为 1/0/0、摘要总时长 320.132 秒，入口完整可见后点击、顶部区/独立列表、目标整行可见断言全部通过。`sourceUnchanged=true`，最终源码 digest `7f65505bf543fda1ae601e6a433fa774877b4da04d3901b632987ee87e290d68`；安装 bundle digest 与前述正常字号生产组件完全一致，仍为 `57ab7ea8f6e041ef42d70816c769abc7064db30e67b733aac87285851d239f8a`。本次只修改测试导航，没有再次改变产品布局。

运行目录 `build/logs/dynamic-ruby-xxxl-viewport-final/`；截图 `build/ui-evidence/dynamic-ruby-xxxl-viewport-final/001-AMLL-and-double-sided-ruby-at-accessibility-XXXL.png` 为1290×2796、SHA-256 `9f7accc90a0efdbf359954fc80a20e205ac6cb5d88add2608da7198590ccf189`。provenance `ready=true`，人工亲看确认两行全部基础文字和注音均完整可见且不重叠。此前正确截图仍保留为中间证据。

最终正常字号 `SourceUITests-1793677595524` 为 1/0/0、摘要总时长 233.530 秒；源码 digest、安装 bundle digest 均与最终大字号相同，运行前后源码一致，当前工作区源码也匹配该 digest。4PNG provenance 全部 ready，运行目录为 `build/logs/dynamic-ruby-normal-viewport-final/`，导出目录为 `build/ui-evidence/dynamic-ruby-normal-viewport-final/`。人工亲看第003张确认顶部区收缩及全部上下注音位置正确，SHA-256 `744472086e3f55f8204992b02b62a3334b9d3a4aa78ef7743f10ad261fd4e6dc`。其余三张只报告来源和哈希核验，不报告本次逐张人工验收。

复现入口为 `node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testAMLLProfileLyricsAtAccessibilityXXXL` 与 `node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testAMLLProfileLyrics`，均先 `source scripts/environment.sh`、清空 `NODE_OPTIONS/PYTHONPATH`，使用全新 `NEXUS_UI_RUN_DIR`，分别运行单一显式目标。辅助字号用例只在显式选择时启用 TTML fixture，不混入缺少对应 fixture 的默认运行。

本批继续走 reverse-skill-router，PRIMARY 为 mobile-reverse；既有离线 scope 和 IPA 样本摘要核验通过。复用 E-019→F-018→P-018 的独立歌词显示及字体角色边界（WI-002，并关联当前阅读器 WI-017），未新增目标观察、解包、私人服务请求或凭据访问。该证据不证明 Sollin 注音、大字号布局或默认值；本批排版完全依据音枢自己的失败截图与实现修复。timeline/workitems 已记录独立实现修复；strict review 为 56 Evidence / 21 WorkItems / 121 timeline / 47 Findings / 47 Paths、0 错误/0 警告，原有 Evidence→Finding→Path 不被测试结果替换。

## 空间与交付

本次检查内盘约 69GiB、T7 约 578GiB 可用；`build/` 约 8.32GiB、`work/` 约 396MiB、Downloads 约 564MiB、Library/Developer 约 9.61GiB、`.cache` 约 3.84GiB。当前无空间压力，活动构建、工具链、最新两个有效阶段、未解决失败及逆向原始证据全部保留，零删除、零个人文件迁移。回执：`build/logs/cleanup-2026-11-03-dynamic-type-ruby.json`。不确定的项目外个人文件只作为完整迁移候选，不能直接删除。

最终预提交 dirty unsigned IPA SHA-256 为 `9db6f50c7d4ae5545d5fe7f1ca07a7690f394dfd555123150dfaf79cd158ea4b`。178 项 ZIP CRC、151 项 archive/IPA 文件逐字节一致，arm64、SDK26.2、最低 iOS15.1、设备族 `[1,2]`、未签名；生产注音标记存在，测试入口、私人夹具、描述文件及签名排除通过。`build/logs/dynamic-ruby-dirty-archive-verification.json` 保存独立核验详情。

该归档与回执先复制至 T7 `2026-11-03-dynamic-ruby-final-precommit`，185 份文件、92,031,668 字节逐文件核验一致，`sourcePreserved=true`、零删除/零个人文件迁移。前一版 dirty IPA 也保留在独立 `2026-11-03-dynamic-ruby-precommit-6580b5c5`，不与最终版混用。

clean 归档、完整阶段证据 T7 核验、正常提交/push 及 Actions 队列在完成时补记；未完成项不预记成功。实体 iPhone VoiceOver、真实歌词库、复杂单词跨行、普通字号任意多行矩阵、完整 TTML2、签名安装及 iOS27 终态保持开放。
