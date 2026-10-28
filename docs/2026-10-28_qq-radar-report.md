# QQ私人雷达与官方日推读取边界

本批继续账号批次8，接入QQ私人雷达读取及正式推荐页；官方每日推荐的独立读取/验证客户端已实现，**独立授权页与key保存尚未接入**，因此不把普通QQ登录、雷达或此客户端当成完整官方日推交付。不添加手工输入key的替代入口，不使用私人凭据、个人歌单或虚构账号截图。

| Evidence | Finding | Path |
|---|---|---|
| 固定Q-music Android `5db858f32695d10c5e9ef0f7037d586aef6a8c4b` 的daily/requests/qqCredentials/cookies/dailyAuthorization及账号说明、LICENSE/NOTICE/MODIFICATIONS共九文件，与固定对象逐字节一致 | 官方日推为独立Bearer key，雷达另走musicu；桌面授权页与普通QQ登录不同 | 原创QQDailyClient，独立授权页为下一步，不推断Sollin相同接口 |
| tests/qq-daily.test.ts十项及既有日推相关34项通过；全量708检查 | 四页/30首边界、去重保序、10首详情组/失败单曲补查、账号/WX隔离、错误脱敏、缓存/取消/迟到结果 | 复用AccountDaily及权威队列，类型区分tx_radar与tx_official_daily |
| 正式AccountRecommendations/账号设置接线 | 平台选择包括QQ，显示私人雷达；保留实际来源，失败保留旧内容时也保留其kind | 已有playTracks/LX优先解析，不新增FM或个人歌单能力 |

来源/许可继续保留Apache/Nshpiter/LX NOTICE，未复制依赖、Android桥接、原生补丁或私人令牌；核对回执在本机 `build/qq-daily-20261028/reference-check.json`。

## 行为与限制

校验platform/accountId/userId、QQ网页uin与派生账号username后才请求；微信身份不借用QQ入口。Cookie仅发给固定官方HTTPS域；日推key仅进入独立官方daily-mix的Authorization头，不进入musicu、URL、可恢复元数据或日志。这里没有新增key持久化代码。默认没有key时只加载私人雷达；有key时官方失败才返回明确标注official_unavailable的雷达，取消不能触发回退。

雷达分页按页码合并、最多四页/30首，详情按请求ID保序，不接受错误录音、空media_mid、坏响应或不完整列表；成功空态独立显示。账号/日期/代次缓存、退出清理、权威账号对象复核沿用现有边界。推荐页保留具体来源名称，刷新失败保留旧列表时也保留其kind；账号对象变化在layout effect内撤销旧请求、清空列表，包括同毫秒重新登录的对象替换。官方日推与雷达不会共享“官方”标签，QQ不提供网易云FM。授权后的实际跨账号呈现仍需测试账号验收。

原生APK路由/prerequisite/--review与既有动态功能案例strict review通过，395E/101F/99P、3WI/124timeline、0错误/警告；默认安装case不是功能证据，无新增Sollin采集/结论。独立官方授权页面的固定参考已阅读，尚未实施，不以backend helper存在声明完成。

## 验证

全量708/708，相关34/34。真实音频库正常入口Release最终1/0/0、16.478秒通过（`build/SourceUITests-1793149802669.xcresult`），三张实际PNG均ready/亲看，19记录及两份原音频摘要保持；源码`f292c45049b71098aba97f5903f39e00bbafae6285a5f2d9780cd6406f79ea1e`与输入摘要前后不变，专用模拟器已关闭。R1先前15.599秒通过，随后完善绘制前账号撤销，以R2为最终。执行前只读检查19条记录无已知合成音调/Fixture artist标记，使用V261020来源的公开Shape of You及既有Perfect。未创建虚构QQ账号、推荐列表或授权key用于截图。

未验证：真实QQ登录后的雷达/官方日推服务、真实推荐曲目播放、独立授权页及key生命周期、真实会话失效与Keychain故障、实体机/签名/后台/动效。协议桩与匿名入口不证明以上通过。下一优先接独立官方授权页及取消/保存边界：需验证该页QQ身份与当前账号一致后再保存key，validateKey仅证明读取响应，不能单独证明key归属。另需修复/专项验证跨日期导致客户端取消而UI可能保持loading的既有路径。完整QQ授权与其余账号能力继续。

实体机只读复查仍为developerModeStatus=disabled、DDI不可用，不计实体机/签名通过。复验用全新输出目录，执行：

```bash
source scripts/environment.sh
NEXUS_SIMULATOR_ID=A8347A1F-0805-4731-B8CE-3FE48C156AC0 \
NEXUS_UI_RUN_DIR=build/qq-radar-live-20261028-r2 \
NEXUS_UI_LOCAL_AUDIO="/Users/ningli/WorkSpace/NexusMusic/build/local-sort-live-20261025/Shape of You - Ed Sheeran.mp3" \
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLivePlatformRecommendations
```
