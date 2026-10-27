# 2026-10-27 独立平台下载音质

批次6落实平台下载首选、独立下载解析和恢复跟随播放。网易云/QQ/酷狗/酷我/咪咕共用配置入口，只展示当前启用LX音源声明且音枢认识的质量级别；空能力与失效首选有明确提示。具体九级顺序属于音枢既有Quality策略，不推断为Sollin内部实现或实际文件编码。

## 依据与实现

采用现有E830→F023→P021可见配置能力，不增加Sollin采集。原生master-route、亲读PRIMARY及precedent/tool-index、APK gate与采纳前`--review`通过；本机日志`build/download-quality-20261027-{route,gate,review}.log`。当前功能case严格哈希review PASS：395 Evidence/101 Finding/99 Path/3 workitems/117 timeline，0错误/警告，见`...-case-review.json`。固定包cab634bd855fc287f6e420c1f36fd1a6b9245960；本批无新的参考代码或原生补丁采纳。

默认各平台跟随播放，独立首选经原子设置队列保存；旧设置自动补空表。新备份携带非敏感质量策略，旧备份缺字段保留现有策略。下载使用专门入口，每次解析固定偏好快照，按实际目标平台应用，沿用音质优先、向下回退和手动匹配边界；不发布下载产生的全局播放匹配。播放器既有解析入口与权威队列保持，私人曲库仍经原客户端处理。

记录区分`requestedQuality`与成功LX请求的`quality`标记，重启/原生任务恢复保持；这些字段不证明比特率、编码、无损或声道。已开始的解析不受后续偏好写入影响，重试按新请求读取。原始URL/headers不随该字段持久化或导出。

## 实际验证

- `npm run check`：637/637，typecheck通过。包括策略校验/旧设置迁移、并发原子更新、便携备份兼容、目标平台策略、下载不写播放匹配、并发请求快照、私人客户端原路径、请求首选与成功档位区分及恢复。日志`build/download-quality-20261027-check-r3.log`。r1为测试类型修正过程；r2通过636项，加入请求首选恢复用例后r3通过637项，采用后者作为最终计数。
- 最终Release `build/SourceUITests-1793079752184.xcresult`，1/0/0、157.737秒；`build/download-quality-live-20261027-r1/`保存候选补丁、精确构建和before/after绑定。源码digest c93ca6df6d81b61033d406015db7b79dffe31c1a863f0edb19fff43bb1f94676。
- 正常设置页真实操作：网易128k、QQ320k，QQ恢复跟随不改网易，重启两项保留；播放设320k。为限定本次真实网易转移，临时关闭自动匹配，正常删除此前受控公开曲目的离线副本，再通过当前真实播放器“保存离线”重新下载；验证播放仍320k，最后恢复原128k与自动匹配开启。
- 当前使用既有V261020真实公开音源，不导入模拟音源或个人歌单。新Shape of You记录请求128k、来源标记128k、状态completed，新内部文件ID与旧副本不同；实际ID3 MP3 3740360字节，SHA be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203。Perfect 4215580字节，SHA086eb96aef026bf336cf5884037a17b28f519b453c19547f3b29093f32ddda39，原文件保持；仍两完成文件、队列一项且当前公开曲目ID保持。详见`physical-verification.json`与`build/download-quality-before-receipt.json`。
- 九张真实PNG逐张亲看、逐张`verifyCaptureEvidence` ready=true，索引`r1/screens/index.json`，回执`r1/provenance-review.json`。正式组件、正常导航/滚动/重启及真实保存路径；不把静态图当作动效或全量UI完成度，不用同态像素分数阻塞本功能。

本批无原生源码更改，最终Release实际执行原生下载写入；不以成功构建替代真实文件。本批未重跑全部原生算法套件或声称重新PCM播放。QQ首选设置经过真实UI验证，其他平台真实下载、跨平台实服务故障/质量回退、备份实服务往返未由本批证明，相关契约仅有上述代码测试。

## 后续范围

平台封面尺寸、持续保存目录与下载时托管侧车继续；显式附加导出已有前批验收。当前设备复查iOS tunnel unavailable、开发者模式disabled、DDI不可用，未真机或签名验收。iOS27云端仍需独立核对，总实施目标保持开放。磁盘约9.8GiB余量，当前有效产物与reverse原证据保留；本批未新增大型解包或清理使用中的构建缓存。
