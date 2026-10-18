# Sollin AM 封面与正文状态证据

2026-10-18，普通移动逆向，flavor=null。本批对固定IPA的AM正文状态、封面节点、歌词/队列页面与控制区做限定原始指令核验。确认三态互斥和重复选择回封面；此前疑似评论回调实际为音质选择，已明确纠正。截图的评论状态不扩展为固定IPA第四枚举。下一原创实现完整封面/正文切换，实际App、归档、云端和真机分别验收。

## 范围和来源

reverse-skill cab634bd855fc287f6e420c1f36fd1a6b9245960，macOS原生master-route-20261018-230619命中R2/mobile-reverse；亲读PRIMARY/工具索引，原case scope=granted/offline/ready，未重新case-init。没有运行参考App、注入、签名或访问任何参考服务。IPA SHA256 c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07，App成员640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d；__TEXT内slice VA等于偏移，FAT raw加0x4000。

沿E001容器/导入身份与已有no-analysis元数据；Blutter0039efb1/Dart3.12.2 unboxed-reader只给地址、类名、池身份，不声称完整反编译。索引Python3.12.14与cstool5.0.3实际解码，逐字节及独立BL立即数复核；1830原始指令、160BL、128池加载。原始输出/脚本/样本仅留忽略work。

## Evidence → Finding → Path

E040 `evidence/am-content-evidence.json` SHA256 `0ab53e385f00b6ec1ae464d367a0a6c528ec24de9ca10713348e815e0325d84f`；F039 info/reverse_algo/candidate/high；P039 callflow。WI014及timeline/field-journal已更新，采纳前40E/39F/39P严格review零错误/警告。E039只补截图构图观察。

| 原始位置 | 有限确认内容 |
| --- | --- |
| 0x7bdcf4–dcf8、0x7bdd34 | 初始album池对象写入state0xa7 |
| 0x511874–887c、0x511a00–a14 | setter先比较当前值；捕获状态/目标后setState闭包写同一0xa7 |
| 0x51d0e0–d0f4 | 当前等于目标时替换成album，再调用同setter |
| 0x51d0a8–b0、0x51d134–13c | queue/lyric池对象分别进入同toggle；不是独立播放器 |
| 0x51c330、0x51c568、0x51c77c | 竖排分配AlbumPage、调用LyricsPage、分配QueuePage；各自有IgnorePointer/Opacity包装 |
| 0x513640 | 独立PlaybackControlArea；不据节点名称推断所有约束/动画 |
| 0x51bdf4–be08、0x51be34–be4c | min/max约束实际AppleMusicArtwork尺寸；完整父几何/横屏/cover-flight未恢复 |
| 0x51d068→0x51af4c | 候选工具实际showPlaybackQualityPicker，禁止据猜测写成评论 |

```mermaid
flowchart LR
  I[初始 album] --> S[同一 state 字段]
  L[歌词入口] --> T[比较当前目标]
  Q[队列入口] --> T
  T -->|重复选择| I
  T -->|新目标| S
  S --> A[封面 歌词 队列互斥正文]
  A --> C[独立进度与播放控制区]
```

图按diagram-generator生成可编辑静态职责，不表示参考运行。docs-generator普通报告模板；没有适用IOC或ATT&CK。完整动画/手势/横竖精确几何/评论正文和目标运行仍未知。

## 原创采纳与复现

[0071决策](decisions/0071-am-body-and-artwork.md)记录五固定参考的实现、维护、Android、许可与验收。原创AMPlayer复用既有Cover/Lyrics/QueuePanel，封面/歌词/队列互斥，隐藏正文移出AX/触摸树；控制区保持，正文选择不操作播放控制器。原曲收藏、评论和实际匹配录音封面/歌词边界保留，其他音枢能力不移除。不复制AOT、源码、品牌/第三方资源或依赖。

```bash
source scripts/environment.sh
node scripts/sollin-reverse-gate.mjs ipa
python3 build/verify-am-content-evidence.py
node scripts/sollin-reverse-gate.mjs ipa --review
npm run check
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testZNavidromePlaybackAndCredentials
```

本机build独立验证器核对冻结manifest、1830原始字和所有BL通过。业务/类型387通过；正式App完整八布局/实际PCM/新正文几何与互斥/暂停定位/统计/重启/凭据清理正在执行，尚无本批App通过、清洁归档或新iOS27结论。真实服务、签名和真机未新增证据。评论正文、写真、舞台、其余31图与全部A/F/J继续，不提高开发百分比。

首轮正式App1792336384286完整1/0/0通过，原八布局/PCM/动效/统计/重启/凭据清理及新增AM方形包含/互斥/重复返回/暂停时钟通过。三张必要PNG与manifest/摘要留build/am-body-first-passed，封面及歌词画面已亲看；完整临时导出自动清理。横屏与大字预算增补后正在复验三项，首轮结果不混作后续代码验收。

横屏增补后三项手机1792336880545全部通过：横屏100.565秒、大字147.057秒、完整回归306.052秒；21合成鉴权/0失败，无新stream（缓存复用），不计真实服务。必要九PNG及manifest/摘要留build/am-window-passed。亲看横屏完整显示与大字图后发现超高歌词行自动居中可能滚过行首，操作通过不当作该项视觉成功；针对AM最大辅助字号改为行首对齐，并新增当前行起点位于真实列表视口的断言，最终复验中。

iPad1792337568682的AM窗口/歌词定位/长按/主控/清理120.417秒1/0/0通过，四PNG与摘要留build/am-ipad-passed，分栏截图已亲看；屏幕捕获方向/比例与XCTest窗口frame区别记录，不称精确参考几何或真机分屏完成。这是大字行首修正前的普通字号分支结果，不能混作修正后大字验收。

最终本地build/SourceUITests-1792337928789.xcresult大字154.595秒、完整八布局/PCM回归307.761秒，2通过/0失败/0跳过。当前行首实际frame断言通过；合成鉴权15/失败0，本轮无新stream，缓存复用，不计真实服务。截图导出/归档/对应云端另记。

最终五PNG/manifest/摘要留build/am-final-passed，修正后大字行首与完整封面已亲看；超高行仍需滚动阅读，不宣称整行同屏。临时完整导出自动删除；先前操作通过但视觉不足的图仍保留。最终40E/39F/39P strict review和独立1830原始字/BL/manifest重放通过；新文档链接与diff空白通过。
