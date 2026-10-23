# Sollin经典歌词字体与同内容基准阶段报告

本批确认了一个有限的静态样式机制，并建立经典页的同内容整页基准；没有完成经典页对齐。最终候选保留经典活动/非活动900/700字重，其他皮肤默认600。两次独立Release采集在状态栏以下零像素差异，但七个冻结关键区仍只通过六个，歌词区SSIM78.41%/ΔE00 5.60失败。全屏93.92%只是诊断值，不能替代页面量表或动效验收。下一批优先核对实际字体度量、截图时间与封面清晰度。

本报告使用普通逆向模板（flavor=null），仅发布脱敏结论及固定摘要。原始字节、反汇编、图片、歌词、scope及完整案例都保留在本机忽略目录；没有移植商业字体、封面或服务逻辑。

## 范围与样本

授权范围为用户提供的本地IPA和截图，用于音枢独立实现的UI校准；沿用本机 `work/sollin-ipa/scope.md`、`workitems.md`、`timeline.md`。网络范围仍是离线样本，无Sollin私人服务、目标动态运行或设备操作。APK仅复核已有互补门禁，本批没有新增APK功能结论。

|来源|固定摘要或身份|用途|
|---|---|---|
|原IPA|c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07|本地已授权样本|
|App.framework/App|640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d|原始字节复核|
|IMG_4854.PNG|d2e52a0f93d20fee320a3876cf8a5b0fdbd74430c55a71d73eb93c84e4b23c19|1290×2796、3x视觉基准|
|reverse-skill|cab634bd855fc287f6e420c1f36fd1a6b9245960|平台原生路由、case guard/review|

工具使用本机索引内的cstool与Python，按固定IPA原始字节独立回放644条指令字；没有使用IDA GUI或声称完整Dart反编译。Mach-O胖容器的arm64切片经有界load-command解析，依赖表含 `/usr/lib/libSystem.B.dylib`。这只是静态依赖检查，不是运行证明。

## 有限静态发现

|符号/位置|已直接核实|不能外推|
|---|---|---|
|ClassicLyricsPanel.buildStyle，0x678c2c|普通/活动字号来自设置字段；存在override时两者改取override|不能据此认定截图字号17、22或17.5|
|LyricFontWeight.heavier，0x67938c|`index=clamp(weight/100-1+2,0,8)`；FontWeight表index0=100、index8=900，700→900|独立审计最初的“+100/700→800”算术错误已撤回；正确为+200封顶900|
|buildStyle，0x678d6c；lyricFontFamilyOf，0x5166e0|字体族走主题AppFontTokens，可为空|没有证明截图使用系统字体或某个具体字体文件|
|buildStyle，0x678e04等|三个TextStyle的相应字段写入Double0；结合布局是letterSpacing=0的强线索|没有0.5pt字距的直接静态依据|
|ClassicLyricsPanelState.build，0x678adc|唯一直接BL调用buildStyle，override来自widget字段|preview闭包、renderer字段到截图三行的完整绑定仍未知|

所以本批的900/700首先是原生像素实验，也与有限默认机制候选相容；它不是截图设置恢复结论。原生UIKit的800/900在这组CJK文字上得到同样墨迹，不能以继续加字重替代字体度量检查。

## 截图实验与产品改动

新增独立正式组件测试入口，外部scene.json和封面输入在构建前后校验摘要，缺失或变化会阻止正式来源通过。封面裁片只作为本地输入，不进入生产bundle；它已含参考圆角，不能证明图片裁切、圆角或取色算法。实际原创合成WAV为284秒，原生定位接近266秒；最终截图显示4:27，参考为4:26，这个采集延迟仍须消除。

v3在采集前把关键区扩到header、cover、title/artist、lyrics、progress/time、transport、tools，覆盖应用区58.57%；颜色区域2.63%，系统top180px及音枢关闭/真实来源扩展分别声明。完整规格、覆盖和区域排除率见[冻结规格](ui-spec/batches/4854-classic-v3-r39-repeat.json)，没有删除失败歌词区或放宽阈值。

|轮次|唯一差异组|歌词区结果/判断|
|---|---|---|
|r31按v3重算|旧合成内容反例|封面和歌词失败；旧局部高分不能外推|
|r32|同内容输入|SSIM77.63%、ΔE6.00；活动墨迹13811，参考20857|
|r34|活动字重700|78.17%、5.75；墨迹15631，仍偏细|
|r35|仅本地开引号改向|77.83%、5.87，未改善，撤回该输入试验|
|r36|活动字重800|77.90%、5.77；墨迹18058|
|r37|活动900/非活动700|77.82%、5.77；活动与800同墨迹，不能继续靠字重解决|
|r38/r39|原r32输入、最终900/700；独立重复|两次78.41%、5.60，七区6/7；状态栏以下零差异|

产品仅为经典歌词显式指定系统字重，同步RN隐藏测高Text、原生UIFont及layoutKey；字号17、行高、父容器和其他皮肤默认字重保持。自定义字体仍按原选择加载。本地465项检查通过；r34–r39各独立Release1/0/0，最终两次来源和外部输入摘要一致，主代理亲看全屏及歌词裁片。

另一个已定位的差距是 `CoverCache.swift` 最大512px，308pt×3的大封面会放大；本批没有修改缓存。下一批须评估高清播放器与列表缩略图的尺寸分层、内存/磁盘预算及失败回退，不能简单取消缓存预算。

## Evidence→Finding→Path与复现

本机案例新增E-051（文件证据，source_ref为`evidence/classic-font-ui-batch-20261023.json`，完整SHA在案例记录），关联WI-017；继承E-001样本身份、E-013渲染边界与E-050度量规则。F-043为info/design、candidate、高置信，位置为上述样式函数及音枢NativeLyricLine；候选状态保留了截图绑定未知的限制。P-043为solve：既有语义边界→原字节/表索引核验→全部关键区和重复采集。时间线记录同批动作，不把安装案例或案例门禁当成功能验收。

在具备同一授权样本和本机忽略案例材料的环境中运行；新输出不得覆盖旧证据：

```bash
source scripts/environment.sh
python3 work/sollin-ipa/notes/classic-font-byte-replay.py "build/classic-font-replay-$(date +%s).json"
node scripts/sollin-reverse-gate.mjs ipa --review
node scripts/sollin-reverse-gate.mjs apk --review
node scripts/visual-lab.mjs --spec docs/ui-spec/batches/4854-classic-v3-r39-repeat.json --out "build/classic-font-visual-$(date +%s)"
```

远程仓库不包含授权样本和原始附件，不能脱离本机材料凭这几条命令重建逆向事实。完整SHA、实际采集参数、安装bundle和xcresult绑定由案例artifact及每轮manifest保存。

## 构建、边界与后续

[云端失败处置](ci-recorder-timeout-2026-10-23.md)记录6f2e413的真实失败与已通过的11秒延迟复验：录制先就绪，再发起被屏障挂起的封面请求；不改生产10秒超时或像素阈值。录屏152帧/10中间帧是音枢模拟器证据，不能替代Sollin真机录屏。本阶段对应新提交的本地归档/云端终态见[BUILD_STATUS](BUILD_STATUS.md)，签名、真实服务和物理设备仍分别待验。

优先剩余：字体族/字号度量与同秒采集、高清封面分层、完整经典阶段出口；随后继续全部parse P2余项/P3–P5和平台登录→日推→FM纵向批次，不因本报告缩减范围。Phase0静态仍2/5；代码75.1%/完整交付53.0%不变。普通UI逆向没有威胁归因或IOC/ATT&CK适用项。

本批E-051 content_hash：0ff7c48010b58e5d10af9ef5af42d1509a2bf5cc066c00494bb2b2068ec643e2；source_ref/artifact_path均为本机case下evidence/classic-font-ui-batch-20261023.json。strict review：IPA51E/43F/43P、APK3E/2F/2P，均0错误/0警告；工作项和时间线已回写。

r40两行邻态SourceUITests-1792715330819，Release1/0/0，671.17pt控制栈断言通过；这是字号/行盒未改变的回归，不是参考图片颜色评分。

阶段归档与提交：27e19b7清洁unsigned设备归档通过：arm64/SDK26.2/min15.1/families1,2，dirty=false/changes=[]；IPA SHA256 7fd6184c1f451f5fe13d00aa8ee6ab9a11d86fe4dc78727b317eda8980fec772，12,276,065字节/83项CRC通过，生产JS SHA cd0b5e98a646c42c9c985738aaed1e5d64fc865025774165dff36826ddee5fd0与归档一致，测试标记和私人资源路径排除通过。版本产物留build/local-classic-27e19b7-20261023。已正常push，云端39879388063/27e19b7运行，0排队；不计iOS27成功、签名或真机。
