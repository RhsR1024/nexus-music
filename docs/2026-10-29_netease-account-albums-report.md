# 网易云远端收藏专辑只读接线

新增账号绑定的 AccountAlbums 和正式平台账号卡片，接线按需读取、完整分页、刷新、空/错态与正式专辑详情重开。它读取平台账号目录，不用音枢本机目录回退，不订阅/取消平台收藏，不持久化账号目录，也不进入播放器/LX边界。

**真实授权目录仍未验收。** 本批验证了受控读取契约、真实匿名入口/官方登录/取消/重启，以及不带凭据的官方端点返回301。没有使用私人账号、个人歌单或合成登录态截图；不能据此证明授权目录成功、响应字段/总数符合真实服务、刷新和详情重开通过。F-100及原F/J范围继续，其他平台和远端MV不算完成。

## Evidence → Finding → Path

| 依据 | 可支持的结论 | 实施边界 |
| --- | --- | --- |
| 既有E-1305/E-1309 → F-100(validated) → P-098 | 远端账号目录可读取/刷新/进入歌单和专辑详情 | 复用可见能力结论，不能用本机目录替代，也不推断Sollin后端 |
| 固定公开module/album_sublist.js与MIT许可 | 官方HTTPS只读地址、weapi、limit/offset/total参数 | 自写会话验证/完整性/取消/UI，不运行或复制参考服务器、依赖、代理或凭据 |
| 842检查含9项新契约、两项真实UI、匿名端点301 | 受控生命周期和匿名路径实际验证 | 不提升为真实授权服务验收，不生成新的Sollin Evidence/Finding |

reverse-skill包根/PRIMARY沿已亲读要求，原生master-route得到R1 APK，APK gate与采纳前--review通过。功能case严格复审395E/101F/99P、3工作项/124事件、0错误/警告。scope.md和timeline.md仍在本机忽略的既有外置case索引 `work/sollin-android-ui-20261023`；未新增Sollin采集、逆向或案例事实。本回执为实施模板与最小证据链，flavor=null。

## 协议来源与许可

五固定参考的HEAD/许可/维护/Android边界沿[REFERENCE_COMPARISON](REFERENCE_COMPARISON.md)，本批定向检索未据它们虚称有收藏专辑接口。额外只读协议源为Binaryify项目的公开镜像[IcyBlue17/NeteaseCloudMusicApiVercel固定模块](https://github.com/IcyBlue17/NeteaseCloudMusicApiVercel/blob/32531f1331fe9db7af8e7def33b4702e59275bfe/module/album_sublist.js)，固定提交32531f1331fe9db7af8e7def33b4702e59275bfe。已读同提交LICENSE，MIT / Copyright (c) 2013-2022 Binaryify；归属保留于[NOTICE](../THIRD_PARTY_NOTICES.md)与[许可](../licenses/netease-cloudmusic-api-mit.txt)，原模块/许可的本机摘要见reference-check.json。不由此给音枢整体重新授权，也不把接口归因于Sollin。

只采用请求契约，使用音枢已有weapi/会话与资料验证；没有新增依赖、Native桥、补丁、服务器、代理、商业逻辑或令牌。平台API维护和真实授权接受度独立于源码存在。

## 账号与目录边界

读取前核对当前账号对象、会话platform/accountId/userId、username和最新官方资料。每次异步返回再核对账号/请求代次与取消信号，拒绝同ID对象替换、迟到结果、伪造目录条目及失效旧目录。只接受完整、总数稳定、无重复/循环的有界分页；错误不发布部分结果，不把未知结果写为空目录。

平台账号页新增“网易云收藏专辑·远端”卡片。已授权路径的目录弹层包含刷新、取消、反馈、空态和正式Discovery专辑详情；账号改变/失焦/卸载撤销任务并清理显示。目录只在内存，用户明确从正式专辑详情另作本机收藏是独立能力。以上授权态UI为接线，尚待真实专用账号验收。

## 实际验证

A轮67.163/57.726秒通过后，复核发现取消末态的load断言仍使用歌单ID。B仅修测试驱动：统一按albums选取load并补重启后的显式load缺席断言，保留无账号断言和生产代码；A原产物保留，不作为最终新驱动证据。以下均为B轮。

`npm run check` 842/842、0 fail；9项新测试覆盖元数据白名单/坏数据/真空、稳定完整分页、缺页/重复/变总数、会话和资料归属、同ID替换、取消、请求代次、失败刷新后旧条目及授权错误。测试使用明确的unit-only受控会话，不使用私人凭据，也不把其数据用于截图。

| 最终Release UI | 结果 | 精确xcresult | 真实PNG |
| --- | --- | --- | --- |
| testLiveAccountAlbumEntry | 1/0，66.247秒 | SourceUITests-1793266305289.xcresult | 3/3 ready，亲看 |
| testLiveAccountPlaylistEntry原入口回归 | 1/0，57.440秒 | SourceUITests-1793266521589.xcresult | 3/3 ready，亲看 |

两轮源码摘要均为6fbe4155d42ec0b860de05f57121ae92c74e896a021d672968b28e14de301ba5，源码/候选patch/外部输入/安装绑定通过。前登记摘要9d37c9ff2e12a9e767a72dbf8753309e36b497ab28f0d093dd5f2f12628fa1ff，原文保留prereg-b.md。manifest/截图索引摘要在本机final-summary-b.json，路径为build/account-albums-live-20261029-b与build/account-albums-playlist-regression-20261029-b。

使用iPhone15 Pro Max模拟器、iOS26.3.1、430×932pt/@3x和正常导航。音频是既有V261020批准实源导入的Shape of You样本，实际解码标记、3:53时间轴进度与暂停检查通过；未重新解析所有平台/脚本，也不等同耳听/实体机验证。两次均从真实卡片打开官方网易登录文档、取消并重启，未保存网易会话。额外使用无凭据请求官方/weapi/album/sublist，实际返回code301、data非数组；仅证明匿名鉴权边界，不证明授权服务成功。

亲看6PNG确认新卡片、区别本机/平台的文案、真实官方页、取消及重启后匿名状态。默认blush+rose/封面取色，蓝背景来自真实封面；没有合成登录态成功截图或同内容Sollin目录对照，不评分像素相似度，不宣称动效一致。签名身份本批复查0，未执行实体机安装或签名验收。

数据库保持19项，正常回放变化仅queue.cursor/library/playbackStats，两原音频数量/字节/SHA不变，目录收藏/歌曲收藏/本地歌单均0；没有新增目录或凭据持久记录。不声称所有播放记录不变。

## 复现与继续

在仓库根执行：

```bash
source scripts/environment.sh
npm run check
NEXUS_SIMULATOR_ID=A8347A1F-0805-4731-B8CE-3FE48C156AC0 \
NEXUS_UI_RUN_DIR="$(mktemp -d "$PWD/build/account-albums-repro-XXXXXX")" \
NEXUS_UI_LOCAL_AUDIO='/Users/ningli/WorkSpace/NexusMusic/build/local-sort-live-20261025/Shape of You - Ed Sheeran.mp3' \
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLiveAccountAlbumEntry
```

原入口回归将方法换为testLiveAccountPlaylistEntry，另建新输出目录；需要已有真实曲库与网络，不用假数据补网络失败。产物/原样本/原始证据均不提交。

继续原F-100远端目录完整范围和其他批次：专用非私人账号授权、实际分页/刷新/详情、账号变化与会话失效；QQ/酷狗等来源与远端MV；完整视频/后台、实体机/签名/动效及原F/J目标。当前本机目录和匿名验证均不替代这些要求。正常push后以远端SHA和实际CI队列回执为准，不取消运行中任务、不把旧CI成功覆盖本候选。
