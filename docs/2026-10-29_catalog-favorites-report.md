# 本机目录收藏与备份版本护栏实施回执

公开歌单、专辑和 MV 可保存为音枢本机目录收藏，从发现或音乐库入口读取、刷新、重开，并确认取消收藏。收藏保存公开目录身份与摘要，不复制整表歌曲、不操作平台账号，也不把 MV 放入权威音乐队列。含非空目录收藏的备份改用 v2，防止旧版 v1 读取器静默丢弃新字段；新版兼容 v1/v2。

本批只推进批次2的本机目录路径，F-100 的远端账号目录仍按原范围继续。真实 WebDAV、跨设备服务、旧客户端实装兼容、实体机签名及完整 MV 播放均未因此通过。原 F/J 总范围、LX 优先和播放器边界不缩减。

## 依据与许可边界

本批是实施回执，采用实施模板和最小证据链，flavor=null；没有新二进制分析。已亲读 reverse-skill 包根与 PRIMARY，运行 macOS 原生路由（R1 APK）、APK gate 与采纳前 --review。功能 case 的 scope/workitems/timeline 沿用既有已审内容，没有新增 Sollin 结论。2026-10-29T08:46:33Z 严格复审通过，395E/101F/99P、3 workitems/124 events、0 errors/0 warnings；计数不因实现增加。

| 既有 Evidence → Finding → Path | 可见事实 | 实施与限制 |
| --- | --- | --- |
| E-1286 → F-088（candidate）→ P-085 | 歌单收藏按钮、取消确认 | 自行实现本机成员与确认；不提升 Sollin 持久化结论 |
| E-1304/E-1306 → F-099（validated）→ P-097 | 普通专辑信息/描述/收藏/刷新/歌曲动作 | 正式专辑详情与本机收藏，不推断平台账号写入 |
| E-1305/E-1309 → F-100（validated）→ P-098 | 远端账号目录读取、刷新、再打开 | 独立远端范围，本机目录不能替代；MV 保存按钮为音枢自身能力 |

离线 case 为本机忽略路径 `work/sollin-android-ui-20261023`，scope.md、timeline.md 和哈希证据仍在既有外置 case。本批没有新增 Sollin 截图/录屏，没有用安装或构建代替功能证据。门禁与严格复审回执在 `build/catalog-favorites-20261029/`。

按 [REFERENCE_COMPARISON](REFERENCE_COMPARISON.md) 复核五参考 HEAD，均与固定提交一致：悦音 d6f1af7、Q-1515 547ccfe、wtfdelphia 6624ab5、CyMusic bf0d469、自有 Wayferar 8e47cdc。本批模型/存储/UI 自行实现，复用已有归属和许可检查下的 provider；没有新增参考代码、依赖、原生补丁或商业服务移植，也不把这些接口归为 Sollin 接口。

## 用户路径与数据保护

| 路径 | 结果 | 验收边界 |
| --- | --- | --- |
| 公开详情 → 收藏 | 按类型/平台/ID 去重；按钮订阅同一音乐库 | QQ 专辑、网易官方歌单、咪咕 MV 真实验证，其他来源完整矩阵未验 |
| 音乐库/发现 → 目录 | 三类目录、来源筛选、封面/摘要、数据库刷新与正式详情重开 | 重启后成员保留，取消确认保留，确认移除后目录/按钮同步 |
| 存储失败/并发/旧确认 | 写入成功才发布，串行刷新，savedId 防旧确认误删重新收藏成员 | 单元契约覆盖，不等同所有设备竞态实测 |
| 导出/恢复 | 非空目录 v2，空/无目录 v1，新版读 v1/v2 | 旧 v1 读取器由已检查版本守卫推导为拒绝，未实装旧客户端 |
| 同步模型 | catalogFavorite、冲突描述、删除墓碑 | 受控契约；旧严格读取器拒绝未知 kind，不声称真实云端或旧客户端互通 |

只保留白名单公开元数据，不保存曲目列表、可播放地址、账号或凭据；剔除额外字段和不安全封面 URL。备份确认显示目录项数，同步冲突标为目录收藏。入口明确“保存在本机，与平台账号收藏分开管理”。

## 实际验证

`npm run check` 最终 833/833、0 fail。新增覆盖身份、并发幂等、输入隔离、写入失败、过期确认、串行刷新、校验/脱敏、备份 v1/v2、同步冲突/墓碑和云端 v2 预览后显式确认恢复。云端为受控传输测试，不计真实 WebDAV 验收。

版本护栏测试先在旧编码器下失败后修复。升级 v2 后，原“未知版本=2”测试改为 99，保留未知版本拒绝断言，并补 v2 正向云端契约。失败日志和 A/B 旧候选保留，不覆盖最终 C。

| 最终 Release UI | 结果 | 精确 xcresult | PNG |
| --- | --- | --- | --- |
| 收藏 C，testLiveCatalogFavorites | 1/0，111.983 秒 | SourceUITests-1793263104262.xcresult | 10/10 ready，全部亲看 |
| MV 回归 B，testLiveMVSearch | 1/0，183.770 秒 | SourceUITests-1793263307870.xcresult | 10/10 ready，全部亲看 |

两轮源码摘要均为 `c57e39c0d6663c408f1251672b96944fa5c224ae21f5c15ce769345569aebb2f`，源码、候选 patch、外部输入和安装产物绑定通过。C 前登记摘要为 `5b199c5a23b31bd1f01cfaf5bc5c7aa8bf77de34338d9d66b3cea375b7661553`；原文另存 prereg-c.md，后补结果不冒充原登记。manifest/导出索引哈希见本机 final-hashes.json 与两轮 verification-receipt.json。

环境为 iPhone15 Pro Max 模拟器 iOS26.3.1，430×932pt/@3x；生产组件、正常导航、真实公开 HTTP 目录，无 fixture 页面或个人歌单。回放使用既有 V261020 批准实源导入的 Shape of You 样本，检查解码标记、进度和暂停保持；本批未重新解析所有脚本/平台。

收藏实际覆盖 QQ 的 ÷ (Deluxe)（16首）、网易官方欧美热歌榜、咪咕 Bad Habits (Comic Book Version)，刷新、重启重开、取消保留/确认移除均执行。MV 回归覆盖 QQ/网易/酷狗/酷我公开页、QQ 刷新/长按、真实分页、草稿跨类型/平台及音乐暂停保持；咪咕保留不支持提示。QQ 网页缺字、酷狗横向溢出继续开放。

最终数据库19项，目录收藏/歌曲收藏/本地歌单均0。收藏轮正常变化为 queue.cursor/library/playbackStats，MV 轮另有 queue/search.history 回放与搜索变化，不声称所有记录不变。原两音频数量、字节和 SHA 均保持：Shape 3740360 B（be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203），Perfect 4215580 B（086eb96aef026bf336cf5884037a17b28f519b453c19547f3b29093f32ddda39）。

截图亲看确认安全区、真实来源/封面、计数、反馈和空态。偏好实查 blush+rose，默认封面取色开启，蓝色背景来自真实封面。本机新目录没有同内容 Sollin 对照，不报像素相似度或全量静态/动效完成；没有新增真机逐帧录屏。实体机最新已知开发者模式/DDI可用，本批签名身份复查0，未执行本候选实体机安装/签名验收。

## 复现与交接

在仓库根先 `source scripts/environment.sh`，常规检查为 `npm run check`。使用 [test-ui.mjs](../scripts/test-ui.mjs) 的显式单方法，配置上述模拟器、一个新输出目录和现存批准实源音频路径；测试需要真实曲库和公开网络，不能用假数据补网络失败。

最终产物为 `build/catalog-favorites-live-20261029-c/`、`build/catalog-mv-regression-20261029-b/`，总回执为 `build/catalog-favorites-20261029/`；均本机忽略。使用精确 xcresult 导出 Real 附件并核验 manifest，不使用 latest/skip-hash。

下一步按 [IMPLEMENTATION_PLAN](IMPLEMENTATION_PLAN.md) 推进首个依赖满足的未落地路径。F-100远端专辑/MV目录、完整来源状态、视频起播/声音/全屏/后台竞争、真实跨设备服务、实体机/签名/动效及原F/J范围保留。提交前核查 diff/隐私，正常 push 后以远端 SHA 和实际 CI 队列回执验收；旧 CI 成功不覆盖本候选。

同工作区复现收藏测试（每次 mktemp 新建输出目录）：

```bash
source scripts/environment.sh
NEXUS_SIMULATOR_ID=A8347A1F-0805-4731-B8CE-3FE48C156AC0 \
NEXUS_UI_RUN_DIR="$(mktemp -d "$PWD/build/catalog-favorites-repro-XXXXXX")" \
NEXUS_UI_LOCAL_AUDIO='/Users/ningli/WorkSpace/NexusMusic/build/local-sort-live-20261025/Shape of You - Ed Sheeran.mp3' \
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLiveCatalogFavorites
```

MV 回归将最后的方法名换为 `testLiveMVSearch` 并使用另一新目录；已有产物不覆盖。
