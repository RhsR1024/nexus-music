# 0051：发现歌单分页与刷新恢复验收

状态：本地验收通过，归档/云端继续，2026-10-18。范围为 A08 已有发现详情，不新增产品服务或改变播放意图。

E023→F022→P022 已在采纳前严格 review，通过23E/22F/22P、8WI/42事件、零错误/警告；独立重放610原始指令、10BL、3池加载与循环回边通过。参考只证明 first/refresh/append/full-read 的独立入口，失败保留和重试页码是音枢原创约束，详见 [报告](../2026-10-18_reverse-sollin-pager-refresh-report.md)。

## 五参考比较

以下固定 HEAD 均重新核对；仅比较实现，不复制依赖、原生补丁或服务地址。

| 参考及固定提交 | 刷新/分页实现与本批取舍 | 维护、Android、许可边界 |
| --- | --- | --- |
| 悦音 d6f1af7f911e84babce56cd07297b44cfe46eed9 | `src/store/reducers/playlist.ts:25–55` 为本地列表增删替换，无远端失败重试依据。 | Expo54，根MIT/资源单独核对；本地 reducer 不证明 Android 网络取消。 |
| Q-1515 547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a | `src/screens/SonglistDetail/MusicList.tsx:85–110` 刷新传 true/page1，追加用已保存 page+1；刷新 catch 可 clearListDetail。`src/core/songlist.ts:173–188` 按 source/id/page 缓存。本批保留音枢失败不清空的数据边界，不移植全局缓存。 | RN0.73/fork维护；Apache2/第三方独立；Android 生命周期和原生另验。 |
| wtfdelphia 6624ab58cbd2f5bda52ab8006912d3c60dc1f847 | 同路径85–110具有相同 first/append/refresh 分流与卸载 guard；不证明传输 Abort 或原服务弱网。 | 旧RN/fork；Apache2/原生依赖独立，不引入 Android 服务。 |
| CyMusic bf0d4694acb52973bcd594d31b3c61f655e166cb | `src/store/library.tsx:95–135` 首次/刷新取固定QQ榜单，其他页本地slice；catch只复位loading。只能比较成功替换和失败保留的组织方式。 | Expo57/RNTP5超基线，Apache2及原生独立；不引新后端。 |
| 自有 Wayferar 8e47cdc701cdbb772577b2bf7abb699e285b0fa6 | `docs/CORE_CLEANUP_REPORT.md:15–29` 记录保留歌单分页和smali复核，不作为iOS恢复行为证据。 | Android/车机/smali权威，自有改动与第三方许可分别保留。 |

## 原创验收契约

使用本机酷我 wire 适配合成101首：第一页100首，第二页1首，筛选仅显示各页标记歌曲。追加首次失败应保持100/101，重试同一第二页后为101/101且无重复；刷新失败应保留两页、数量和筛选；刷新重试成功应替换第一页为新身份100/101，再加载第二页到101/101。服务器记录页序列应为 `[0,1,1,0,0,1]`，两次失败；保留既有导航取消/完整导入/收藏/重复项/两种Sheet归属/清理断言。

产品既有 generation/Abort、成功后更新 page/items/total、错误保留旧数据与 retryAppend 分流先接受测试，不为补验收重写产品实现。新夹具只随 testDiscoverySongActions 启用，不进入正式服务；本批不据合成数据宣称真实平台、签名或手机通过。

## 验收结果

359业务/类型检查与完整发现 App `SourceUITests-1792271857949` 145.119秒通过，零失败/跳过。服务器独立核对页序列恰为 `[0,1,1,0,0,1]`、两次失败；共22次隔离合成请求，无音频。原有完整读取取消、截断拒绝/重试、收藏、重复歌单项、两种Sheet归属及清理断言均通过。已亲看刷新失败101/101及两首标记歌曲保留、替换后两首新身份截图。没有产品行为、原生后端或依赖修改。

日志、summary、counts分别留存 `build/logs/ui-discovery-pager-recovery-{passed.log,summary.json,counts.json}`；截图在 `build/discovery-pager-recovery-attachments`。独立 Evidence 核验日志 `reverse-pager-independent-verify.log`。验收后严格review/清洁归档/对应云端继续，不把此次既有功能补验收计为新增服务完成。

验收后 strict review23E/22F/22P、8WI/43事件、零错误/警告通过，日志 `build/logs/reverse-pager-recovery-final-review.log`；工作项与timeline已追加，未修改不可变Evidence。
