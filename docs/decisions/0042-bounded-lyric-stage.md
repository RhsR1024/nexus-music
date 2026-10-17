# 0042 有界歌词舞台

2026-10-17，A09/F26/F27。新增可工作的第七种音枢布局；完整参考特效和 AM2 不随此项勾选完成。

## 证据与取舍

先执行 reverse-skill macOS master-route，PRIMARY mobile-reverse，沿当前离线样本 scope 和 case-guard，通过项目门禁。E-014 已确认独立舞台、半开外层时间段、组起点扫描与身份守卫。E-015 补充 StringCharacters 字符计数、短组/flush 的四字符比较、按索引均分时间及 CJK 范围；采纳前 strict review 为15E/14F/14P、7工作项/23事件，零错误/警告。详见[专项报告](../2026-10-17_reverse-sollin-stage-rules-report.md)。

不按方法名猜测完整分段，也不移植未知 widget field88 偏移、商业特效或原包绘制代码。音枢沿既有正值延后偏移契约：展示时间=播放毫秒−全局/本曲偏移，定位反向加偏移。普通行级歌词保留完整行，不制造逐字时间；真实逐字词按原时间组成短组，长词保持完整。四字符为音枢展示预算，以 Unicode 标量保守计数，并保护跨词的组合符、连接符、肤色/变体与旗帜边界；不宣称与参考 grapheme/flush 全规则一致。

## 五参考比较

本批逐一复核固定 HEAD，沿[参考比较](../REFERENCE_COMPARISON.md)的来源和许可，不复制源码或引入依赖。

| 参考 | 亲读证据和采纳 | 维护、Android 与许可边界 |
| --- | --- | --- |
| 悦音 d6f1af7 | `src/components/common/LyricsView.tsx:61` 独立行和 native Animated；只采纳可见内容/动画职责分离 | Expo54接近；不移植其完整列表或动画，根MIT及资产边界保留 |
| Q 547ccfe | `src/screens/PlayDetail/Vertical/Lyric.tsx:62` 行/字进度、KaraokeLine 与列表分离 | RN0.73及原生模块不搬入；根Apache2/逐文件边界保留，Android绘制另验 |
| wtf 6624ab5 | 同路径`:57` 行级焦点与列表职责 | 不据行级模型宣称具备本次舞台；不引入其旧导航/播放后端，Apache2/逐文件独立 |
| Cy bf0d469 | `src/components/lyric/index.tsx:23` 滚动限频、`:50` 歌词管理器和播放器状态分离 | 不升级Expo57/RNTP或引入gesture-handler；根Apache2和RNTP独立许可，Android另适配 |
| 自有 Wayferar 8e47cdc | `app/src/main/java/com/wayfarer/music/importer/StageLyricLayout.java:17` 测量宽度、Unicode边界和保留时间索引 | Java为参考，Smali权威边界沿原记录；不复制Android Paint/View实现，自有/第三方许可不混合 |

## 实现边界

`lyrics/stage.ts` 从当前歌词文档建立最多10000行、每行最多2000词的时间轴。半开外层区间保留空隙，重叠主行按输入顺序首个命中；组按起点推进，返回同一对象直到组变化。首词尚未到起点时显示等待，真实单词动画按自己的起点控制。无效字时序降级为整行；背景声不替换主行，完整歌词入口继续保留原文档。组不修改原歌词或播放队列。

`Lyrics` 只显示当前组，复用 TextKit 原生累计绘制，暂停/缓冲不推进。分段文档按文档/布局/实际时长 memo，不在每帧构建列表；歌词加载结果按歌曲、录音版本、文件版本和用户选择隔离，切换时不呈现旧组。舞台复用实际录音的封面与歌词，原曲负责收藏/队列，同一控制器负责进度和定位。来源选择、全部歌词/偏移与原有六布局保留。

当前没有参考特效公式、入退场/碎片动画、完整分词/画面等价或实际帧率证据。音枢舞台先交付当前组与真实扫色，不把新增选项当作完整视觉对齐。背景人声专用舞台绘制、VoiceOver、大字、手机功耗/后台仍单独验收。TS时间轴可共享Android；TextKit/字体/生命周期需对应原生实现。

## 验收

342项业务/类型检查通过，覆盖真实词保留、半开区间/空隙、正负偏移、原文不变、坏时序降级、Unicode组边界及布局持久化/写失败。新增App断言覆盖真实逐字舞台、偏移入口与暂停，正式入口Navidrome组另核同源60秒及切换控制。App分项结果为歌词141.407秒、正式Navidrome206.720秒、分组导航109.951秒/大字持久化146.224秒，均通过、零跳过；前两次测试查询/滚动失败和修正已保留。首词延迟起点最后修正由单元检查覆盖，不将之前App日志写为该边界新跑。本地清洁IPA及对应iOS27结果以[BUILD_STATUS](../BUILD_STATUS.md)后续实测记录为准，本文不预填成功。
