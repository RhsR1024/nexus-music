# P2 稀疏cue原生绘制（实施前）

结构化解析已保留timedCues及全文，但NativeLyricLine只传words；稀疏合法片段仍实际行级显示。此次补齐该链路，不改来源解析规则、不推断未计时文字的时间。

原生把inclusive UTF8 byte range映射到UTF16 NSRange，限制每行2000cue/20000 UTF16、验证文本/有限单调时序/字节与组合字符边界。保留原始start/end，间隙补集静态完整绘制。若TextKit将cue扩大到跨越未计时字符的连字glyph，整行静态回退，避免替相邻文字造时序。只在布局签名变化时转换范围；原生CADisplayLink继续绘制当前行，不逐帧经React传递词或整列表。

NativeLyricLine传稀疏cue；Lyrics五处非当前行同时移除words/timedCues，保持非激活行原亮度和模糊。舞台仍以整行呈现稀疏cue，保留全文和行开始的双击定位，不把未定时片段拆成假词组。

验证：Foundation原生范围测试覆盖中文/ZWJ emoji/组合音标、前中后空隙、错误字节/文本/时间/数量；stage业务测试验证整行保留真实cue；正式结构化Navidrome夹具追加稀疏行，真实seek/暂停/播放，截图像素检查计时片段变化而首尾静态文字稳定。通用check、相关native及Release App结果独立记录，未取得真实服务/设备不计全部parse完成。UI主线配重/沟槽继续，不借此增加静态2/5。

实现中发现合法2000cue/20000 UTF16的中文行在接近24小时的合法时序下，JSON配置为277283字节，超过旧262144门槛。因此原生配置上限改为1MiB，行/词/时序边界保持；该精确边界用例原生已通过。原生布局签名使用sortedKeys，避免仅时钟更新时字典顺序改变导致重复排版。新文件通过既定pods.sh注册，Podfile.lock未变；生成的工程项目仅排序变化已恢复，不提交无关工程改动。

r1本地构建在执行测试前主动中止（SourceUITests-1792754191034，exit75、0/0/0，不计通过）：复核发现测试错误按不透明白色设peak>200，但舞台classic activeColor为56%白色（约143）；改为120以区分32%计时暗底。同时未计时文字不再叠加整行暗底，避免半透明颜色重复绘制变亮。布局重排后重新核对glyph边界。r2另目录重新构建验证，不覆盖r1。

r2（SourceUITests-1792754340800）0/1/0，失败在静态前缀像素差2962391。亲看已保存的Lead截图发现夹具继承了正常导航的neon舞台样式，80pt Unicode行实际分成多行；旧“整行左右窄带”包含其他行计时emoji，不能代表前后缀。r3固定正式偏好stageStyle=classic，并按实际亮色静态墨迹首/末行带取前后缀；额外对所有亮色未计时像素做零变化断言，保留原全行计时变化及回退/播放断言。增加取样前后完整截图和实际坐标日志，不换短文案或缩字号掩盖换行。r2原证据保留，功能仍未验收。

r3（SourceUITests-1792754768451）在测试编译阶段失败，Swift无法及时推断嵌套reduce像素累加表达式；改为等价的显式循环，产品未变，r4重新运行。未执行App的r3不计通过。

r4（SourceUITests-1792754949474）0/1/0：暂停后前跳、完整行计时变化、前后缀及全部亮色未计时像素零变化、回跳精确恢复均已通过；实际播放后的prefix差值24导致失败。截图已确认中文/é可读，但ZWJ emoji显示缺字框，不能声明Unicode视觉验收。r5只补播放期截图、静态像素变化数量/最大通道差与字体可用性日志，保持断言不变，定位量化/叠绘/字体问题后再决定修复。

r5（SourceUITests-1792755242551）复现prefix24；全部53969亮色静态像素中770像素变化，最大通道差仅1，suffix总差48；字体API确认AppleColorEmoji可用，磁盘runtime也有对应字体。r6为emoji presentation/VS16 emoji/keycap组合显式选择系统彩色字体，其他文字保留所选字体；需新截图证明缺字修复及布局。播放期检查经两次采样校准为最大单通道差≤1（不作平均），暂停/seek仍精确零差；计时变化新增最大色阶差>16，避免把量化抖动当动画。本项为功能像素采样校准，不修改Sollin视觉ROI/SSIM/颜色门槛，也不据此增加UI完成量。

r6（SourceUITests-1792755531526）App功能1/0/0，但亲看四张实际截图，显式Emoji字体仍未修复缺字框，因此撤回该字体改动，不将通过测试当作Unicode显示正确。原生范围检查及é/CJK计时已证明；Emoji显示单列缺口。CoreText只读检查确认runtime字体含woman/laptop码位及非零glyph，但这不证明UIKit最终光栅正确。r7追加离屏UILabel/TextKit、默认/显式字体四组诊断图，与实际App图分开，不作页面验收图。

## 当前快照提交检查

2026-10-23按用户要求先提交当前全部文档代码。`npm run check` 508/508、完整`npm run test:native` exit0（含新增稀疏cue范围及大配置边界）、`node --check scripts/test-ui.mjs`、`git diff --check`通过；native保留既有Sendable警告。本轮未重跑r7 App/新归档，Emoji显示缺口继续开放，不宣布全部parse或UI对齐完成。检查日志保存到忽略目录`build/logs/prepush-snapshot-20261023/`。
