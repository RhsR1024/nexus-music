# 相似页控制与随机模式：真实来源预登记

在上一批网易相似纵向路径后继续，复用E-262→F-003→P-001与既有相似/队列证据；原生master-route、APK gate/--review及395E/101F/99P功能case严格review通过。没有新Sollin采集、后台/性能或内部机制结论。参考/许可边界沿[上一批](../2026-11-01_similar-songs-report.md)，不新增参考代码/依赖或服务。

检查现有代码发现：相似页/发现页随机动作只写shuffle=true；nativeSession曲终先检查repeat=one，而队列UI先显示shuffle，故从单曲切随机可能显示随机却继续单曲。按既有队列模式契约一次写repeat=off、shuffle=true，不修改native曲终算法或增加另一权威队列。

专用iPhone15ProMax模拟器A8347A1F-0805-4731-B8CE-3FE48C156AC0、iOS26.3.1/23D8133、Release、430×932pt/@3x。正式target testLiveSimilarControls，新目录build/similar-controls-live-20261101-a。正常blush/rose/gradient和实际封面着色；布局沿上一批16pt/48px内边距与44pt/132px点击下限，按0079检查可读/可达、滚动、返回和真实反馈，不报像素或动效一致。

输入沿指定V261020固定源05631b29ff18a4b8688b4464abf0f38952474cd4d8d6c4149c365b0190c7fd28，以及原公开Shape MP3。开头从正式下载管理播放原Shape/PCM后暂停，正常导入启用脚本并真实搜索Photograph。共享相似页真实读取/本次推荐内空态/返回保持原曲暂停。

新增交互：播放全部推荐→真实首曲PCM/进度/暂停→队列数量等于实际推荐数→在正式队列切为单曲；回搜索中的原Photograph共享菜单再开相似页，定位当前播放须可用且真实行可达；逐行更多执行加入队列，验证数量增加一、当前曲暂停与单曲模式保持。再从原锚点相似页点随机，验证真实播放，暂停后用正式进度条定位距曲尾6秒内、继续播放，等待曲终切为另一歌曲并验证其PCM/进度；队列仍为完整推荐数、随机模式选中。最后用正式队列恢复顺序、正式下载管理播放原Shape并暂停，重启后顺序与原曲暂停保持。

本机只读SQLite已确认前置repeat=off、shuffle=false，不读取/打印私人字段，不注入状态。整轮显式切换/恢复模式，最终全部偏好哈希应与开头一致；全部四个已有公开音频和下载记录保持。队列/统计/库变化对应明确正常播放和加入队列，不声称整轮queue哈希不变。

冻结源码、Swift与driver，保留candidate.patch/manifest/精确xcresult/输入与源码摘要/逐图SHA，逐图亲看；所有界面均为真实公开推荐、批准真实音源或其真实播放。发现页随机同策略修正尚未逐页重跑；provider错误/取消矩阵、其他平台、实体机/签名、VO与连续动效仍独立待验，不用截图或构建成功替代。

实际完成：SourceUITests-1793497645984、1/0、288.307秒、12PNG同源ready且逐图亲看；源码digest c74248f678167e78a532822176a9997aee737a741e45131adf248d71a93b4775。近曲尾为home 2:59/3:02，随后Dance Monkey、队列4/5随机；最终顺序/原Shape暂停和全部偏好/四音频保持。见[验收回执](../2026-11-01_similar-controls-report.md)。
