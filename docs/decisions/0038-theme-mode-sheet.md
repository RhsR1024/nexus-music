# 0038 软件主题使用原生 Sheet

2026-10-17，A03/A06、F18/J41。已有功能对齐，范围沿0033，不新增主题能力。

## 依据

reverse-skill mobile-reverse IPA E-009→F-008→P-008采纳前严格review通过。`_showAppThemeModeSheet`0x3a6858在0x3a68a4调用`_showThemedModalBottomSheet`0x330370，后者0x3306e0直接调用Flutter `showModalBottomSheet`0x3306f8；主题编辑包装0x3a679c也走共用包装。仅采纳模态选择边界，不推断参考Sheet精确尺寸、关闭是否保存、动画或默认值。[专项报告](../2026-10-17_reverse-sollin-theme-sheet-report.md)记录坐标、证据与限制。

## 五参考比较

固定提交/许可证沿[REFERENCE_COMPARISON](../REFERENCE_COMPARISON.md)，本批主代理亲读：悦音Library908–947用三个主题行和立即回调；Cy settingModal615–645用原生MenuView及三态勾选；Q和wtf `settings/Theme/IsAutoTheme.tsx:13–34`在平台支持时显示自动主题并复用主题store；Wayferar SourceSettings8–18独立来源入口，无本次iOS模态实现可迁移。主题的权威状态复用可采纳；各自导航、MenuView依赖和Android主题适用性不迁入。

## 实施

外观→软件主题打开现有AdaptiveModal的原生pageSheet，类别实例/滚动保持。三种模式仍用PreferenceStore原子持久化；选择立即保存并留在面板，关闭、iOS下拉、AX escape或Android返回只关闭面板。底层分类退出触摸/AX树；面板独立标题、44点关闭和可滚动选项，无底部主导航叠入。直接以theme作为初始目标时，关闭回到外观分类。无新依赖、第二主题仓储或播放器。

现有完整背景编辑器继续是独立页，本批未把所有设置叶页改为Sheet，也未把摘要组件取色算法移入全局主题。未来Android共用三态持久化/内容，原生呈现、返回与权限分别验收。

## 验证

328项业务/类型通过；正式App两项和最大字号/下滑关闭专项通过，最终文案复验38.790秒通过，截图亲看。设备归档及对应云端结果按实际写入BUILD_STATUS；本地模拟器、unsigned归档均不替代云端iOS27、真实服务、签名和手机。没有参考运行结果，不宣称运行等价。
