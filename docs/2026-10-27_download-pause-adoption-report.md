# 2026-10-27 下载暂停恢复偏移修正

上一并发批次代码复核发现：原生已暂停、JS尚未写入partialBytes的终止窗口，启动恢复仅复制paused状态而没有回填已接收字节。恢复后继续下载传给原生的resume为false，会从头请求。本批补回有效的原生进度，保留原有非法值/单文件大小边界，不改变暂停状态、播放意图或权威队列。

## 真实输入与复现

使用已批准的V261020公开Shape of You原样MP3，3,740,360B、SHA256 `be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203`。测试在本机随机端口提供原始字节，以原生Foundation URLSession实际暂停；重新构建JS下载存储并保留“原生已暂停、JS旧记录尚无偏移”的故障窗口。不是UI注入场景，不使用私人凭据或个人歌单，不声称是真实provider。

负证据 `build/pause-adoption-probe-20261027/negative-r1/receipt.json`：原生暂停131072字节，恢复后0，resume=false，两次请求均无Range，最终SHA仍正确但重新下载。修正后同一输入 `positive-r1/receipt.json`：回填131072、resume=true、`Range: bytes=131072-`，完成SHA一致。

正式可复现工具 `scripts/verify-live-native-pause-adoption.mjs` 与 `tests/native/OfflinePauseBridge.swift` 仅连接127.0.0.1；输入必须传完整MP3、明确SHA和新输出目录。桥接复用正式Native类，主调度与后台观察适配器也使用正式模块；工具绑定这些源码、二进制及输入前后SHA，不携带URL/凭据进入回执。Native桥接和JS存储的实际字节契约不代替Expo桥接/iOS系统后台或真实App进程终止验收。

正式 `build/native-pause-adoption-real-20261027-r2/receipt.json` 同样验证131072→131072、resume=true、非零Range与完整SHA。`npm run check` **622/622**，新增原生暂停先于JS保存的恢复/继续偏移测试，日志 `build/download-concurrency-20261027-check-final-r3.log`。生产原生类与已通过完整native及三路真实MP3契约的版本相同。

## 旧CI用例适配

新默认并发1不能用来假定“两项同时在途”。`testDownloadTaskBatchActions`先通过正式设置选择1→2并确认，新增“两项确在下载”的断言，保留原暂停/取消/重试/清理断言，结束后恢复1。`SourceUITests-1793037129669` **1/0/0、231.524秒**。这是既有隔离夹具的CI功能回归；未查看或使用其截图作UI/真实音源验收，没有以其替代本批真实MP3证据。

最终真实MP3 Release `SourceUITests-1793038088417.xcresult` **1/0/0、149.899秒**，10个实际附件逐张亲看及来源绑定。正常导入/PCM→1/2/3确认取消→重启3→降低1→再重启和PCM通过；只读偏好/原生配置均1，下载索引存在且为空，两份owned MP3 SHA均保持，权威队列1条Shape、游标6.514215457秒。与R2“索引尚未创建”分别记载，不伪造相同状态。

自身1态/重启1态全屏无遮罩visual-lab 99.85% SSIM/ΔE00 0.06、关键区SSIM1，侧并图已亲看。只作自身恢复诊断，不作Sollin颜色、相似度或UI完成量。当前生产源码与R3采集一致；旧CI测试适配也已包含在该轮源码绑定。下载管理的命名/侧车/保存位置/平台质量、真实provider多任务、iOS系统后台/真机签名等余项继续，整体目标未结束。

## 最终绑定

- source：`cf3f9fe172ef7914546f27d8e3254472099b00643a9a062bcd05dbd79719b27a`
- patch：`59ade48edc767fa980e682f48fb6a70243992b42c232c1fb7802a1876a44e480`
- bundle：`de6c4e88cad1167199fe03fc4d2aea9da8e25b1a5c5ebd93ca429ee0e4e34da5`
- js：`728da5cb14aa1d21c408eec286aebcc4cebb3a6783698f3ffc2a38bbba30eea1`
- manifest：`9e94e79545a991f4134c69332849ac42e83a6affeaac0d8b84704f5e9601fc28`
- index：`5ce9877619b3b92782456e31beec9151ebdc4406c51599846d47cc366775ac25`

R3采集前candidate.patch、10附件/精确xcresult及外部输入前后SHA均通过；未使用latest/skip-hash。原生暂停真实契约另绑定Native/桥接/JS存储源码、二进制与输入。既有APK --review/395E严格审核沿本批回执，无新增Sollin证据。系统后台/实际App进程终止及真机签名仍待独立验证。
