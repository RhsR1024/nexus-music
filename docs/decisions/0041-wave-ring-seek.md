# 0041 声波核环形播放定位

2026-10-17，A09既有交互补齐；不将新增样式名称当作布局实现。

## 依据和采纳边界

reverse-skill macOS路由`work/master-route-20261017-223355/route-scope.md`为mobile-reverse；固定版本、样本和离线scope通过。E-013→F-012→P-012采纳前严格review通过13E/12F/12P、7WI/20事件、零错误/警告。原始指令/池加载确认声波核具有canGrab/begin/update/end/abort识别器，preview/commit/cancel分离；通过同一页面字段的store/load和池确认闭包，关联到唯一控制器seek。详见[专项报告](../2026-10-17_reverse-sollin-renderer-ring-report.md)。

只采纳交互职责；音枢环半径、12点顺时针进度、命中区域、跨端点夹紧和token隔离均原创。不声称参考环的全部几何/动画或动态运行已恢复。此次另核实layout0/1/2/3分别为封面/声波核/写真/舞台分支，舞台确实创建独立LyricStagePage；其具体绘制/特效与AM2仍继续分析，不新增伪入口。黑胶等音枢特有布局保留。

## 五参考比较

固定HEAD/许可沿[参考比较](../REFERENCE_COMPARISON.md)，本批亲读下列内容；不复制源码、依赖或原生补丁。

| 参考 | 实现、取舍 | 维护/Android/许可 |
| --- | --- | --- |
| 悦音d6f1af7 | `src/screens/NowPlaying/CircleSlider.tsx:20–108`实际为线性原生Slider，只有预览和完成职责；名称不能证明圆环 | Expo54/RN0.81基线接近，但不为此引入Slider；根MIT、资源独立，Android需分别验 |
| Q-1515 547ccfe | `src/components/player/ProgressBar.tsx:32–63,98–107`PanResponder拖动/完成和durationRef；不照搬未实现的terminate或全局事件 | RN0.73差异、不引入useDrag/全局事件；根Apache2及文件头独立，TS行为可共享 |
| wtfdelphia 6624ab5 | 同文件`31–62,96–105`预览/完成；没有本次token时长守卫证据 | 保留其上游维护边界，不复制Android/播放器代码；根Apache2/文件各自许可 |
| CyMusic bf0d469 | `src/components/PlayerProgressbar.tsx:34–78`归一进度和完成时seek，动画使用SharedValue | Expo57/RN0.86/RNTP不整体迁移；根Apache2、RNTP独立；Android真实后端不由此证明 |
| Wayferar 8e47cdc | `app/src/main/smali/com/wayfarer/music/importer/QishuiPlayer.smali:1184–1260`active守卫、时长夹紧和generation异步提交；不移入汽水专用后端 | 自有恢复源码/第三方许可边界保留；Android代码不当iOS底座 |

## 原创实施

已有FrequencyHalo的外环独立暴露adjustable控件，中心播放/暂停仍是兄弟触摸区域。开始只接受环带上的单指；移动只更新本手势预览，松手验证原播放token与原duration后仅提交一次controller.seek。切歌/解析变化、时长变化、系统手势终止、多指、后台、卸载及释放到中心均取消预览；不改变播放意图、队列或音频实例。跨12点沿运动方向夹紧端点，避免接近曲尾时突然跳曲首。

进度刻度始终代表真实播放位置；频谱仍只在播放且原生PCM频带有效时显示，不以假动画填充。VoiceOver提供增减10秒动作和时间值，语音读屏实测仍单列。无新原生模块/依赖；TS手势事务可共享，Android触摸/无障碍另验。

## 验收

335项业务/类型检查通过，新增覆盖角度/非法值、同token单次提交、旧token/时长变更、取消/无效输入、端点连续拖动。正式App `SourceUITests-1792248125950.xcresult` 综合回归198.360秒、1/1通过，零失败/跳过：暂停拖至60秒且线性进度同源，播放中拖环保持播放，中心按钮/真实频谱、多皮肤/歌词/mini/重启与凭据清理通过，亲看最终声波核截图。多指、后台、VoiceOver及拖动中切歌/时长变化未逐项注入App，守卫代码与业务测试不替代这些实机交互验收；清洁归档、push和对应iOS27以[BUILD_STATUS](../BUILD_STATUS.md)后续实证为准。真实服务、签名、手机和参考动态效果不因模拟器成功完成。
