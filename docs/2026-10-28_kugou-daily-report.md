# 酷狗账号每日推荐实施回执

批次8扩展既有平台推荐入口：酷狗账号可读取每日推荐，网易云私人FM仍只属于网易云。协议参照用户指定Q-music Android，不推断Sollin使用相同接口；完整酷狗扫码授权后的真实日推仍未验收。

| Evidence | Finding | Path |
|---|---|---|
| 固定Q-music `5db858f32695d10c5e9ef0f7037d586aef6a8c4b` 的 `kugouApi.ts:getDailyHashes`、`daily.ts`、`kg/songList.js:createTask/getMusicInfos/filterData2` | 独立官方HTTPS推荐hash、详情保序/完整性及签名字段；只证明源码路径 | 原创 `kugouDaily.ts`，不导入Android运行时/依赖/补丁 |
| `build/kugou-daily-20261028/reference-check.json` 七文件与固定对象逐字节一致 | Apache/Nshpiter/LX NOTICE 与MakcRe MIT边界保持 | [第三方说明](../THIRD_PARTY_NOTICES.md)、[来源比较](REFERENCE_COMPARISON.md) |
| `tests/kugou-daily.test.ts` 与既有日推测试；全量698通过 | 签名、缺项补查一次、保序/录音去重、音质hash、错误脱敏、取消/账号替换/缓存失效 | 共享AccountDaily生命周期，不授予其他账号能力，不以本地列表伪装平台日推 |
| 实际公开搜索+酷狗HTTPS详情探针 | Shape of You（Ed Sheeran）真实ID `24748592`、233769ms和音质返回 | 仅详情服务；推荐hash在探针内拦截，未发送账号token，不是授权日推成功 |

## 实施边界

账号与会话的platform/userId/mid/version必须匹配当前账号，未经匹配不请求；查询可能含凭据，底层异常统一脱敏。传输credentials=omit、HTTPS及有界期限，无第三方代理。推荐最多30首，详情最多补查一次；仍缺少有效详情时报错，保留上次已展示列表；成功空列表独立显示空态。每次返回前复核当前账号、请求代次和日期，退出/替换账号清缓存，迟到结果不能覆盖新请求。

统一推荐页可选网易云/酷狗账号，酷狗不显示网易云FM、不新增替代列表；播放通过已有playTracks与LX优先解析器/权威队列。登录能力列表不自动扩为歌单、收藏、账号播放或FM。公开详情不是音源URL/实际PCM或完整授权证据。

## 门禁与验证

原生master-route为APK PRIMARY，APK prerequisite及--review通过；默认安装case不作为功能证据。既有Android功能case直接strict review首次被两个AppleDouble二进制元数据旁文件阻断，核对文件头后原样保留到case/artifacts/metadata-20261028/*.bin，主报告/素材不变，小型回执在本机。再次strict review通过395E/101F/99P、3WI/124timeline，0错误/警告；没有新增采集或Sollin结论。

`npm run check` 698/698。最终真实音频库Release1/0/0、17.769秒通过（`build/SourceUITests-1793148919006.xcresult`），三张实际PNG均ready并亲看，正式音乐库→账号页及酷狗入口可达。清理后19条记录与两份原音频前后保持，源码`16424090652ecfc7586fcc708d8a1ea8fb936694b5aeb875186b5e303397c457`及输入摘要不变，专用模拟器已关闭。R1/R2虽然XCTest通过，人工检查R2截图发现旧测试留下的Synthetic tone历史/统计，因此不采用这两轮作本批UI验收。已备份并仅从专用测试模拟器的library.v1及playbackStats.v1（含replica）移除三个明确fixture ID，保留所有公开歌曲、音频和账号；记录级前后哈希与恢复备份在本机synthetic-history-cleanup.json / synthetic-history-backup.json。最终轮以清理后的状态为基线，不把清理前后写成所有记录不变。

设备只读检查为developerModeStatus=disabled、ddiServicesAvailable=false、tunnel unavailable，不计实体机通过。

复验使用全新输出目录：

```bash
source scripts/environment.sh
NEXUS_SIMULATOR_ID=A8347A1F-0805-4731-B8CE-3FE48C156AC0 \
NEXUS_UI_RUN_DIR=build/kugou-daily-live-20261028-r3 \
NEXUS_UI_LOCAL_AUDIO="/Users/ningli/WorkSpace/NexusMusic/build/local-sort-live-20261025/Shape of You - Ed Sheeran.mp3" \
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLivePlatformRecommendations
```

音频沿用V261020来源的公开录音，Shape SHA256为`be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203`；复跑前检查专用库无合成曲目历史，先读数据再截图。

未验证：真实扫码授权、授权日推成功/失效、真实Keychain故障、酷狗日推曲目的实际播放、真机/签名/后台与动效。自动服务桩、公开详情和匿名入口分别记录，不替代这些边界。
