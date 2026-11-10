# 账号歌单创建与刷新恢复

网易云建单成功后，页面改为清空旧目录并保留显式读取入口；重新读取后，新歌单可正常打开导入预览。三平台共用的账号歌单页面在开始刷新时也清空旧条目，刷新失败或取消后不再显示已被服务层撤销的歌单。

## 原因与修正

| 证据 | 问题 | 修正路径 |
| --- | --- | --- |
| `NeteasePlaylistCreateClient.perform` 独立生成回读对象；`AccountPlaylists.preview` 要求对象属于当前登记目录 | 将创建结果直接插入页面，会在预览时错误提示“账号已更改” | 创建确认后清空目录；用户通过 `list()` 重新读取并登记条目 |
| `AccountPlaylists.list` 开始即删除旧目录；页面原先仅成功时替换列表 | 刷新失败或取消后，旧行重新可点，但预览拒绝 | 点击读取时同步清空 `lists`，保持既有目录失效契约 |
| 专辑/MV 共用读取器和既有测试采用相同失效规则 | 保留旧目录成员将改变账号目录约定 | 不修改服务层的账号、请求代次及成员校验 |

修正只涉及音枢既有状态一致性，没有增加 Sollin 采集或协议结论。创建请求仍单次发送，不因刷新或取消自动重试；成功空目录与读取失败继续分开显示。

## 验证

- `npm run check`：1108/1108，0 failed/skipped/cancelled。新增契约测试确认失败/取消刷新撤销旧条目和旧预览，拒绝路径不发额外网络请求、不写入本地歌单，显式成功重读可恢复。
- Swift parse、Node syntax 与 `git diff --check` 通过。首轮沙箱检查的4项下载传输测试因禁止监听127.0.0.1而失败；允许本地回环服务后完整检查通过，原日志保留。
- 正式 Release `SourceUITests-1794296288625`：1 passed / 0 failed / 0 skipped，51.340秒；iPhone 15 Pro Max、iOS 26.3.1、x86_64。`sourceUnchanged=true`，安装包摘要完整。
- App路径：读取原空目录 → 创建 → 重新读取新歌单 → 完整空歌单预览 → 刷新失败 → 重读成功 → 挂起刷新并取消 → 释放迟到响应 → 再次重读及预览。最终 `writes=1`、`reads=7`、`invalid=0`、`held=0`。
- 4张1290×2796截图按精确xcresult导出并通过来源核验，创建确认、失败提示、读取入口和恢复预览文字可达且无裁切。首轮 `SourceUITests-1794295814250` 停于整段中文输入仅留下首字；用已有逐字输入方式修正测试，保留完整名称断言及失败原件。

精确本机证据在 `build/ui-account-playlist-refresh-20261110-r2/`；完整检查在 `build/account-playlist-refresh-20261110/check-unsandboxed.log`。关键SHA-256：

| 文件/内容 | SHA-256 |
| --- | --- |
| 完整检查日志 | `a5a8d8e01952a8caeee57df96844f6e61adab501024417696eebf28685347ad8` |
| 运行清单 | `048a791bd07d9a0de50df2c9e1137eb9e6534f81db4a388649ad4ba79b63c84c` |
| 源码集合 | `b6bc626c1d9f32fe3ef83e6f2ae4aec9814b544e8d47bffd730054c11a358064` |
| 安装bundle | `01b4ba6cdc0d12965f025065611b6231528f11b64a510f410111ee45ac1c386d` |
| xcresult Info | `d4dab8e333b6c28629999f7ca31481277d9166b4f5215e5705337e0145c470da` |
| 夹具计数 | `bda4a4944002efefdf90bec4558b05b5ee6cf09353c79b1216c590f233356fc3` |
| 截图索引 | `2fc3370d0226738973c94f1c7f1bffc0c480c1061201873db1d1a8120d9f671d` |

复现：加载 `scripts/environment.sh`，清空 `NODE_OPTIONS`/`PYTHONPATH`，指定新的 `NEXUS_UI_RUN_DIR` 后运行 `node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testNeteasePlaylistCreateFixture`。需本机回环端口与模拟器权限；数据和会话均为合成夹具。

## 仍开放的范围

本批没有真实平台账号写入或实体机证据，J10仍为B。真实网易云创建与隐私、跨设备可见性，QQ/酷狗创建和平台加歌/删除，以及签名与iOS27验收继续开放。下一项已核对为音乐库单曲与批量动作接线，其后为每日推荐/私人雷达完整列表。

## 本地交付

产品修复提交 `6951056`，连同前次网易云创建提交 `bafeacd` 完成清洁工作树正式入口归档。unsigned IPA为17,844,411字节，SHA-256 `05ea097ae24297b57b631a95749f30d96d090a1ba63d5abc8390fd2118ade20a`；manifest `dirty=false`、arm64/iphoneos26.2、设备族[1,2]。90个ZIP条目CRC通过，63个业务载荷与xcarchive逐字节相同，8份隐私清单、0签名条目；生产bundle排除本批及既有测试标记。旧`build/distribution`链接及原文件摘要恢复一致。

源码tar逐项核对Git blob通过。T7阶段`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-10-account-playlist-refresh-6951056`保存124份/77,507,662字节，逐文件源/目标SHA-256零差异，源保留、零删除；清单SHA-256 `bfa8b2cecd5f97706f302a6120ca4093af27531714b7a99ce8048f77112c30b3`。恢复时按归档`root/`中的项目相对路径复制，xcarchive用独立tar解包，源码tar保留Git符号链接。推送及云端终态单独核对，未签名归档不增加实体机、个人签名或真实平台验收结论。
