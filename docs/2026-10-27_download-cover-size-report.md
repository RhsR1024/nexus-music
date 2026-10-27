# 2026-10-27 平台封面导出尺寸

批次6继续落实已有E-838的平台封面尺寸配置，作用于iPhone已完成音频的显式附加JPG导出。五平台独立保存，默认最长边512，可选256/500/1000/1024/1200/2048；保持比例、不放大小图，实际尺寸由原图与来源可用性决定。这些有界选项属于音枢策略，不推断为Sollin平台规格或接口。

## 依据与边界

采用E-838→F-023→P-021、WI-003既有结论；包固定cab634bd855fc287f6e420c1f36fd1a6b9245960，原生master-route、PRIMARY与APK gate/采纳前review已执行，日志`build/download-cover-20261027-{route,gate,review}.log`。T7真实挂载/可写后只追加实施采纳timeline与workitem说明，无新Sollin原始采集。功能case严格哈希review：395 Evidence/101 Finding/99 Path/3 workitems/119 timeline，0错误/警告；本机`...-case-review-final.json`。review在内存过滤macOS AppleDouble的`._*`旁文件，固定包和证据数据文件不改；安装case不作为功能证据。

尺寸按原曲目在线平台固定在单次导出快照内，同时传入封面取得与原生JPEG阶段；歌词/元数据、缺失不输出占位与完成/取消清理沿用前批。设备文件策略不进入便携备份，旧设置补空表，原子并发保存及恢复默认保留其他平台。下载时托管侧车、持续目录和Android公共目录继续开放，不将显式导出记为这些能力完成。

播放器封面仍走原512/1024与`cover-v2`；在线导出走`cover-export-v1`及独立NexusExportCovers缓存，上限16MiB，避免与显示缓存混用。原生校验有界尺寸、8MiB输入/16M像素、JPEG输出和受控临时路径；统计/用户清理包含两种缓存。私人曲库封面保持原客户端512路径，未因五平台设置扩大私人访问。

## 验证

`npm run check` 640/640、typecheck通过；日志`build/download-cover-20261027-check-r1.log`。覆盖默认/无效值、并发原子保存/重启、备份排除与保留、请求固定快照及同尺寸传递、导出缓存身份与原生入口、私人/显示路径保持。完整`bash scripts/test-native.sh` exit0，`build/download-cover-20261027-native.log`；既有Swift非Sendable告警保留，未当作失败或无告警证明。

原生CLI使用V261020来源的真实Shape MP3和现有OnlineProvider取得的实际关联原封面3000×3000，不改原始输入。`build/download-cover-native-real-20261027-r1/receipt.json`记录七档真实JPEG输出、256小图请求1200仍256、四个非法尺寸拒绝、显示缓存hash保持及音频/原图hash保持。原MP3 SHA be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203；原封面SHA ee0ea9e0a0544bdcccfc8bb00ee813fe5a18063c2b2791dbc40c6b24c2766337。来源URL只留hash，无私人凭据。

Release R1 `build/SourceUITests-1793083196833.xcresult`：1/0/0、128.058秒。正常导航：网易1000、QQ1200、酷我500，QQ恢复默认不改网易、再设1200；重启三个值保持。真实系统四文件保存JPG1000×1000，295510字节，SHA7a3ee62f6edc49ddeefaae9c8986fbc33e30f9001b912cdac28d42f55c4ef720，MP3仍be80。八张实际PNG逐张亲看/来源校验ready=true，无夹具UI验收；索引`build/download-cover-live-20261027-r1/screens/index.json`。截图003为实际分享弹窗，002为系统保存四项。临时Files目录沿用旧名称Nexus UITest Fixtures，内容为原样真实MP3及OS实际输出，不是合成音乐/图片。

Release R2 `build/SourceUITests-1793083518479.xcresult`：1/0/0、84.583秒，正常选择256/重启/实际四文件系统保存通过。实际JPG256×256、17317字节，SHA eea92861245c96314a4094fac2e2517ea79406d36f2f83cc8c39139f467b2bd4；五张实际PNG逐张亲看及ready=true。两轮各有207行实际定时歌词和269字节白名单元数据；伴随MP3均be80。两个原生离线文件名/字节/SHA与此前相同，队列一项、播放128k、自动匹配及独立下载质量保持，导出临时目录0；两个尺寸在独立导出缓存内各自存在。`build/download-cover-live-20261027-r2/physical-verification.json`与两轮`actual-attachments-receipt.json`保留原样系统输出核验。

两轮最终源码digest均9fa40e2f720018cfad631e050a960943ba067832323ceca63d962efd72b97a4e，当前源码一致。十三张实际PNG均绑定精确构建、真实输入与hash。R1 008的1000选中按钮填充区域809/1682→1045/1820px，即78.67×46pt；与44pt点击下限一致，其他平台/尺寸可正常滚动到达，无掩码。仅静态质量/正常操作验证，不作全量像素或动效完成度结论。

## 未验证范围

当前只证明真实网易关联封面导出；QQ/酷我配置与重启不等于对应实服务封面下载通过。未声称本批重新PCM播放、真机签名、后台、全平台服务或动效对齐。iOS27云端终态独立核对；当前已登记手机tunnel不可用/开发者模式关闭，未真机验收。UI按0079功能与体验验收，默认blush/rose随真实Shape封面取色形成蓝底，不作颜色/像素相似度或全量UI完成度结论。下一继续持续目录/托管侧车等批次6余项。
