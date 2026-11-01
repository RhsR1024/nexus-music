# 歌曲分享：公开详情链接与原生取消归属

共享歌曲菜单补齐“分享歌曲”；播放器原有仅歌名/歌手的分享改用同一个内容生成器与系统分享生命周期。五平台按已核对的公开ID白名单生成详情URL：网易/酷我数值ID、QQ songmid、酷狗hash及可选albumId、咪咕copyrightId。无合法公开ID时退回可见歌名/歌手；本机、设备、WebDAV、Navidrome和汽水导入来源只分享名称，不转发账号、路径、播放URL、headers或任意元数据。可见文字去控制符并按Unicode码点限长。系统取消按正常结束处理，错误使用固定文案，迟到回调不写入其他歌曲面板。

实测发现系统分享取消点可能落入播放器菜单底层控件；分享期间禁用PlayerMenu全部按钮（卡片、行、关闭），共享TrackActions也保持busy保护。修正后在原取消点恢复同一菜单，按钮重新可用，歌曲仍暂停。分享不调用播放意图、队列、偏好或下载操作；测试中的明确播放仍沿正式播放器与权威队列。

## 来源与门禁

复用E-1278→F-081→P-078：该批只证明Sollin菜单含分享入口，分享动作/歌曲口令未执行。本次亲看既有q105-chart-track-more原图，未新增采集或推导其内部接口。原生master-route、APK gate、采纳前--review及功能case严格哈希review通过，395E/101F/99P、3WI/124events、0错误/警告保持。索引与原始材料留既有外置case；本轮只增加音枢实现和验收资料。

五个ReferenceProject固定HEAD复核一致，许可/维护边界沿[参考比较](REFERENCE_COMPARISON.md)。本轮核对Q-1515与wtfdelphia的getMusicDetailPageUrl和自有onlineTrack元数据命名空间，按协议事实独立构造URL，无复制依赖、原生补丁、商业业务逻辑或私人令牌。实际五平台匿名搜索结果均生成公开格式链接；酷我首项为另一歌曲，未称五平台匹配同一曲目。外部网页自动打开未通过工具验证，不能把链接构造/系统预览当成各站网页可用性或真实服务全矩阵通过。

## 验收

npm run check：885通过，新增5项覆盖五平台ID命名空间、任意媒体/认证元数据排除、五类本机/私人来源、无效ID/注入回退、名称清洗与长度边界。单元样本仅用于逻辑检查；UI验收使用真实内容。

正式Release testLiveSongShare最终D为1通过/0失败，153.968秒，精确结果SourceUITests-1793500053957.xcresult。专用iPhone15ProMax模拟器，iOS26.3.1/23D8133，430×932pt/@3x。正常离线页恢复Shape of You，实际PCM/4秒进度后暂停；正常设置加载resources/V261020固定GdStudio源（SHA256 05631b29ff18a4b8688b4464abf0f38952474cd4d8d6c4149c365b0190c7fd28），正常搜索Photograph Ed Sheeran。

共享菜单→系统分享服务，直接断言原生caption包含Photograph — Ed Sheeran及https://music.163.com/#/song?id=28692519；正常点按面板外侧取消，原Shape仍暂停。明确播放Photograph，确认PCM/进度后暂停；播放器更多→系统分享，断言相同真实caption，原点位取消后回到同一菜单且分享按钮可用；返回仍为Photograph暂停。正常下载管理恢复Shape，真实播放后暂停，重启仍为Shape暂停。没有发送内容、选择目标应用、读取/修改剪贴板或保存分享文件。

源码digest 83164c233c739dcac06f06701803f9aa7d5545c35cc6522a6a580d68b4a58fae。build/song-share-live-20261101-d保留完整candidate.patch、run-manifest、存储前后SHA、精确xcresult引用、输入/截图哈希、双进程AX层级和verification-receipt。8PNG全部同源ready且逐张亲看；无源/输入漂移，candidate.patch匹配。批准输入Shape MP3 SHA256 be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203保持；真实播放也可能使用此前已完成的公开离线文件，本轮未据此声称重新验证在线媒体下载。

按[预登记](ui-spec/song-share-real-2026-11-01.md)检查入口、可读性、容器/返回及56pt操作行（大于44pt点击区）。默认blush/rose/gradient与真实封面取色保持。参考Patient Zero与本批Photograph内容不同，整页同态像素证据不完整；本批按0079做功能/体验验收，不新增“整页静态对齐”或动效一致结论。

19→19记录，最终D及整个A→D阶段变化都仅queue.v1、queue.cursor.v1、library.v1、playbackStats.v1；全部偏好、下载记录、托管附加文件及其他记录保持，4份已有公开音频名称/字节/SHA全部相同。显式播放/恢复允许队列变化，不称整轮队列哈希不变。只关闭本批专用模拟器，保留其他会话设备；磁盘余量已检查，失败包/当前证据保留，无盲删构建目录或Sollin材料。

## 失败轮次与边界

A：SourceUITests-1793499011604.xcresult，105.620秒，0/1，只在host应用内找关闭按钮；B：SourceUITests-1793499368782.xcresult，108.656秒，0/1，系统服务完整截图/层级证明分享已呈现，但紧凑面板无关闭按钮。C：SourceUITests-1793499656370.xcresult，125.836秒，0/1，改按真实面板外侧取消，共享路径已通过；播放器取消后未回菜单。系统窗口minY546、host倍速行frame(16,453,398,56)，取消点(408,506)落在该行内，属于基于现场几何的定位；未声称记录了倍速选择。D禁用底层按钮并在同点重跑完整通过。A/B/C及其原包/失败资料均保留，不计成功。

其余平台原生分享、私有来源实际UI、Android/实体机、错误/迟到/连续分享全矩阵、VoiceOver、外部页面、签名、耳听和连续动效仍未验；有效签名身份0。既有歌曲口令协议未证实，不猜测实现。当前公开分享能力不等于全部歌曲操作或F/J完成。用户暂无专用非私人账号，授权目录继续待验且不重复索要账号；后续沿既定批次检查下一独立余项。

本批云端验收需按实际提交另核对；本地结果与安装/打包均不能替代云端、实体机或外部服务验收。
