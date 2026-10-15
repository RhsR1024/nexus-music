# 漫途逐字歌词与三平台导入核验

参考固定提交8e47cdc701cdbb772577b2bf7abb699e285b0fa6。按仓库说明以Smali为权威、Java为阅读参考；未复制其反编译UI或车机SDK进音枢。

- `app/src/main/smali/com/wayfarer/music/ui/lyrics/KaraokeLineView.smali:2`继承Android View；395/404等直接Canvas.drawText；1146等ValueAnimator；1266为onDraw。Java参考位于同目录对应java路径，类声明24行。显示层是项目自定义绘制，不能称作直接使用某个可安装的歌词UI库。
- `ClassicLyricTextView.java:3`起使用Canvas、TextPaint、StaticLayout、Shader/LinearGradient、ValueAnimator、BreakIterator；滚动模式与单行舞台模式是两条绘制路径。`docs/releases/2026-10-05-253.md`描述累计高亮和当前字强调；257记录之前仅修单行而漏掉滚动模式。需要对照两条路径，不能只复刻一种效果就声称相同。
- 上述结论仅针对显示层；混淆后的歌词数据解析/上游算法来源尚未完整核实，不据此宣称整个歌词功能都无第三方代码。后续应记录真实时间→布局→累计扫色/当前字强调→滚动的边界，iOS用对应原生能力实现，不导入Android Canvas/ECARX。
- 当前音枢支持真实字时间和局部原生透明度动画，但漫途的完整累计填色、光晕/当前字强调和舞台过渡尚未等价实现，列为M8视觉收尾，不以QRC解密成功替代显示验收。
- `app/src/main/java/com/wayfarer/music/importer/PlaylistProviders.java:7`注明PlaylistOut（MIT）协议参考；10–12分派WY、TX、汽水，165起汽水读取，184起在线回退。它的三个平台确实是网易/QQ/汽水，不能误写为WY/TX/KW。

2026-10-15用户确认首版加入汽水歌单导入、使用其他平台匹配播放；PRODUCT_SCOPE F13和TASK_PLAN M6已更新。不接入汽水账号/直接播放。导入保留原ID和曲序；跨平台候选与原曲分开保存，低置信度待确认，单条无匹配不能导致整份歌单丢失。Wayferar的完整分页/重复保序/失败不覆盖与匹配参考，继续按决策0009/0010逐项复核。
