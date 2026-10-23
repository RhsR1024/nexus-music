# 6f2e413 iOS27录制时序失败

[运行39837345526](https://github.com/RhsR1024/nexus-music/actions/runs/39837345526)终态failure；checks成功，核心App21通过/1失败/0跳过。唯一testGlobalCoverThemeChangesAcrossPages，在释放红封面后的像素R-B>12断言超时（该提交SourceSettingsTests.swift:1836/1958），507.828秒。后续独立P2与归档未执行，不能计成功。

已核验compact artifact12459215459，540321字节，SHA256 d13b8c953c6e79128dd48359e68e4c364fc402656ff9ace1c11bf6d2cea5d8b2，与API一致/ZIP CRC通过；本机build/ci-39837345526留ZIP及diagnostic-summary.json，含内部文件摘要与49818–49827/49884–49889行，不下载1.54GB完整诊断。

实际UTC：record=1 20:06:21.714001，release=red 20:06:32.980900，等待11.266899秒，超过NativeModule fetchCover的10000ms。held-red身份与旧蓝保留已先通过。高置信原因是测试屏障消耗真实请求超时；未获取原生error码，不把推断写成直接运行日志。

修复：record ready移至transition-red点击前，保留HTTP身份屏障/迟到结果与像素/录屏检查，不改生产超时、不降阈值。夹具可选NEXUS_UI_THEME_RECORD_READY_DELAY_MS=11000仅延迟ready回执；本地SourceUITests-1792713215545正在复验。成功后仍须新提交触发iOS27；不重派旧运行、不取消运行中任务。

## 本地故障注入终态

SourceUITests-1792713215545，Release 1通过/0失败/0跳过，584.806秒；NEXUS_UI_THEME_RECORD_READY_DELAY_MS=11000确已写入ui-server-counts.json。源码digest7e11545e92ea3c89c282cd9f19444788181a4e00672b93f979541f2432a14c3f前后相同，安装bundle digest fd2f85d77a70b5e70f2a5d52122a99d1939995d85d75d6d3f5398a10563e5df0。目录build/cover-theme-recorder-order-r33-20261023保留manifest/日志/计数/4张截图，主代理已亲看：红色当前、蓝色迟到保红、经典原生PCM/全屏队列恢复均符合断言。

独立视频build/logs/ambient-transition-1792713215341.mp4验证PASS：152帧、10中间帧，blueTime0/redTime15.45。此为音枢模拟器实际像素过渡，不是Sollin真机动效等价证据。Xcode完成后的诊断收集有simctl定位error72；主进程xcrun --find simctl成功、测试exit0、安装包摘要和录屏验证成功，保留诊断附件限制，不伪报App失败或云端成功。下一新提交正常触发云端。
