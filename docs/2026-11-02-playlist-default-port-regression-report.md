# 公开歌单链接的默认端口归一化回归

2026-11-02。本批继续 F12/F13 的已有公开歌单导入边界，修复显式默认端口被 URL 归一化隐藏的问题。

## 根因与实现

WHATWG `URL` 会将 HTTPS 的 `:443` 和 HTTP 的 `:80` 从 `url.port` 中去掉，包括带前导零的等价写法。原代码仅检查 `url.port`，因此无法满足已有的“拒绝显式端口”约定。原短链测试使用 `parsePlaylistLink`，它本来就不会展开短链，故该断言不能证明 `resolvePlaylistLink` 在开始传输前拒绝端口。

解析器现在先保留清理后的原始 URL，检查其 authority，再使用已解析 URL 的协议、凭据、主机和 ID 检查。直接链接、短链输入和展开目标共用此边界；查询值中的冒号保持允许。网易短链在所选平台不是网易时立即报告平台不匹配，不发起展开请求。

这是音枢已有校验的原创修正，没有采纳新的第三方实现、依赖、资源或协议。复用既有 `E-053→F-044→P-044 / WI-018` 的输入、错误和平台边界，不新增 Sollin 目标采集、服务访问或运行时结论。该修正不声称浏览器实际重定向保留原始端口；默认 fetch 的最终 URL 只提供平台返回的归一化结果。

## 验证

- 链接专项 12/12，通过；覆盖 HTTP/HTTPS 默认端口、前导零、非默认端口、直接链接、短链输入和展开目标，以及跨平台短链零请求。
- `npm run check` 961/961，通过，0 失败/取消/跳过。
- Swift parse 与 `git diff --check` 通过。
- IPA strict review：53 Evidence / 18 WorkItems / 112 timeline / 44 Findings / 44 Paths，0 错误/0 警告；APK strict review 3/2/3/2/2，0 错误/0 警告。
- 正式 Release `SourceUITests-1793573573210.xcresult`：1/0/0，214.252秒；`sourceUnchanged=true`。三种显式端口均保留在输入页并报告“分享链接无效”，短链请求计数不变；后续取消/迟到隔离、重试、刷新/分页保留、完整读取、歌单操作及清理继续通过。
- 新增截图 `build/playlist-port-ui-20261102/001-Explicit-default-ports-are-rejected-without-short-link-transport.png` 已亲看，provenance ready，无错误。截图 SHA-256 `1accf986e6ee82f600ee701b2e2b2faf8cad9e7bd23837c1a3bab8b4a0f5b26a`；索引 SHA-256 `19e3d238101a01fcadc69ecb7431dcfd022d28f2997c0dfe1a24e870ebec04d1`。
- Run manifest SHA-256 `f82544eb815c3af8f718b8dc80e44d0f7fad73f47b1f2e9cb08bbcd4b17daef8`，xcresult Info SHA-256 `a81eb8fd63d419a9a58a4cdd065398ff6211d0929af410a9ea45c224d40c0c92`，源码 digest `ae70dab4c3fb25034a35b6d57817410ccfd5c11942d154912458e549de1e2f12`，安装 bundle digest `79fd33deabf6df1f5b5d71bea699855f8da7419c238081cdc894aabce8dd31cd`。本批只有一次正式 UI 运行，没有业务失败；provenance 辅助调用最初漏传截图参数，纠正调用后通过，未改工具或原始记录。
- 清洁 IPA 与云端结果按本批实际终态补录。

UI 状态与验收路径见[公开链接导入规格](ui-spec/playlist-link-import-2026-11-02.md)。原生产品代码未变，本批不重复完整原生音频/宿主套件；同日上一批完整 native 通过的精确范围见[上一批回执](2026-11-02-public-playlist-link-import-report.md)。

## 未完成边界

完整平台分享文本矩阵、真实弱网/限流、真实 iPhone、签名与安装和连续动效仍需独立验收。当前 UI 范围继续采用决策0076的 iPhone 常态布局；大字号和 iPad 专用布局不重新纳入本批退出条件。云端 iOS27 只按实际覆盖本代码的运行终态记录，不将排队、模拟器或未签名归档写成全项目完成。
