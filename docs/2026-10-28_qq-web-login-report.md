# QQ 网页登录入口与会话适配

本批按批次 8 推进账号入口。**匿名网页登录、取消及重启路径已验；完整 QQ 登录仍在实施中**，不把接口适配或模拟响应记作真实账号授权完成。

## 实施

- 账号页增加 QQ 卡片，沿用正式组件与正常导航；取消仅显示中性状态，不再重复报红。既有网易云入口保留。
- iOS 使用独立的非持久 WebKit 会话。固定官方 HTTPS 起点、导航与 Cookie 子集；QQ 网页入口只接受 QQ 身份，不把微信或通用 QQ Cookie 当作音乐账号。每次生成独立 state，并核对 QQ 音乐官方回调，之后才允许提交捕获结果。未使用 QQ App 桥接、客户端秘密或桌面配对。
- QQ 客户端读取官方资料并执行固定参考中的音乐接口检查；严格处理响应、身份错配、异常与取消。响应中的歌单内容不保存、不展示。资料读取成功仅显示“资料可读取”，不宣称持久会话仍有效。
- 账号元数据与 Keychain 会话分离；QQ 身份包含登录类型，能力列表为空。QQ 日推、微信、个人歌单、收藏和账号播放授权继续分别实施、验收。LX、Navidrome、播放器与权威队列未改职责。

## 来源与门禁

依据用户指定的 Q-music Android 固定提交 `5db858f32695d10c5e9ef0f7037d586aef6a8c4b`，涉及登录、Cookie、QQ 身份、请求与账号传输检查路径；9 个来源/许可文件与固定提交逐字节一致，回执 `build/qq-web-login-20261027/reference-check.json`。保留 Apache 2.0 与 Nshpiter/LX NOTICE，见 [第三方说明](../THIRD_PARTY_NOTICES.md)及[参考边界](Q_MUSIC_ANDROID_REFERENCE.md)。没有整包复制依赖、原生补丁或参考项目凭据。

已执行原生路由、亲读 PRIMARY、核对工具索引并通过 APK `--review`。该默认安装 case 不是功能证据；另对既有功能 case 执行 scope guard 与严格哈希 review，395 Evidence / 101 Finding / 99 Path / 3 workitem / 124 timeline，0 错误/警告。仅在内存遍历中过滤 AppleDouble 元数据，固定包未改。没有新增 Sollin 采集或 Finding；QQ 接口来自 Q-music，截图与操作来自 NexusMusic，不推断 Sollin 使用同一接口。

## 验证与本机索引

- `npm run check`：**665/665**，`build/qq-web-login-20261027/check-final-r2.log`。定向 14 项覆盖 QQ/WX 身份、通用 Cookie 拒绝、资料页不能单独成功、音乐接口拒绝、凭据与元数据分离、晚到响应及哈希期间取消等。均为隔离单元输入，不用于截图验收。
- 原生策略 CLI：真实模块中的 Foundation 策略被直接抽出编译；官方 URL、平台隔离、回调 state/重复参数、身份规则通过。`native-policy-final.log`；新检查已加入 `scripts/test-native.sh`。本批没有重报完整 native 套件通过。
- 最终真实内容 Release：`build/SourceUITests-1793122864541.xcresult`，**1/0/0**，总运行 **153.591 秒**。正常设置 → QQ 官方密码表单 → 空账号提示 → 关闭/重开 → 重启无账号 → 网易云入口关闭，暂停意图保持。没有填写账号或密码。
- `build/qq-web-login-live-20261028-r8/` 包含 candidate.patch、manifest、summary、5 张 `screens/` PNG、`screenshot-provenance.json`、`verify-state.mjs` 与 `state-verification.json`。五张均亲看且 ready；源码摘要 `4ebd2b0a3aaadf646eb63f3ed4a1f3918186a129dac2a74a4ae91d347ad0cbcc`。
- 两首原音频 SHA-256 保持：Shape of You `be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203`；Perfect `086eb96aef026bf336cf5884037a17b28f519b453c19547f3b29093f32ddda39`。全部 19 条存储记录摘要保持，账号库仍为空，涵盖原队列、偏好及扫描授权。本次是保留真实 V261020 来源音频的 App 流程验证，不增加真实播放验收项。

R1 只证明页面可开/可关；亲看发现移动首屏只有“一键登录”。R2 匿名点击未推进，因此没有将其记为可用登录。R3 改为默认桌面网页呈现，实际密码表单通过，四张 PNG 亲看/ready；R4 增加真实空表单校验。最终证据不覆盖早期缺口。场景、主题与质量边界见 [UI 记录](ui-spec/qq-web-login-live-2026-10-28.md)。

## 未验证边界与后续

真实账号授权、成功回调后的实际 Keychain 会话、重启资料读取、实际失效及 QQ 服务权限尚未验证；不使用私人凭据或真实个人歌单补齐。QQ 官方网页按钮在当前模拟器显示字形异常，但 AX 标签“登录”、实际点击及空账号校验成立；网页兼容与完整登录体验继续验收。官方 QQ 互联也没有承诺 App 内嵌 H5 接入支持，不能写成 SDK 应用认证通过。静态图不证明动效一致。

实体 iPhone 当前 tunnel disconnected、developer mode disabled、DDI false（`devices-20261028.json`），不计真机或签名验收；Android 对应宿主仍未接线。当前模拟器保留原真实数据，阶段收尾关闭以释放空间；检查时磁盘约 9.3 GiB 可用，未删除使用中的构建缓存或证据。

上一源码 `9e7c6f5ad0b128c997d3864c2f2c127538b84248` 的 [CI40511643805](https://github.com/RhsR1024/nexus-music/actions/runs/40511643805)已失败：checks/native 通过，首组 App **21 过 / 1 败**，失败为封面迟到响应时序；后续匹配、离线 App 与 IPA 步骤跳过。因此旧“CI 运行中”已过时，不能把该云端算通过或声称离线云端通过。只读日志与文本证据已保存，没有查看夹具 PNG；继续核对原生 10 秒超时与测试切换时序，不降低断言。


### 提交前复核与中间回归

QQ 密钥优先级曾误套微信回退条件，已按固定源码纠正：QQ 分支保留第一项非 W_X 音乐密钥，包括 Q_H_L；665 检查再次通过。R5 的空表单提示观测失败保留为失败，未充分确认其根因；R6 以实际可见的空账号提示验收并记录前后文本，1/0/0。R7 加入正常载入指示，并在文档完成载入后操作表单，1/0/0；亲看发现已停止的进度控件仍留下空白原生玻璃底。R8 在载入结束时移除该导航项，当前完整源码 1/0/0，五张真实截图来源与亲看通过；早期失败及第三方网页兼容仍保留边界，不据此宣称真实账号服务通过。


## 交付与收尾

源码 `de7f5b955c2bbfa03047d79ba6ecec4ec2b8120a` 正常提交并 push，远端完整 SHA 核对一致；[CI40554716636](https://github.com/RhsR1024/nexus-music/actions/runs/40554716636) 运行中，当前1运行/0等待，尚不计云端通过。自有测试模拟器已关闭，真实数据保留。重复导出PNG仅在SHA与保留的正式PNG完全一致时删除，原始xcresult与文字/未解决失败素材仍保留，回执为 `build/qq-web-login-20261027/cleanup-receipt.json`；未清理构建缓存、逆向样本或引用证据。
