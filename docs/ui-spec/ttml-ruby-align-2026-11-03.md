# TTML `rubyAlign` 增量：界面场景与量测

## 场景与来源

场景依据 W3C TTML2 10.2.36 `tts:rubyAlign` 与 10.3.3
`<annotation-position>`，不是 Sollin 截图、录屏或 IPA/APK 结论。正式夹具继续使用
430×932pt iPhone 常态窗口、默认 `blush` + `rose`，截图 1290×2796 @3x。

合成歌词在既有 AMLL、标准 `rtc`、`rbc` 与双侧注音后增加三组两字基础：

```xml
<span tts:ruby="container" tts:rubyAlign="start">…起边/st…</span>
<span tts:ruby="container" tts:rubyAlign="center">…中间/md…</span>
<span tts:ruby="container" tts:rubyAlign="end">…到尾/ed…</span>
```

## 量测与容差

- 基础字号为原生 24pt，两字基础框约 48pt（144px @3x）。
- 注音字号上限为 11.04pt，两个拉丁字约 12–16pt 宽（36–48px @3x）。
- `start` 注音左缘贴基础框左缘；`center` 左右余量相等；`end` 注音右缘贴基础框右缘。
- 三者相对于同一基础框的水平差应保持可见且单调，不以压缩到单个基础字形或全行居中冒充。
- 注音总宽超过基础框时允许等比缩至 7pt 下限；此状态只验证不越出基础框附近，不扩展为规范未要求的溢出策略。
- 行高继续由既有 `rubyInset` 与 `rubyAfterInset` 预留；本批不增加 React 逐帧刷新、第二歌词行或第二时间线。

## 大字号与截图证据

普通字号使用 `SourceUITests-1793686791272`，截图
`build/ui-evidence/ttml-ruby-align-20261103-r4/001-AMLL,-rtc,-rbc,-double-sided-and-aligned-annotations-rendered-around-base-text.png`
为 1290×2796，SHA-256 `bcd082acf174285f5947104846e2866e3ddbf95d854df597d9e883ba6cbbf851`。
人工亲看确认 `st` 贴“起边”左缘、`md` 居中于“中间”、`ed` 靠“到尾”右缘。

大字号使用 `SourceUITests-1793686417862`，截图目录
`build/ui-evidence/ttml-ruby-align-20261103-xxxl-r3/`。首次把样本追加到最长注音段时，
XXXL 行高达到 714pt，超过 418.67pt 阅读列表视口；把对齐样本拆成独立段后，
第二次仍因原目标部分露出列表上缘而失败。两次 xcresult 原位保留。最终测试辅助器
在真实 `full-lyrics-list` 内按目标相对位置双向滚动，直到原目标和对齐目标都整行可见；
原有的完整容纳断言没有放宽。大字号截图中换行基础与注音均可到达，当前范围外的
跨行字节素重新分配仍不宣称完成。

## 状态

| 状态 | 行为 | 验收 |
| --- | --- | --- |
| `start` / `center` / `end` | 注音在基础范围内按边缘/中心对齐 | 契约、原生布局单测与截图 |
| `spaceBetween` | 剩余空间均分在注音字形之间 | 原生布局单测 |
| `spaceAround` | 剩余空间均分在首尾与每个注音字形两侧 | 原生布局单测 |
| `withBase` | 注音与基础字形数量相等时逐字形居中，否则回退中心 | 原生布局单测与拒绝/回退契约 |
| 未声明 | 使用 TTML 初值 `center` | 既有截图回归 |
| 未知值 | 按规范回退 `center` | 契约 |
| `rubyPosition="outside"` | 当前单行歌词解析为 `before`（上方） | 契约 |

## 当前范围外

竖排中的右侧/左侧注音、跨行后注音字符重新分配、完整 TTML2 样式级联、
`rubyReserve` 字号/长度计算、真实歌词库矩阵、实体 VoiceOver、动态字号/小屏、
签名安装与 iOS27 Actions 终态仍独立保留。
