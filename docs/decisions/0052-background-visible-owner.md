# 0052 全屏播放页的背景可见性

日期：2026-10-18。A04/A05已有功能对齐。采纳前reverse-skill R2/mobile-reverse与既有离线scope通过；E024→F023→P023独立重放2358条原始指令、28BL和9组池加载，严格review24E/23F/23P、8WI/44事件零错误/警告。完整参考算法/运行仍未知。

## 问题与选择

根页面和经典播放页均挂载AmbientBackground。此前两处仅按全局开关、ready、playing、非buffering门控，因此全屏播放页打开时，底层根页面仍有满足条件的动画路径。这个代码路径不等于已量测重复绘制、实际耗电或帧率。

音枢采用明确的全屏播放页呈现状态：Player将open且有当前条目的布尔变化交给根层；根背景不可见时移除MotionImage并保留静态渐变，关闭播放页或清空队列后恢复正常门控。经典播放页继续按全局偏好显示自己的背景，现代播放页保持独立背景偏好。AppState、系统减少动态效果和暂停/缓冲仍由原MotionImage/权威播放状态控制。没有逐帧回传或第二播放状态。

E024只支持参考的当前路由/生命周期/活动实例/面积选择约束计时器，见[报告](../2026-10-18_reverse-sollin-cover-flow-report.md)。不移植其面积仲裁、MediaQuery未知字段、场景shader、HSV权重、静态Duration或商业逻辑。部分覆盖的Sheet不视作整个背景不可见；其他全屏业务层后续逐项核验。

## 五参考与维护边界

固定HEAD均已重新核对，来源及许可沿[参考比较](../REFERENCE_COMPARISON.md)。

| 项目/固定提交 | 亲读实现与取舍 | 维护与Android边界 |
| --- | --- | --- |
| 悦音 d6f1af7 | MiniPlayer.tsx:42–102曲目显隐动画和异步歌词active清理，仅参考局部生命周期职责 | 根MIT及原README限制；不引入ExpoBlur/Slider/逐进度React更新，Android另验 |
| Q 547ccfe | ImageBackground.tsx:52–104为Image/children分层，无可见实例仲裁 | 根Apache2、文件Meta MIT；不复制旧RN组件/依赖，不能当作iOS调度方案 |
| wtf 6624ab5 | 同路径52–104同样为图层包装，无动画可见性控制 | 根Apache2、文件Meta MIT；不引入全局事件或原生补丁，Android路径另验 |
| Cy bf0d469 | usePlayerBackground.tsx:85–122按URI/active取消迟到结果及50项有界缓存 | 根Apache2、RNTP独立许可；不引入RNTP或高版本Expo，取色iOS/Android字段各异 |
| 自有Wayferar 8e47cdc | HomeCardTheme.java:44–87 home-only保存/恢复图层及颜色职责 | 自有与反编译/第三方边界保留；Android View背景不复制为iOS实现 |

全部原创组合现有组件，没有复制源码、品牌资源、依赖或原生补丁。TS呈现状态可供未来Android复用，原生Modal/后台/动画和功耗仍须独立验收。

## 验证边界

359项业务/类型通过。正式入口SourceUITests-1792273286451背景专项308.007秒、1通过/零失败/跳过：红蓝实际像素、独立全局/播放偏好、重启、暂停、全屏经典页实际PCM、系统Home→激活与关闭恢复及凭据清理均通过，经典蓝背景和恢复截图已亲看。20成功鉴权/0失败、8次本机合成stream，不计真实个人服务。首轮UITest目标前缀遗漏以70退出且0测试执行，失败日志保留。MotionImage测试标识只观察实际送入Animated分支的运行门控，不能作为动画帧率/遮挡耗电或参考运行等价证据。本地清洁设备归档、对应iOS27、真实服务/签名/手机分别沿[BUILD_STATUS](../BUILD_STATUS.md)验收。
