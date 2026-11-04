# 网易热门歌手公开目录

发现页新增网易“热门歌手”，公开目录支持分页、取消、刷新和失败保留/重试；打开歌手复用正式歌曲/专辑详情，返回保留目录。没有扩大账号权限、音乐队列或下载范围。J09其余平台和真实设备矩阵保持开放。

## 证据与采纳边界

本轮按reverse-skill的R2/mobile-reverse路由，核对本机工具索引、既有离线scope和固定IPA SHA-256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`。未重跑case-init、未安装新工具或请求Sollin服务。E-057→F-048→P-048→WI-022只记录静态对象池的`neteaseTopArtistsProvider`、`NeteaseCloudApi::fetchTopArtists`（0x3cab08）与“热门歌手”（pp+0x3c590）；源骨架没有恢复方法正文，不推断实际调用图、分页或HTTP契约。

严格审查57 Evidence/22 workitems/122 timeline/48 Findings/48 Paths，0错误/0警告。原件与scope、timeline仅留本机忽略`work/sollin-ipa/`。五参考既有比较沿[REFERENCE_COMPARISON](REFERENCE_COMPARISON.md)；本轮额外亲读固定桌面`c9d446f6ad3b7ea1aff64bd5ce290b6e7f9712a8`的`neteaseAuth.ts:686`和MIT许可，只以其`/api/artist/top`作公开协议线索。匿名HTTPS响应独立验证，不复制weapi实现、账号、桌面组件、素材、依赖或原生补丁。TS契约可供未来Android复用，未承诺Android交付。

```mermaid
flowchart LR
  A[发现网易热门歌手] --> B[匿名公开目录]
  B --> C[校验分页与歌手身份]
  C --> D[保留公开元数据]
  D --> E[既有歌手歌曲与专辑详情]
  E --> F[返回保留目录]
  C --> G[失败保留旧页并重试]
```

`ArtistProvider.popularNetease()`只请求固定官方HTTPS地址，按30条页计算offset，显式`credentials:omit`，不使用设备ID或账号会话；只映射公开歌手元数据，丢弃响应中账号、关注等字段。成功信封、boolean more、数量上界、数值ID、重复身份及空页却more=true均校验。接口没有总数，不制造总数或完整艺术家曲库声明。

发现页复用既有代次和AbortSignal，切页/关闭后迟到结果不发布；续页失败保持原页码、已加载内容及more，重试请求原失败页。跨页有重复ID时停止追加，提示目录变化后刷新。嵌套详情返回保留目录，摘要明确来源为热门目录。新增独立XCTest文件，避开另一执行者正在修改的SourceSettingsTests；生产测试入口隔离沿原构建机制。

## 验证状态

类型/全量业务检查1016通过、0失败；新增7项测试覆盖匿名分页、终页/空态、缺失与畸形信封、重复/超量/非法身份、边界和请求前/迟到取消。艺术家聚焦16项全部通过。Node脚本语法、Swift测试语法、工程plist和diff检查通过。原生产品模块未改。

2026-11-04匿名真实读取：前两页各30位，合计60个不同ID、两页more=true；没有Cookie或设备身份。未把目录读取写成音频播放。正式Release UI与截图已按下方r4通过；清洁归档与正常push已完成（见末节），新iOS27终态继续；[UI规格](ui-spec/popular-artists-2026-11-04.md)记录固定验收条件。

当前同一仓库有独立WebDAV测试修正和模拟器专项，未接管其改动或进程。T7在本轮曾掉载又恢复；掉载期间停止外置读写，未创建内盘回退目录。内盘余量高于30GiB，未删除或迁移用户文件。

## 后续

本批正常入口/分页/详情/返回/刷新Release专项、截图及清洁归档交付已完成；下一继续独立功能验收。咪咕公开专辑真实创建副本/重启、其他热门目录、账号写操作、真实设备/签名、弱网限流与原F/J继续；项目目标仍active。

## 分轮验证记录

r1 `SourceUITests-1793750922152`界面1/0/0、145.820秒、sourceUnchanged=true，6PNG已亲看。r2 `SourceUITests-1793751527046`界面同样通过且源码未变。两轮结束时目标模拟器已由Xcode关闭，原run-manifest的installedBundle明确为unavailable；保留原清单，不把自动通过写成完整来源核验。r2运行期间另存实际安装包只读摘要`fa7b82cf8856878d77d7271add00bc96e057f976ea8af9e2395e23ea2e7c7bcd`，不追改原清单。

新增工具修正只在本专项选择的目标处于Shutdown时重新boot该目标，再读取真实安装包；不会用DerivedData产物替代已安装字节，不触碰并行DAV目标。r3仍未取得结束后安装快照，不能记作来源ready。共享错误分类同时加入精确热门目录白名单，保留“目录变化请刷新”提示，任意带URL/服务器原文仍脱敏。

## 最终本地纵向验收

r4 `SourceUITests-1793752218233.xcresult`为1通过/0失败/0跳过、143.834秒、exit0且sourceUnchanged=true；源码摘要`b3980af4b88a412d3bf47d01d5c60f7e0cadecdc574c21b64046b9f8d86da88d`，实际安装bundle摘要`fa7b82cf8856878d77d7271add00bc96e057f976ea8af9e2395e23ea2e7c7bcd`。00:33:14Z、测试进行期间从该目标读取112项实际安装文件，观察源摘要与run-manifest一致；结束后simctl不可用的原始记录另外保留，没有改成成功。六张附件逐项`verifyCaptureEvidence`均ready、failures为空，并全部人工亲看。

验证从正式发现导航进入网易，30→60位、歌手热门歌曲范围与目录摘要、专辑页、返回保留60位、刷新回30位及未启动音乐。图片按平台实际返回加载，失败使用既有占位；不伪造封面或静态参考素材。最终1016业务/类型检查通过，原生产品未改，Release实际编译成功。

提交前dirty unsigned IPA为17,853,350字节，SHA-256 `542e4482e7782765bcf6614c516ca9f325b298494707bfc696ff67f316007e4b`；178项ZIP CRC、151项archive/IPA载荷逐字节、arm64/iphoneos26.2/iOS15.1/[1,2]和测试/私人/签名排除通过。首次核验脚本仅按UTF-8查中文标记而失败；确认Hermes将该中文表存为UTF-16LE后按实际编码核验，保留原失败，不误报生产代码缺失。clean归档、正常push和新iOS27结果下一补记。

严格收尾审查新增独立音枢验收事件后为57E/22WI/123 timeline/48F/48P，离线Sollin结论未扩大。预提交T7阶段保存四轮精确结果、最终截图、dirty IPA/archive与日志，403份文件、158,663,274字节逐项一致，0差异、源证据保留。

## 清洁交付与云端队列

产品/测试/初始文档提交`fdf225add888d0d78b2d8254b1bcd5500ad98380`后，使用独立受管工作树生成真正clean归档，未stash、覆盖或提交并行DAV修改。依赖沿现有锁文件在本机SSD复制；官方RN codegen在隔离树重新生成。首次缺少generated文件、第二次复用路径绑定PCH/SwiftShims失败均保留；切换全新本机DerivedData后第三轮ARCHIVE SUCCEEDED，无原生产品源码修改，工作树始终clean。

manifest提交=`fdf225a`、dirty=false、workingTreeChanges=[]，arm64/iphoneos26.2/min15.1/[1,2]且signed=false。clean IPA为17,813,222字节，SHA-256 `b0fa0cc63c5a8a65050d49b8b3f1382d283d2b178427bcbdc3c70ea7f8cac2e6`；manifest SHA-256 `1c309e0ccd7509f27fd4f66bb52f64740c62fec00d607f688744bf80c016e5f5`。90项ZIP CRC、63项普通archive/IPA载荷逐字节、生产热门目录/既有咪咕/注音标记及测试/私人/签名排除均通过。此本机clean包没有旧外置dirty包中的88项AppleDouble元数据。

本机稳定交付在`build/local-popular-artists-fdf225a/distribution/`。T7 clean阶段`NexusMusic/BuildArchive/2026-11-04-popular-artists-fdf225a/`保存精确产物、失败/成功构建日志、最终UI/6PNG、运行来源、strict review及固定源码归档；135份映射文件、113,977,681字节逐项SHA-256一致，0差异、源证据保留、零删除。

`fdf225a`已正常push并在远端Actions核对；新运行[41749569579](https://github.com/RhsR1024/nexus-music/actions/runs/41749569579)对应同一提交，实核1运行/0排队。旧`41662090745`已经取消，未把它计为成功，本批未取消/重派任何旧运行。此快照不等于iOS27终态，实体机/签名、真实错误/取消矩阵及原F/J仍开放。

独立工作树当前被桌面管理工具视为主checkout，archive_worktree返回保护错误，已保留目录，未用手动删除绕过。所需忽略产物已另存本机稳定目录及T7。原仓库仍在`/Users/ningli/WorkSpace/NexusMusic`，后续业务继续显式使用该路径，并保留独立DAV任务的HANDOFF/SourceSettingsTests/报告修改。收尾磁盘余量高于30GiB，所有当前缓存、最新有效阶段及未解决原件保留，没有个人文件搬移。
