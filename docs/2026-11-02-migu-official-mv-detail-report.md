# 咪咕官方 MV 分享页详情与刷新验收

2026-11-02。产品提交
`80533543625578ffd1c963274d4fea78c168d486`。本批取代
2026-10-29 记录中的“咪咕 MV 详情暂不支持”产品限制：音枢现在为合法数值
MV 标识生成咪咕官方匿名分享页，并可在正式详情页刷新。该结果证明官方详情页
能够加载及刷新；真实视频起播、声音、全屏、弱网和实体机行为仍未验收。

## 范围与安全边界

本批只允许以下精确公开页面：

```text
https://h5.nf.migu.cn/app/v4/p/share/mv/index.html?id=<numeric-id>
```

`id` 必须为纯数字，host、path 和唯一查询参数均须精确匹配；额外参数、
fragment、畸形 ID、私网地址及跨平台导航均被拒绝。实现不解析、保存或提交
临时 HLS/MP4 地址、Cookie、设备标识、会话信息或平台凭据。MV 仍与权威音乐
队列分离，打开或刷新 MV 页不会把视频加入音乐队列。

该公开网页是音枢的正式只读详情入口，不扩大为咪咕账号、私人服务、媒体地址、
下载协议或客户端内部接口。Sollin 对齐仍复用既有
`E-1028/E-1030/E-1052 → F-042 → P-040` 可见 MV WebView 合同；本批没有新增
Sollin 原始采集，也没有把公开网页加载写成参考运行时、视频播放或像素/动效
等价。

## 实现

- `VideoProvider.publicPage("mg", ...)` 删除旧的
  `PublicMVPageUnavailableError`，直接生成白名单内官方分享页；不发起解析媒体
  的 API 请求。
- `MVDetail` 对咪咕显示现有刷新按钮；刷新只重建同一公开页面的加载代次，返回
  仍回到原 MV 搜索结果。
- `PublicMVPolicy` 对初始页面和同站导航同时实施 HTTPS 精确 host/path、单一
  数字 `id` 校验；其他咪咕域名和跨平台页面被拒绝。
- MV 页面仍使用既有独立 WebKit 容器。网页“页面已载入”只代表 WebKit 文档
  就绪，不替代媒体播放、声音或全屏状态。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| `npm run check` | 980/980 通过 |
| `npm run test:native` | 通过 |
| `npm run ios:build` | `BUILD SUCCEEDED` |
| Migu/MV Release UI | `SourceUITests-1793623216513`，1 通过 / 0 失败 / 0 跳过，219.732 秒 |
| 云备份文本替换回归 | `SourceUITests-1793621671370`，1/0/0，235.209 秒 |
| Navidrome 设置页签回归 | `SourceUITests-1793622026059`，1/0/0，590.027 秒 |
| clean unsigned archive | 成功，manifest 与产品提交一致 |

三次 Release UI 运行均为 iPhone 15 Pro Max 模拟器、iOS 26.3.1。Migu/MV
运行 manifest 的 `exitCode=0`、`sourceUnchanged=true`，源码 digest 为
`96856510f54a041e015d70858fe4734f8c22bda268636acf02c3a10e25f24746`，
安装 bundle digest 为
`813cc756dd92ceafe97d3addb70e13b96966b63d9385371a0d322ead09b4e686`。

最终 Migu/MV 结果导出了 11 张 1290×2796 PNG；`provenance-review.json`
中每张图均为 `ready=true`，均绑定上述源码和安装 bundle。人工亲看关键图像：

- `004-Real-Migu-MV-official-share-page-refresh-preserves-its-source-and-title.png`
- `005-Real-Migu-MV-opens-its-verified-anonymous-official-share-page.png`

两张图均显示实际咪咕官方分享页、正确 MV 标题、作者和时长；刷新后页面保持同一
来源与标题。其余图像继续覆盖五平台目录、公开详情、分页、草稿跨类型/平台保留
及 MV 详情与音乐队列隔离。

云备份和 Navidrome 回归使用同一源码/安装 digest。前者验证 iOS 27 忽略
`Command+A` 时，字段替换回退仍以有界 Delete 清理并精确断言最终文本；后者在
页签 `isHittable=false` 时点击有限可见 frame，同时继续断言页签实际选中及目标
页面出现。两项回归的结果包分别为
`SourceUITests-1793621671370.xcresult` 与
`SourceUITests-1793622026059.xcresult`。

## 证据与产物

| 项目 | 路径或摘要 |
| --- | --- |
| 最终 Migu/MV xcresult | `build/SourceUITests-1793623216513.xcresult` |
| 结果包 Info.plist SHA-256 | `f2d36b85e321e813845c4060347c987523841129f9b1489e95fb9ee0e90635c8` |
| run manifest SHA-256 | `205495191e9d0c800288c69dedd7d8eb7e51ca7c02a05103d9742b4cef0cf695` |
| screenshot index SHA-256 | `e8aca7849098501b3349a94d1f0e9b53886ddc098e4496807f2646790a502faa` |
| provenance review SHA-256 | `ce428514735759e1ed91bbc05f997d57a9a37ebe5e3c540ab44c2bc42bdc7974` |
| 云备份 run manifest SHA-256 | `34e43c9b04400a92a467caafe23d5aff91a5ca2481b6e832acb72d6b795e274b` |
| 云备份 xcresult Info.plist SHA-256 | `29cb64de520d4d74e73a92ee03f0561ef5fc4579ad2d7b268dcc9bca89db915e` |
| Navidrome run manifest SHA-256 | `16f54c2853f741982f499a0349011e0485704af986f5d48d5802aa9f4da1e243` |
| Navidrome xcresult Info.plist SHA-256 | `ad342d66aa170747604cb399b84452e983a1d5c66d060b700c3b23f289aa1222` |

clean unsigned archive manifest 记录
`commit=80533543625578ffd1c963274d4fea78c168d486`、`dirty=false`、
`workingTreeChanges=[]`、arm64、`iphoneos26.2`、最低 iOS 15.1、设备族
`[1,2]`、`signed=false`。manifest SHA-256 为
`361ab93df2f831e6f04acc8622d64044869661af89f9ed157775608304cf9b18`。

IPA 为 `build/distribution/NexusMusic-unsigned.ipa`，12,899,521 字节，
SHA-256 为
`648ae07add5b894916e84642096b880f3c036c3733e1e5cab17a64c32099d1a3`。
独立验证回执为
`build/logs/migu-mv-archive-verification-8053354.json`，SHA-256 为
`017c1e9edf454206649e639eb079ef24ce3457bedf7fde9ab61d7470b163702c`，
`ready=true`。

归档包含 164 个 ZIP 条目和 138 个普通 payload 文件；CRC、archive↔IPA
路径与逐文件字节全部一致，archive-only、IPA-only 和 changed 均为空。正式包
同时包含 JS 的咪咕分享 URL marker、原生 host/path marker；测试适配器、夹具
秘密、私有地址、本地测试输入、匹配音频和旧不可用错误标记均不存在。包内无
`_CodeSignature`、嵌入描述文件或任何签名身份。JS bundle、可执行文件和
`Info.plist` SHA-256 分别如下：

```text
48fac1e0582e1094e9a71c5ee7445af0a8f7cd03fa170e91e1a180ab6f653989  main.jsbundle
2eb8c2ec3b5148444aa65b3d9309f21780fbb6f6392894ad29d78e99e308c31a  app
dd9d3304202133385f743d3b89fc3af5f319faebaae0435cde36eb0b39e90452  Info.plist
```

### 推送与 T7 阶段

产品提交 `8053354` 与文档提交 `dfba72a` 已正常 push，远端 `main` 实核一致。
push 后 `41435198362` 继续运行，`41449172204`/`dfba72a` 为唯一 pending，符合
同工作流/分支 1 运行 / 1 排队；没有手动取消或重派旧版本。

独立阶段位于：

```text
/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-migu-mv-8053354/
```

该目录保存 IPA/archive、manifest/验证回执、三个 xcresult 及对应运行日志、11 张
截图/provenance、审阅文档和提交 diff。238 个源文件逐份 SHA-256 对比为 0
失败；`SHA256SUMS` 全量复核通过，最终清单哈希、普通 payload 与 exFAT `._*`
元数据计数保存在该阶段的 `transfer-receipt.json`。源证据保留，
`deleted=0/moved=0`，内盘约 47 GiB 可用。

## Evidence → Finding → Path

| 类型 | ID | 内容 |
| --- | --- | --- |
| Sollin Evidence | `E-1028`、`E-1030` | 可见搜索结果可进入 MV 详情，内容是 WebView 容器 |
| Sollin Evidence | `E-1052` | MV 详情具备标题/来源/刷新等可见合同；未证明视频起播、声音或全屏 |
| Sollin Finding | `F-042` | 参考可见能力是可打开的独立公开 MV 页面，不能外推媒体播放 |
| Sollin Path | `P-040` | 音枢保留独立公开页面与音乐队列隔离，不进入媒体协议移植 |
| 产品 Evidence | `E-MV02-01` | 数值咪咕 ID 被构造成唯一精确官方分享 URL，无媒体/凭据解析 |
| 产品 Evidence | `E-MV02-02` | 正式 Release 实际显示网页内标题，刷新后来源/标题保持 |
| 产品 Evidence | `E-MV02-03` | 策略测试拒绝畸形 ID、额外参数、fragment、私网和跨平台导航 |
| 产品 Evidence | `E-MV02-04` | clean IPA/archive 标记、字节、CRC、隐私与未签名检查通过 |
| 产品 Finding | `F-MV02-01` | 咪咕官方 MV 详情页加载/刷新已形成可复现能力；真实媒体播放仍未验 |
| 产品 Path | `P-MV02-01` | 仅开放白名单官方分享页及刷新，继续把真实媒体状态留给独立生命周期验收 |

项目 `ipa --review` 与 `apk --review` 在本批均为 `PASS`、0 错误/0 警告；
IPA 为 54 Evidence / 19 WorkItems / 116 events / 45 Finding / 45 Path，
APK 为 3 Evidence / 2 WorkItems / 3 events / 2 Finding / 2 Path。它们是离线
证据门禁，不证明本次公开网页、真实视频或实体设备行为。

## 复现

本机复现需先加载项目 Xcode 环境；不把模拟器或归档成功替代云 iOS 27、签名和
真机验收。

```sh
cd /Users/ningli/WorkSpace/NexusMusic
source /Users/ningli/WorkSpace/Tools/env.sh
export NODE_OPTIONS=
export PYTHONPATH=
npm run check
npm run test:native
npm run ios:build
```

Migu/MV 的正式 UI 测试由项目测试脚本以
`-only-testing:NexusMusicUITests/SourceSettingsTests/testLiveMVSearch`
运行；具体 fixture、模拟器、源码 digest 和结果包见
`build/migu-mv-live-20261102-final-r3/run-manifest.json`。截图与来源绑定见同目录
`provenance-review.json`。

## 未完成边界

- 咪咕真实视频起播、声音、网页/系统全屏和播放退出尚未验证。
- 弱网、资源失败、限流、后台竞争和网络恢复矩阵尚未形成完整验收。
- 当前只有 iOS 26.3.1 模拟器与 unsigned arm64 archive；iOS 27 云端终态、
  Apple 签名、设备安装、续签和实体机功耗/后台行为仍待。
- 没有咪咕同态 Sollin 截图/录屏，不声明像素、布局或连续动效一致。
- 本批不关闭完整 MV、五类型搜索、平台服务或项目总目标。

## 文档自检

- [x] 报告选择通用技术回执，未套用 malware/APT/vuln 专属结构。
- [x] 包含概述、授权与公开边界。
- [x] 包含独立 Sollin 既有 E/F/P 与本次产品 E/F/P，未混算。
- [x] 工具、源码/结果包/产物摘要和复现命令均已记录。
- [x] 明确官方详情页成功，以及真实视频/声音/全屏/实体机仍未完成。
- [x] 未提交真实凭据、签名、Cookie、临时媒体 URL 或私人数据。
