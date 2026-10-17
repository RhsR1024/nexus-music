# 0040 播放界面样式选择 Sheet

2026-10-17，A03/A06/A09、F26/J48；已有能力交互对齐，范围沿0033，不新增伪布局。

## 依据与采纳边界

reverse-skill mobile-reverse IPA E-011→F-010→P-010严格review通过（11E/10F/10P、7工作项/17事件、零错误/警告）。原始指令确认`_showPlayerInterfaceStyleSheet`0x3a5ce4→共用包装0x330370→Flutter showModalBottomSheet0x3306f8。build0x45fd00读取style provider0x2220和八项枚举列表；普通选择尾部0x4609f4调用setStyle0x460a24，再0x460a0c调用Navigator.pop0x339464。只采纳模态/选后关闭边界，参考持久化耐久性、完整渲染器映射/尺寸/动画/运行未证明；商业鉴权/预览分支排除。详见[专项报告](../2026-10-17_reverse-sollin-player-style-report.md)。

## 五参考比较与维护

固定HEAD沿[参考比较](../REFERENCE_COMPARISON.md)，本阶段亲读后的比较如下；没有导入依赖或复制参考源码。

| 来源 | 已读实现与取舍 | 维护、Android与许可 |
| --- | --- | --- |
| 悦音d6f1af7 | Library914–947选择行/选中勾与主题回调；采纳单一权威选择的原则，没有本批播放器布局映射 | Expo54/RN0.81选择模型可共享，导航各自维护；根MIT，资产另核 |
| Q-1515 547ccfe | settings/Theme/Theme.tsx16–48、78–94主题store/延迟应用；不搬入其延迟主题调度或整套导航 | RN0.73维护成本与音枢不同；Android主题能力不证明iOS呈现；根Apache2，文件自带许可仍独立 |
| wtfdelphia 6624ab5 | 同路径主题选择与store复用；无证据支持移入新的原生Sheet依赖 | 保留原模块边界，不复制Android适配；根Apache2，局部头独立 |
| CyMusic bf0d469 | settingModal615–645原生MenuView和选中态；不引入MenuView，复用音枢现有SheetModal | Expo57/RN0.86依赖不整体迁移；Android呈现另验；根Apache2、RNTP单独许可 |
| 自有Wayferar 8e47cdc | SETTINGS_POLISH适配/状态监听；SourceSettings8–18独立来源入口及自适应按钮；不移植车机视图 | Java恢复源码非iOS底座，权威Smali/第三方边界保留；Android功能不混入本批 |

## 实施与错误语义

设置→外观→播放界面样式使用现有原生pageSheet。保留六种真实布局（经典、AM、封面沉浸、写真、黑胶、声波核），复用PreferenceStore原子写入，成功后关闭；失败保留旧值、面板和可重试错误，保存中禁止重复选择。关闭/下滑/AX escape/Android返回不发起新写入，已经发起的保存按原子事务落定。用呈现session隔离旧写入回调，避免关闭/重开后迟到回调收起新面板。

大字号外观摘要改放标题下方，避免选择值长度挤压标题造成行高跳变。分类实例、滚动、未提交草稿及底层AX/触摸隔离保持；直接skins目标关闭回外观。主题Sheet保持选后留在面板。播放器内已有样式Sheet及其布局入口保持，唯一队列、进度、媒体与暂停意图仍属原控制器。无新原生依赖；未来Android共享偏好/内容，原生返回/呈现另验。

## 验收边界

331项业务/类型通过；最终App三项3/3通过：分组96.095秒、样式91.027秒、主题37.948秒，零失败/跳过，亲看最大字号选中截图。首轮摘要宽度引发分类行跳变失败已修正，未放宽±2断言；首轮Navidrome综合185.508秒通过属于摘要修正之前的独立证据，详细日志按BUILD_STATUS记录。保存失败沿原子仓储既有业务测试，不虚称App已注入磁盘故障。清洁unsigned归档、本机SDK26.2、云端iOS27、真实服务/签名/手机分别验收。参考八项名称不等于音枢八布局完成；AM2/歌词舞台及完整渲染映射继续取证。
