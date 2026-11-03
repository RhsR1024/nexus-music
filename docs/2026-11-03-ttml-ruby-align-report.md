# TTML `rubyAlign` 与横排 `outside` 增量回执

## 范围与依据

2026-11-03。本批继续补齐 W3C TTML2 `tts:rubyAlign` 与
[`tts:rubyPosition`](https://www.w3.org/TR/ttml2/#style-attribute-rubyPosition)
的无歧义横排子集。依据为
[`tts:rubyAlign`](https://www.w3.org/TR/ttml2/#style-attribute-rubyAlign)
及规范中的 `<annotation-position>` 语义：

- `start`、`center`、`end` 将整段注音放在基础范围的起点、中心或终点。
- `spaceBetween` 把基础范围扣除注音宽度后的剩余空间放在注音字素之间。
- `spaceAround` 把剩余空间等分到首尾及每个注音字素之间。
- `withBase` 在注音与基础字素数量相同时逐字素居中，数量或宽度不匹配时回到 `center`。
- 未声明或未知值采用实际可见的 `center` 初值；当前横排中的 `outside` 解析为上方 `before`。

本批是音枢原创有界TTML能力增量，使用合成XML和正式Release夹具。没有新增Sollin样本、
目标运行时观察、私有请求、凭据或商业逻辑移植，也没有把包内模板扩展成服务探测或
全局客户端配置。

## 实现

`src/lyrics/parser.ts` 为 `LyricWord` 增加可选 `rubyAlign`。`src/lyrics/ttml.ts`
只从注音容器读取该属性，并把值附着到实际含注音的词；无注音词不增加字段。既有AMLL
容器、标准`rtc`/`rbc`、直接`ruby/rb/rt`与双侧注音都复用该字段，不增加第二歌词模型。

`modules/nexus-native/ios/LyricRubyLayout.swift` 提供纯值字素切分和水平起点计算；
`NexusLyricsModule.swift` 读取配置并仍由当前TextKit实例绘制注音。Swift组合字素边界
避免拆开Emoji、组合附加符或代理对。布局不改变播放器、权威队列、暂停意图、单词时间线
或React列表刷新频率。

正式夹具在既有注音样本后增加：

```xml
<span tts:ruby="container" tts:rubyAlign="start">起边 / st</span>
<span tts:ruby="container" tts:rubyAlign="center">中间 / md</span>
<span tts:ruby="container" tts:rubyAlign="end">到尾 / ed</span>
```

## 失败证据与修正

首次大字号 `build/SourceUITests-1793685342828.xcresult` 为0通过/1失败/0跳过。三组
对齐样本追加在最长注音行后，使XXXL行高达到714pt，超过418.67pt阅读列表视口。
没有缩小字号门槛或改成只校验元素存在；把对齐样本拆成独立歌词段后重跑。

第二次大字号 `build/SourceUITests-1793686136778.xcresult` 仍为0/1/0。测试辅助器
只向下滚动，实际原目标已经位于列表上缘外，`minY=306.94`而列表`minY=489.67`；
元素被报告为可点击不等于完整可见。最终增加真实`full-lyrics-list`视口内的双向滚动，
分别把原注音段和对齐段完整移入视口，同时保留高度、可见上下界和可点击断言。

两次失败xcresult与必要证据原位保留，未删除或记作通过。

## 自动化与界面验证

- `npm run check`：997项通过、0失败。
- 完整 `npm run test:native`：退出0，新布局单测覆盖六种模式、组合字素、`withBase`
  回退、超宽基础和非有限输入。
- 最终正常字号 `SourceUITests-1793686791272.xcresult`：1通过/0失败/0跳过、
  264.185秒、`sourceUnchanged=true`。
- 最终大字号 `SourceUITests-1793686417862.xcresult`：1通过/0失败/0跳过、
  315.965秒、`sourceUnchanged=true`。
- 两轮同源源码digest为
  `65c2971da8e60d76575250c0f35759e53980c73fb2a8725b686e8ce363e6c86f`，
  安装bundle digest为
  `01730b5831dc243a2e2d814f01d132150546fe8938a303d5f1f42ebf3c05e021`，
  fixture SHA-256为
  `564e821a7703ba8ea6a011ae6df6668c8df6a91b9d0ca0840f3ee215d812c709`。
- 正常字号截图
  `build/ui-evidence/ttml-ruby-align-20261103-r4/001-AMLL,-rtc,-rbc,-double-sided-and-aligned-annotations-rendered-around-base-text.png`
  为1290×2796，SHA-256
  `bcd082acf174285f5947104846e2866e3ddbf95d854df597d9e883ba6cbbf851`。
  人工亲看确认`st`、`md`、`ed`分别贴左、居中、靠右基础组；大字号截图确认完整
  阅读行和全部注音可滚动到达。
- 正常运行清单SHA-256为
  `b9063b718365c3ae7c05278b84824ff722bb7187643429abdfcb64b6e7b25cda`，
  UI摘要为`8b70fe6d2f8200e10276767b0bdc82fb5cf802d8ae9ee0d2e5f80075e86f3fef`；
  大字号运行清单为`5c8592372ff24e27b3f1b9f7ee24d5189b7dbd2610afb5f03dfa98ce50513d4d`，
  UI摘要为`8a1a088134e62b8ed19006777a7389fb2d06e49dac08ad4ca9bb75c512132635`。

`node --check scripts/test-ui.mjs`、Swift解析与`git diff --check`通过。构建中的既有
Sendable/weak-variable警告没有新增失败，不把历史警告写成已修复。

## 逆向与隐私边界

`node scripts/sollin-reverse-gate.mjs ipa --review`检查既有离线证据，结果为56 Evidence、
21 WorkItems、121 timeline事项、47 Findings、47 Paths，0错误/0警告。日志位于
`build/logs/ttml-ruby-align-ipa-review.log`，SHA-256为
`0dfc922640709d6d5bcd071be5115ebc199bacd6496caf2f053887381f4bb7e3`。

本批没有新增Sollin采集或strict review结论。测试服务器只提供合成歌词与既有脱敏
夹具，不访问私人账号、真实歌词库、私有音源或用户数据。

## 归档与交付

提交前dirty unsigned archive已通过。manifest绑定基线
`1a27c23548140b5e30ab2570fcc9869482dfd98b`且`dirty=true`，IPA为
17,842,149字节、SHA-256
`b347850f09dbfd7b9d5bcecdda3e84df6d36a611e50f5c54a3607084e42e07a3`；
arm64、iphoneos26.2、最低iOS15.1、设备族`[1,2]`且`signed=false`。独立回执
`5de3706d3b7df8187e4e6a674861e4be0b9ccf8c9189eb45f30bf13954d3a142`
为`passed=true`：151项archive/IPA载荷逐字节一致，ZIP CRC、生产
`rubyAlign/withBase/spaceAround/spaceBetween/outside`标记、无测试bundle、
无描述文件/签名材料及无`_CodeSignature`均通过。manifest SHA-256为
`14cfa40fa6d5bc02c318e6a68b54e89900f992e79a472262930f168d34b6362c`，
archive日志4,631,397字节、SHA-256
`da8f7067ff00c303826c49d5258a0b4ae5f72d906c2cca29a1cde7f136c63b75`。

完整证据已先复制至T7
`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-03-ttml-ruby-align-precommit-b347850f09db`，
包含精确unsigned IPA、展开archive、manifest、两份成功与两份失败xcresult、
运行清单、截图、四项测试/门禁日志、源码、tracked patch及git状态。669份
逻辑源文件/305,997,336字节逐项SHA-256一致，`SHA256SUMS`
SHA-256为`2c4b37c4d38ca62c6ae131856c96a55699f20297ba94c7b3287025bb49cea771`，
transfer receipt SHA-256为
`f91ce04917dc4ed9ec9844ee9211725527f9836bf858d88e9899cf19237d68b5`；
`deleted=0`、`movedUserFiles=0`、`activeBuilds=0`，源证据保留。

产品/测试/初始文档提交`a651aad8265114781008ec6223410d0ec8b39691`
后从clean HEAD重新归档。manifest与HEAD一致、`dirty=false`且
`workingTreeChanges=[]`，arm64、iphoneos26.2、最低iOS15.1、设备族`[1,2]`
且`signed=false`。clean IPA同样为17,842,149字节、SHA-256
`e56f2fd9dc78e420606d13886dae21fd973475304db560fd93c64f13a5a0f240`；
manifest 526字节、SHA-256
`8a499b606b1dc537c1264d6f0fc214d61b11626896fb8c53e9e175667437c93e`，
archive日志4,601,754字节、SHA-256
`346a72a3a02c7fa0110401714702f4668aeab4e5e81d527fa5a80d5c6d0aac65`。
独立回执
`7dcd80d060c38a580a625bc74b423c92e50d25175e133ab93df23d469b8a57c7`
为`passed=true`，再次通过151项archive/IPA载荷、ZIP CRC、生产标记、
未签名/无描述文件/无测试bundle及arm64架构检查。

clean阶段位于T7
`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-03-ttml-ruby-align-a651aad`，
保存精确IPA/archive/manifest、成功与失败xcresult、运行清单、截图、测试门禁日志及
提交源码。669份逻辑源文件/310,595,673字节逐项一致，`SHA256SUMS`
SHA-256为`a6cbd81cfcc6ca3b08f95657af9210ced84ffc795fcd81827b2f0977ae22ac8e`，
transfer receipt SHA-256为
`25d03ad5cf920f06293d6182db78ac1752ee022c9ee1668520be9937010b26b2`；
`deleted=0`、`movedUserFiles=0`、`activeBuilds=0`，源证据保留。

`a651aad..c178ea6`已正常push，先实核远端main为
`c178ea6c8f07b9f80dd9f0d86430767134591287`。push后GitHub Actions页面
实际显示旧`41563617753`/`235d0d8`运行，`41591188218`/`c178ea6`为唯一pending，
即1运行/1排队；未手动取消运行中任务，也未重派旧版本。Actions页面和解析回执已保存至
clean T7阶段`actions/c178ea6/`，回执SHA-256为
`57c1f795f0818b0f2c9eea33d321950f793dfefae53abc9371681a7a509880d8`，
快照清单SHA-256为
`dc9e80f86a979a99818798ca39f0928a60907c56af9a4bf6313a734b9bfcc1b1`。
随后仅为队列记录的docs-only提交`e68f7e6622676f085c19f0396ba6f8b28250c51c`
已push；工作流路径规则没有另派运行。阶段收尾快照时远端main为`e68f7e6`，
最新工作流仍是`41591188218`唯一pending且`41563617753`运行，即1运行/1排队；
终态快照回执SHA-256为
`6b8a73e2dba7e8d3ed4928bcb77af9cbd6e7da4626b450773be4b5642efe9cb2`，
快照清单SHA-256为
`d462ac916014efaf4e8cb4172f019ff6223efaf660378e7dddaa6b5571299872`。
`41591188218`的iOS27终态仍待后续运行结果，不以pending或本地Result替代。

阶段收尾检查无活动构建/归档/UI/逆向进程。内盘可用70,920,990,720字节，高于30GiB
阈值；T7可用617,358,557,184字节，`build/`约10.03GB、`work/`约415.5MB。
保留最新两个有效T7阶段、两组失败原件、当前增量编译缓存和全部源证据；本批未删除或
搬移用户文件。清理回执
`cleanup-2026-11-03-ttml-ruby-align.json`的SHA-256为
`c74210722ed59aec67fa963411ef9d95b02f5bd7cff6bb2ec3ab64248cdcc0c5`，
已随clean阶段保存。

## 当前边界

本批支持的是当前横排歌词行内、注音与基础字素可计算的六种对齐。竖排右侧/左侧放置、
跨行后的注音字素重新分配、`rubyReserve`、完整TTML2样式级联/字体排版、真实歌词库矩阵、
实体机VoiceOver、动态字号/小屏、签名安装及iOS27 Actions终态仍独立开放。本批不提高
完整TTML2、S4/J35–42、F/J或项目总完成度。
