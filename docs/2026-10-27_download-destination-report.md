# 2026-10-27 用户持续保存目录

交付：源码`9e7c6f5ad0b128c997d3864c2f2c127538b84248`已正常push，远端完整SHA一致；[CI40511643805](https://github.com/RhsR1024/nexus-music/actions/runs/40511643805)运行，当前1运行/0等待。未取消运行或重派旧版；云端终态继续核对。

下载设置增加系统目录选择、重启保留和停止授权。后续新任务固定目录版本与命名；音频及已选托管附加文件就绪后另存到该目录。旧任务只能通过完成卡片明确另存；已发布的用户副本独立于App内原音频。

## 依据与边界

复用已完成的 E-830→F-023→P-021 / WI-003。固定 reverse-skill 路由、PRIMARY、本机工具索引、APK gate及`--review`沿用本批记录；原生功能case-guard与严格哈希review再次通过：395 Evidence、101 Finding、99 Path、3 workitems、124 timeline，0错误/警告。未新增Sollin采样，安装case的3条Evidence不代替功能case。

`DownloadDestination`只将版本ID/名称传给JS，设备内书签排除备份，与扫描目录注册表分开。交付任务另有等待/写入/完成/失败/取消记录，不改变音频完成状态、播放器或权威队列；换目录不追溯旧任务，失败重试使用原job，明确再次另存使用新job。

原生只接收受控导出暂存目录，音频在后台队列流式暂存/校验，JS不搬运整首字节。用户目录采用同组编号、逐文件摘要校验和私有回执；恢复缺失成员前确认已有成员未被用户修改，不覆盖或删除已发布文件。仅清理本轮排他创建的临时文件，不因同名前缀删除历史文件。四文件不是文件系统原子事务；中断可能留下部分组，重试补齐，进程崩溃产生的外部隐藏暂存清理仍需独立验收。

选择器补充真实presentation delegate、祖先转场/窗口检查及关闭后恢复；测试先确认实际系统选择器和可交互打开按钮，避免在展示期间导航。扫描入口继续使用原注册器。

## 验证

- `npm run check`：657/657，日志`build/download-destination-20261027-check-r6.log`。覆盖不追溯旧任务、快照、授权变化、失败重试/幂等、附加文件等待、异步暂存租约与清理。
- 完整native exit0：`build/download-destination-20261027-native-suite-r3.log`。真实四文件原生CLI最终`build/download-destination-native-real-20261027-r5/receipt.json`，覆盖流式音频暂存、越界拒绝、重启/幂等、缺失恢复、用户修改、整组同名、遗忘授权和同前缀非本轮临时文件保护。
- 最终Release实际App：`build/SourceUITests-1793106626782.xcresult`，`testLiveDownloadDestination` 1通过/0失败/0跳过、207.198秒。iPhone15ProMax模拟器/iOS26.3.1，正常下载设置/系统目录/任务导航，无截图专用入口。
- 从`resources/V261020`启用的真实来源重新下载公开Shape of You：取消/重新选择→授权→重启→完成四文件自动另存→明确再次另存得到同组` (2)`→重启不重复写→停止授权并重启。八个实际文件归档在`build/download-destination-live-20261027-r7/actual-destination-copies/`；测试拥有目录在归档核对后由harness清理，不将该清理说成产品删除用户文件。
- 两组MP3均为原SHA `be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203`；LRC207时间行/9446B、JPG256×256/17317B、meta269B与上一批真实资料逐字节一致。原Shape/Perfect两份音频SHA保持，Perfect稳定文件名保持；扫描授权注册表SHA不变，权威队列一项；停止后书签文件不存在，当前两个私有事务回执一致，暂存目录0。
- 十一张实际PNG已逐张亲看并通过`verifyCaptureEvidence(...).ready === true`。最终源码digest `9c28a70070fe58da62de428fd63b8a2280a62b79dcb790f8c4effc95d9351803`，当前源码匹配。详见[场景与绑定](ui-spec/download-destination-live-2026-10-27.md)。不增加整页像素/动效完成量。

R1的取消按钮查询失败；R2曾全流程通过，源码仍早于临时归属保护/关闭重开修正；R3/R4停在目录选择，保留失败记录；R5编译发现测试辅助替换误及已有`testLiveRetainedAudio`，已恢复该方法；R6在恢复修正前全流程通过；R7覆盖最终源码，为最终接受轮次。未把失败或较早通过轮次折算为最终通过。

真实原生MP3集成`build/download-destination-native-transfer-real-20261027-r2/receipt.json`进一步通过：正偏移Range一次、暂停/恢复、取消重试、重启认领、配额、1→2→3并发/降低并发不取消已启动任务、两份原SHA及`.audio`实际PCM解码。使用相同公开MP3与自有loopback服务；这是macOS Foundation ephemeral验证，不冒充iOS后台或实际Navidrome服务。首轮CLI检查新增局部变量与原名称冲突，已隔离到独立检查函数，最终重新编译执行通过。

## 云端回归与未验证项

3520174的[CI40468166406](https://github.com/RhsR1024/nexus-music/actions/runs/40468166406)已失败：checks成功，iOS在离线下载测试等待“暂停下载”时，文本证据已是0下载/1已保存。小型失败包只解出文字分析，未查看夹具PNG。测试服务器现在可明确保留有进展的部分响应，暂停重启后释放；条件Range、清缓存、屏蔽服务器后的真实Native播放断言保留，另断言服务器确实进入部分响应窗口。该回归属于CI功能测试，不是产品真实音源/UI验收。

独立iPhone17Pro模拟器最终`SourceUITests-1793106170098.xcresult` 1/0/0、253.568秒；`heldFull=1/full=1/resumed=1/blocked=0`，清理确认/0临时音频缓存/服务器屏蔽后Native播放、保留与删除离线记录及移除连接通过。源码digest与真实媒体R7完全相同，没有查看夹具PNG作UI验收。新提交云端终态仍待，没有重派旧版或取消运行中任务。

途中发现并修复两个实际缺陷：React Native的abort-controller不提供`signal.reason`，原适配层将暂停传成取消，现由权威下载store显式传递意图；Navidrome每次解析更新签名盐/令牌，原生完整URL摘要导致拒绝旧续传，现仅Navidrome传既有账号/歌曲/原始音质cacheKey作为稳定身份，仍绑定服务端、端点及请求头。其他来源保持完整URL校验，原生不存明文地址/凭据；旧摘要不匹配安全重新下载。原生契约验证身份隔离与无效key拒绝。

回归R1停在初次设置导航，R2证实暂停误取消，R3保留条件Range失败，R4证实续传后停在未确认的清缓存弹框；R5补齐既有产品清理确认并全程通过。没有移除原暂停、续传、空缓存或服务器不可用断言。

实体机最新检查仍是tunnel unavailable / developerMode disabled / DDI false。本批未验实体机签名、Android、其他平台实际下载、真实云盘文件提供器、锁屏/杀进程中断和连续动效；构建通过、模拟器目录及原生CLI不代替这些结果。继续批次6实际异常状态与云端，不扩大Sollin采集。

## 产物与提交检查

阶段检查磁盘余量与目录占用，已按保留文件的SHA核对清理7个旧原生CLI音频重复副本26,182,520B；最新两个原生目录验证/原输入/回执均保留，旧R1–R3原生目录不再是完整raw包。清理回执`build/logs/download-destination-cleanup-20261027.json`。构建缓存与reverse样本未盲删。仅文本源码/规格/摘要进入diff，未包含音源、书签值、凭据或签名材料；链接与diff检查通过。

R2的八个重复用户副本对照保留R6/R7后清理7,534,532B；R2原始副本不再可取，结果包/原回执/摘要保留。当前实际副本以R6/R7为准，见`build/logs/download-destination-export-cleanup-20261027.json`。

低空间收尾：285份旧普通日志进入透明压缩计划，实际处理284份，逐份SHA/逻辑字节与路径保持，st_blocks口径减少638885888B；原日志仍可直接读取，未删除证据。回执`build/logs/download-destination-log-compression-20261027.json`。独立CI模拟器在结果/计数留存后删除，真实媒体模拟器仅关机且保留数据；磁盘余量仍低，后续构建前继续核对。
