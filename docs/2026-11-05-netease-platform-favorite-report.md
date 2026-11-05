# 网易云平台收藏纵向切片

本批为网易云在线歌曲新增独立“收藏到网易云音乐”入口，仍与音枢本地收藏分离。平台收藏只对当前唯一一个网易云账号生效；没有账号或多个账号时不猜归属，继续保留本地收藏与唯一权威队列。

## 参考来源与许可

协议参考为 MIT 的 [Sollin-Music-Desktop](https://github.com/Ryderwe/Sollin-Music-Desktop) 固定 `c9d446f6ad3b7ea1aff64bd5ce290b6e7f9712a8` 的 `src/services/neteaseAuth.ts`：

- `likeSong` 使用 `/api/radio/like`，参数 `alg: 'itembased'`、`trackId`、`like`、`time: '3'`。
- `getLikelist` 使用 eapi 的 `/api/song/like/get`，参数 `uid`。

同时核对公开的 NeteaseCloudMusicApi 协议模块固定 `984cc021b8598cf94c22134f32a8426887fb2de7`：

- `module/song_like.js` 使用 `/api/song/like`，参数 `trackId`、`userid`、`like`。
- `module/song_like_check.js` 使用 `/api/song/like/check`，参数 `trackIds`。

音枢只采用端点、参数和状态事实，自写账号绑定、单次写入、回读确认、取消和竞态处理；未复制参考运行时、UI、依赖或私有逻辑。没有把参考源码存在写成真实账号验收。

## 实现

- 新增 `src/providers/neteaseFavorite.ts` 的 `NeteaseFavoriteClient`。调用前严格校验账号平台、会话版本、账号 ID、`userId`、`netease:` 用户名和会话 Cookie；原始 Cookie、`csrf` 不进入返回值、UI、日志或备份。
- 先以 `trackIds` 读取 `/weapi/song/like/check`。响应只接受明确的布尔映射、`liked` 映射或喜欢 ID 数组；无法确定时返回 `unavailable`，不猜测已收藏或未收藏。
- 只有首读确认为未收藏才发送一次 `/weapi/song/like`，参数为 `trackId`、`userid`、`like: true`。写入响应 `code: 200` 本身不代表成功。
- 写入后最多回读两次；只有回读确认才返回 `added`，否则区分 `unconfirmed`、`unknown`、`rejected`、`login_required`、`account_changed`、`unavailable`。已收藏直接返回 `already` 且零写入。
- 网易云 `userId` 和歌曲 ID 按 1–19 位十进制不透明字符串处理，不要求落进 JavaScript 安全整数；20 位及以上、前导零或非数字值拒绝，避免把真实 19 位账号误判为未登录。
- 同一账号与歌曲的并发请求共享同一任务；取消、账号删除/替换、迟到响应均不能发布成功。多账号时只显示明确提示，不自动选择账号。
- `TrackActions` 仅在网易云在线歌曲且恰好一个网易云账号时显示独立“收藏到网易云音乐”入口；账号 capability 仍保持 `[]`，没有虚构 `favorite` capability，也没有接入平台歌单创建。

## 匿名协议核验

实现前用匿名 weapi 请求核对公开端点，不携带真实账号或凭据：

- `/weapi/song/like/check` 使用 `trackIds: "[186016]"` 返回 HTTP 200 `{"msg":null,"code":301}`，确认端点存在且需要登录。
- `/weapi/song/like` 使用 `trackId`、`userid`、`like` 返回 HTTP 200 `{"code":301,...}`，确认参数形态被接受但未认证。
- 参考桌面端使用的 `/weapi/radio/like` 匿名返回 `-460` 风控；本实现没有采用该端点。

以上只证明匿名端点和加密封装可用，不证明真实账号已写入、回读或跨设备生效。

## 单元与契约验证

新增 `tests/netease-favorite.test.ts` 19 项，覆盖：

- 先读后写、单次写入、写后回读确认；已收藏幂等且零写入。
- 布尔映射、`liked` 映射、喜欢 ID 数组和 `ids` 数组的读取形态；畸形响应不写入。
- 写拒绝、鉴权拒绝、回读失败、两次回读未确认、第二次回读确认。
- 身份/会话/Cookie 不匹配、非法歌曲 ID、19 位不透明 ID、取消前不请求、写入中取消、账号删除、并发重复点击共享一次写入。
- 写后 HTTP 401/403 为 `unknown`，不冒充失败或成功；加密请求体不泄露 Cookie。

`npm run check` 为 1087/1087，0 failed/skipped/cancelled；日志 `build/logs/check-netease-favorite-final-20261105.log`，SHA-256 `5b42d5886e4adc4131acd017aa36a60a52e58f70c68c8d3e409afddc9fcbda49`。`npm run test:native` 退出 0，日志 `build/logs/native-netease-favorite-20261105.log`，SHA-256 `51bfcdb0fafaf187b1df72755f6af8b1f8c4ba434dc89b16c8b05945fd7c4e0d`（原生代码未变，日志与既有原生基线一致）。`git diff --check`、`node --check scripts/test-ui.mjs` 与 Swift `-parse` 通过。

## 正式 UI 回归

新增 `testNeteaseFavoriteFixture`，使用正式 Release 入口、真实账号存储、Keychain 会话与 provider；仅将网易云 HTTP 传输指向本地合成夹具：

- 合成账号：`netease:9000000000000000003`，凭据为合成值。
- 夹具严格校验 `POST`、`MUSIC_U=synthetic-wy-favorite`、weapi `params` 与 256 位 `encSecKey`。
- 启动时清理同平台旧合成账号，避免多账号保护把入口隐藏；不删除其他平台账号。

结果：`build/SourceUITests-1793885436711.xcresult`，Release 1 passed / 0 failed / 0 skipped；测试总时长 75.954 秒，`sourceUnchanged=true`。

- 源码 digest：`50d75204f42b1c8ed4218bae62d0fb7079a873dfd748f538314c91ed3ad1341e`（前后一致）。
- 安装 bundle digest：`812cd89eb60e0eacc1bcbd22cb63be4456e860d206dd6ed44533ae158239fba1`。
- result Info SHA-256：`f2deb544ec6a4231da69484ffbc5dacfb1697c199b0a0490f056e349a34fc435`。
- 运行清单 SHA-256：`9eaaa26d195cc10b803bbeffc2e1787889735fbd78e890bdfe09189469e1cb75`。
- ui-summary SHA-256：`688334de35ab5e3a7a3967330ecd7d6ce529fb4757904d8567e0a43ac1be7679`。
- ui-server-counts SHA-256：`d0e847f853bd39709745b60bad9694d0a8c15c4519024c5feef2c2a460459677`。

夹具计数：`reads=3`、`writes=1`、`favorited=true`、`invalid=0`。第一次点击写入一次并回读确认；第二次点击只读回查，写入数仍为 1。

截图目录 `build/ui-netease-favorite-20261105-r8/screenshots/`，三张均为 1290×2796：

- `003-netease-online-action.png`，SHA-256 `d5a959a7e1a8f047ade8a3aa12b5d9ac1ead0358b73aa937e0c1274e6928a39a`：未收藏空心星与独立“收藏到网易云音乐”入口。
- `002-netease-confirmed.png`，SHA-256 `e6a2f1b1c670031c8bf40d508fe7a604c3f9b90ab6202a2f665badb714ba0695`：实心星与完整“已收藏到网易云音乐”状态。
- `001-netease-idempotent.png`，SHA-256 `bfda8b27fef699a3ba34f9298d535924dccd0d95e8bde3fc241fb0fdfce2fc36`：再次点击后状态与写入计数保持不变。

三张已人工亲看。r1 键盘态按钮命中失败、r2 旧网易云合成账号导致多账号、r3 19 位用户 ID 被安全整数误拒、r4/r5 状态文字在折叠线下方、r6 辅助函数作用域错误等原件保留，未放宽业务断言。

## Clean unsigned archive

产品/测试提交 `7c884a39aea0b5009c76dbc591dc76fbe0a510c6` 的 clean unsigned archive 通过，`build/distribution/build-manifest.json` 记录同一提交、`dirty=false`、`workingTreeChanges=[]`、arm64/iphoneos26.2/iOS15.1/[1,2]、`signed=false`；manifest SHA-256 `aef6666c0b49e7ff3519d00e47c1882ba2c669b0eb691e76886f4ebe265128a7`。

- IPA：`build/distribution/NexusMusic-unsigned.ipa`，17,879,316 字节，SHA-256 `ba47aa7478ea2fb19a5e9dce6bc622037316c2ec31b679593a0be06ba11039a9`。
- ZIP 178 项 CRC 全部通过；63 个业务载荷逐字节与 archive app 一致，0 缺失、0 多余、0 差异；88 个 exFAT `._*` 元数据另计。
- 8 个真实 `PrivacyInfo.xcprivacy`；0 个 `_CodeSignature` 条目；`codesign` 为 `not signed at all`。
- 生产 `main.jsbundle`：4,386,085 字节，SHA-256 `cfbc2fcb0b526985f69a027d53706c1c66df22481a38164f6eb9732e5e1ef098`。
- 生产 bundle 中 `NEXUS_UI_WY_FAVORITE_FIXTURE`、`Synthetic NetEase Favorite`、`synthetic-wy-favorite`、`wy-favorite-fixture-control`、既有测试标记均为 0。
- 独立 `build/ipa-verify-7c884a3/verification.json` `ready=true`，SHA-256 `531f1fe0267bf2873edbee9aca88849a549cb930052a65f258200374067cb3cc`。
- 源码 tar：`build/distribution/NexusMusic-source-7c884a3.tar`，1,160 个条目（1,112 文件 + 48 目录），SHA-256 `6a27d2589e2fe7d6986b580a404eb788075780688b68bc2ad0c569420ab1ac69`。
- 提交补丁：`build/distribution/netease-platform-favorite-7c884a3.patch`，SHA-256 `2315ebb84c1254fd2ccfc738200f98e476227729300094340859756958f3fe8f`。
- archive 日志：`build/logs/archive-netease-favorite-20261105.log`，SHA-256 `1bd0d5bf382a890f36de538cd7a22a7c590d91d579e9e56f9c1533d7cd19e065`。

## T7 阶段副本与提交

产品 `7c884a3` 与文档 `f218d09` 已正常 push，远端 main 实核为 `f218d096380e8529a384d5b366b92980836562b1`。Actions 页面快照显示 `42030288920/01837dc` 运行、`42038514883/f218d09` 唯一等待，1运行/1排队；`queue: single`、`cancel-in-progress: false` 保持，未手动取消或重派。旧运行的 checks 已成功，iOS 仍在运行，不代表整套通过。页面 SHA-256 `a351c054f20e8615026579506a4b546fdfe995d29507fa3278332a44b467c7fa`。

阶段目录 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-05-netease-favorite-7c884a3` 保存 clean IPA/manifest/验证、产品源码tar与补丁、文档提交源码tar、最终xcresult、截图/运行清单、check/native/archive日志和队列快照。58份业务文件、58,309,560字节逐文件源/目标SHA-256一致，0差异；`ready=true`、`sourceRetained=true`、`deleted=0`，未迁移或删除用户文件。exFAT `._*` 元数据不计业务载荷。

- `inventory.json` SHA-256：`b4ff9983b396ac2332a341eb60bba4189a753d8d15858f90d5c7f79b2f6068da`。
- `SHA256SUMS` SHA-256：`90d0a300768c00de6536168ec5955a748195377232394cf8b09e6fb88b058836`。
- `transfer-receipt.json` SHA-256：`94189985f1cedc2d874b56f036522017b1beb90d9c29df839bcd4526ebcca215`。

恢复时先在阶段目录执行 `shasum -a 256 -c SHA256SUMS`，再按清单复制所需文件回工作区；原始源副本仍保留。本阶段归档属于 `7c884a3`，后续空数组解析修正另行验证，不复用本IPA宣称覆盖新代码。

## 边界

真实网易云账号的写入、回读、取消与跨设备生效未验收；本批只有匿名端点核验和合成夹具。酷狗平台收藏、三平台平台歌单创建、真实三平台账号逐项验收、实体机、Apple 签名、iOS27 终态和云端终态仍未完成。J10 保持 B，全项目保持 active；本批没有新增 Sollin IPA/APK 采集或 UI 对齐证据，不触发 reverse-skill 采集门禁，也不能据此宣称 Sollin UI 对齐通过。

## 续批：空数组与畸形数组解析

交付复核发现：明确的空喜欢ID列表此前被误判为不可用，阻止首次收藏；混杂非法ID的数组可能因提前遇到目标ID而错误确认，或因另一个合法ID而触发写入。现完整校验数组每项后再判断成员，空数组明确为未收藏，混杂非法项整体拒绝。没有增加写入次数或以写响应代替回读。

新增3项测试，覆盖 `data:[]`/`ids:[]` 首次收藏、混杂非法字符串/对象/null/不安全数值、写后空数组未确认及畸形数组未知。旧实现先失败复现，修正后专项22/22、完整1090/1090；日志 SHA-256分别为：

- 修正前：`4813fdbdb41d4c656026190f5188cc454cf63049fba33302cea8c6b12fcae4e0`。
- 修正后：`ab78767f6debd93f0eaaec3f1b5f9d9df296fc2e3def8bb7ed7be3ed4839295b`。
- 完整check：`8e3aa2653daeea24ec8c39f5511408a86ae5c63b6b9a6e8febed4fd552d8941b`。

正式Release夹具改为 `[]→['1001']`，`SourceUITests-1793886546069.xcresult` 为1/0/0，`testNeteaseFavoriteFixture` 48.515秒，`sourceUnchanged=true`；夹具 `reads=3/writes=1/favorited=true/invalid=0`。三张1290×2796截图亲看入口、完整确认文字与重复点击幂等。源码digest `7a4657fb7a2dbd8f3703e007853bce34704ebc0a1707510e440b87c5f5d24dcb`，安装bundle digest `7ccbccb80b2921901b377bbb603e03687700b1fdc986f5238f91a28c6da95545`。

新输出 `build/ui-netease-favorite-array-20261105-r1/` 的运行清单、summary、计数 SHA-256依次为 `ddf9fac8908473b43a6b76e62ee465c7c1cdf5688462c7b8c319340942976f35`、`9d6b8aa16fb1f32bd0b48e1af28dca81b480d19b0818951944963322b7b7a4ff`、`5ed794a0f2d59ea137cf77071d018be7007a57a3480334b5a359979c1cc91004`；三张截图按003/002/001分别为 `dbb6f6129da675327180564195ca074149864394254b6d05aaab8bdbb5d474d6`、`29aa90065bee1e293d6701a73452353e673422a94af14ce7eaf1780b18e0f2f1`、`0d01db8de42fb3b1237d6f32321353801b1506dd0abbb61aea60fa7fea7cfd0b`。原生代码未变；新clean归档与push另记，不复用原IPA覆盖本次代码。
