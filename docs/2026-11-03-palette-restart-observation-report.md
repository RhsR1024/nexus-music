# 配色重启恢复的真实应用状态观测

本批针对旧 iOS 27 运行 `41553030339` 的配色恢复失败补证。固定 14 个边缘像素不能单独证明原始 palette 丢失：活动场景有 20 秒取样窗口，而重启后的静止场景只有一个固定时刻；既有 `AmbientSceneTests` 已包含第三色场完全避开 14 点的合法构图反例。本轮先用真实 store、原生 applied 状态和已安装背景层排除产品链路故障，再以整屏全屏截图保留视觉证据。云端原始 URI、seed 和参考端实际应用颜色仍未知，因此本批不关闭原始 iOS 27 故障，不把本地模拟器结果写成云端或真机通过。

## 观测路径

封面专项显式选择隔离 E2E 入口，以原生产服务默认参数创建服务。每次 launch 生成新的 boot UUID，原生观测仅在模拟器且环境 `NEXUS_UI_THEME_OBSERVATION=1` 时启用；正式设备不编译该接口，正常界面与无障碍树不展示诊断值。没有新的私人服务请求或 Sollin 观察。

检查点以不可重用的 nonce 绑定当前 boot；E2E 在原生主线程快照前后核对同一 store 对象，记录有序原始三元颜色和完整真实 URI 的 SHA-256。原生读取真实 `appliedColors`/`appliedIdentity`、有效 installed scene 色数、dark/pending、实际 display-link 状态和只读 timeline 时间，同时渲染实际 canvas 图层。弱引用列表避免最后一个已关闭播放器覆盖根背景观测；验收要求唯一可见且有效的背景实例，其已应用颜色和身份必须与 store 一致、已暂停并符合深浅模式。

可见性要求 view 转成 window 坐标后与 window 相交，并在祖先 `clipsToBounds` 时逐层求交；快照同时保存最终可见 frame。原生 PNG 不包含前景控件，取自真实已安装图层；查询不推进时间、不恢复相位、不修改服务或渲染参数。服务器为每个检查点立即写入独立 JSON/PNG 及 PNG SHA-256，拒绝旧 boot/nonce、重复回传、畸形字段与过大请求。只发身份摘要，不发送路径、账号、URL、凭据；仅合成封面功能测试会启用。

## 构图诊断

原生软光混色会把绿色显示成橄榄区，因此单像素三通道主色判断不适用于静止相位。最终诊断把真实背景 PNG 最近邻降采样为 86×186，每个像素计算三通道相对该像素最小值的高出量；任一通道高出中性底至少 6 时计入该通道。该结果只用于证明三色在已安装图层中均有可见贡献，不能单独证明 store 或 bridge 正确，因此同一次验收仍要求 palette 精确为 `#FE0000,#0000FE,#00FF01`、`sceneColorCount=3`、store/native 身份摘要一致，并要求 R/G/B 各自计数至少 200。

## 运行结果

- r1 `build/SourceUITests-1793680673149.xcresult` 为 1/0/0，593.609 秒；首次接入真实 store/native 快照，三态均唯一可见、已安装、暂停、palette 精确且身份一致。
- r2 `build/SourceUITests-1793681555883.xcresult` 为 0/1/0，483.815 秒；重启前后 store 和 native palette 都是 `#FE0000,#0000FE,#00FF01`，身份摘要都是 `9ea3c446…d1cd`。唯一失败仍是同一静止构图未命中固定 14 点，证明该边缘采样并非 palette 丢失的可靠判据。失败结果与截图保留。
- r3 `build/SourceUITests-1793682338519.xcresult` 为 1/0/0，测试 589.358 秒，`exitCode=0`、`sourceUnchanged=true`；源码摘要 `4a738e51…f18522`，fixture `564e821a…c709`，安装 bundle 与运行清单一致。运行输出位于 `build/logs/palette-native-observation-20261103-r3/`。

r3 三态均只有一个可见、已安装背景实例，frame 都是 `(0,0,430,932)`，pending/moving 为 false，palette 与 store 完全一致：

| 状态 | boot | dark | identity digest | R/G/B 通道样本 | timeline |
|---|---|---:|---|---|---:|
| 重启前暗色 | `1C7EAA8A…D443E6` | true | `5d3c8a44…7fb0b` | `15301/2044/13386` | 0 |
| 重启后暗色 | `24D1881B…C9A9` | true | `5d3c8a44…7fb0b` | `15192/3537/10881` | 3.510249 |
| 浅色重建 | `1C7EAA8A…D443E6` | false | `5d3c8a44…7fb0b` | `13462/1969/12557` | 0 |

重启前后 boot 不同而 store/native 的有序 palette 和身份摘要相同；浅色重建在当前进程内保持同一身份和 palette，变化的是实际暗色重绘状态。原生 PNG 实测 SHA-256 分别为：

- 重启前暗色：`7e409f7a5f67864cebe0e19aa73c830a928443b2a2dc3910c7a202f1e0b7b9b1`
- 重启后暗色：`97b7d7468a7bbbc95128c3d8da32eb0655d6c72c848f33b30942e4daa4538c1f`
- 浅色重建：`6df9ac7023aafbbca761365e0dca3e043338c9f9d81f6e2179fbd4d8abf3ffba`

精确 xcresult 另导出 25 张 1290×2796 全屏截图到 `build/palette-native-observation-20261103-r3-screenshots/`，索引 SHA-256 为 `dd47f0dbf399ecc63e3bded192c6be549485f995a6a054eff619cded379a798a`。人工亲看重启前暗色、重启后暗色和浅色重建三态，均能看到红/绿/蓝贡献；原生 PNG 进一步证明完整安装背景层而非前景控件保留了三色。

## 验证边界

检查点契约测试覆盖旧 boot/nonce、畸形字段、重复覆盖和证据对象快照隔离。`npm run check` 为 996/996、0 失败；完整 `npm run test:native` 退出 0；固定 Xcode Release 测试已真实编译 Swift，Node 语法与 `git diff --check` 通过。`ipa --review` 复用既有离线证据为 56E/21WI/121 timeline/47F/47P、0 错误/0 警告，无新增 Sollin 采集或私有探测。

本轮移除的是暂停态固定 14 点三色断言；全屏像素、停车稳定、跨页三色、亮度、运动、异步身份竞争和跨进程 store/native 状态断言均保留。替换项要求唯一有效安装背景、精确有序 palette、身份、暗色/暂停状态和完整图层三通道贡献，并额外保留原有全屏截图。检查点允许在 20 秒窗口内重试，最终 JSON 只证明最终成功检查点；失败尝试仍另存且未隐藏。

原生 PNG 是 scale=1 的独立已安装图层渲染，不能代替 `XCUIScreen` 的真实合成、遮挡或显示验收；本批同时保留 25 张全屏证据。模拟器编译/运行也不能代替云端 iOS 27、实体机、真实服务或签名验收。

## 提交、clean 归档与远端

提交前 dirty IPA 为 17,838,257 字节、SHA-256 `8eba44db9c889b4298b1ab1046cf3c09d0880dc21ea18964adb5a92dcfd94eeb`；T7 precommit 阶段逐项比较 606 份普通文件/619,109,169 字节，无缺失、额外载荷或差异。

产品/测试/初始文档提交 `d7bb46acedf8c1929db50f570820bc74f34e4f03` 后，从 clean HEAD 重建 unsigned archive。manifest 与 HEAD 一致、`dirty=false`/`workingTreeChanges=[]`、arm64/iphoneos26.2/iOS15.1/设备族 `[1,2]`、`signed=false`。clean IPA 仍为 17,838,257 字节，SHA-256 `a5663c03d45236a81e213ea9eeee35bde2d0c2481b8e222aaf13ab00fbf0f328`；manifest SHA-256 `b7a72f4cac6e729e8bd959c49401cc9805d726a6781d43e1f43f907dbcf138f1`，archive log SHA-256 `ae1f0d60a55bd434c3d59632371f78eed8992a76fa6aeb51e4fac6eb4fb4d781`。

独立回执 `build/logs/palette-clean-archive-verification-d7bb46a.json` 为 `ready=true`、SHA-256 `b033ce058045b8d4f25caac890f71de743b9e8eb6f44d8acea424ad5778da167`。178 项 ZIP CRC 全部通过；archive 与 IPA 各有 151 项普通文件，路径集合与逐项字节一致。`nexus-ui-test-theme-observation`、其他 UI 测试入口、合成账号/夹具、私人和签名材料均未进入生产包，`codesign` 明确返回未签名。T7 clean 阶段 `2026-11-03-palette-restart-observation-d7bb46a` 的 611 份普通映射路径逐项 SHA-256 一致，源证据保留。

远端 main 实核为 `d7bb46a`。推送后 `41584802858`/`d7bb46a` 为唯一 pending，`41563617753`/`235d0d8` 继续运行；旧 pending `41578685392` 由 `queue:single` 自动取消，实核 1 运行/1 排队，未手动取消或重派。新 run 的 iOS 27 终态仍待，不与本地模拟器、unsigned IPA 或历史 run 混用。

阶段收尾检查无活动构建或逆向进程。内盘可用 71,444,910,080 字节，T7 可用 618,402,414,592 字节；本批零删除、零个人文件搬移，增量构建缓存、最新有效产物和未解决 CI 证据保留。清理回执 SHA-256 为 `8e447e4a5eacbf9774f38bc941be24888a1c9d1818f6b516df389ac2b14c52bd`。
