# 相似歌曲公开读取与播放：预登记

复用现有E-262→F-003→播放意图路径，以及E-964/E-966/E-968的锁定队列外部替换观察；原生路由、APK gate/--review与严格功能review通过，395E/101F/99P、3WI/124events保持。原截图262-similar-song.png已亲看，1080×2340px，显示锚点/5首/播放/随机/定位/搜索/逐行更多。不猜其Android px→pt比例，不新增Sollin采集、规格、后台或性能结论。

音枢采用自己的只读公开网易适配器；其他平台能力未接入，不用关键词搜索冒充相似推荐。固定api-enhanced 2c36daf07a4a092df3e5dc66f3acc9e1a9b4c91f（MIT）的module/simi_song.js用于端点/字段研究，直接访问平台HTTPS端点，凭据omit，不调用其部署服务，不复制依赖或加密/商业逻辑，也不推断Sollin内部API。五个既有参考HEAD与许可证文件摘要核对见本机reference-pins.json。

正式组件为一个既有Sheet中的FlatList：锚点/平台说明、页内搜索、播放/随机/定位/刷新、状态和歌曲行/更多。取消、换锚点及迟到返回隔离；刷新错误保留旧推荐并明确说明，真正空态与数据错误分开。搜索只过滤展示，选曲仍使用本次完整推荐替换队列；随机播放遵循音枢现有shuffle偏好，未写成参考内部机制。所有动作继续使用权威playTracks、标准歌曲菜单和LX解析。

本轮正式target testLiveSimilarSongs，目录build/similar-songs-live-20261101-a；iPhone15ProMax专用模拟器A8347A1F-0805-4731-B8CE-3FE48C156AC0，iOS26.3.1/23D8133，Release，1290×2796px→430×932pt。默认blush/rose/gradient及真实封面着色保持；沿用space/typography/radius，16pt=48px容器内边距，按钮至少44pt=132px，歌曲行含真实封面与单独44pt更多按钮。按0079验收可读性、层级、滚动和可达，不预报像素相似度或动效一致。

正常路径：实际原Shape播放/PCM后暂停；正常导入指定V261020固定源05631b29ff18a4b8688b4464abf0f38952474cd4d8d6c4149c365b0190c7fd28；真实网易Photograph搜索→共享菜单相似→真实结果→正常输入无匹配文本查看本次推荐内空态→清除/返回→原Shape仍暂停。随后明确播放Photograph/PCM后暂停→锁定当前搜索队列→播放器菜单相似→刷新真实读取→正常点第一首→真实PCM/进度后暂停→完整队列按本次实际结果数替换并解锁编辑→重启保持当前曲/暂停→明确播放原Shape后暂停。

下载文件和全部偏好须保持；测试不点随机按钮，不把随机/定位/播放全部的实现记成真实交互已验。整轮包含明确播放/锁队列，不声称queue.v1哈希不变。功能空错/重试矩阵、其他平台、实体机/签名/耳听、VO专项及连续动效仍独立开放。真实音频和目录均来自批准输入/公开provider，不生成截图歌曲、音频或注入SQLite。

采集前冻结源码/测试/driver，保存candidate.patch与预登记副本；采集后用精确xcresult、run-manifest、输入/源码/逐图SHA校验来源并逐图亲看。原Shape/Perfect及两个公开Photo下载文件应逐字节保持，无私人账号、凭据或歌单。

最终B目录预登记为build/similar-songs-live-20261101-b。A的真实推荐/搜索已显示，原生Typography父子同名StaticText导致测试多匹配（95.432秒0/1），文本查询使用firstMatch锁定同一文本树，原断言保留。A源码/新文件副本及其capture摘要、失败结果包均保留，不计通过。B将新增源文件以intent-to-add纳入完整candidate.patch，未上传私人资源。

B实际完成SourceUITests-1793496483034、1/0、205.594秒，9PNG同源ready/逐图亲看，97a8a44728c5af8a241be3544cd17d789525a9c340261190fa11d1ea72753257。复用的播放意图路径为P-001（非本地扫描P-003）。原参考1080×2340px仅作页面语义/层级，音枢1290×2796px→430×932pt，容器padding16pt=48px、控件设计下限44pt=132px；可读、可滚动、无裁切遮挡，正常返回与选曲/队列均有真实交互证据，未报像素或动效一致。见[验收回执](../2026-11-01_similar-songs-report.md)。
