# 单平台日推下一纵向批次

这是静态核查后的实施计划，不是已接通记录。固定参考Q-music android 5db858f32695d10c5e9ef0f7037d586aef6a8c4b，本机HEAD再核相符；主代理已亲读requests.ts:1–80、daily.ts:129–139及当前音枢账号/日推客户端。许可沿[接入记录](Q_MUSIC_ANDROID_REFERENCE.md)，crypto文件另有上游来源，采用前须文件级核验。

1. 先修现有日推生命周期：services未提供endpoint，网页登录capabilities=[]，故当前不会发真实日推；缓存命中在session校验之前、传入旧account对象不能检测仓储替换、clear后迟到请求可回填、并发刷新无淘汰；错误code但data存在可能被接纳，合法空列表被当不可用。现有6测试仅原地改对象，未证明真实MusicAccounts.save/remove安全。此批以真实仓储发布/清缓存/逆序响应测试修复，不宣称协议接通。
2. 传输层根据固定Q链补Cookie白名单、csrf、WEAPI表单与双AES/RSA；日推ID→详情→保序映射onlineTrack，保持长整数ID。凭据仅provider/Keychain，官方HTTPS；不把现JSON endpoint直接填入/weapi。若选其他官方api路径，必须独立取得依据并验证。
3. 服务公开loadDaily(accountId,signal,force)，UI显式选账号；capability表示客户端已接入，真实账号验收另记；兼容已有capabilities=[]账号，不强制重新登录或顺带开fm/playlist。
4. 正式曲库页独立平台日推块，复用正式Sheet/列表，包含未登录、初态、加载/取消、成功、合法空列表、过期重登、失败重试、刷新失败保留同账号旧列表、切换/退出清旧内容；本地回退明确标题。播放/追加复用services.playTracks/addTracksToQueue，唯一权威队列。
5. 测试覆盖固定加密向量、Cookie/CSRF/表单、HTTP/业务码、详情乱序缺项/去重/30首、真实仓储替换与clear迟到/并发逆序，以及App正式导航和队列动作；真实账号/日推/实际音源播放/FM/签名/真机分别验收。平台FM、QQ/酷狗及全部parse任务仍在总范围。

当前主线仍先收经典阶段出口；本计划允许无依赖的生命周期修复随后推进，不等待全UI或未知动效。

## 2026-10-23 生命周期修复回执

已将AccountDailyClient生产实例绑定MusicAccounts.getSnapshot，缓存前/响应后核对当前账号对象与身份、session accountId/platform；真实save替换同ID对象和remove均能淘汰旧请求，不能只原地改updatedAt测试。clear按账号精确失效generation，迟到成功/失败均不回填；同账号新请求淘汰旧请求并归cancelled，跨日请求亦不发布。合法空数组现在成功缓存；缺失/坏数组、全坏行、错误业务码即使带data也拒绝，301/401/403映射过期。

新增6项测试（含循环子场景）验证真实仓储替换/删除、缓存前身份校验、定向/全局clear与其他账号保留、并发强刷逆序、空列表/业务码、TTL与跨日；原6项保留并修正空态约定。npm run check445/445通过，日志build/logs/check-daily-lifecycle-20261023.log。未配置真实endpoint、未传Cookie到网络、未开启capability/UI，正式协议接通和真实账号仍待；不增加F30完成度。

## 2026-10-23 鉴权传输、私人FM与正式入口实施回执

本批按上述第2–4项接线，但仍不等于真实账号验收：

- 加密与会话：`src/providers/neteaseCrypto.ts` 纯TypeScript AES-128-CBC/PKCS7双重加密+BigInt裸RSA，固定`0CoJUm6Qyw8W8jud`/`0102030405060708`和官方256位模数；`tests/netease-crypto.test.ts`以`node:crypto`交叉校验加密结果与固定向量。`src/providers/neteaseSession.ts`只接受白名单Cookie（含`MUSIC_U`）并生成csrf/WEAPI表单请求头。来源与许可记录见`THIRD_PARTY_NOTICES.md`、`licenses/sollin-mit.txt`；上游Sollin文件SHA-256 `5abc7db3…`、RSA模数逐字节核对一致。
- 日推：`AccountDailyClient`默认endpoint改为`https://music.163.com/weapi/v3/discovery/recommend/songs`，请求经WEAPI加密与保存的Cookie发送；缓存/响应前后仍校验仓储身份、会话与请求代次。
- 私人FM：`src/providers/accountFm.ts` 实现`/weapi/v1/radio/get`取批（≤30、去重、30分钟TTL、按账号revision隔离）与`/weapi/radio/trash/add`的“不喜欢”（`{songId,alg:'RT',time:25}`）；迟到/账号替换/取消均不发布旧结果，`clear`按账号精确失效。
- 兼容与登录：网页登录现在记录`['daily','fm']`；日推/FM的客户端门槛改为平台`wy`，既有`capabilities=[]`账号不强制重登（新增两项legacy测试）；`services.ts`同时构造并订阅清理两个客户端。
- 正式入口：曲库页“平台推荐”块显示未登录CTA、多网易云账号显式选择、每日推荐/私人FM的加载、成功、合法空态、登录失效、失败重试、刷新失败保留旧列表；播放与“播放全部”只走`services.playTracks`，不伪造本地替代列表。登录CTA经`openAccounts`路由到设置-音乐账号。截图已亲看：未登录块只有说明与“去登录”，无占位曲目；账号页展示真实登录入口。

验证：`npm run check` 492/492（含typecheck），日志`build/logs/check-platform-ui-20261023.log`。正式入口Release UI用`NEXUS_UI_RUN_DIR=build/logs/account-recommendations-20261023-r3b`，xcresult `build/SourceUITests-1792725802476.xcresult`，1通过/0失败/0跳过，71.079秒，`exitCode:0`、`sourceUnchanged:true`且运行前后`diffSha256`同为`6c812c53…`（基线9f40879＋运行时代码/测试diff；本段回执文档写于运行后，不计入该哈希）；fixture `scripts/test-ui.mjs` SHA-256 `2a3f82c2…`，resultInfo SHA-256 `ee9cbab1f0241486563beccd00d439fef15a6d5d0634fd4ce9f01feb54779853`，安装包digest `240955de…`、`main.jsbundle` `f3289f0c…`。截图导出`build/ui-screenshots-account-recommendations-20261023-r3b`（登录路由`e0e1c677…`、未登录`89affe3b…`）。本机为Xcode 26.3/模拟器iOS 26.3.1，不是iOS 27；r2虽通过但采集中修改了文档致diff变化，已由r3b取代；r3因未加载工具链在构建前失败，目录与xcresult保留为负证据，不计通过。

未完成/不作声明：未用真实网易云账号把Cookie与CSRF发到真实endpoint，未验证日推/FM真实返回与音频播放；FM低水位自动续批未实现，UI展示每批前5首（播放全部覆盖整批30首）；QQ/酷狗平台未接入；本提交尚无云端iOS 27终态，Apple签名/真机未验收；本批不改变UI整页相似度或项目百分比，90%目标仍按截图阶段继续。
