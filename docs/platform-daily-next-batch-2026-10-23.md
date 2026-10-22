# 单平台日推下一纵向批次

这是静态核查后的实施计划，不是已接通记录。固定参考Q-music android 5db858f32695d10c5e9ef0f7037d586aef6a8c4b，本机HEAD再核相符；主代理已亲读requests.ts:1–80、daily.ts:129–139及当前音枢账号/日推客户端。许可沿[接入记录](Q_MUSIC_ANDROID_REFERENCE.md)，crypto文件另有上游来源，采用前须文件级核验。

1. 先修现有日推生命周期：services未提供endpoint，网页登录capabilities=[]，故当前不会发真实日推；缓存命中在session校验之前、传入旧account对象不能检测仓储替换、clear后迟到请求可回填、并发刷新无淘汰；错误code但data存在可能被接纳，合法空列表被当不可用。现有6测试仅原地改对象，未证明真实MusicAccounts.save/remove安全。此批以真实仓储发布/清缓存/逆序响应测试修复，不宣称协议接通。
2. 传输层根据固定Q链补Cookie白名单、csrf、WEAPI表单与双AES/RSA；日推ID→详情→保序映射onlineTrack，保持长整数ID。凭据仅provider/Keychain，官方HTTPS；不把现JSON endpoint直接填入/weapi。若选其他官方api路径，必须独立取得依据并验证。
3. 服务公开loadDaily(accountId,signal,force)，UI显式选账号；capability表示客户端已接入，真实账号验收另记；兼容已有capabilities=[]账号，不强制重新登录或顺带开fm/playlist。
4. 正式曲库页独立平台日推块，复用正式Sheet/列表，包含未登录、初态、加载/取消、成功、合法空列表、过期重登、失败重试、刷新失败保留同账号旧列表、切换/退出清旧内容；本地回退明确标题。播放/追加复用services.playTracks/addTracksToQueue，唯一权威队列。
5. 测试覆盖固定加密向量、Cookie/CSRF/表单、HTTP/业务码、详情乱序缺项/去重/30首、真实仓储替换与clear迟到/并发逆序，以及App正式导航和队列动作；真实账号/日推/实际音源播放/FM/签名/真机分别验收。平台FM、QQ/酷狗及全部parse任务仍在总范围。

当前主线仍先收经典阶段出口；本计划允许无依赖的生命周期修复随后推进，不等待全UI或未知动效。
