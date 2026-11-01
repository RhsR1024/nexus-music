# 相似歌曲：网易公开读取与权威队列

播放器批次补齐相似歌曲入口，搜索/发现共享歌曲菜单和播放器更多菜单均可进入。当前实现网易公开推荐；其他平台没有已核实的适配，不把普通搜索当成其相似推荐。页面提供锚点、数量、推荐内搜索/清除、播放全部、随机、当前曲定位、刷新和标准歌曲更多操作。元数据读取不调用播放器；明确选曲后继续使用playTracks和原LX解析，替换权威队列并恢复编辑。

## 实现与参考边界

只读适配器固定平台HTTPS origin、numeric ID、有界结果和credentials=omit，复用已有onlineTrack清理元数据；不读取账号、Navidrome或脚本秘密，也不返回推荐接口的音频地址。原曲/重复项去重、非法全量响应与成功空数组分开处理。页面会话有AbortController及代次，换锚点/关闭隔离迟到结果；刷新失败保留旧内容并明确说明，错误不显示原始URL/请求头。筛选只改变可见行，选曲仍使用本次完整推荐集合，页面明确告知。随机动作沿音枢已有shuffle偏好，存储成功后才提交播放，并隔离关闭后的反馈。

复用E-262→F-003→P-001的页面/统一播放意图，以及E-964/E-966/E-968的锁定队列外部替换观察；已亲看原E-262截图。原生master-route、APK gate、采纳前--review和外置功能case严格哈希review通过，395E/101F/99P、3WI/124events、零错误/警告保持。未新增Sollin采集、逆向、后台或性能结论，未改变Q125范围。

五参考固定HEAD与根许可摘要复核保持，受限检索其既有src/自有docs未找到可直接采用的相似歌曲实现，不外推为全仓无能力。另按既有盘点核对api-enhanced固定2c36daf07a4a092df3e5dc66f3acc9e1a9b4c91f（MIT）的[module/simi_song.js](https://github.com/Ryderwe/api-enhanced/blob/2c36daf07a4a092df3e5dc66f3acc9e1a9b4c91f/module/simi_song.js)，仅研究公开端点/字段，自写客户端直连平台；没有引入其服务部署、Cookie服务、代码依赖、加密模块或商业逻辑，不推断Sollin使用此API。固定来源、许可证与维护/Android边界沿[参考比较](REFERENCE_COMPARISON.md)。本批TS/React职责可共享，原生播放维持既有平台后端；iOS模拟器结果不外推为Android新页面或实机通过。

## 验收

npm run check：880通过，新增7项覆盖无凭据/非法来源不出站、元数据清理/去重/长ID、空态与认证/格式错误分离、换锚点迟到隔离、刷新保旧与安全错误、取消不发布和刷新不同锚点清旧。单元端口替身不作为UI或真实服务验收。

真实provider客户端从Photograph Ed Sheeran搜索取得网易28692519，再公开读取5首相似结果；结果为home/asheu、Collarbone、Tangerine、Dance Monkey、Why Can't We Be Friends?。元数据来自平台，并非注入测试歌曲。正式Release专项testLiveSimilarSongs：1通过/0失败，205.594秒，精确SourceUITests-1793496483034.xcresult；iPhone15ProMax模拟器/iOS26.3.1/23D8133、430×932pt/@3x，默认blush/rose及真实封面着色保持。

正常导入启用指定V261020固定源05631b29ff18a4b8688b4464abf0f38952474cd4d8d6c4149c365b0190c7fd28。共享歌曲菜单真实读取/输入无匹配文本/清除/返回后，原Shape仍暂停。随后明确播放Photograph并验证NativePCM/进度，暂停后锁定30首搜索队列；从播放器更多进入相似页，真实刷新并点home，NativePCM与4秒进度变化通过后暂停。完整队列为1/5，锁定关闭，上下移/删除控件恢复；重启保留home和暂停状态。最后通过正常下载管理明确播放原Shape并暂停。没有生成音频、假目录或SQLite状态注入。

最终B目录build/similar-songs-live-20261101-b：完整candidate.patch、manifest、源码/新增文件副本与摘要、输入摘要、9PNG逐图SHA及验证回执。源码digest 97a8a44728c5af8a241be3544cd17d789525a9c340261190fa11d1ea72753257，全部9PNG同源ready且逐张亲看；检查整页容器/文字/44pt控制区、正常滚动和返回，未报全局静态像素对齐或连续动效一致。量测与计划见[预登记](ui-spec/similar-songs-real-2026-11-01.md)。

19→19记录，变化仅queue.v1、queue.cursor、library和playbackStats；全部偏好、下载记录、托管附加文件及其余记录保持。原Shape/Perfect及两份公开Photo共4个音频文件的名称、字节与SHA全部保持。整轮有明确播放/锁队列动作，不能声称整轮队列哈希不变。新曲的证据是原生PCM和进度，不把截图当作声音/耳听证明。

## 反例与继续范围

A为SourceUITests-1793496123432，0通过/1失败、95.432秒。真实推荐和页内空态已显示，Typography父子StaticText同名导致测试匹配多项；限定同一文本树的firstMatch后B保留原断言通过。A源码及新增文件副本/摘要、结果包和失败附件留存，未计通过。初次新增会话类使用Node strip-only不支持的参数属性导致测试导入失败，已改为显式字段/赋值，最终880检查通过。

其他平台相似适配、真实provider空错/重试与取消矩阵、其他共享页面逐页验收仍继续。播放全部、随机、定位及逐行更多虽已接正式命令，本轮未逐项点按验收，不记完整相似页通过。实体机/签名、耳听、VoiceOver专项和连续动效未验；当前有效签名身份0。用户暂无专用非私人账号，授权态继续待验，不重复请求。原F/J整体保持开放；上一批8acd2f8的CI及本批新提交须按各自SHA核对。

本轮磁盘/占用核对未删除当前缓存或必要证据；结束时只停止本轮专用模拟器，其他会话模拟器保留。失败A、最新有效阶段及reverse-skill材料继续保留，旧轮换可取性以[构建回执](2026-10-30_build-retention.md)为准。
