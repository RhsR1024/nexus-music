# 0021：公开歌曲评论与请求生命周期

2026-10-16，S7 / F31 / J11。先实现网易公开评论，再逐平台核验；没有接口的来源不显示虚构内容。与平台登录、评论发表/点赞分开，不新增账号权限。

固定提交与许可见 REFERENCE_COMPARISON。本次主代理亲读悦音评论 provider/播放器调用及音枢 HTTP/播放器/Search；只读探索另核对六参考调用链。全部新增实现原创，不复制 SDK 或加密常量，不增加依赖。

| 参考与证据 | 采纳及维护/Android边界 |
| --- | --- |
| 悦音 d6f1af7 `src/core/comment/index.ts:112/147/202/221`、`src/screens/NowPlaying/CommentSheet.tsx:194/250` | 精确歌曲线程、普通评论数量推进分页、热门单独展示、失败留旧内容可借鉴。不采用从任意ID抽数字、日志或无界缓存；linuxapi依赖不为首批引入。MIT/README原有边界保持，原创TS协议可共享Android |
| Q 547ccfe / wtf 6624ab5 `src/screens/Comment/utils.ts:26` 与 `src/utils/musicSdk/wy/comment.js:73/120/127` | 五平台分别有协议/字段和cursor；逐文件比较五平台comment.js完全相同，不视作独立互证。Apache资产不整包复制；RN0.73导航/网络/加密不迁入，其他平台逐项HTTPS和字段验证后接入 |
| Cy bf0d469 `src/components/utils/musicSdk/tx/comment.js:80/85/95/148` | QQ songmid需数值ID映射，不能把MID当网易ID。promises.set缺键及未发现已接评论UI的限定检索不作为可采用实现。独立协议可参考，不引入Expo57/RNTP依赖 |
| Wayferar 8e47cdc `docs/BUILDING.md:3/42`、`docs/NETEASE_CAR_VOICE_ANALYSIS.md:164` | 当前稀疏docs/script未证明评论实现，不宣称全仓无此功能；保留目录/播放来源边界，Android/Smali/车机权限不移入iOS，未用本项目许可覆盖其恢复资产 |
| Sollin c9d446f `src/services/api.ts:466` → `officialCommentApi.ts:113–133` → vendor LX | 分离评论职责可借鉴，不采失败吞空页、桌面Cookie持久化或整SDK。根MIT与vendor独立Apache保持；RN FlatList界面原创，无Electron依赖 |

## 行为

- 评论始终归属用户明确选择的原始在线曲目，LX换源/自动匹配不静默改变评论平台。仅精确网易数字ID支持首批请求，其他来源明确显示暂不支持。
- 热门与最新评论分区，普通原始行数推进offset，不因坏行、去重或热门插入改变游标；长ID完整保留。单页最多50、总计最多1000普通评论；不无限增长内存。
- 请求有独立AbortController/代次和12秒预算，切歌/关闭取消；分页/刷新失败保留已加载内容，重试原游标；重复页或零推进停止，禁止假称已取完整评论。
- 对协议错误/权限限制/不可用显示恢复操作，不把失败伪装无评论。展示文本而非HTML，不自动跳转评论内URL，不写入听歌库/个人备份/诊断日志。
- 评论浏览不改变队列、播放意图、LX实例或音质；不持久化头像、账号ID和评论全文。

## 验收

HTTP注入测试覆盖原始身份/长ID/热门普通分离/坏行与游标、重复页、分页失败和刷新失败、取消/迟到/切歌；真实公开歌曲端点另记录；模拟器验证原曲评论、刷新/加载更多与关闭保持暂停。实现/合成测试/真实服务分别记录，不用首批网易成功泛称五平台评论完成。
