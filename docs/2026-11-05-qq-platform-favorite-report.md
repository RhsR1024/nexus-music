# QQ 平台收藏纵向切片

本批接入 QQ 音乐在线歌曲的平台收藏，不改变音枢本地收藏身份。平台收藏只对当前唯一一个 QQ 账号生效；没有 QQ 账号或多个 QQ 账号时不猜测归属，继续保留本地收藏与既有队列语义。

## 参考来源与许可

固定参考为 [Nshpiter/Q-music](https://github.com/Nshpiter/Q-music) `android` 分支提交 `5db858f32695d10c5e9ef0f7037d586aef6a8c4b`，本机路径 `/Users/ningli/WorkSpace/ReferenceProject/Q-music-android`：

- `src/core/musicAccount/qqFavorite.ts`：`IsSongFanByMid` 预读、歌曲详情校验、`AddSonglist` 单次写入、写后回读。
- `src/core/musicAccount/qqCredentials.ts`：QQ 网页 Cookie 身份、`authst`、`tmeLoginType` 与网页 CSRF 取值。
- `src/core/musicAccount/playlists.ts`：`dirId:201` 的“我喜欢”歌单语义。

参考根许可为 Apache-2.0；NOTICE 保留 Nshpiter 与 LX Music Mobile/lyswhut 归属。音枢只适配协议与状态语义，没有复制参考 UI、Android 存储、依赖或工程文件。新增代码文件头保留来源、固定提交、许可及修改说明。

## 实现

- 新增 `src/providers/qqFavorite.ts` 的 `QQFavoriteClient`。调用前严格校验账号平台、会话版本、账号 ID、`userId`、QQ 用户名和 Cookie 音乐身份；原始 Cookie、`authst` 与签名材料不出现在返回值或 UI。
- 先调用 `music.musicasset.SongFavRead/IsSongFanByMid`。已收藏直接返回 `already`，不发送写请求；未收藏才读取 `music.pf_song_detail_svr/get_song_detail_yqq`。
- 详情必须与请求 MID 完全一致、返回安全正整数歌曲 ID、类型为普通歌曲；否则返回 `unsupported` 且不写入。
- 通过 `musics.fcg` 签名调用 `music.musicasset.PlaylistDetailWrite/AddSonglist`，固定 `dirId:201`、`songType:0`。写请求只发送一次。
- 写入成功后最多回读两次；只有回读确认才返回 `added`，否则区分 `unconfirmed`、`unknown`、`rejected`、`login_required`、`account_changed`、`unavailable`，不把响应 `code:0` 当成收藏成功。
- 同一账号与歌曲的并发请求共享同一写任务；取消、账号删除/替换、迟到响应均不能发布成功。不会把会话或平台凭据写入 `Track`、备份、同步或日志。
- `TrackActions` 只在 QQ 在线歌曲且恰好一个 QQ 账号时显示独立“收藏到 QQ 音乐”入口，与“本地收藏”分开；多账号时显示明确提示，不自动选择账号。
- 账号 capability 仍保持 `[]`，没有因为合成验收虚构 `favorite` capability，也没有接入平台歌单创建。

## 单元与契约验证

新增 `tests/qq-favorite.test.ts` 15 项，覆盖：

- 先读后写、单次写入、写后回读确认；已收藏幂等且零写入。
- 写拒绝、鉴权拒绝、回读失败、两次回读未确认、第二次回读确认。
- MID 不一致、非法数值 ID、非普通歌曲、身份/会话不匹配、非法 MID。
- 取消前不请求、写入中取消、账号删除、并发重复点击共享一次写入。

`npm run check` 为 1068/1068，0 failed/skipped/cancelled；日志 `build/logs/check-qq-favorite-20261105.log`，SHA-256 `ac9166ea1ca13f992ea74c5e0bec613b903dfdb6c2930964a0acfe96900c68f8`。`git diff --check`、`node --check scripts/test-ui.mjs` 与 Swift parse 通过。

## 正式 UI 回归

新增 `testQQFavoriteFixture`，使用正式 Release 入口、真实账号存储、Keychain 会话与 provider；仅将 QQ HTTP 传输指向本地合成夹具：

- 合成账号：`qq:2:9000000000000000002`，凭据为合成值。
- 夹具严格校验账号 uin、歌曲 MID、`songId:9068436`、`dirId:201`、签名前缀和 `g_tk` 数值。

结果：`build/SourceUITests-1793881881959.xcresult`，Release 1 passed / 0 failed / 0 skipped；`testQQFavoriteFixture()` 用时 31.360 秒，总计 195 秒，`sourceUnchanged=true`。

- 源码 digest：`36b8f4cb5fc64be9dcc74cbfdac487c1f2f043cf8d10efbff0e7c78077a9a66d`。
- 安装 bundle digest：`14dd6295813552f1ac7083b2f925d8a19550b3af9f34c90e43ac1499d7d70f36`。
- result Info SHA-256：`c95f9234603beb0c4a5782f2d3844e089c166b38c3236e4df3c3e6398f79e1ed`。
- 运行清单 SHA-256：`9cc0c292539aeb8c606fca44c4cd695e27a4570a5c1e511127a20553f82992ce`。
- ui-summary SHA-256：`a761d1f3587eba9c5c567850780d0ca275fe713d8d2b6d444bab88b58fc2a84a`。

合成夹具计数：`reads=3`、`writes=1`、`favorited=1`、`invalid=0`。第一次点击写入一次并回读确认；第二次点击只读回查，写入数仍为 1。

截图目录 `build/ui-qq-favorite-20261105/screenshots/`，三张均为 1290×2796：

- `003-QQ-online-track-exposes-a-separate-platform-favorite-action.png`，SHA-256 `f2c340834e0eae713e9d27faf4806910d595e2760aaa2987479a74ec0063c161`：未收藏空心星与独立“收藏到 QQ 音乐”入口。
- `002-QQ-favorite-is-confirmed-by-a-read-back,-not-by-code-zero-alone.png`，SHA-256 `9527830202e539ed58b617c986feb73be65fa388775d201d026cc1e943b8f1ec`：实心星与“已收藏到 QQ 音乐”。
- `001-Repeating-the-QQ-favorite-action-stays-idempotent.png`，SHA-256 同 `002`：再次点击后状态不变，符合幂等预期。

截图索引 SHA-256 `99f5b343a2a302230f63d92f7e1023cdb0db94ee323de9929d6514a02edc1055`。三张已人工亲看。

## 清洁设备包

产品/测试/文档提交 `aebfa2fed39759f83d33e75222f5e3b93389d5b3` 的 clean unsigned archive 通过，`build/distribution/build-manifest.json` 记录同一提交、`dirty=false`、`workingTreeChanges=[]`、arm64/iphoneos26.2/iOS15.1/[1,2]、`signed=false`。

- IPA：17,876,117 字节，SHA-256 `0775167ab26c61e225d6d4506605779b96447f60b9eada2b8388b1bdd2507f48`。
- 178 个 ZIP 项 `unzip -t` CRC 通过；63 个载荷文件、88 个 AppleDouble 元数据文件、8 个隐私清单；`_CodeSignature`/`embedded.mobileprovision` 均为 0，`codesign` 为 `not signed at all`。
- 63 个 IPA 载荷与 archive app 逐字节一致，0 缺失/差异。
- 生产 `main.jsbundle` 4,374,303 字节，SHA-256 `639fa0d5d77f81eb45e029df7463ac1c15082c9ca478d75072d76d23f2978ae2`；`NEXUS_UI_QQ_FAVORITE_FIXTURE`、`Synthetic QQ Favorite`、`synthetic-qq-favorite`、`qq-favorite-fixture-control`、账号 FM 夹具、在线搜索/主题观测适配器及 `tests/e2e/entry` 标记均为 0。
- manifest SHA-256 `d93908114d9049330af3d852763e0f1f88e2841891e3d24f0d5889351d473d42`；独立 `build/distribution/verification.json` 的 `ready=true`，SHA-256 `3e7ad715ad6b7672fdb2e1e452285eff2ecd290d99dc9fd2c6d06110f692584d`。
- 源码 tar：`build/distribution/NexusMusic-source-aebfa2f.tar`，SHA-256 `751b2496efb5c80818f05b65c300282e5f5fbf024cf92a3c33d892ab9d53ac21`；含 Git 树 1,110 个条目（1,108 文件 + 2 符号链接）及 49 个目录项。
- 提交补丁：`build/distribution/qq-platform-favorite-aebfa2f.patch`，SHA-256 `e4534569056cc1d8b634404abfc47daf3a74a6236bd665a5df0c00d5bafad7a2`。
- 归档日志 SHA-256 `bcf4275459ba11235435a3d830ce7ba43e128fe608c308ac78036a6d4c9a756c`；检查日志 `ac9166ea1ca13f992ea74c5e0bec613b903dfdb6c2930964a0acfe96900c68f8`；native 日志 `51bfcdb0fafaf187b1df72755f6af8b1f8c4ba434dc89b16c8b05945fd7c4e0d`。

## T7 阶段副本

阶段目录 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-05-qq-favorite-aebfa2f`，保存 clean 分发、xcarchive、源码 tar/补丁、xcresult、运行清单、截图索引、check/archive/native/UI 日志与产品提交 `aebfa2f` 时点的相关文档快照。

- 129 份业务文件 / 114,290,677 字节逐文件源/目标 SHA-256 一致，0 缺失、0 差异、源保留、零删除；280 个 exFAT `._*` 元数据文件不计业务载荷。
- `inventory.json` SHA-256 `65db83654c81a94dcdf6a639ed5ba5f2a1d49651fda82516ff02c2ca3081830f`。
- `SHA256SUMS` SHA-256 `e8effa7f078f585c11579e744d4bcbefaca158c8d1d40c68f6733b83516fabb4`，`shasum -a 256 -c` 全部 OK。
- `transfer-receipt.json` SHA-256 `d2dce665396b46a791df1213f1ca50ae30fc68bff340891265c78df58611b9a5`，`ready=true`、`sourceRetained=true`、`deleted=0`、`movedUserFiles=0`。

恢复方式：源文件仍保留在工作区 `build/` 与 Git 提交；T7 副本可按 `SHA256SUMS` 重新核验或复制回 `build/`。本批没有迁移或删除任何用户文件。

## 边界

- 本批只证明 QQ 合成账号、合成服务与正式 App 纵向路径，不证明真实 QQ 账号、真实平台收藏、平台限流/弱网或跨设备同步。
- 未接入网易云、酷狗平台收藏，未接入平台歌单创建，未扩展账号 `favorite` capability。
- 本批无新增 Sollin IPA/APK 采集或对齐结论，未触发 reverse-skill 门禁；这不代表 Sollin UI 对齐通过。
- 不关闭 J10；真实三平台账号、收藏/创建歌单逐项验收、实体机、签名、iOS27 与云端终态仍开放。
