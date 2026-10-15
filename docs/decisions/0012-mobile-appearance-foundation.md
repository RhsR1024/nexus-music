# 0012：移动版主题与导航基础

2026-10-15，S1，对应 J43–45/J49–50 的基础部分，不代表五皮肤或完整新拟态已交付。

## 比较与采用

按 REFERENCE_COMPARISON 固定六仓：悦音与本项目 Expo54 相近，参考来源/外观分组；Q/wtf 的 RN0.73 导航和播放器不可整套移入；Cy 的新 Expo/RN、Router 与 RNTP 不因 UI 重构引入；Wayferar 保留队列、多源、歌词时轴语义；Sollin c9d446f 的 uiStore/PlayerBackdrop 参考设置和渲染职责，但 DOM/canvas/CSS/AMLL React 不能作为 RN 原生组件直接使用。九张移动截图是视觉基线，桌面开源代码不是移动源码。

原创 semantic palette 接入现有主题兼容映射，避免逐页改配色同时丢失业务入口。外观继续由 PreferenceStore 原子串行写入；旧 preferences.v1 缺字段用默认值补齐，错误值拒绝，写失败不改变已生效状态。三个视觉基础为 classic/blush/soft，soft 不宣称完整拟物，blush 不宣称磁带已实现。

导航为发现/音乐库/设置 + 独立搜索，私人曲库进入音乐库页；旧设置 deep link 保留。发现使用直接占满页面的 FlatList，不嵌到同向 ScrollView。悬浮 mini 复用权威 controller，封面用既有缓存；播放、暂停、下一首接真实操作。底栏留白与安全区域适配，原有功能入口保持可达。

## 依赖与原生边界

采用本机 Expo54 bundledNativeModules 匹配版本并精确锁定 expo-linear-gradient 15.0.8、react-native-safe-area-context 5.6.0，图标使用 @expo/vector-icons 15.0.3（Ionicons），保留各包许可。原创 NexusMaterialView 使用静态 UIKit UIVisualEffectView 系统材质，LinearGradient 对应原生渐变；没有声称这是系统 Liquid Glass 专属 API。系统降低透明度或用户关闭玻璃时使用实色。组件订阅透明度变更并在卸载清理。Android 可使用相同设置与布局，模糊实现/降级需要实际平台测试，未交付 Android。

不更换播放器、数据库、脚本宿主、RN/Expo 大版本；维护 ios 工程，pod install 只增加对应 Pods，锁文件提交。没有执行参考仓库的安装脚本或原生二进制，没有复制参考图片或大块实现。

## 验收

旧设置兼容、无效设置与写失败保留状态；本地类型和业务测试；Release App 的外观保存/重启、一级导航、私人曲库、mini 与合成 Navidrome 实音回归；本地截图检查。云端 iOS27 单独跟踪；真机对比/性能与系统控制仍待设备。后续 S2/S3 继续封面取色、推荐卡片与五皮肤，不能用 S1 截图代替它们。


初次实测发现 expo-blur 15.0.8 的 BlurEffectView.swift:draw 使用长期未完成的 UIViewPropertyAnimator 调整 intensity，XCUITest 每操作等待 60 秒动画空闲；已中断该测试，移除该依赖，用原创静态系统材质替换，不使用测试专用伪装参数掩盖。系统降低透明度仍回退实色。发现页封面实测还发现网易旧 HTTP CDN 被 ATS 阻止：仅对已知公开支持 TLS 的网易/QQ CDN 升级 HTTPS，不放宽全局安全策略，不改私人服务器地址。
