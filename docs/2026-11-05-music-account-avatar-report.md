# 平台账号头像与资料刷新

J10 此前只有账号显示名和会话状态，网易云资料只取昵称，酷狗扫码结果只保存昵称；账号页没有头像，验证按钮成功后也不会刷新公开资料。本批补齐网易云、酷狗公开头像的采集、严格规范化、账号元数据持久化与账号页显示，QQ 未核实的头像字段不猜测接入。

## 实现

- 新增 `src/domain/accountAvatar.ts`：账号头像只接受去空白后不超过 2048 字符的绝对 `http/https` URL，拒绝凭据、控制字符、空主机和伪协议；公开 HTTP CDN 升级为 HTTPS，仅 `localhost`/`127.0.0.0/8`/`::1` 保留 HTTP 供本地夹具；统一去除 query/fragment，避免签名、令牌等瞬态参数进入元数据或封面缓存键。
- `MusicAccount` 增加可选 `avatar`；`validAccount` 要求恢复记录中的头像已经是规范化形式，旧记录缺少该字段仍可恢复；保存时规范化后再写入，未知运行时字段继续剥离。
- 新增 `MusicAccounts.updateProfile()`：只更新昵称/头像，不改写 Keychain 会话，也不改变 `updatedAt` 账号版本，避免误清 FM/日推缓存；写入仓库失败不发布新快照，账号被删除或同身份被替换时拒绝迟到的旧资料。
- 网易云 `profile.avatarUrl` 与酷狗扫码 `data.pic ?? data.picurl` 进入登录保存；酷狗会话与账号元数据均保留头像。QQ 音乐官方资料只使用已核实的昵称/加密 UIN，不新增未证实的头像字段。
- QQ 日推授权、撤销授权和电脑配对重存账号时显式保留既有头像；账号页验证成功后刷新昵称与头像，并提供 40pt 圆形头像，加载失败回退显示名首字。网易云、QQ、酷狗共用既有 `Cover` 封面缓存与安全 URL 加载路径。

## 单元与契约验证

- 新增 `tests/account-avatar.test.ts` 4 项；扩展账号存储、网易云资料、网页登录、酷狗扫码与协调器测试。
- 覆盖 URL 规范化/拒绝、HTTP 仅回环例外、旧记录恢复、非法头像拒绝、会话与版本不变、仓库失败保留、删除/替换竞态、网易云 `avatarUrl`、酷狗 `pic/picurl` 及协调器保存。
- `npm run check` 为 1053/1053，0 failed/skipped/cancelled；日志 `build/logs/check-account-avatar-20261105.log`，SHA-256 `535d3430a088dfc4c1b17313cb830d6a7c6804f62727cb763095a4225ebfac0a`。
- `git diff --check`、`node --check scripts/test-ui.mjs` 与 Swift parse 通过。

## 正式 UI 回归

新增 `testAccountAvatarFixture`：正式 Release 入口、真实 `MusicAccounts`/Keychain 夹具账号和公开 HTTP 本地 PNG，验证账号页实际渲染 `music-account-avatar-wy-image`，不是首字占位。

- 结果：`build/SourceUITests-1793880508658.xcresult`，Release 1 passed / 0 failed / 0 skipped。
- 输出目录：`build/ui-account-avatar-20261105c/`；`sourceUnchanged=true`。
- source digest：`d42ba82d353d4b9376367ac56f82ebcc2e5225d779a605da41465515a701763b`。
- 安装 bundle digest：`798a5fffc1f6b8be6d40a0da156c6c882b60e0513e3eacd4649acb46df04b0d5`。
- result Info SHA-256：`ff189ba93d34a8a9045af2e5547d98e8830bcd8730104934a3ad84fa0bf39d13`。
- 截图：`001-Music-account-avatar.png`，1290×2796，SHA-256 `517df034164af9f90740978a201544c5a91659107c7233bdafd6edabc1b9268e`，已亲看：网易云夹具账号左侧显示真实红色 PNG 头像，昵称、验证/退出与新增账号入口布局正常。
- 首轮 `build/SourceUITests-1793879945042.xcresult` 失败原因是新 UI 目标未选择 `tests/e2e/entry.tsx`，生产入口不读取夹具环境变量；修正测试调度 `accountAvatarUI` 后重跑通过。原失败截图/层级保留，未放宽头像存在断言。

## 清洁设备包

产品提交 `7d9464220e8648e560596927c9af8d7bc95724aa` 的 clean unsigned archive 通过，`build/distribution/build-manifest.json` 记录同一提交、`dirty=false`、`workingTreeChanges=[]`、arm64/iphoneos26.2/iOS15.1/[1,2]、`signed=false`。

- IPA：17,867,711 字节，SHA-256 `714fc95fbff2bceca5496471d227467f3a1f41fbbea5c7d5d7dc6e5620b794f8`。
- 178 个 ZIP 项 `unzip -t` CRC 通过；63 个载荷文件、8 个隐私清单；`_CodeSignature`/`embedded.mobileprovision` 均为 0，`codesign` 为 `not signed at all`。
- 生产 `main.jsbundle` 4,359,889 字节，SHA-256 `c97184e3166b84af4b7212671ae37a2776b9aa1dcfc0ef84a3f7c5bc0230e394`；`Synthetic NetEase FM`、`account-avatar.png`、`NEXUS_UI_ACCOUNT_FM_FIXTURE`、`tests/e2e/entry` 标记均为 0。
- 源码 tar：8,120,977 字节，SHA-256 `1690f9fa98933ad102c37193e1e744bc9a4b7fe76fe5e09b96369f6d6f537b6f`，与提交树 1,106 个条目同源。
- 本批补丁：40,853 字节，SHA-256 `9dce501a80129964e85ea25258d27963a03cb32a04e975ddf1d1ab21c3342424`。
- 独立 `build/distribution/verification.json` 的 `ready=true`；manifest SHA-256 `6b237c4e5f6ec2bf55dbc492fa8793d2629a5dedb701680a680f3e7987c33aac`。
- 归档日志 SHA-256 `6a6bacd70817049484cb717a069e7e33e512bc93bcf9e4380472d4b5a6e87d82`；IPA 测试日志 `816c0a1caabebfffe4af34a94ae6af00bf5e343a055c8f44be25da921a6d461e`；codesign 日志 `ad71f80ffefafecc9eecf941d8027a7e05c33aed01b198ffc86840f8c294655b`。

## 边界

- 本批只验证合成登录资料与本地头像图片，不宣称真实网易云/酷狗账号头像已在线核验；QQ 头像字段未从官方响应证实，继续显示首字回退。
- 头像 URL 进入账号元数据，不进入 Keychain；不新增账号同步、私人资料探测或平台写入。
- J10 的收藏/创建歌单能力逐项验收、真实三平台账号、实体机/签名/iOS27 与云端终态仍未完成，因此 J10 从 C 调整为 B，而不是关闭。
