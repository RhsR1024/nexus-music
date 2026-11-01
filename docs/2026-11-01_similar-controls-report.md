# 相似页控制与随机模式一致性

相似页“播放全部、定位当前、逐行更多加入队列、随机播放”已补真实交互验收。修正相似页与发现页随机命令：一次保存repeat=off和shuffle=true，与既有队列模式契约一致。此前只写shuffle，队列UI优先显示随机，而nativeSession曲终优先检查repeat=one，可能显示随机却继续单曲；本批不改变原生曲终算法、播放器或权威队列。

复用E-262→F-003→P-001及既有相似/队列证据，原生master-route、APK gate、采纳前--review及功能case严格哈希review通过，395E/101F/99P、3WI/124events、零错误/警告保持。没有新增Sollin采集、后台/性能或内部机制结论；参考许可与provider/LX/播放器边界沿[上一批](2026-11-01_similar-songs-report.md)，无新参考代码、依赖、原生补丁或服务。

## 真实验收

npm run check：880通过。Release正式testLiveSimilarControls为1通过/0失败，288.307秒；精确结果SourceUITests-1793497645984.xcresult。专用iPhone15ProMax模拟器，iOS26.3.1/23D8133，430×932pt/@3x；实际目录/歌曲来自网易公开读取，播放使用批准V261020固定源05631b29ff18a4b8688b4464abf0f38952474cd4d8d6c4149c365b0190c7fd28和原公开Shape MP3，没有生成歌曲/音频或注入SQLite。

正常导入/搜索Photograph与推荐内空态回归后，播放全部建立完整5首推荐队列，home真实PCM/进度通过并暂停。正式队列改为单曲，从搜索原锚点再开相似页，定位当前home可用且行可达。逐行更多“加入队列”后为1/6，当前曲仍暂停、单曲模式保持。再从相似页点随机，home真实播放后暂停；正式进度条定位到2:59/3:02，继续播放约数秒后切到Dance Monkey，PCM及4秒进度变化通过。队列为4/5、随机选中、单曲未选。最终用正式队列恢复顺序、正式下载管理播放原Shape并暂停，重启后1/1和顺序保持。

源码digest c74248f678167e78a532822176a9997aee737a741e45131adf248d71a93b4775。完整candidate.patch、run-manifest、输入/源码与逐图SHA、12PNG和验证回执在build/similar-controls-live-20261101-a；12PNG全部同源ready且逐张亲看。按[预登记](ui-spec/similar-controls-real-2026-11-01.md)检查容器/文字/点击区、滚动/返回与实际反馈；默认blush/rose/gradient和真实封面着色保持。不将静态图或这次曲终行为写成与Sollin连续动效一致。

19→19记录，变化仅queue.v1、queue.cursor、library、playbackStats。全部preferences.v1、下载记录、托管附加文件和其余记录哈希保持；四个已有公开音频名称/字节/SHA全部保持。模式在测试中明确改变再恢复，队列也有明确播放/入队/恢复操作，不报整轮queue哈希不变。前置repeat=off/shuffle=false由只读SQLite确认，未读取或打印私人字段。

## 源码归档修正

首次工程检查发现，上批A/B各4份新增源码副本使用.ts/.tsx扩展名，被默认TypeScript扫描纳入工程，因归档相对导入路径而报错。已核对每份原索引与SHA，将8份字节不变副本改为文本扩展名（如provider.ts.txt），同步更新各new-source-copy-receipt.json；没有删除正文、结果包、截图、源摘要或reverse-skill证据。旧副本应通过各自新索引查找，不沿用旧扩展名路径。逐项old/new路径、字节、SHA及理由留build/similar-controls-20261101/archive-extension-receipt.json；随后完整880检查通过，冻结源码未在采集期间变化。后续诊断副本应使用文本扩展名。

## 未验范围

发现页采用相同模式修正，但其随机按钮未在本轮单独重跑。逐行更多只新增验证加入队列，其他动作沿共享菜单既有验收，未据此外推全部页面/组合。网易provider真实空错/重试/取消矩阵、其他平台相似适配、VoiceOver专项、实体机/签名、耳听及连续动效仍待；当前有效签名身份0。用户暂无专用非私人账号，授权态保持待验，不重复请求。原F/J整体未完成。

本轮检查磁盘与目录占用，保留当前缓存、最新有效阶段及失败证据；只停止本轮专用模拟器，其他会话模拟器保持。提交后另核对远端SHA与single队列，不将旧云端成功替代本候选。
