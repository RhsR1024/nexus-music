# 2026-11-02 进程终止后的原生后台下载验收

本批补强 M10/F22 的系统级后台下载验收。产品代码没有改动；验证路径从公开 App UI 发起真实原生 `URLSession` 下载，在测试服务器只发送了真实部分响应后调用 `app.terminate()`，再由测试运行器释放响应。服务器独立计数器 `fullFinished=1` 证明响应在 App 的 UI/JS 进程已经终止时完成。重新启动 App 后，现有任务页通过原生 journal 认领该文件、校验摘要，并显示“播放离线文件”。

这条路径同时覆盖进程终止后的完成、重启认领与完整性校验，不把前台轮询、模拟完成或仅编译成功当成系统后台传输。随后测试再次从公开 UI 发起下载，验证显式暂停可以跨进程重启保留，并确认继续时发出真实条件 Range 请求、最终文件可离线播放。

## 实现与测试边界

- `SourceSettingsTests.testDownloadSettingsAndOfflinePlayback` 先等待测试服务器进入 `heldFull` 状态，保留“进程终止前真实下载中”截图，再终止 App。
- 测试运行器在 App 进程已终止时解除服务器 hold，并等待 `fullFinished` 达到 1；该计数只在完整非 Range 响应写完时增加。
- App 重启后从正式设置/下载任务页认领完成文件；可见“播放离线文件”说明现有原生 journal、文件身份与摘要校验链路已通过。
- 原有显式暂停、终止并重启、条件 Range 继续、完整文件离线播放、容量摘要、确认删除及凭据清理断言继续在同一用例执行。
- 测试辅助 `scripts/test-ui.mjs` 新增 `fullFinished` 计数，仅用于证明服务端响应在进程终止期间完成，不改变生产传输策略。

功能提交为 `eb52efeb87bb1f61b02ccbc4fa4dd2d44364367f`。测试运行基于父提交 `0816fd0` 加本批未提交测试改动；run manifest 记录运行前后源码未变化，提交后两个文件的内容摘要与 manifest 分别一致：

- `ios/NexusMusicUITests/SourceSettingsTests.swift`：`b02e6fa7ce7e4b826c6c18e865ea521d76f1e6fabc4f23d24d1d77aeafae7a21`
- `scripts/test-ui.mjs`：`c57a37ebbf39422e027c54027bd1eb95a84fd5a6826abe5fa281885df952555c`

## 验证结果

- `npm run check`：类型与契约检查通过，948/948。
- `npm run test:native`：完整 native 套件通过。
- 目标 Release XCUITest：`build/SourceUITests-1793564362296.xcresult`，1 通过 / 0 失败 / 0 跳过，测试用例耗时 350.283 秒。
- 设备：iPhone 15 Pro Max 模拟器，iOS 26.3.1，x86_64。
- run manifest：`exitCode=0`、`sourceUnchanged=true`；运行前后源码 digest 均为 `c744fb1cc95aae93021dda3f8618f697c11f112deaaa828cfae48d115989a927`，diff SHA-256 均为 `bcc82a359682a1c3f458494067a7a42206c241f7778dcd4b1efaba6f1f23b644`。
- 服务器最终计数：`{"full":2,"resumed":1,"blocked":0,"heldFull":2,"fullFinished":1}`；`blocked=0` 维持离线播放不访问受阻网络。
- 三张 1290×2796 PNG 已导出、来源核验并人工查看：终止前真实下载中、终止后重启认领完成文件、显式暂停后条件 Range 完成。

关键证据 SHA-256：

- xcresult `Info.plist`：`a45d8edcfa1302409af46e6a109694af3e6d2e6818162b1bd6532ed53827ad05`
- xcresult summary：`883ccaf54e53f8b22520b43654241538ab2566e3d6b05883890f7affdedccbc2`
- UI 日志：`da75235b5ce79916c1388a9a5813acc5eb68bd8daad35d8ef56537772a3ee914`
- run manifest：`643f979dbe51765bed89879ae7933e1f044b840558b4cfd0f228e22db30dba11`
- 服务器计数：`d4c545617e35954d8c5ee802e6ed3a25035293330dfd31782a78bc40da4ac7d8`
- 终止前截图：`9dbf9c6b304a40898e346b85a8a50f65ebd60b8edea803374afa04f17ea3da2a`
- 重启认领截图：`59fa2e70259b07006a41b9b1779791d7ce46472a9117494b53e428c71b9d4021`
- Range 完成截图：`f0c1e3f5a12cd35b8872bac89dd6357a96f7554e4e1f3e179e698c88a8d62957`

## 归档与复核

清洁未签名归档 `ARCHIVE SUCCEEDED`，manifest 对应 `eb52efe` 且 `dirty:false`、`workingTreeChanges:[]`；产物为 arm64、iphoneos26.2、最低 iOS 15.1、设备族 `[1,2]`，未签名且无 provisioning profile。

- IPA：`build/distribution/NexusMusic-unsigned.ipa`，12,872,747 字节，SHA-256 `0f4893794ecd478df5748a99ba8b3a8eace5ce1dfa6dc9e48e6b3d7bea757b73`
- IPA 验证：164 个 ZIP 条目、0 CRC 错误，archive/IPA 内 JS、可执行文件与 `Info.plist` 字节一致；测试适配器、本机端点、夹具凭据和私有路径标记均被排除
- build manifest SHA-256：`573bdfa72ad427b2825cf29f5c21730e63673fec676e4bb6c09c27454b44210e`
- IPA verification SHA-256：`1c94c931c119fa3ad4c9e9924e07b60ed448b39c39430f7e544fee2102ff4beb`
- archive `Info.plist` SHA-256：`aea9c7700a6c6f71313e2945c07bea9058770f5eb30d33ede67201b97af49e08`

T7 独立阶段 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-background-termination-eb52efe/` 保存 xcresult、截图、日志、summary、manifest、IPA 与恢复清单。复制收据记录 56 个 payload 文件、24,422,519 字节，全部源/目标哈希一致；收据 SHA-256 为 `c5e86a7d44f3006612c0027463105018f8419d960143df72c50f9f5b85dd5653`。

## 尚未证明

本批证明的是本机 iOS 模拟器中的 App 进程终止场景，不证明真实 iPhone 上的系统终止/重新调度、长时传输、弱网切换、低电量或功耗行为，也不证明 Dynamic Island、音频路由、中断、签名、描述文件或设备安装。

M10/F22 仍保持未完成：真实设备后台调度与长期稳定性必须等签名材料和真机条件满足后单独验收。本批仅关闭“进程终止后由原生 transfer 完成并在重启后认领”的模拟器证据缺口，不提高保守代码完成率或完整交付完成率。
