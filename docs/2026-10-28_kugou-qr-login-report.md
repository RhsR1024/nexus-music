# 酷狗官方扫码入口与取消边界

本批按批次8接入酷狗二维码创建、等待、过期、取消与账号保存接口。**真实匿名入口已验证，完整扫码授权仍未验收**。未使用私人凭据、个人歌单或私人音源，不新增 Sollin 采集；日推、歌单、收藏与账号播放不随登录入口自动开放。

## 改动

- 独立 `KugouLoginClient` 只调用官方 HTTPS 二维码创建/查询接口，随机生成每次尝试的关联 nonce，使用现有 Expo MD5 能力完成固定协议签名；不新增依赖、原生补丁或第三方代理。
- 响应、账号标识、令牌和 PNG 均有边界检查；PNG 限制 URI 大小及解码尺寸。传输错误不透传含挑战参数的 URL。请求显式省略共享 Cookie。
- `KugouLoginCoordinator` 管理单次尝试、两分钟本机期限、串行轮询和迟到结果隔离。展示状态只暴露状态、代次、临时二维码图与期限，不单独暴露协议 key/mid/token；二维码图本身仍按临时敏感材料处理。取消、离页、后台和失败时清空展示图。
- 正式账号页增加酷狗卡片，获取/取消动作行置于图片上方。二维码代次变化时新建图片视图，防止旧图片回调影响新尝试。QQ 说明归回 QQ 区域，既有网易云/QQ 入口保留。
- 设置缓存页面通过明确的 active 状态取消授权，修复“页面隐藏但未卸载，扫码仍在继续”的问题。新二维码按真实窗口/滚动视口几何移入可见区域，不依靠截图模式或猜测坐标。
- 授权结果只有在官方返回 connected、身份与令牌校验后才能保存，能力列表为空。会话只进既有 Keychain 边界；账号存储增加可选取消信号，在哈希、秘密写入和元数据写入等待点取消时回滚原账号/凭据。该回滚由自动化桩验证，不冒充真实账号或故障 Keychain 的端到端结果。

播放器、LX 宿主、在线元数据 provider、Navidrome 与权威队列职责不变。

## 来源与门禁

Q-music Android 固定提交 `5db858f32695d10c5e9ef0f7037d586aef6a8c4b` 的 `kugouApi.ts`、`docs/music-accounts.md`、LICENSE/NOTICE/MODIFICATIONS 五份工作副本与固定对象逐字节一致，回执 `build/kugou-login-20261028/reference-check.json`。保留 Apache 2.0、Nshpiter/LX NOTICE 和 MakcRe MIT 文本，见 [第三方说明](../THIRD_PARTY_NOTICES.md)与[MIT 文本](../licenses/kugou-api-mit.txt)。这条协议路径来自用户指定的账号后端参考，不宣称 Sollin 使用相同接口；接口变动与客户端维护由音枢承担。

执行 macOS 原生 master-route，PRIMARY 为 apk-reverse；APK gate 与 `--review` 通过。默认安装 case 的三项证据仅证明固定包、样本与离线前置条件，不证明本批功能。未重新分析样本或扩充 Q125 的 Sollin 功能证据。

## 证据与结论

| Evidence | Finding | Path / 后续 |
| --- | --- | --- |
| `anonymous-probe.json` | 官方创建与首次轮询 HTTP200、外层 status1/error_code0，返回 waiting；未输出或保存挑战密钥 | 继续真实客户端入口；此结果不等于账号授权 |
| `check-r2.log` | 677/677，覆盖协议、响应边界、超时/取消、迟到成功、图片失败、过期和三处持久化回滚 | 保持能力空列表，真实 connected/会话失效继续独立验收 |
| R1 `SourceUITests-1793126540232.xcresult` | Release 1/0/0，174.827 秒；正常入口、取消、本机期限到期、后台清空、重启未登录通过 | 五张真实 PNG ready 并在挑战过期后亲看；不计动效/完整授权通过 |
| R1 `state-before.json` / `state-after-r1.json` | 19 条记录、两份原音频摘要保持；暂停意图保持，无匿名账号创建 | 不把此次账号测试记作新增真实播放验证 |
| `qr-decode-r1.json` | Vision 可从真实页面图识别 QR，目标为官方 `h5.kugou.com/apps/loginQRCode/html/index.html`；仅保留载荷摘要、字段名与边界 | 仅证明显示图可被本机解码，不证明真实设备扫码或授权 |
| R2 `SourceUITests-1793144878984.xcresult` | 在初始设置导航失败，AX 仍为发现页，未进入酷狗；19 条记录与音频未变 | 原因未完全确认；R3 显式前台激活并补充导航失败截图/层级，全部断言保留 |
| R3 `SourceUITests-1793145293651.xcresult` | 返回账号页仍为 waiting；源码确认 visited 页面仅隐藏、不卸载，原卸载清理不足 | 增加页面 active 信号，在布局阶段失活时明确取消 |
| R4 `SourceUITests-1793145791314.xcresult` | Release 1/0/0、188.511 秒；离页、过期、取消、后台与重启通过，19 条记录/两首音频保持 | 六张图 ready 并亲看，发现二维码部分位于视口外；功能结果保留，显示完整性继续修正 |
| QQ/网易云匿名回归 `build/kugou-qq-regression-live-20261028-r1/` | Release 1/0/0、75.509 秒，官方表单/空账号校验、取消/重开/重启与网易云入口通过 | 证明页面失活处理未破坏已覆盖的网页入口；不证明完整账号授权 |
| R5 `SourceUITests-1793146540043.xcresult` | Release 1/0/0、189.308 秒，二维码 240×240pt 与完整视口包含区通过，点击获取后到截图之间没有测试辅助滑动；其余生命周期断言均通过 | 六张正式状态真实 PNG ready 并在本机期限后亲看，Vision 识别官方地址，未保存原始载荷 |

R5 源码前后摘要均为 `1d45b7b92ded3721f7be474f4305096549f40cc42b58752c45835517a5919252`，音频输入不变；`state-verification.json` 确认从首轮前到最终轮后的 19 条记录与两份原音频摘要一致。场景、精确构建/manifest/图片索引见[记录](ui-spec/kugou-login-live-2026-10-28.md)，未使用 latest、跳过哈希或合成截图。QQ/网易云回归的五张图也均 ready/亲看，但官方网页按钮字形兼容问题仍保留，不宣称修复。

音频为 V261020 此前取得的公开 Shape of You / Perfect 原始文件，SHA-256 分别为 `be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203` / `086eb96aef026bf336cf5884037a17b28f519b453c19547f3b29093f32ddda39`。未重新采集 Sollin。

## 复验与边界

在专用真实音频验收模拟器执行，勿指向个人数据设备；实际命令从仓库根启动：

```bash
source scripts/environment.sh
NEXUS_SIMULATOR_ID=A8347A1F-0805-4731-B8CE-3FE48C156AC0 \
NEXUS_UI_RUN_DIR=build/kugou-login-live-20261028-r5 \
NEXUS_UI_LOCAL_AUDIO='/Users/ningli/WorkSpace/NexusMusic/build/local-sort-live-20261025/Shape of You - Ed Sheeran.mp3' \
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLiveKugouQrLogin
```

复跑需换全新输出目录，脚本拒绝覆盖现有 manifest。匿名轮询在本机120秒期限到期退出；未另行推断或测量服务器后台失效策略。真实已扫码/确认、授权后的持久会话与失效、真实 Keychain 故障/崩溃、真机/签名和完整动效仍未验收。未读取个人歌单，未开放酷狗日推或受限播放。

上一源码 `1d6239c3eeb367071d5153597537612365326381` 的 CI40559801315 已 success，checks/native/App/匹配歌词/离线播放与未签名 IPA 步骤实际成功；该运行不含本批酷狗代码。上一 de7f5b9 的 CI40554716636 已 failure，不计通过。本批交付后单独核对新提交远端与 CI 队列。
