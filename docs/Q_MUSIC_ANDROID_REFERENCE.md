## 2026-10-28 网易云账号歌单只读复制

固定playlists.ts的user/playlist分页、v6完整ID与v3分批/权限对应已接入音枢AccountPlaylists、正式账号页和可取消本地复制；原始Cookie不进Track/备份，不实现远端写入/同步。目录/预览绑定当前账号对象与请求，保存等待期间失效在库串行队列内回滚。731检查含13项新覆盖；实际匿名入口和未验范围见[回执](2026-10-28_netease-account-playlist-report.md)。QQ/酷狗账号歌单、微信PC配对继续，不以参考代码存在声明真实服务成功。

## 2026-10-28 QQ官方日推授权页接线

dailyAuthorization.ts / LoginPage 的独立官方Skills/桌面UA/key格式已适配NexusMusic原生会话，不沿用RN消息桥；绑定同网页Cookie身份、校验资料/日推后本机保存，普通登录不自动授权，移除不退出QQ。718检查/26相关/原生策略通过；匿名页面实际回归与未验范围见[回执](2026-10-28_qq-daily-authorization-report.md)。

## 2026-10-28 QQ私人雷达与官方读取

固定daily.ts的独立Bearer key官方日推、四页雷达及详情调用已适配QQDailyClient；来源kind、失败回退与缓存隔离保持独立。708检查及相关34项通过；dailyAuthorization.ts的独立官方Skills页面已读但尚未实施，不增加完整官方日推/真实授权完成量。见[回执](2026-10-28_qq-radar-report.md)。

## 2026-10-28 酷狗每日推荐接线

固定kugouApi.ts:getDailyHashes、daily.ts及kg/songList.js的请求/详情语义已适配独立KugouDailyClient。共享账号/日期/请求代次缓存与现有推荐页，酷狗不提供网易云FM；698检查通过，公开详情实际返回Shape of You。真实账号日推仍未验，正常真实音频库入口验证单列于[回执](2026-10-28_kugou-daily-report.md)。下方“酷狗日推客户端未接”是历史状态。

## 2026-10-28 酷狗扫码入口接入

固定源五文件核验、官方二维码客户端与状态机、取消/Keychain接口及正式卡片已接线。677检查、真实匿名正常导航Release1/0/0，离页/后台/期限/重启及完整显示通过；真实已扫码/确认、持久会话和日推仍未验收。MakcRe MIT已保留，不读个人歌单，不引入代理或Android补丁。见[回执](2026-10-28_kugou-qr-login-report.md)。

# 三平台登录、每日推荐与评论后端参考

2026-10-18 用户明确指定 [Nshpiter/Q-music](https://github.com/Nshpiter/Q-music) 安卓端作为 QQ、酷狗、网易云登录及每日推荐的实现参考，这部分不再依赖 Sollin 后端逆向。先完成已有 UI/交互对齐，再接入新增账号功能；酷我、咪咕不增加登录/日推，五平台公开搜索等既有能力保留。用户随后补充：歌曲评论后端同样参考该项目，评论UI仍与Sollin对齐。源码初查为历史阶段；2026-10-28 已开始 QQ 网页入口/会话适配，匿名表单与取消路径通过，完整真实账号验证仍未通过，见[实施回执](2026-10-28_qq-web-login-report.md)。

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

## 2026-10-21 网易账号日推协议客户端（未接真实登录）

已从固定 Q-music `5db858f.../src/core/musicAccount/daily.ts` 的 `neteaseDaily` 路径和固定 Beans `NetEaseAPI.swift:509` 的 `dailyRecommend` 交叉核对，新增 `src/providers/accountDaily.ts`：

- `parseNeteaseDaily` 只转换已授权的 `dailySongs` 响应，按平台 ID 保序去重、跳过坏行并限制 30 首；不把本地推荐混入平台结果。
- `AccountDailyClient` 使用账号 ID、平台和 `updatedAt` 组成缓存/请求快照键；换账号、取消、401/403、空列表和坏响应分别返回明确错误或空态，不制造“成功列表”。
- 客户端必须由登录 launcher 提供已鉴权 endpoint/transport；默认未注入 endpoint 时直接返回 unavailable，避免未登录请求或把公开接口误当账号日推。
- `tests/account-daily.test.ts` 6/6 通过，覆盖坏行/去重/上限、账号缓存隔离、请求中换账号、取消、空响应、未鉴权 endpoint 和 local fallback 标记；`npm run typecheck` 通过。

**未完成**：真实 WKWebView/Cookie session、QQ 日推授权 key、酷狗/FM 客户端、日推 UI 展示及真实账号联调。该模块不提高 F30 完成度，也不把候选 endpoint 与合成夹具计为真实平台成功。固定来源许可/归属仍按本页上方记录。

## 2026-10-22 网易云 WKWebView 登录适配

已按固定提交的官方网页与 Cookie 语义完成首个平台登录闭环：原生 `NexusMusicAuth` 使用隔离的非持久 WebKit store 打开网易云官方登录页，只允许网易云 HTTPS 导航，并在检测到 `MUSIC_U` 后返回白名单 Cookie。TS 账号协调器拒绝空值、控制字符和超长 Cookie，账号元数据只保留派生身份，原始会话仅进入 SecureStore/Keychain。设置页提供登录、取消、退出和固定错误状态，没有把登录与日推、歌单或 FM capability 绑定。

验证：业务/类型 **417/417**、完整 native 套件和登录窗口打开/关闭 App 专项 **1/0/0** 通过。首次 WebKit 实现从 Expo 异步队列创建 data store 导致 `EXC_BREAKPOINT`，已定位并改为主线程执行。真实账号登录、昵称资料、重启会话、官方鉴权日推 endpoint、QQ/酷狗、FM 与真机仍未完成。

继续补齐 Login→session lifecycle 的已可独立验证部分：网页登录取得 Cookie 后，按固定参考的 `w/nuser/account/get` 账户校验语义，适配为 iOS 端只读官方 `/api/nuser/account/get`；严格解析数字 `userId` 和 1–120 字符昵称，会话无效或空资料不保存账号。账号 stable identity 为 `netease:<userId>`，昵称以 `displayName` 元数据保留，Cookie 不进入可恢复元数据。设置页新增“验证”，从 Keychain 恢复该账号会话后实际请求官方资料接口，失败显示固定提示且不删除原会话。

验证：`npm run check` **421/421**、完整 native 通过；无凭据合成 Cookie 对真实官方端点探针返回 `login_required`，证明生产路径可拒绝无效会话，但不证明真实账号。真实 WebView 登录、重启后有效账号、官方鉴权日推、QQ/酷狗、FM 与真机仍待。


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
