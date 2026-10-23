# iOS27 Files测试导航修复（2026-10-23）

云端39892842558/cf31064和39895020303/e0b61c1均为首组22项20通过/2失败；checks、Pods、native通过，后组和归档跳过。两失败为背景图片持久化及本地音频导入，不记云端完整成功。

连接器job 120219493683/120245980918日志摘录在`build/ci-files-failure-20261023/`。e0b61c1失败附件12481594309下载至`build/ci-39895020303/failure.zip`，ZIP CRC通过，SHA256 `490dfcdd550db6f3323a8e46f9914d286be931860192324ed3af8d3c8e777032`。层级显示标题“Nexus UITest Fixtures, Actions Menu”被误当文件夹入口，实际打开目录菜单；音频测试另强制等待Browse，不兼容系统恢复目录。

修复仅在XCTest：排除目录标题操作菜单；先等Files取消按钮确认呈现；已在夹具目录时等枚举，不反复导航；仅操作位置列表cell；选中文件后确认多选Open；图片用例开始时通过正式移除UI清理上次失败残留。保留全部图片导入/重启/删除、音频元数据/播放/重启/在播保护/移出队列删除断言。

r1本地0/2，DocumentManager在转场中SIGSEGV（objc_msgSend→_runAlongsideCompletions→completeTransition），系统崩溃原件保留`build/ci-files-fix-20261023-r1/system-crashes/`，不宣称与云端同因。r2重启模拟器后0/2：图片因上轮已导入资产违反空起始态，音频实际点中文件但缺少Open确认。负证据均保留。

最终r3：`build/SourceUITests-1792738743849.xcresult`，Release/SDK26.2/iOS26.3.1模拟器，**2通过/0失败/0跳过**。manifest `build/ci-files-fix-20261023-r3/run-manifest.json` exitCode0、sourceUnchanged=true，SHA256 `4a90d042daff411e066ea02e900fc342a4e27795ff9757ff8606bd46b6b2568c`，resultInfo SHA `ab0482db6687719f5cb75dae3dcaaa4718b2470379c82495446ee656b16db9cd`。已亲看导出的“Persisted visual image settings and fallback”：两图片槽已移除、按钮恢复可用；不是新UI配色评分。完整日志/fixture/源码及安装包哈希见manifest。

`npm run check`499/499（含typecheck），日志`build/logs/check-files-fix-20261023.log`；Swift parse与diff检查通过。最终App来源包含未提交黑胶实验，当前提交只纳入Files测试修复；该两项不使用黑胶布局。未重复设备归档，无产品/原生后端修改。云端最新39904225211/8a96dc7仍在运行，不包含本修复，不取消/重派；正常push后的新云端仍待。真机、签名、真实音频服务及90%UI/全部parse不由本批证明。

交付回执：`4a21c8e101f28946808985c32ac932548172ae3a`已正常push并核对远端main一致。连接器实核39915726008/4a21c8e pending、39904225211/8a96dc7 in_progress，1运行/1排队；未取消/重派，新云端终态仍待。
