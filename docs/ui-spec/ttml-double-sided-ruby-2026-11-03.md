# TTML 双侧注音：界面场景与量测

## 范围与来源

场景来源为 W3C TTML2 [`tts:rubyPosition`](https://www.w3.org/TR/ttml2/#style-attribute-rubyPosition)，不是 Sollin 截图、录屏或 IPA/APK 结论。正式夹具使用 430×932pt iPhone 常态窗口、默认 `blush` + `rose`，截图 1290×2796 @3x。

合成歌词末行保留既有注音，并新增：

```xml
<ruby>
  <rbc><rb begin="63" end="64">双</rb></rbc>
  <rtc tts:rubyPosition="before"><rt>shuang</rt></rtc>
  <rtc tts:rubyPosition="after"><rt>sou</rt></rtc>
</ruby>
```

完整视觉文本为：

```text
AMLL：漢字（注音 kanji）
标准 rtc：音（注音 yin）
标准 rbc：多基（按顺序注音 duo、ji）
双侧 ruby：双（上方 shuang，下方 sou）
普通文字：ruby tail
```

## 预期布局

- 上方注音继续复用 `rubyInset`，下方注音新增独立 `rubyAfterInset`；两侧都不在高频歌词列表里增加额外 React 行。
- 注音高度复用 `ceil(clamp(9…12pt) × 1.25 + 1pt)`，默认大字号场景封顶 16pt；@3x 对应每侧最多 48px。
- 上方注音以基础字形范围居中，绘制于基础文字上方；下方注音使用同一字形范围，绘制于基础文字下方。不得用第二权威歌词行或重复时间线实现。
- 基础词、双侧注音与普通尾文字共用当前歌词前景色、活动色和透明度。
- `ruby tail` 保持普通单词时间，不继承 `sou` 或 `shuang`。
- 可访问标签按基础词顺序去重为 `注音：kanji，yin，duo，ji，shuang，sou`。

## 状态

| 状态 | 行为 | 验收 |
| --- | --- | --- |
| AMLL 双文字容器 | 一个 base，明确 `before` + `after` | 契约与正式截图 |
| 标准双 `rtc` | `rbc` 基础与两条 `rtc` 等数量配对 | 契约与正式截图 |
| 直接相邻双 `ruby/rt` | 两个基础词分别只有一个显式位置 | 契约精确断言 |
| 仅 `after` | 只预留/绘制下方注音 | 契约断言 |
| 单注解无位置 | 保持既有默认上方行为 | 既有契约回归 |
| 双注解位置重复/缺失/未知/冲突 | 无定义映射，安全拒绝并回退 | 契约拒绝 |
| 基础与注解数量不等 | 不按字符或读音猜测 | 契约拒绝 |
| 跨行、行间、右侧、完整样式 | 当前范围外 | 未验收 |
| 真实 VoiceOver/动态字号/小屏 | 需要实体设备手势与显示设置 | 未验收 |

## 证据

固定 Release `SourceUITests-1793670038024` 为 1/0/0，`sourceUnchanged=true`，摘要总耗时 345.561 秒。截图：

`/Users/ningli/WorkSpace/NexusMusic/build/ui-evidence/ttml-double-sided-20261103-r1/003-AMLL,-rtc,-rbc-and-double-sided-annotations-rendered-around-base-text.png`

尺寸 1290×2796，SHA-256 `894a427f91bf92b241dda65f7b044347e5696f93b455283782c3038b33430e64`。人工检查确认 `shuang` 位于“双”上方、`sou` 位于“双”下方，既有 `kanji / yin / duo / ji` 仍在各自基础上方。

## 限制

本场景证明 iOS 26.3.1 模拟器 Release 中的静态上下注音、无障碍标签与既有歌词路径共存。它不证明实体 VoiceOver 操作、真实歌词库覆盖、动态字号、小屏、多行 wrapping、跨行分配、精确行间/右侧位置、复杂字体、签名安装或 iOS 27 Actions 终态。
