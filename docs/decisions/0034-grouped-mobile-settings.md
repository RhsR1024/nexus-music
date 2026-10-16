# 0034 移动设置分组与返回

日期：2026-10-16，F18/F25–27/F32–33，J41/44/50/53/54。延续0033的Sollin移动行为边界；证据顺序为IPA逆向优先、截图补充。已找到分类页、pushSecondaryPage和多组配置Sheet名称，但尚未恢复对象引用/调用关系，本批不宣称精确动画/像素已对齐。

## 参考与采纳

固定提交和许可沿REFERENCE_COMPARISON，本批主代理亲读：悦音`src/screens/Library/index.tsx:806–824`将外观、来源、缓存分入口；Q `src/screens/Home/Views/Setting/Main.tsx:14–25`定义设置组；wtf同文件`:16–36`按平台隐藏不适用组；Cy `src/app/(modals)/settingModal.tsx:403–435`声明式分组；自有Wayferar `app/src/main/java/com/wayfarer/music/importer/SourceSettings.java:8–18`分开Navidrome/音源入口（权威Smali attach/showLibraries见0031所固定仓库）。Sollin IPA静态设置路径见SOLLIN_IPA_ANALYSIS，不能从桌面DOM滚动或静态路径推导移动导航行为。

当前原创实现设置首页与“播放与歌词、外观与界面、数据与存储”，独立音乐来源页面，字体/歌词共用叶页。只提供实际可用操作；下载管理仍在最后S9，不提供虚假下载控件。排除Sollin自身账号/商业/支持/遥测，保留音枢已有全部功能。

首次访问后保留页面实例，隐藏页同时退出触摸/无障碍树；返回恢复各页滚动及未提交草稿，页面标题和返回按钮始终可达。来源从音乐库进入时，返回原音乐库。平台密码只保留当前设置会话内存，切出设置释放，不写导航/备份。字体与歌词叶页由播放/外观两组共用，不建两份字体管理或播放器。

数据页与音乐库提取共用导入/导出/预览恢复组件；沿原32MiB上限、明确确认和原子仓储，不挂载第二个LibraryHome。云备份、同步及缓存继续原服务/Keychain/ETag边界。

不复制第三方代码、图片、原生补丁或新增依赖。TS路由/页面分组可共享Android；iOS返回手势、VoiceOver焦点、键盘和原生文件选择器仍分别验证。测试覆盖真实首页/返回/草稿、持久化、数据入口、源导入和播放回归；本地/云端/真机证据分别记录。

2026-10-17：后续选择器优先核对IPA的showThemedModalBottomSheet、AppThemeModeSheet、ThemeSettingsSheet、FontSettingsSheet、PlayerInterfaceStyleSheet等结构；当前叶页只是已实现能力的阶段组织，不能以名称共存确认所有入口都是push或Sheet。封面全局背景优先于新增功能，详细证据和门槛沿[SOLLIN_ALIGNMENT_PLAN](../SOLLIN_ALIGNMENT_PLAN.md)。
