# 0049 发现歌单完整读取的导航取消

2026-10-18，A08。reverse-skill原生ipa-discovery-cancel路由为R2/mobile-reverse；既有离线scope复用case-guard，不重跑case-init。E022/F021/P021确认详情二级路由与独立loadAll回调、失败/重试边界，采纳前strict review22E/21F/21P、8WI/39事件零错误/警告。参考异步取消/完整分页/运行仍未知；本批只修复音枢已有完整导入的原创状态边界，不新增接口或参考默认值。

## 五参考比较

已重新核对五个固定HEAD，来源/完整许可见[参考比较](../REFERENCE_COMPARISON.md)。

| 固定参考 | 实现检查与采纳边界 | 维护、Android与许可 |
| --- | --- | --- |
| 悦音d6f1af7 | src/store/reducers/playlist.ts:25–55只按id hydrate/更新/删除；保留音枢原子本地创建，不引入Redux | Expo54近基线；根MIT/资源独立；TS不保证Android取消有效 |
| Q547ccfe | SonglistDetail/index.tsx:15–31按详情生命周期loadList；MusicList.tsx:20–76卸载标记保护部分异步UI；不引入全局songlistState或requestAnimationFrame列表栈 | RN0.73/fork维护成本；Apache2与第三方独立；保留音枢AbortController与代次 |
| wtf6624ab5 | 同路径MusicList.tsx:20–103具有load/刷新/更多及卸载guard；不能据此声称完整取消状态机 | 旧RN/fork；Apache2/原生独立；Android网络取消另验 |
| Cybf0d469 | src/store/library.tsx:95–135全局isLoading/page/hasMore与finally式失败复位；不复制固定榜单/占位身份或全局阻塞模型 | Expo57/RNTP5超基线，Apache2及原生独立；保留当前局部页面状态 |
| 自有Wayferar8e47cdc | docs/CORE_CLEANUP_REPORT.md:15–29保留发现/分类/歌单/分页与媒体控制；文档不证明iOS异步取消 | Android/smali权威与反编译Java区分，自有改动/第三方独立，不移植车机服务 |

## 问题与验证方案

Discovery的view/platform/category/open变化会abort旧完整读取，但旧finally因signal.aborted不复位importing。返回并再次进入详情时仍显示“正在完整读取…”和取消入口，无法开始新读取。正确行为是在上下文变化时同时清除局部读取状态和旧提示；旧signal guard继续阻止迟到确认/错误覆盖。

原有testDiscoverySongActions加入仅本机合成服务的hold-next/release屏障，不用固定延迟猜测请求是否完成；实际等待服务器确认完整读取被悬置，返回广场/重入详情后检查可再次读取、无取消残留和无迟到确认，再真实完成新的预览并取消。保留原收藏/加入歌单/重复项/嵌套Sheet归属与清理检查。失败基线1792268341340在22.380秒精确失败于重入后导入入口未恢复（服务端held=1）；原完整日志/摘要/计数/录屏保留，附带simctl诊断失败不是首因。修复仅在上下文变化时复位importing/旧提示，保留Abort和迟到guard；352业务/类型检查通过，最终1792268529189发现完整专项114.383秒通过、零失败/跳过，服务器held=1、3次列表/5次详情均为本机合成服务，截图已亲看；包含新读取确认/取消与既有收藏、重复项、两种呈现的Sheet归属和清理。无新原生后端/依赖，清洁归档/云端/真实服务/签名/手机另记。
