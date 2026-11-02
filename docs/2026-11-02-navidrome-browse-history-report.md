# 2026-11-02 Navidrome 浏览历史与上下文恢复

本批补强音枢自有私人曲库的层级导航。旧组件进入歌手、专辑或服务端歌单详情会覆盖父层列表，缺少逐层返回；现在保存本次会话的父层列表、已载入偏移、50项可见页、标题、搜索草稿/已提交查询和歌单名称草稿，四个一级分类可恢复各自上下文。返回已加载父层不重新联网。保存的是分页上下文，不承诺外层 ScrollView 精确像素位置。

## 实现与边界

`NavidromeBrowser` 通过订阅快照对接现有正式组件；账户切换、移除或重新连接清空历史和分类缓存。导航取消请求，generation 与 AbortController 隔离迟到结果；取消的 client 获取不会再发起 HTTP。刷新/分页失败保留原内容，分页重试沿失败的同一偏移；刷新成功回第一页。

服务端星标只在确认成功后同步本会话各保存层的同曲状态，保持当前页；重命名同步保存歌单的列表标题。其他服务器写操作仍沿现有刷新路径。组件以 writeGeneration 隔离账户变化或卸载后的迟到 UI 更新。导航只保留现有白名单 Track 元数据，不持有凭据、认证 URL、客户端或音频，不写持久存储、备份、本地收藏或第二播放队列。

本批依据项目现有 OpenSubsonic 客户端与组件原创补强，没有新增 Sollin 分析、证据采纳或第三方源码移植。UI 采用现有排版与主题，新增至少44pt高的明确父层返回按钮。当前 iPhone 常态范围、音枢特有能力和许可/隐私边界保持；不报像素相似度或手势/动效一致。场景见[UI规格](ui-spec/navidrome-browse-history-2026-11-02.md)。

## 验证记录

完整业务与类型检查967/967通过；新增6项契约覆盖两层分页返回、四分类/已提交查询与草稿恢复、失败保留及同偏移重试、账户/卸载取消与迟到隔离、取消client获取不联网、确认星标后跨层缓存一致。Node脚本语法、Swift parse、YAML与diff检查通过。

初轮正式 Release `SourceUITests-1793576224837` 为0/1/0、555.378秒：末尾空搜索框断言误把iOS AX暴露的占位文字当作旧值。前序导航与播放已执行，但整轮不计通过。修正断言只允许空串或精确占位文字，仍禁止旧查询。原始xcresult、failure-evidence和console保留；后处理额外的simctl找不到不改写为用例首因。

最终正式 Release `SourceUITests-1793577102182` 为1/0/0、580.834秒，`sourceUnchanged=true`，源码 digest `5ea1ca97…`、安装 bundle `f0291dc4…`。正式 App 实际完成歌手/专辑两层分页、服务端星标、原生 PCM 播放与暂停、第三页返回、已提交搜索和服务端歌单恢复，以及第二账户切换清空旧栈/查询；服务器计数为21次认证成功、0失败，星级写入1次，结束时仅清理两个合成账户。5PNG 导出后逐张 `verifyCaptureEvidence` 为 ready 并亲看，截图索引与来源记录在本机精确目录。

旧 Navidrome 综合回归 `SourceUITests-1793577857813` 为1/0/0、651.540秒，`sourceUnchanged=true`，源码 digest 与安装 bundle 和新导航专项一致。正式 App 继续通过账户校验、私有曲库、原生流4次、歌词4次、六个播放器皮肤的暂停/定位/队列/重启行为、迷你控件持久化、实际聆听统计和连接/凭据移除；13次认证成功、0失败。两次运行证明本批导航未破坏原播放与凭据链路。

来源摘要：正式 UI run manifest `6da32aef…`、xcresult Info `061f40c3…`、截图导出索引 `62ef4be4…`、联系表 `2bff2c09…`、provenance review `46fe3a0c…`；交叉回归 run manifest `5df631ba…`、xcresult Info `adf79b14…`。截图 `provenance-review.json` 的五项均为 ready。精确 xcresult、日志、计数和截图保留在 `build/logs/navidrome-history-ui-final-20261102/`、`build/logs/navidrome-existing-regression-final-20261102/` 与 `build/ui-screenshots/navidrome-browse-history-final-20261102/`。

## 清洁未签名归档

功能提交`6522587`生成清洁未签名归档：manifest `dirty:false`、`workingTreeChanges:[]`、commit与HEAD一致，arm64/iphoneos26.2/iOS15.1/设备族`[1,2]`、`signed:false`。IPA 12,881,335字节、SHA-256 `d2134ee41a894e6d0296aca18aa8cff89f30d4032123550646eeeaf11937baf1`；manifest SHA-256 `a57fe579f1608c9fd3aff1c15e66820ca2a04384c546df3c25e2d4bb9ecd3650`，核验回执`1a4bfc16…`。

ZIP共164项、138个普通文件，CRC全通过；archive与IPA的138项逐文件字节一致，0缺失/0额外/0差异。由于本机`build/`位于T7 exFAT，归档同时包含81个`._*`扩展属性旁文件及57个规范payload；138项均参与比较并通过，Git树仍清洁。包内正式导航标记存在；`fixture-browser`、合成歌曲/歌手、测试适配器、私人端点与夹具秘密均排除，无`_CodeSignature`或描述文件。机器核验在`build/distribution/ipa-verification.json`与`build/logs/navidrome-history-archive-verification-6522587.json`。本机SDK26.2/未签名归档不替代iOS27、签名、实体机或真实私人服务。

push与云端本批终态在实际完成后补录；本批不预记。

## 云端证据与诊断

iOS27运行41347977881 / `8c6db6f26951309a17af4f963d00271a20fc6f54`已完整成功。小日志包CRC/SHA-256核验通过，按不同测试组去重为29项UI零失败（核心22、在线5、结构歌词1、离线1）；unsigned IPA为12,192,267字节、SHA-256 `98849ff02e68f9a3d414997880f25879b0996146f47b9c20d167f39cd2909af7`，arm64/SDK27/iOS15.1/[1,2]、ZIP CRC与无签名/描述文件及测试标记检查通过。

该云端manifest为`dirty:true`，唯一变化为`M ios/Podfile.lock`；Pods步骤通过项目固定Intel/ARM Yoga checksum允许规则，但未独立取得该次生成lock原文件。不能称云端清洁树。产物、日志、网页和核验回执保存T7 `NexusMusic/BuildArchive/ci-41347977881/`。本次成功只覆盖8c6及祖先，不覆盖后续Wayfarer、端口修正或本批导航。

旧运行41341222840第二组退出1，小日志在PublicComments开始后截断，真实首因仍未定位；596MB完整诊断超过连接器512MiB上限，公开备用下载返回404。现为四个UI运行组保存Node runner标准输出/错误，并保留pipefail错误退出，属于后续诊断补强，不能宣称已修复旧未知根因。41360300631 /36cc893目前运行中，checks及native已通过，后续终态独立核对。

## 空间维护与未完成范围

已核对T7真实挂载，内盘约55GiB、T7约607GiB可用；上批5份闲置安装日志24,372,591,788字节已完整迁至T7并逐文件核验，实测释放21.04GiB，原路径保留链接。当前UI构建期间不清理活动目录，回执`build/logs/cleanup-2026-11-02-nav-history-preflight.json`记录本次零内容删除。项目外不确定用途的个人文件优先保留内容迁移，不直接删除。仍保护最新两个有效阶段、未解决失败必要原证据和reverse-skill样本/scope/Evidence。

真实私人服务器、弱网/限流、实体机、签名/安装、大字号/VoiceOver、完整F15/S8、iOS27本批终态与全项目仍开放。不能以合成HTTP/模拟器PCM或未签名归档替代这些验收。
