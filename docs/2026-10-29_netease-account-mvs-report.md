# 网易远端MV只读切片与共用目录保护

已开始的网易收藏MV切片接入正式账号页；抽取音枢自有AccountCatalogRead及共用卡片/目录容器，与专辑保持独立请求代次和成员缓存。MV进入现有独立MVDetail；普通平台视频保留身份/元信息和明确打开限制，不丢弃或伪装成MV，不进入音乐队列，不作本机目录回退，不写平台收藏。

用户已明确暂时没有专用非私人账号、继续其他能力。本切片收束后，授权目录成功态保留待验，不反复索要账号；下一优先处理已定位的背景图片CI失败，再继续不依赖登录的路径。原F/J、F-100和其他来源/真实授权/实体机范围不缩减。

## 证据、来源与边界

| Evidence → Finding → Path | 本批使用 | 限制 |
| --- | --- | --- |
| E-1307收藏MV入口；E-1305/E-1309 → F-100 → P-098 | 保留远端入口与目录语义，音枢自行实现只读设计 | 不将歌单/专辑观察外推为Sollin完整MV目录行为，不新增Sollin结论 |
| 固定MIT模块mv_sublist.js | 官方HTTPS weapi/cloudvideo/allvideo/sublist和分页参数 | 只借鉴请求契约，不复制服务器/代理/运行时/凭据 |
| 849检查、真实MV/专辑匿名入口、匿名端点301 | 生命周期/分页/类型隔离受控，真实官方登录取消与重启实际通过 | 不是授权列表/刷新/普通视频限制/详情重开真实服务验收 |

原生路由R1 APK、APK gate及采纳前--review通过；既有外置功能case的scope/workitems/timeline沿已审内容，严格复审395E/101F/99P、3工作项/124事件、0错误/警告。无新采集、逆向或安装替代功能证据。case为本机忽略索引work/sollin-android-ui-20261023；本回执采用实施模板与最小证据链，flavor=null。

五参考固定HEAD/既有许可和维护边界已复核，无新增参考依赖/补丁。额外MIT协议源为[已固定公开镜像模块](https://github.com/IcyBlue17/NeteaseCloudMusicApiVercel/blob/32531f1331fe9db7af8e7def33b4702e59275bfe/module/mv_sublist.js)，沿已读同提交LICENSE，Binaryify 2013-2022，归属见[NOTICE](../THIRD_PARTY_NOTICES.md)和[许可](../licenses/netease-cloudmusic-api-mit.txt)。模块本机SHA为3ae42227120165359d53e6cf182c046dd65f5140af9eee1101336e460947b6e2。

公开[字段交叉线索](https://github.com/chen310/NeteasePotPlayer/blob/f4ed2c75867005571d4840834282f93735e650da/Media/PlayParse/MediaPlayParse%20-%20Netease.as)核对vid/title/durationms/coverUrl/creator和MV/视频类型；该仓库未声明许可，不采用其实现代码、依赖、播放/解密逻辑或资产，仅记录协议字段事实，不据此证明真实账号响应。所有字段净化、状态保护和界面由音枢原创；不推断Sollin接口。

## 实现与验证

共用读取器逐步检查当前账号对象、会话/资料归属、取消/请求代次；完整分页必须总数稳定且无循环/缺页，失败不发布部分目录。MV与普通视频按内容类型加ID区分，即使原始ID相同也不覆盖；未知类型、错误MV标识或不合理时长拒绝，毫秒保留为秒。目录仅内存元数据，排除播放地址、账号凭据与未知字段。重新登录先返回账号页，由正式入口发起。

`npm run check` 849/849，0 fail；原专辑9项回归保持，新增7项覆盖MV净化/时长、普通视频限制/同ID隔离、坏数据、完整分页、取消/账号替换、专辑/MV并行独立及授权错误/旧成员失效。早期抽取使用参数属性与Node strip-only不兼容，已改显式字段后通过；旧失败日志保留。

| 最终Release UI | 结果 | 精确xcresult | PNG |
| --- | --- | --- | --- |
| testLiveAccountMVEntry | 1/0，77.447秒 | SourceUITests-1793284825012.xcresult | 3/3 ready、亲看 |
| testLiveAccountAlbumEntry | 1/0，67.398秒 | SourceUITests-1793285143409.xcresult | 3/3 ready、亲看 |

两轮源码摘要1812df0bbd2c22e65e4022ef23104e9ab3509b257c9dad848d058ed96020ea24；源码、候选patch、外部输入/安装绑定通过。登记原文prereg-a.md摘要dd7eb771a9afe2cc37606097a865985ebb61c31ea98e70aad83fa8af84c03a91；登记在接线编码后、首次正式采集前，未冒称编码前的Sollin同态像素量测。输出为build/account-mvs-live-20261029-a及build/account-mvs-album-regression-20261029-a；manifest/导出索引哈希见本机final-summary.json。

使用iPhone15 Pro Max模拟器iOS26.3.1、430×932pt/@3x，正常导航与既有V261020批准实源Shape of You回放；解码标记、3:53进度、暂停→新/原卡片→实际官方网易登录页→取消→重启及load缺席实际通过。无个人歌单、私人凭据或合成授权列表截图；不是全部音源重新解析/耳听/实体机验收。官方端点无凭据请求实际301、data非数组，只证明匿名鉴权边界。

6PNG全部亲看；blush+rose/default封面取色，蓝色来自真实封面。无同内容Sollin目录对照，不申报像素/动效一致；授权列表、刷新、MV重开/普通视频限制尚未真实验收。19记录数量保持，目录/歌曲收藏/本地歌单均0；原两音频数量/字节/SHA不变，queue.cursor/library/playbackStats为正常回放变化。签名身份复查0，未执行本候选实体机或签名验收。

## CI失败与下一步

已实际核对40838751539和40851551813：checks成功，iOS同一步骤失败。f7提交为21/22通过，唯一失败testVisualImagesAndPlayerBackgroundPersistence，background-image查询无法匹配。下载了341519B失败证据ZIP，仅提取文本/JSON，未查看其中合成图片，未下载542MB完整诊断。小型回执在build/account-mvs-20261029/ci-artifact-receipt.json，下一检查背景弹层/可访问性/导航并以真实音频和图片复现，不减断言、不重派旧CI。

复现：仓库根先source scripts/environment.sh和npm run check；显式运行testLiveAccountMVEntry或testLiveAccountAlbumEntry，每次配置新的NEXUS_UI_RUN_DIR、上述NEXUS_SIMULATOR_ID和既有批准MP3路径NEXUS_UI_LOCAL_AUDIO。脚本会约束单目标/真实输入。证据使用精确xcresult/manifest，不使用latest/skip-hash，产物不提交。授权成功态不强行用模拟数据验收，继续用户要求的其他能力与原总目标。

真实入口复现命令（同工作区且原音频仍在，每次新目录）：

```bash
source scripts/environment.sh
NEXUS_SIMULATOR_ID=A8347A1F-0805-4731-B8CE-3FE48C156AC0 \
NEXUS_UI_RUN_DIR="$(mktemp -d "$PWD/build/account-mvs-repro-XXXXXX")" \
NEXUS_UI_LOCAL_AUDIO='/Users/ningli/WorkSpace/NexusMusic/build/local-sort-live-20261025/Shape of You - Ed Sheeran.mp3' \
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLiveAccountMVEntry
```

专辑回归改用testLiveAccountAlbumEntry和另一新目录；授权态不能用该匿名命令代替。
