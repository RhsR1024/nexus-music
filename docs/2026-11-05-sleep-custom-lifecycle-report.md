# 自定义睡眠时长与进程生命周期验收

本批补 J29 的独立正式设置入口证据：输入两分钟并启动原生计时；输入 0 和 1441 分钟被拒绝且活动计时保留；进入主屏幕后返回，原生截止时间继续递减；终止并重启 App 后恢复“未开启”。只增加 XCTest，产品源码、播放器、队列和原生计时机制没有变化。

## 正式结果

`SourceSettingsTests/testSleepCustomDurationAndRestart` 在 Release `build/SourceUITests-1793859946172.xcresult` 为 1 通过 / 0 失败 / 0 跳过，75.088 秒，exit 0，`sourceUnchanged=true`。运行目录为 `build/sleep-custom-20261105-r1/`。

- 源码基线：`191574a2e1f699593ca03223419ac9ec68aab826`。
- source digest：`fdbdf413ef76ee8ba0d08d3ce20430361de1d9507d12ed5d0bc1ef31bdcec9ad`。
- 安装 bundle digest：`84ef23b3b790b67daeccd3690d391bcbecbd0f620346e2d0a4390ed2f0d0ef80`，与已交付歌单封面批次产品相同。
- result Info SHA-256：`a918a3ba699e7d81b160a21c7704c96ae65e04a720d794bb7b07f785363ac327`。
- run manifest SHA-256：`0ddff4f2a8c9078afb7d274896f90d6e736a55a18bce15e66a98cf01ef810b4c`。
- `npm run check`：1028/1028，通过日志 SHA-256 `d44734680fdfdc2b70575c5d0636cc519f3f6c48bc61ffcf89fcb4139698d1fe`。

测试通过正式“设置→播放与歌词”导航，不注入计时状态。启动后要求秒级倒计时处于 90–120 秒；无效输入逐项要求显示准确错误且活动计时仍在。主屏幕停留三秒后要求剩余时间严格减少且大于零。重启重新进入设置后要求“未开启”且取消按钮不存在。没有实际音频播放，因此不把这次状态验收写成到点停止实音通过。

## 截图

从精确 xcresult 导出两张 1290×2796 图片，`verifyCaptureEvidence` 两项均 `ready=true`，人工亲看活动状态“剩余 1:58”和重启后“未开启”。导出索引 SHA-256 为 `c14bfeef0fb329c35a4d1df039527ff992d9f828a0ebdd263ead92af2a331c07`。

| 文件 | SHA-256 |
| --- | --- |
| `002-Sleep-custom-two-minute-timer-active.png` | `3dc2129485a481a374850446550d96696129f8d0c5317d2f8b353105e005541e` |
| `001-Sleep-timer-cancelled-after-process-restart.png` | `1b8d1459192594762eeaf623fc0321b260d36504772a2854f0ba3c230792346a` |

## 外置证据副本

`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-05-sleep-custom-lifecycle`保存精确xcresult、运行记录、两图与索引、源码补丁、检查日志和本回执快照；49个文件/6,829,514字节，源与目标逐项SHA-256一致，`ready=true`、0差异、源保留且零删除。清单SHA-256为`d153181ec8332a1bf1e4ea06e4baffd869840d9072cb7d8a83a139392484937e`，恢复按`inventory.json`的路径或源码补丁进行。归档首次挂载判定误用Node未提供的`fsid`属性而在写入前拒绝，改用真实设备号且结合已核对的挂载信息后成功；没有回退写入同名内盘目录。

## 范围与后续

本批只确认完整设置中的数字输入路径，播放器自定义双滚轮实际启动、本曲后停正式 UI 实音、手动切歌、长时后台、实体机、签名和 iOS27 仍开放。产品未变，不重复生成同内容 IPA；沿用已核验 clean 产品 `3a2ecc2`。逆向路由为 R2/mobile-reverse，既有 IPA strict review 58E/23WI/125事件/49F/49P、0错误/0警告；J29 来源为用户需求 U，没有新 Sollin 采集或新证据结论。

同期核对旧云端 `41962294108/e6e5668`：checks/native 通过，核心 UI 24通过/1失败，失败用例为 `testPlaylistSearchSortAndDuplicateRemoval`，后续组与 IPA 步骤跳过；这是 GitHub connector 实际 job 日志结论，精确断言仍需完整失败附件定位，不猜测根因。最新运行/排队状态沿歌单封面专项的队列补记，未取消或重派。
