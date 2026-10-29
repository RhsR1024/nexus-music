# 咪咕匹配建议与搜索入口回归

咪咕输入建议已从“不支持”改为音枢自己的“匹配建议”：读取既有匿名歌曲搜索第一页元数据，生成最多5个标题/艺术家查询词；页面说明“根据公开歌曲匹配生成，点击后重新搜索”。这落实输入建议的可见交互，不冒称咪咕专用官方联想服务或Sollin内部实现。旧v3联想跳首页的路由继续不用。

## 实现与边界

SearchAssistanceProvider内部持有只用于咪咕元数据的OnlineProvider副本，通过已有强制credentials=omit的HTTP边界请求；不读取账号、不解析音频、不持久化Track、不编辑队列。结果仍通过既有文本清理/去重、取消与请求代次保护。缺失/矛盾总数、正总数却无行等为错误，明确0条才返回空建议；不是把接口错误压成空态。

当次公开核验：love返回5条元数据，总数250；生成“LOVE！ - 吴宇恒”后重搜返回7行/总数53。当前咪咕热词首条重搜返回10行/总数44。服务可能返回超过pageSize的附加匹配行，展示仍限制5个词，不把请求页长冒充返回数量保证或Sollin容量规格。回执在build/migu-assistance-20261029/{public-probe,actual-matching-words,hot-resubmission}.json。

复跑全部公开读词路径，五热搜/四原联想/咪咕自有匹配均实际返回；当次词数为网易10/4、QQ20/4、酷我20/10、酷狗20/10、咪咕16/5。最后一项是歌曲匹配派生词，不能写成五平台专用官方联想已验证；完整类型/来源及空错UI矩阵仍开放。

没有引入新的第三方实现、依赖或原生补丁。五固定HEAD再次核对不变，沿用已归属的自有OnlineProvider公开协议；组合读取、校验和说明由音枢实现。Apache/LX等既有许可边界保持，不复制静态设备标识或私人材料，不推断Sollin使用相同接口。

原生路由work/master-route-20261029-migu-assistance命中R1/APK；APK门禁及--review通过，只证明离线前提。功能案例独立strict/hash review为395E/101F/99P、3工作项/124事件、0错误/警告。复用E-1297→F-095→P-093、E-1258至E-1260→F-073→P-071；无新增Sollin采集、E/F/P或scope初始化，不按新增入口增加完成度。

## 测试与正式页面

860项检查通过（新增匿名元数据/词数限制、真空与异常结构、取消迟到返回3项）；脚本语法通过。正式驱动按来源共用同一操作链，新增单一显式testLiveMiguSearchAssistance，原testLiveSearchAssistance继续网易回归；两个目标都只接收同一完整公开MP3，正常导航而非截图专用入口。

V261020批准实源沿用的Shape of You MP3，SHA256 be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203；原生PCM、3:53总长与进度推进先通过再暂停。iPhone15ProMax模拟器/iOS26.3.1、430×932pt/@3x、生产index.ts、真实HTTP、默认blush+rose/真实封面取色。

| 专项 | 精确xcresult | 结果 |
|---|---|---|
| 咪咕匹配 | SourceUITests-1793289484912.xcresult | 1通过/0失败，71.748秒 |
| 网易回归 | SourceUITests-1793289724459.xcresult | 1通过/0失败，66.000秒 |

两轮均实际核验热词点击重搜、完整love输入、键盘/建议同屏和首条直接可点、建议替换查询后的真实歌曲结果、同查询重聚焦、清空历史/重启后再选对应来源，以及原曲暂停/进度稳定。8张真实PNG均ready并亲看，咪咕说明与五条匹配词可见；未查看合成数据截图，不用编译结果代替这些操作。

同源digest 90a8f4d20d12a9acfca375c57ae1a4acc3ff274c8da84263d3bc0270fe675363；前后/current、candidate.patch、输入与两原音频字节/SHA保持。两轮均19→19条，仅queue.cursor.v1、library.v1、playbackStats.v1正常变化，其余16条摘要保持，历史最终为空。没把记录数量保持写成所有数据不变。

本机目录build/migu-assistance-live-20261029-a/与build/migu-assistance-wy-regression-20261029-a/。两轮开跑前[场景记录](ui-spec/migu-matching-real-2026-10-29.md)原副本SHA256均907d291c9e92496a5472f7dff90377d744239515a926bfeba43381f5249c6a6d。咪咕/网易manifest摘要分别916b5329365f73c1209005bdbcb78cc27ea90a5c3f5f920474f4d29d254c57e9、dda3b9ba7fe0f9dad299ce23155a0d0dc05e3904c2bf35c2620778d39bddb6ba；两screens/index.json分别c559cad4d61281e11a139289129528a850a48f25786226e45112b522956698a3、10308682a7a5014afec4281524eee65a2012d174e926778f14f821267ddfe2f1。正式记录按10月29日启动保留目录，实际本轮UI验收跨入10月30日。

当前有效签名身份实查0，实体机/声音/签名未验；未录屏，不声明动效一致。其它来源UI和真实断网/失败/重试、全部类型矩阵、咪咕MV详情、原F/J与账号授权态继续开放。下一仍按0–8顺序检查首个依赖满足余项，优先批次2公开详情/状态覆盖，不因用户暂无专用账号而反复请求或缩小目标。

跨日首次及阶段末已核对目录占用/磁盘余量，回执build/migu-assistance-20261029/retention-privacy.json；0删除，保留在用DerivedData、两最新有效专项、旧输入验收反例与未解决证据，reverse原始材料未动。提交只包含代码、脱敏文档及归属说明，不含音频/图片/原始响应/凭据。
