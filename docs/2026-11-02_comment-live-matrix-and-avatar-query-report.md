# 五平台公开评论与头像查询参数回执

2026-11-02。本批补齐五平台真实公开评论矩阵，修正 QQ SDK 公开头像身份丢失，并诊断旧 iOS 27 录像启动失败。完整 F31、账号写操作、所有图片可用性、emoji 字形、签名/实体机与云端终态仍未完成。

## 公开头像修正

实际 QQ 响应包含 `thirdqq.qlogo.cn/g` 的 SDK 头像。旧实现去掉全部查询参数后，原本可用的图片会变成 HTTP400，同时不同作者退化为同一个 `/g` 缓存身份。最终实现仅在 HTTPS、无用户信息、默认端口、精确 host/path 下保留 `b=sdk`、有界公开 `k`、白名单尺寸 `s`；每字段只允许一次，其他参数与 fragment 丢弃。其他端点沿用去 query 的边界，缺失/无效/远程失败仍回退首字符。

复核纠正了草稿中把 `b` 值误写成 `oidb` 的假设。r2 是该草稿阶段，不能作为最终 SDK 修正证据；正式代码和匿名化测试使用真实响应的 `sdk`。没有提交作者 key、昵称、原始响应或图片。最终正式函数独立读取两张图片均为 HTTP200 JPEG，分别为 100×100、140×140；描述符摘要不同。部分作者原地址本身也会失败，本批不保证全部头像可用。

有意义的回归覆盖重复/非法/超长字段、相似域名/端口/路径、凭据与控制字符、根/回复独立 SDK 身份，以及两个公开作者进入不同原生 Cover 缓存 key。完整检查 `build/logs/check-comment-qq-query-final-20261102.log` 为 **940/940**；脚本语法与 diff 空白检查通过。

## App 验证与来源

所有真实评论专项均通过正式 Release 入口、公开匿名服务和正常搜索/更多/评论导航，验证正总数、热门/最新、第二页追加及关闭后不播放；酷狗、咪咕另验完整回复。五个专项现在断言实际 `Image` 的 `-image` 标识，容器存在本身不算图片加载成功。该断言只保证至少一张实际图片，不证明每位作者头像正确或可用。

| 阶段 | 结果 | 来源与用途 |
| --- | --- | --- |
| r1 修正前矩阵 | 5/0/0 | `SourceUITests-1793552226827.xcresult`；17PNG 来源 ready，联系表亲看，保留 QQ 首屏回退的历史 |
| r2 背景/评论联合 | 6/0/0 | `SourceUITests-1793553019185.xcresult`；全局背景570.374秒通过，19张背景PNG来源 ready并亲看；SDK修正前草稿 |
| r3 最终 SDK 源码矩阵 | **5/0/0** | `SourceUITests-1793554215133.xcresult`；酷狗108.594秒、酷我88.696秒、咪咕65.743秒、网易云70.602秒、QQ68.999秒 |

r3 `sourceUnchanged=true`，源码摘要 `014858879cfb970de1c2ba9ec8de5513aca6b0c8b97010c10530711be8397e78`，安装包摘要 `333ab2c369e933710de89f1d52825e1777d921f3ff77f056ff806700319daedc`，xcresult Info摘要 `0da3fb7097f5833cf2f7c7b5d21ba90a9ba1ec203cd10205e62661015d2fa14a`。r3导出17PNG均来源ready，联系表与QQ关键图已亲看；manifest SHA-256 `3861db875d8cdfebf81d2694aae9cf40aadeeb67715f6236de8cc061b7d00a09`，PNG index SHA-256 `a84bccb91eab7187658e3f47097e9371b448948601f322eb41b245b46a12b02f`。每轮日志、run-manifest、PNG index和来源核验存于忽略目录中对应的 `comment-identities-live-matrix-20261102-r1/r2/r3` 路径，不使用 latest 覆盖证据。

公开服务探针当时观测 WY总数158659/热门15/最新20、QQ4078/15/20、酷我23674/20/20、酷狗433740/20/18、咪咕311/5/20。服务内容和总数会变动；解析出头像字段不等于图片已加载。原始响应仅在忽略目录 `build/comment-identities-live-probe-20261102/`，摘要索引记录每份 SHA-256。

## iOS 27 失败诊断与录像加固

旧 run `41314376539`、提交 `69c9316` 的 checks/native通过，核心 App 22项为21通过/1失败。唯一失败是 `testGlobalCoverThemeChangesAcrossPages` 在 `theme-fixture-control?record=1` 抛错；此前颜色、暂停/播放及重启断言已执行，Navidrome主播放用例也通过。日志显示该控制请求约15秒后失败，旧服务端恰有15秒录像就绪超时。旧脚本未保留 recorder stderr，不能确定底层为何迟迟未就绪，也不把推测写成已修复根因。

取得并核验 ZIP SHA-256/CRC：

- compact artifact `13091937979`：`a99b0e7734b79c9070c8919d249e76c2408025af4be93a4dc10af96e8a8177d2`。
- failure evidence `13092227182`：`c731fdf34cd099ce85bbc9bbe1b21a69d2b63d438454df885c99c70275ad553b`，13张PNG已亲看。
- 完整诊断包764,762,658字节超过连接器536,870,912字节上限，未下载；不宣称全量原始 xcresult 已取回。当前诊断基于上述完整 compact 日志和截图，见忽略目录 `build/ci-41314376539/diagnosis.json`。

本批将录像就绪上限改为60秒，仍在真实封面请求开始之前等待；拼接分块 stderr，失败时记录有界 stderr、用时和退出状态。Swift 控制请求改 URLSession、有界超时及 HTTP 状态检查，保留全部原像素/竞态/录像断言。r2 本机 recorder启动961ms，录像 `ambient-transition-1793553018987.mp4` 实测164帧、8个中间帧，蓝到红4.3217秒，逐帧验证通过。本地结果不能证明托管 iOS27 的启动问题已解决，继续等新云端诊断。

## Sollin scope 与证据链

复用 mobile-reverse 路由 `work/master-route-20261102-005636/route-scope.md`、`work/sollin-ipa/scope.md` 与既有 **E-033→F-032→P-032**；它只支持评论 Sheet/分区/刷新与列表结构，不支持头像精确像素、全局动画或新的账号能力。没有新增 Sollin 采集或服务探测。IPA/APK case-guard、gate与strict review均0错误/0警告；IPA52E/17WI/107事件/43F/43P，APK3E/2WI/3事件/2F/2P。报告使用 docs-generator 的通用结构，flavor=null；本机网络及App证据与Sollin不可变Evidence分别留存。

在仓库用bash复现，输出目录应为新的未使用目录：

```bash
source scripts/environment.sh
export NODE_OPTIONS= PYTHONPATH=
npm run check
NEXUS_UI_RUN_DIR=build/logs/comment-matrix-reproduction \
  node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLive{Netease,QQ,Migu,Kuwo,Kugou}PublicComments
```

精确原次参数和入口见r3 run-manifest。真实服务需网络可用，不能以离线模拟响应冒充通过。

## 磁盘与交付边界

遵守用户全盘整理授权：不确定个人内容保留，优先迁移 T7。此前已完整封存并逐文件核验 CocoaPods1,392,008,366字节与WorkBuddy BundleMigration1,521,251,585字节内容，归档及恢复说明仍可取，见[既有空间回执](2026-11-02_comment-author-identities-report.md)。本次复查内盘约36GiB、T7约644GiB；活动构建/模拟器、当前Xcode、运行中的Qoder/浏览器缓存、reverse-skill原始证据及最新两个有效阶段均保留。当前检查回执 `build/logs/cleanup-20261102-comment-matrix-check.json` 未删除个人文件。

本批 unsigned IPA、提交、T7独立副本及远程队列的精确收尾结果在下方追加；签名、实体机、iOS27实际终态和原F/J总范围继续跟进。

## 提交前 unsigned IPA

本地 `npm run ios:archive` 成功，日志 `build/logs/archive-comment-qq-query-precommit-20261102.log`。dirty候选IPA为12,865,223字节、SHA-256 `e03d35b81ddbcc33caa5ed41ad0690e986f07259a3e6dbf1fb32e418465de66c`，manifest摘要 `a1b6f35d3ebad2845da9bb079f32248b925d45d6b41e5306864a5dd172bd4c44`；arm64/iphoneos26.2/最低iOS15.1/设备族[1,2]、未签名。164项ZIP CRC、archive/IPA内JS/可执行/Info.plist字节、生产SDK端点标记和测试/私有/签名材料排除均通过。验证回执 `build/logs/comments-query-archive-verification-dirty-20261102.json`，提交后的clean包独立记录。
