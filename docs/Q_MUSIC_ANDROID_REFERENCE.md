# 三平台登录、每日推荐与评论后端参考

2026-10-18 用户明确指定 [Nshpiter/Q-music](https://github.com/Nshpiter/Q-music) 安卓端作为 QQ、酷狗、网易云登录及每日推荐的实现参考，这部分不再依赖 Sollin 后端逆向。先完成已有 UI/交互对齐，再接入新增账号功能；酷我、咪咕不增加登录/日推，五平台公开搜索等既有能力保留。用户随后补充：歌曲评论后端同样参考该项目，评论UI仍与Sollin对齐。当前仅完成源码初查，未移植或宣称真实账号验证。

## 固定来源与许可

- 分支 `android`，固定提交 `5db858f32695d10c5e9ef0f7037d586aef6a8c4b`；通过 `git ls-remote` 及 GitHub tree API 相互核对。与已有 Q-1515 参考是不同仓库，不能混用名称或提交。
- 已亲读该提交的 `LICENSE`、`NOTICE`、`MODIFICATIONS.md`、`docs/music-accounts.md` 及下表源码。根许可 Apache-2.0；NOTICE 保留 Nshpiter 与 LX Music Mobile/lyswhut 归属；酷狗模块另注明 MakcRe/KuGouMusicApi 的 MIT 协议参考，说明文档带 MIT 文本。
- 采用实质源码时保留适用许可、归属与修改说明，逐文件检查第三方部分；不因此给音枢全项目或参考资源统一宣告许可。本轮没有复制产品源码、图片、依赖或 Android 原生工程。
- 本机参考路径为相邻 `ReferenceProject/Q-music-android`；克隆已终态exit0，实际HEAD核对为上述固定提交；未运行安装脚本或构建。远端固定提交可独立复现本页。

## 已核对的实现路径

以下行号均对应固定提交；静态源码证明调用路径存在，不证明当前服务可用或账号端到端成功。

| 平台/职责 | 固定源码证据 | 结论与后续采用路径 |
| --- | --- | --- |
| QQ/网易云登录入口 | [login.ts](https://github.com/Nshpiter/Q-music/blob/5db858f32695d10c5e9ef0f7037d586aef6a8c4b/src/core/musicAccount/login.ts#L1)、[LoginPage.tsx:201](https://github.com/Nshpiter/Q-music/blob/5db858f32695d10c5e9ef0f7037d586aef6a8c4b/src/screens/MusicAccount/LoginPage.tsx#L201) | 官方网页入口、原 WebView 保留会话、前台恢复及轮询；QQ通用授权与音乐账号登录需分别确认。音枢需适配 WKWebView Cookie、外部App回跳与取消/迟到结果。 |
| 酷狗登录 | [kugouApi.ts:57](https://github.com/Nshpiter/Q-music/blob/5db858f32695d10c5e9ef0f7037d586aef6a8c4b/src/core/musicAccount/kugouApi.ts#L57) | 创建二维码、等待/已扫/过期/已连接状态；直接官方 HTTPS，token 与设备关联标识组成会话。保留超时/取消及凭据错误脱敏。 |
| QQ每日推荐 | [daily.ts:53](https://github.com/Nshpiter/Q-music/blob/5db858f32695d10c5e9ef0f7037d586aef6a8c4b/src/core/musicAccount/daily.ts#L53)、[daily.ts:104](https://github.com/Nshpiter/Q-music/blob/5db858f32695d10c5e9ef0f7037d586aef6a8c4b/src/core/musicAccount/daily.ts#L104) | 官方每日30首使用独立日推授权key；失败有私人雷达路径。普通登录不等于已获日推授权；雷达与官方日推必须标记不同种类。 |
| 网易云每日推荐 | [daily.ts:129](https://github.com/Nshpiter/Q-music/blob/5db858f32695d10c5e9ef0f7037d586aef6a8c4b/src/core/musicAccount/daily.ts#L129) | 登录会话请求推荐歌曲，再查询详情并保序；接入音枢 Track/provider 身份，不替换权威队列。 |
| 酷狗每日推荐 | [kugouApi.ts:148](https://github.com/Nshpiter/Q-music/blob/5db858f32695d10c5e9ef0f7037d586aef6a8c4b/src/core/musicAccount/kugouApi.ts#L148)、[daily.ts:141](https://github.com/Nshpiter/Q-music/blob/5db858f32695d10c5e9ef0f7037d586aef6a8c4b/src/core/musicAccount/daily.ts#L141) | 带账号会话取得推荐hash，再取完整歌曲详情；失败回本地精选并明确来源。 |
| 账号隔离与缓存 | [daily.ts:141](https://github.com/Nshpiter/Q-music/blob/5db858f32695d10c5e9ef0f7037d586aef6a8c4b/src/core/musicAccount/daily.ts#L141)、[账号说明](https://github.com/Nshpiter/Q-music/blob/5db858f32695d10c5e9ef0f7037d586aef6a8c4b/docs/music-accounts.md) | 缓存绑定账号身份/日期/有效期，返回前复核账号，退出清缓存；本地fallback不冒充平台日推。凭据在音枢仅进 Keychain，不进备份/同步/日志。 |

## iOS适配与验收顺序

1. 已追加亲读 `cookies.ts`、`requests.ts`、`qqCredentials.ts`、账号 `index.ts` 及原生 `MusicCredentialModule.java` 的加密存储段；完整QQ授权/桌面配对组合调用及文件级依赖仍需在采用前核对。本页不是全量模块已审查声明。
2. 保留参考后端协议与状态语义，适配音枢 provider/Track/取消边界；Android CookieManager/Keystore、权限、Scheme、UA、原生方法不能直接放进 iOS。QQ微信登录的桌面配对路径需独立核对，不把普通QQ登录当微信登录成功。
3. 分平台覆盖成功/过期/取消/账号切换/迟到回调、凭据保存失败、退出清理、分页保序、推荐缓存及本地回退；合成服务测试不计真实账号成功。
4. 在实际App验证登录呈现/回跳/重启与日推展示，再分别记录真实账号、个人歌单/收藏、日推和FM结果。参考自身说明也明确：二维码连通和自动模拟不等于真实账号端到端通过。
5. 本地及云端构建、签名与真机按既有门槛逐批完成。其他 Sollin 逆向/对齐继续执行 reverse-skill，不能用本源码参考豁免其他功能证据。

本页属于开源源码接入记录，Evidence 为固定源码，Finding 为上表静态路径，Path 为 iOS/provider适配及分平台验收；不冒充 Sollin IPA 案例的新 Evidence，也未探测私人服务或使用真实凭据。完成度暂保持开发约81%/完整交付约58%。


## 评论后端参考与UI边界

用户提供的截图能观察歌曲标题、评论总数、热门区、头像/昵称、日期/地区、点赞数、长文本与刷新入口；不据此推断点赞写入、所有平台支持范围或Sollin精确UI。截图不提交真实评论/用户头像为测试夹具。音枢现有网易公开评论继续保留，其他平台请求和解析按需接入；评论读取不依赖先完成账号登录，点赞/发评写入也不因本轮截图自动纳入已完成能力。

固定提交中已亲读下列 `src/utils/musicSdk/<source>/comment.js` 对应请求/分页/解析段：

| 来源 | 关键符号/行 | 静态发现与采用前验证 |
| --- | --- | --- |
| QQ tx | getComment:91、getHotComment:126 | 普通评论零基页码，热门走musicu/CommentRead；歌曲mid到数值ID需保留映射，分别校验总数与列表。 |
| 酷狗 kg | getComment:9、getHotComment:30、getReplyComment:48 | hash与签名查询；热门/最新/回复分路径。含外部协议来源注释，采纳前检查对应许可；旧HTTP入口不能作为iOS已可用证明。 |
| 网易云 wy | getComment:120、getHotComment:150 | 最新评论有游标/页码状态，热门独立接口；实际歌曲身份、取消/切歌隔离及回复字段需核验。 |
| 酷我 kw | getComment:7、getHotComment:29 | start/count分页、热门/最新总数分别解析；旧HTTP传输需要验证可用HTTPS路径。该公开评论能力与不新增酷我登录/日推并不冲突。 |
| 咪咕 mg | getComment:10、getHotComment:35 | 最新按前页末commentId衔接，热门为offset；游标必须按歌曲/实例隔离，不能共享旧页状态。此处同样不增加咪咕登录/日推。 |

以上只证明参考代码路径。接入使用音枢独立provider请求实例/AbortSignal、统一评论模型及原曲/实际录音身份规则，不复制参考模块级单例取消句柄。验收包含总数/热门与最新、翻页不重不漏、空列表/错误重试、切歌/退出后迟到结果、长文本/回复、弱网与服务不可用；按平台分别记录真实可用性，不用源码存在替代结果。不得为旧HTTP接口扩大全局ATS例外。

评论页面的样式、原生弹层、安全区、滚动与返回仍从严格review后的Sollin功能证据采纳；本页仅替换后端参考来源。当前背景批次与后续账号批次保持独立验证。

## 本机源码基线检查

本机固定提交克隆已完成、HEAD相符。使用音枢现有 TypeScript 工具只运行参考仓库的离线mock检查，没有安装或执行其产品构建：

```bash
source scripts/environment.sh
NODE_PATH="$PWD/node_modules" node --test ../ReferenceProject/Q-music-android/scripts/verify-music-login.cjs ../ReferenceProject/Q-music-android/scripts/verify-music-accounts.cjs ../ReferenceProject/Q-music-android/scripts/verify-account-daily.cjs
```

实际结果20项中19通过、1失败，无跳过。登录路由及18项账号检查通过；日推测试入口加载 `verify-account-playlists.cjs` 时因测试桩缺失 `./qqCredentials` 依赖直接失败，未到该入口的日推断言。本机日志 `build/logs/q-music-reference-mock-baseline.log` 保留；未修改参考仓库，不将部分mock通过写成参考全量测试或实际登录/日推成功。后续采用模块需在音枢自己的边界中验证。
