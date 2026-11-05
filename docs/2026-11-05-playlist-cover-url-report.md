# 歌单持久化封面与安全回退

本批修复音枢歌单的封面地址只可填写、重启后却不在歌单列表与详情显示的缺口。已保存的安全公开 URL 现在同时用于列表、详情头部和批量歌曲列表头部；URL 缺失或不安全时回退到第一首歌曲的封面。封面地址仍属于歌单本地元数据，不新增网络代理、账号同步、数据库迁移或第二套封面缓存。

## 实现

- 新增 `src/domain/publicURL.ts`，集中判定公开媒体 URL：只接受绝对 `http:`/`https:` 地址，拒绝用户名、密码和含 `password`、`authorization`、`cookie`、API key、token、credential、secret、rawscript 等敏感查询键的地址。
- 新增 `src/domain/playlistCover.ts`，以 `playlistCoverSource(coverUrl, firstTrack)` 作为列表、详情和歌曲列表共用的纯决策：安全且有内容时返回裁剪后的 URL，否则返回第一首歌曲。
- `src/ui/LibraryHome.tsx` 在歌单列表使用 `library-playlist-cover-{index}`，在歌单详情头部使用 `library-playlist-detail-cover`；详情选择同时把当前 `coverUrl` 传给 `TrackListModal`。
- `src/ui/TrackListModal.tsx` 的批量歌曲头部使用同一决策，测试标识为 `track-list-cover`。
- `src/storage/cleanTrack.ts` 复用并继续兼容导出 `safePublicURL`，原有清理行为不变。
- 封面加载继续走既有 `Cover`/封面缓存；无效 URL 不进入原生图片加载，未保存任何凭据或新增持久化副本。

## 测试与证据

最终 Release 为 `build/SourceUITests-1793858859629.xcresult`，用例 `SourceSettingsTests/testLibraryPlaylistCoverURL` 为 1 通过 / 0 失败 / 0 跳过、55.901 秒，运行目录 `build/playlist-cover-20261105-r10/`。

- 源码提交：`258cac7ee66b72f9c5a198f10149c7420cbecb85`
- source diff SHA-256：`6db734cebf69e028fca498de0d64d04e9c33b59f9b21f0b2ddf34870c19f0602`
- source digest：`9192734b54c17e3742d0a44bb40d6ac93d6f3e0c4901a71c084b7c04cee0e486`
- installed bundle digest：`84ef23b3b790b67daeccd3690d391bcbecbd0f620346e2d0a4390ed2f0d0ef80`
- `main.jsbundle`：`202f0945d4ec82f07f2903677d5d95b9ee1e70f3bf2cf3c6c80e3b64654404c0`
- `sourceUnchanged=true`、`exitCode=0`
- result Info SHA-256：`89450fc0952a72d4dd775cc9788622a1e9c62e4f53da96d75d52d11f85e10384`
- run manifest SHA-256：`33429e513c5f594671b83f2650bac31915e13f72d5a52cd8f397c6b534b74e2d`
- ui-summary SHA-256：`93a8c09a378a8ac24c5b4001978a209a8903805e025cc7d04ce90da675fb3a4c`
- UI catalog log SHA-256：`14ba3e196ad4e85cfb3fb76e61307d439dbdbfe3b1b2a141f2724a04d67d690a`
- server counts SHA-256：`8d22ac19c4962688a9ffc31dc58eafaa23532171cf7f4ca3816c733579d0dcec`

正式用例在隔离 HTTP fixture 上创建带真实红色 PNG 封面地址的音枢歌单，终止并重启 App 后验证：

- 歌单列表目标行出现真实图片，而不是只读回表单值。
- 打开详情后头部出现同一持久化图片；测试先双向滚动到页面顶部，再要求图片实际 `isHittable` 后才截图。
- 删除目标歌单；下一轮开始前只按 `Cover fixture ` 前缀有限次清理测试自己的旧歌单，并等待列表计数逐次下降。
- 不删除无关的 `Cloud kept …` 或未知用户数据；最终列表仍含这些历史夹具，但不含其他 `Cover fixture`。

两张 1290×2796 截图均从精确 r10 xcresult 导出并人工亲看：

| 文件 | SHA-256 |
| --- | --- |
| `001-Playlist-detail-renders-persisted-public-cover-URL.png` | `a290d522178e76ca33bcf8833dbd9d6deca66e65369774956df6dd32c189c981` |
| `002-Library-playlist-renders-persisted-public-cover-URL.png` | `4565e91dc5e2468e95449ffbc0d10141ffcadd75c861a6d12453fd252b1d8e00` |

截图索引 SHA-256 为 `97351891c7b50053c2100c4412ab47f1de8dcac6475cd388e07cb44cedc7f775`。索引与截图位于 `build/playlist-cover-20261105-r10/screenshots/`。

`npm run check` 最终为 1028/1028、0 失败、0 取消、0 跳过；日志 `build/logs/check-playlist-cover-20261105-final.log` SHA-256 `aaf0dbc5be6b8e5a74999bdb2ea5ffd16320f13b535ccc2ea4b78b42046f4d7c`。完整 `npm run test:native` 退出 0，覆盖原生音频、媒体、WebDAV、视觉素材与播放边界；日志 SHA-256 `51bfcdb0fafaf187b1df72755f6af8b1f8c4ba434dc89b16c8b05945fd7c4e0d`，仅有既有 Sendable/WeakMutability 警告。Swift 解析、`node --check` 与 `git diff --check` 通过。

## 迭代记录

r1–r10 结果目录与 xcresult 全部保留，未删除失败或替代证据：

- r1 因键盘遮挡封面输入框失败。
- r2 在未载入项目环境时找不到 Xcode，未运行测试，不计失败或通过。
- r3 测试通过但详情截图停在表单中段，不采纳为视觉证据。
- r4、r5 详情封面未进入视口并失败。
- r6 引入双向滚动后通过；r7 封面可见但残留旧 `Cover fixture`，视觉证据不干净。
- r8 清理已干净，但旧 `frame` 判定错误接受页面外封面，详情截图仍在页面中段。
- r9 已显示正确详情与列表；随后删除一处非必要代码注释，使源码摘要变化，因此保留但不作为最终证据。
- r10 使用最终源码、计数下降屏障和 `isHittable` 顶部验收，测试与两图均通过。

## Clean 未签名归档

产品、测试和初始文档提交 `3a2ecc2e6135ff28803a80166aeb2ce5d8cd1e9e` 后，从 clean HEAD 完成独立归档。产物保存在 `build/playlist-cover-clean-3a2ecc2/distribution/`。

- clean manifest 对应产品提交 `3a2ecc2`、`dirty=false`、`workingTreeChanges=[]`、`signed=false`；arm64 / `iphoneos26.2` / 最低 iOS 15.1 / 设备族 `[1,2]`。
- unsigned IPA 为 17,821,674 字节，SHA-256 `1f5290d23211f00011bb82f1f8c0b60e65fb225edaceda6196d5df29651a4cdb`。
- manifest SHA-256 `4ecb056dc5424386f1f27cff124d56f50774278a478193515e5cc52da3e264f8`，归档日志 SHA-256 `e057ae3b6db0017e30352f8bc53c702d829a5a5be4c3fe27bb990c60266e0cc1`。
- 独立核验 SHA-256 `293be4f04c3b723414baaec79a91ea1e1ee8c7ad9d2d6c3667f82edb88fb2320`，结果 `ready=true`：ZIP CRC、63 个普通载荷与 90 个 ZIP 项逐字节、arm64/SDK/iOS/设备族、封面测试标识，以及测试/私人/签名排除全部通过。
- 构建时临时避开历史 `build/distribution` 符号链接。保护回执 SHA-256 `1b7d31b29e6b4fda88285f9882a18883b97d1e3a5d64839255a882aedf5deeba`，恢复回执 SHA-256 `3dabb245e651643279fc7c4cd8d9f1e53adce9db52d721814b78882edd5daf02`；目标和 6 个顶层文件哈希、mtime 均未变化。
- `source/nexus-music-3a2ecc2.tar.gz` 为 8,066,761 字节、SHA-256 `1324148ee9acbd8b0fc4f5fad9c97d2a0d5c3ee266f43c5319919a32799aaad4`；1,093 个 tracked 条目（1,091 普通文件、2 符号链接）与产品提交逐项内容一致。完整补丁 SHA-256 `0a586cc16305c79cf763b5fa0a6eecb1e56d30c05777ba1a9ca74fc629f3ec85`。

## T7 阶段归档

已真实挂载且可写的 exFAT 外置阶段为 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-05-playlist-cover-3a2ecc2`。归档包含 clean IPA/xcarchive/manifest、r1–r10 运行记录、9 份有效 xcresult、失败附件、最终截图、检查/native/clean/T7 日志、源码 tar/补丁、文档快照和核验脚本。

- 722 份业务文件、410,722,802 字节，逐文件 SHA-256 0 差异；目标 `shasum -a 256 -c SHA256SUMS` 722/722 通过。
- `inventory.json` SHA-256 `88ec0656f02ad8f839f6c7b82a6ef7246bf17179e89d5cd8fbfd944b47462a67`；`SHA256SUMS` SHA-256 `9d1070e621b37494e34a462fd54b3253f3526a9b09ff7f3fae22c700f6d551ac`。
- `transfer-receipt.json` 为 `ready=true`、`mismatches=0`、`sourcePreserved=true`、`deleted=0`、`movedUserFiles=0`，SHA-256 `7609b2f0a45af71eea901f4d893207fda9583757f7da067511d5d0ddfe310206`。
- 源码 tar 的 1,093 个 tracked 条目与 `3a2ecc2` 内容一致，0 差异；文档快照对应 clean 文档提交 `3dddb32ecb9542fa6cdb16f7f6d41955f7f0ccc1`。
- 目标在回执生成前记录 805 个 exFAT 自动 `._*` 元数据文件；其不计入 722 份业务载荷，也不替代逐文件 SHA-256 核验。
- 恢复按 `inventory.json` 的相对路径执行；tracked 源码也可由 `3a2ecc2` 与 `source/nexus-music-3a2ecc2.tar.gz` 重建。源证据和本机阶段目录均保留。

## Push 与云端队列

`3a2ecc2`产品、`3dddb32`clean归档和`191574a`T7归档文档已正常push，远端main经`git ls-remote`核对为`191574a2e1f699593ca03223419ac9ec68aab826`。2026-11-05 14:24（Asia/Shanghai）从GitHub Actions实际页面核对：`41973467272/258cac7`正在运行，`41979882570/191574a`为唯一等待串行任务，队列1运行/1排队。没有取消或重派。未认证REST API返回限流403，未用于判断构建终态；当前没有新云端成功结论。

## 边界

- 本批正式 UI 覆盖歌单列表与详情；当前目标歌单为空，不出现“全部歌曲与批量管理”，因此 `track-list-cover` 的实际弹层视觉未单独采集。其共用决策和 URL 安全回退由纯函数测试覆盖，后续有歌曲的歌单仍应补正式弹层断言。
- fixture 使用本机 HTTP 地址验证正式封面加载/缓存链路；未连接真实私人图床、Navidrome 或第三方账号，也不宣称弱网、超时、跨域服务矩阵通过。
- J24 仍保持 B：实体机滑动/长按/批量手势、VoiceOver、动态字号和小屏、真实大歌单及签名未验。本批只关闭持久化封面显示缺陷。
- 无新增 Sollin 逆向采集、私有接口探测或商业逻辑移植；既不提升 J24 的 Sollin 对齐等级，也不关闭完整 F11/F23 或项目。
