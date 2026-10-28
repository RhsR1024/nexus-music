# QQ 微信电脑配对接入

批次8接入正式音乐账号页的“微信登录（电脑配对）”：电脑先在官方窗口授权，iPhone主动扫码或粘贴配对码，经官方音乐资料/接口校验后显示昵称与微信/QQ掩码，由用户确认才保存。普通QQ网页入口仍拒绝WX身份，不把QQ登录当微信成功；真实电脑传输/授权保存未验，F30不记完成。

## 来源与实现

固定Q-music Android 5db858f32695d10c5e9ef0f7037d586aef6a8c4b，LICENSE/NOTICE/MODIFICATIONS、账号说明、accountTransfer.ts、qqImportedSession.ts、qqCredentials.ts、AccountTransfer.tsx和AccountTransferModule.java共9文件逐字节匹配固定Git对象，收据本机build/qq-account-transfer-20261028/reference-check.json。沿用Apache-2.0及Nshpiter/LX归属；只采用v1协议、身份和确认语义，自写URLSession/CryptoKit/AVFoundation与Nexus状态机，不复制Android依赖、扫码补丁、Keystore或桌面实现。没有新增Sollin结论/采集，也不把这些接口称Sollin后端。

| Evidence | Finding | Path |
|---|---|---|
| 固定源码与账号说明 | 私有IPv4、nonce/HMAC、AES-GCM/AAD、短时账号领取与确认 | 原生AccountTransferWire/Request，独立确认协调器 |
| Node/Swift交叉向量 | HMAC及AES-GCM字节互操作，AAD/篡改拒绝、严格地址/重复字段/长度/期限 | 原生套件直接提取生产wire定义编译，不访问测试LAN地址 |
| 778业务/类型检查 | QQ/WX身份、歌单/雷达归属；接收/验证/确认/保存、取消/迟到/代次、过期和固定错误 | QQAccountTransfer及原有Profile/Daily/Playlists |
| 正式真实音源专项 | 正常导航、空输入、主动相机权限拒绝后手动可用、原生无效输入拒绝、关闭/后台/重启不建账号 | 精确结果和来源在下方最终回执；不以模拟账号截图验收 |

## 权限、传输与保存

仅显式扫码请求相机，目的说明同步app.json/Info.plist；手动输入无需相机/照片读取，提交和后台立即清空输入，不自动读剪贴板。局域网目的说明补上主动电脑配对。相机在原生解码QR，只返回合格配对码，不保存/上传画面；后台/取消停止会话，停止队列持有捕获会话，补光不可用禁用/KVO更新并提供可访问状态，确认状态带读屏提示。实体相机识别、横竖屏/补光与VoiceOver效果未验。

原生仅接受唯一的v/host/port/id/key字段、规范RFC1918 IPv4、1024–65535端口、32位hex ID/64位hex密钥，不接DNS/公网/loopback或任意路径；HTTP固定POST路径，随机16字节nonce及HMAC-SHA256证明，连接密钥不随请求发送。临时URLSession不使用Cookie/凭据存储/缓存，不跟随重定向，25秒资源期限、响应上限32768字节。AES-256-GCM绑定id:nonce，认证后才接收v1/tx与原期限数据；最大3分钟窗按账号说明收紧，真实PC版本/时钟差异兼容尚未验。一次领取由电脑端承担，客户端不宣称已验证对端一次性实现。

导入Cookie严格白名单/ASCII/长度/身份绑定，忽略对端昵称，只显示官方接口返回的有界昵称。WX使用自身wxuin/musicid/qqmusic_uin及tmeLoginType=1，QQ保持2，不能退回残留QQ uin；普通网页登录仍只接受QQ。账号身份分别qq:1/qq:2，原歌单和其他身份保留；同一身份更新会替换本机会话并清除原独立日推key，不自动开放日推/账号播放。Cookie只在私有候选及确认后的Keychain，公开快照无配对码/密钥/Cookie；音乐库/备份/LX/播放器不接凭据。候选绑定初始账号对象，取消/退出页面/后台/过期使其失效；保存使用MusicAccounts既有期望对象与回滚边界。权限失败明确可改手动，保存失败不误报网络，也不显示原生异常。

## 验收边界

真实音频沿用resources/V261020授权链的公开Shape of You，完整233.744秒，SHA256 be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203。协议/状态单元样本不作为UI内容，不查看合成账号或音频截图。正式专项只截图真实库/入口、系统权限、拒绝回退与重启；无效输入只作生产校验断言，无对应截图。

未验：真实PC发行版/局域网传输、专用非私人账号的官方验证/确认/重启会话、真实网络/Keychain故障、物理扫码/补光/旋转、设备签名、VoiceOver与动效。本机CoreDevice新只读结果developerMode=disabled、DDI=false、tunnel=disconnected，本轮没有实体iPhone或签名通过声明。原生成功编译、互操作向量和匿名UI不能替代以上结果。

## 最终回执

| 正式专项 | 精确结果 | 结果 |
|---|---|---|
| R5配对 | SourceUITests-1793193410287.xcresult | 1通过/0失败，64.857秒 |
| R6原QQ日推回归 | SourceUITests-1793193716348.xcresult | 1通过/0失败，47.706秒 |

两轮源码digest均c0a1fd7f9f19a7e9b0ab38fa1febb8a379eaf9ec60b5de5b9089326962d435e0，源码前后/current、candidate patch、外部输入与安装JS/原生来源一致；9张真实PNG均ready并亲看。配对原生实际请求相机，明确拒绝后退出扫描并保留手动入口；只读TCC仅Camera=0/PhotosAdd=0，无照片读取授权行。R5的19条记录仅播放三键queue.cursor.v1/library.v1/playbackStats.v1变化，R6全部19条保持，两原音频SHA均保持。场景规格在捕获候选patch中逐字节匹配，捕获时SHA256 3965d67e19d0e56b33aa979d9deaa87d8354fe58d5d2616b7a67811964af1a80；原文和收据本机build/qq-account-transfer-20261028/ui-spec-*。

778检查、完整原生套件exit0（包含生产wire提取/跨实现HMAC/AES-GCM）及Info.plist语法通过；既有Swift Sendable警告保留。无同态Sollin配对基准，不虚报visual-lab或动效分数。QQ Skills官网缺字仍实际存在，只验匿名打开/取消/后台/重启，不把页面打开记授权内容通过。R1–R4是中间候选（60.820/64.692/64.996/66.532秒均通过）；相机停止持有、补光KVO/可访问状态、到期抢先于计时器及权限/存储分因提示先后补入，最终只采用R5/R6精确同源回执。

原生master-route与APK gate/--review通过；既有功能案例严格hash review仍395E/101F/99P、3WI/124事件、0错误/警告，不新增Sollin证据。安装前提3E不替代上述功能图或真实业务验收；本批QQ协议依据独立固定源码，不从Sollin推断。源码/许可、记录、权限、UI来源、review均留本机build/qq-account-transfer-20261028及精确运行目录，不提交原始系统数据/画面。

第三方说明已同步电脑配对/WX身份范围，保留原许可/NOTICE。阶段磁盘审计与自用模拟器关闭回执在build/logs/cleanup-20261028-qq-pair-audit.json，剩余约5.4GiB；当前缓存与必要证据保留，无盲删。新增文档相对链接、Info.plist及diff检查通过，原始权限/设备信息/截图/单元密钥样本留本机忽略目录。
