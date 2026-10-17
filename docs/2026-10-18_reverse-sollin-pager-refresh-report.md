# Sollin 歌单分页与刷新边界

本批仅恢复离线 IPA 中首次读取、刷新、追加、完整读取及缓存清理的静态边界。610 条原始 ARM64 指令、10 条选定直接调用、3 组对象池加载及循环回边独立核对通过。它们支持分别审查这些入口，不能证明参考 App 的失败界面、缓存时效或动态请求协议。音枢保留已加载数据的行为另由原创 App 测试验收；不采纳私有服务或复制参考实现。报告采用普通逆向模板，flavor=null。

## 范围与来源

reverse-skill 固定提交和工具路径遵循 [工作流](REVERSE_SKILL_WORKFLOW.md)。本批原生 master-route 输出 R2/mobile-reverse，路由留存 `build/reverse-skill/routes/ipa-playlist-refresh/route-scope.md`。现有案例 `work/sollin-ipa/scope.md` 为 auth=granted、offline-sample、ready=true，只读用户提供的离线样本；未重新初始化案例、运行目标、签名安装或请求参考服务。

IPA SHA256 为 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`；App.framework/App 为 `640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d`。VA 等于 arm64 slice 偏移，FAT raw 加 0x4000。导入/依赖沿既有 E001/E002 容器与 [IPA 分析](SOLLIN_IPA_ANALYSIS.md) 的 App/Flutter 边界，本批不由依赖名推断网络或缓存语义。

## Evidence → Finding → Path

| 记录 | 来源、复现与结论 |
| --- | --- |
| E-023 | `work/sollin-ipa/evidence/playlist-pager-refresh-evidence.json`；SHA256 `5d3a414b7e3197f384279ac4af6a1b8d763121752abe852684a02f60ca7a1ca6`。`notes/pager-refresh-probe.py` 对固定样本调用索引 cstool，原始字节、直接分支和池加载由独立 `build/verify-pager-evidence.py` 再核对；既有 Evidence 不覆盖重写。 |
| F-022 | info/design、candidate、confidence=high、evidence_ids=[E-023]；位置 loadAll 0x3a8b68、loadMore 0x3a8c4c、refresh 0x3b3810、loadFirst 0x3b3fd4、cache 0x3bd720。仅调用/字段操作边界置信度高，完整语义仍未知。 |
| P-022 | callflow：核对 loadAll→loadMore 回路 → 核对 first/refresh/append→getPlaylistSongs → 区分 forceRefresh/limit 与 limit/offset 描述符 → 独立验收音枢恢复行为；均挂 E023/F022。 |

本机 timeline 第42事件记录静态验证；工作项 WI008 保持 in_progress。采纳前 strict review 为23E/22F/22P、8WI/42事件、零错误/警告，日志 `build/logs/reverse-pager-refresh-adoption-review.log`。原始指令/对象池/日志和 scope/timeline 只留本机忽略目录。

## 静态发现与限制

loadAll 在 0x3a8bd4 调用 loadMore，await 后检查字段，0x3a8bf8 回到 0x3a8b9c；不能仅凭名称认定所有失败或取消均已恢复。loadMore 在 0x3a8d20、refresh 在 0x3b3898、first 在 0x3b405c 分别调用 repository getPlaylistSongs 0x3a9168。refresh 描述符池 0x23a58 包含 forceRefresh/limit，append 池 0x3f188 包含 limit/offset。

refresh 通知前操作字段 3f/47/4f，append 有响应/标志/token/loading 守卫与正常、异常出口标志清理。cache clear 存在全量及捕获过滤分支，池 0x2d080 指向闭包 0x3bd7b8。没有恢复精确字段名称、默认分页数、缓存 key/过期时间或失败视觉；不能要求音枢据此清空现有歌曲。NO_CODE_ANALYSIS 骨架只用于归属，原始指令核验不等于完整反编译或动态调用图。

音枢采用自身 provider/Abort/权威队列边界，详细比较和验收见 [0051](decisions/0051-discovery-pager-recovery-validation.md)。参考运行、真实平台弱网、签名与手机另验；ATT&CK/IOC 不适用于本次功能边界审查。

验收后 strict review23E/22F/22P、8WI/43事件、零错误/警告通过，日志 `build/logs/reverse-pager-recovery-final-review.log`；工作项与timeline已追加，未修改不可变Evidence。
