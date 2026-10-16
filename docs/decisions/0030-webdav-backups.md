# 0030 WebDAV 云备份与验证恢复

日期：2026-10-16，S8/F32/J53。实现音枢版本备份上传、目录配置、列表、校验和预览恢复；F33 多设备冲突同步单独实现，不以备份冒充同步。

## 五参考、许可与平台边界

固定提交和许可沿 REFERENCE_COMPARISON。以下为亲读后的原创实现决定，无复制源码、资源或新增依赖。

| 参考 | 证据 | 采用 / 不采用 |
| --- | --- | --- |
| 悦音 d6f1af7 | src/core/config/playlist.ts:19–85，简化曲目、AsyncStorage延后保存 | 参考保存职责；不采用丢字段/临时URL/吞失败路径，沿用音枢原子仓储与备份清理器 |
| Q 547ccfe | src/screens/Home/Views/Setting/settings/Backup/actions.ts:13–75、84–149，整库收集/确认/覆盖 | 采用预览后明确恢复；不复制逐条吞错再覆盖、旧导航/原生分享及依赖 |
| wtf 6624ab | 同目录 actions.ts:10–71，文件选择器和整库导入；plugins/sync/client另有专用协议 | 备份和同步分开；不将LX专用同步当WebDAV备份，不引入另一套列表权威 |
| Cy bf0d46 | src/store/config.ts:98–102；限定src TS/TSX检索仅见WebDAV配置字段 | 不从字段推导云备份已实现，不存明文密码；继续既有Keychain与受限原生HTTP |
| Wayferar 8e47cdc | docs/playlist-sync/SPEC.md:15–38及音枢WAYFARER_IMPORT_FORMAT所记录的v1来源/设置/歌单分区 | 保留失败不改旧库和来源顺序；不备份其认证/音源字段、Android路径或将公开歌单刷新当多设备同步 |

Sollin c9d446f补充：src/services/webdavBackup.ts:254–278、322–383、393–423 的目录/列表/PUT/下载职责可参考；不采用明文配置、响应/URL日志、任意远端URL或盲信MKCOL405。TS状态/格式/校验可共享Android；URLSession传输、取消和Keychain需相应平台实现，仍不交付Android。

## 协议与数据

- 复用既有多账号配置/Keychain，另存账号ID和相对备份目录，不把凭据写入备份。备份内容沿现有nexus-music/v1格式：歌单、收藏、历史、匹配/歌词选择和实际统计；不含音源脚本、账号配置、字体/图片/音乐文件。
- 每次产生时间/随机ID/内容SHA256命名的独立JSON版本；PUT使用If-None-Match:*，不覆盖其他设备的版本。成功后GET回读并验证摘要和格式才确认成功。取消/网络失败不承诺撤回已到达服务器的写入，允许刷新核对，不自动删除未知远端文件。
- 目录逐级验证/创建；MKCOL201/405之后以PROPFIND核对确为目录，拒绝同名文件。写操作拒绝重定向；读取只允许当前备份目录内跳转，保留鉴权/响应体上限与取消。
- 文件上传/下载上限32MiB，目录XML仍2MiB。列表允许目录内JSON备份（含手动放入的旧备份），解析前不修改本机；新命名文件必须匹配文件名摘要，旧命名备份明确仅做格式验证。可用强ETag做If-Match，不能以弱ETag冒充强版本保证。
- 预览导出时间与歌单/收藏/历史/统计数量，再由用户明确确认恢复；复用同一MutationQueue和SQLite事务恢复音乐库+统计，不替换队列、不自动播放。恢复绑定若影响当前曲目，沿既有失效保护停止旧媒体并保留定位。坏版本、坏JSON、摘要不符和事务写入失败保留旧库；提交后刷新异常须提示检查本机数据，不能冒称已撤销。
- 连接/目录修改、关闭和取消使旧网络结果失效；用户确认后已开始的本机原子恢复不提供假取消。无需轮询/自动上传；F33另设计冲突和删除语义。

协议依据：[RFC4918 MKCOL](https://www.rfc-editor.org/rfc/rfc4918.html#section-9.3.1)、[RFC9110 If-None-Match](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-none-match)。摘要检查用于内容一致性，不冒称服务器真实性或端到端加密。

## 验证门槛

目录/Unicode路径、已有文件/目录竞争、条件创建不覆盖、回读不一致、取消与连接变化、鉴权隔离、体积上限、旧文件/未知版本、预览和原子恢复；真实URLSession本地合成HTTP与实际App上传/重启/恢复/失败保留，再分别做本地清洁IPA/云端iOS27。个人WebDAV服务与真机网络/后台单独验收。
