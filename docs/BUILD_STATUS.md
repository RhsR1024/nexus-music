# 首批实现验收记录

## 已完成

| 检查 | 实际结果 |
| --- | --- |
| npm依赖 | 已安装，package-lock.json记录705个初次安装包；Expo兼容版本检查通过 |
| 类型检查 | `npm run typecheck` 通过 |
| 自动测试 | `npm test` 20项通过：队列、播放竞态、LX协议与MusicInfo适配 |
| Pods | 75个Podfile依赖、74个Pods安装完成，Podfile.lock已生成 |
| Release模拟器构建 | `bash scripts/build-ios.sh` 重试通过，`** BUILD SUCCEEDED **` |
| 安装与启动 | iPhone 15 Pro Max / iOS26.3.1 Universal，com.nexusmusic.app成功启动 |
| 首屏视觉检查 | 已截屏并检查音乐库空态、来源入口、底部导航；无运行错误页。截图位于build/nexus-library.png |
| LX离线初始化 | 原生JavaScriptCore隔离检查24份脚本，19份发出inited；完整边界见LX_HOST_PROGRESS.md |
| 漫途样本 | 版本1结构调查完成，原始文件未提交；导入器仍未实现 |

构建产物：`build/DerivedData/Build/Products/Release-iphonesimulator/app.app`。

第一遍构建期间AssetCatalogSimulatorAgent停在dyld映射等待；终止该遍资源编译、待运行时稳定后增量重试成功。没有删除资源或修改第三方依赖绕过编译。初次模拟器存在重复运行时注册，已通过本地完整DMG重新注册并成功启动。

## 当前版本可以做什么

应用目前提供音乐库空态与来源设置说明页；领域代码具备独立队列、FIFO、删除/移动、播放意图与过期请求保护，LX协议及数据适配已有首批契约测试。这些领域模块尚未与真实播放器、数据库或原生LX生产桥接通。

## 不能宣称通过的项目

- LX真实出站请求、AES/RSA/zlib、脚本导入到App、真实musicUrl和歌词返回。
- 实际音乐播放、锁屏十首、耳机控制、FLAC格式和功耗。
- Navidrome账号认证/实际曲库/播放，或服务端写入。
- 私人数据导入、SQLite持久化、重启恢复、unsigned IPA和个人签名。
- 四个参考项目本身在此Mac上的构建与运行；目前仅克隆、源码阅读、比较。

下一步优先补生产LX宿主及其回归测试，再接单一播放后端。每项功能先按REFERENCE_COMPARISON.md比较实现、维护与Android成本后移植，不能将本记录的离线结果扩大为完整兼容。
# 2026-10-15 多音源路由增量

`npm run check`通过：TypeScript检查及31项测试（新增11项）。本批实现SourceRegistry独立代次/批量部分成功、音质外层/音源内层路由、原始档位别名传参、取消/超时/源更新隔离、安全错误。没有新原生代码，本批未重复全量原生构建。

测试覆盖同档跨源优先、逐档降级、不升档、忽略取消的transport超时、暂停取消不重试、在途源停用、无效URL、批量失败隔离、替换顺序、删除重导入代次及初始化迟到。仍未接入生产JSC/HTTP或实际播放；源顺序持久化、UI批量勾选待后续接入。

## 2026-10-15原生宿主增量（当前）

- `npm run check`：类型检查、35项测试通过，含adapter及同步订阅者停用竞态修复。
- `npm run test:native`：24项utility独立字节对照、本地HTTP端到端及同进程生命周期测试通过；超量响应拒绝/无响应超时均有验证。
- Pods安装与iOS Release模拟器构建通过，自动链接NexusNative及bootstrap资源；模拟器安装/启动通过。
- 24份真实本地脚本以原生HTTP/timer初始化，23份发出inited，一份SCRIPT_TIMEOUT；报告只在build/logs，不提交。
- 本批没有实现App脚本导入/持久化/批量管理UI，也没有证明真实musicUrl、音频解码、后台、PCM频谱/EQ或Navidrome联调。单次解析取消与底层HTTP取消的边界见LX_HOST_PROGRESS及决策0002。
