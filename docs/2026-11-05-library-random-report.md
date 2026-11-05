# 音乐库随机播放清除单曲循环

本批修复音乐库歌单、收藏和最近播放共用的“随机播放”入口：此前只写入 `shuffle:true`，没有清除已经持久化的 `repeat:'one'`。当用户先在播放器队列选择“单曲”再回到音乐库点“随机播放”时，队列会同时显示随机与单曲，歌曲自然结束后仍重复当前曲，而不是随机前进。

## 修复

`src/ui/LibraryHome.tsx:63` 的随机播放动作现在一次写入 `{repeat:'off',shuffle:true}`，再调用既有 `playTracks` 权威队列。相似歌曲与发现页的随机入口已经采用同一两项写入方式；本批没有新增队列、播放器或偏好镜像，也没有改动播放全部、来源身份、历史记录或收藏边界。

“播放全部”保持原有行为，不额外改写随机/循环偏好；只有用户明确点击“随机播放”时才切换为顺序循环关闭加随机开启。

## 回归

正式 Release `build/SourceUITests-1793848700604.xcresult` 的 `testPlaylistSearchSortAndDuplicateRemoval` 为 1 通过 / 0 失败 / 0 跳过，210.308 秒，exit0，`sourceUnchanged=true`。运行目录为 `build/library-random-20261105-r7/`。

- source commit：`a8de627032559335ab2958eeaf31d5c77b75e156`
- source digest：`8f07df94c717c78aac32bd4bb3f2ef2dd46d082651cc6d1bd96321139f172739`
- 实际安装 bundle digest：`d2cc5b0e3890da064040b603990e80e7a7a24105a0b3ea17bec404b25b745d00`
- 服务计数：无鉴权失败、无异常请求；本用例不使用平台账号或私人服务

测试仍使用正式歌单导入、1000 首权威队列、播放器和队列组件：先执行“播放全部”，在完整队列选择“单曲”并确认选中；返回音乐库点击“随机播放”；再次打开完整队列，断言“随机”已选中、“单曲”未选中，并将队列模式恢复为“顺序”后才关闭，避免污染后续断言。测试随后继续执行原有长歌单加载、批量选择、排序、重复项移除、重启持久化和删除步骤。

关键截图 `build/library-random-20261105-r7/screenshots/library-random-disables-single-repeat.png` 为 1290×2796，SHA-256 `90c1ba98687473b3bf75ba6b3eb97f3789e6434aec6a5e25720520db931552f5`；人工亲看确认随机分段高亮、单曲分段未选中，队列标题与真实歌单队列可见。

失败诊断轮次均保留，未计入通过：`r2` 因未设置 `DEVELOPER_DIR` 在启动前退出；`r3` 使用了精确标题而非带“· 1000 首”的前缀匹配；`r4` 在队列转场期间直接点播放页收起；`r5`/`r6` 在父级队列与播放选项的滚动定位/覆盖层上过早操作。最终 `r7` 按既有 `reach` 双向滚动和真实导航顺序通过。

`npm run check` 本轮为 1025/1025，`git diff --check` 通过；这是模拟器 Release 回归，不替代真实 iOS 设备、自然曲尾长时播放、后台/锁屏或签名安装验收。

## Clean 归档

产品/测试/初始文档提交 `17246a2` 后，从 clean HEAD 重新构建 `build/distribution/NexusMusic.xcarchive`。manifest 与 HEAD 一致，`dirty=false`、`workingTreeChanges=[]`；unsigned IPA 为 `build/distribution/NexusMusic-unsigned.ipa`，17,859,667 字节，SHA-256 `eb9eb67d9f994701c81ff5054157b397b9a77a6b8d9fc157b5161122e8f56b13`。

独立核验脚本 `build/verify-library-random-clean-20261105.py` 生成 `build/library-random-clean-verification-20261105.json`，`ready=true`：ZIP CRC PASS，151 项 archive/IPA 文件逐字节一致，测试与私人标记排除 PASS，arm64、`iphoneos26.2`、iOS 15.1、设备族 `[1,2]` 且未签名。clean archive 构建日志为 `build/library-random-clean-archive-20261105.log`。

## T7 归档核验

完整 clean 产物、成功与失败 xcresult、UI 清单/截图、clean 提交源码 tar 和本回执已复制至：

`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-05-library-random-17246a2`

- 473 个业务普通文件，290,103,144 字节，逐项 SHA-256 与源文件比较 0 差异；`SHA256SUMS` 全量复核 PASS。
- 源码 tar 为 8,031,528 字节，SHA-256 `1fd228200d64e04bf5f501eedd29d4190935c4700ebc696640e0b5a41c43ba72`；未压缩内容与 clean 提交 `17246a2` 的 `git archive` 完全一致，1087 个 tracked 文件集合一致。
- 源 `NexusMusic.xcarchive` 中 102 个既有 AppleDouble 文件逐项一致、0 差异；exFAT 目标另生成 426 个 `._*` 元数据文件，单独计数，不计入业务载荷。
- `transfer-receipt.json` 为 `ready=true`、`mismatches=0`、`sourcePreserved=true`、`deleted=0`、`movedUserFiles=0`，SHA-256 `4d0389c62b77c0374abb0105669eaea1c743e8aa20557914874d809f7a63d7c5`。
- `inventory.json` SHA-256 `11b6bd0537105f3ab867e444d0c495be81fa5430ff860747da4846518827d3d1`；`SHA256SUMS` SHA-256 `ce285cbf1a702b90703525324be123c13a25e452f26bd81a6e295b7c0cb56387`。

恢复时按 `inventory.json` 的相同 source/target 相对路径取回；tracked 源码也可由 clean 提交和 `source/nexus-music-17246a2.tar.gz` 重建。本批未删除或移动任何源证据或个人文件。

## Push 与队列

产品提交 `17246a2` 与 docs 收尾提交 `e6e5668` 已正常 push；当次快照实核本地、`origin/main` 均为 `e6e5668402042d04d60a682af283561098e06550`。没有 force push，也没有重派旧版本。

GitHub Actions 公开页面与专用解析回执 `build/library-random-ci-queue-20261105.json`（SHA-256 `7ea452f619b5ff50a82cc4bd7438592bfd4c442ebf658c52b8af6edf44f148f7`）在快照时为：

- 运行中：`41949520533` / `a328ee66c7de693898d0f298aade101523a85598`，Run 311。
- 排队中：`41962294108` / `e6e5668402042d04d60a682af283561098e06550`，Run 314。
- 计数为 1 运行 / 1 排队；并发规则没有保留额外 pending，运行中任务未被取消。

`130bcd9` 的旧 `41957090823` 已按 `queue: single` 被后续提交替换为 cancelled，不把该取消运行算作通过。云端实际终态仍需在运行完成后另行核对，不由本批模拟器回归或 clean archive 推断。

## 边界

本批只关闭音乐库随机播放与单曲循环冲突的产品缺陷，不关闭完整F/J、云端 iOS27 终态、实体机、VoiceOver、弱网/限流、真实私人服务、签名或全部平台功能。没有新增 Sollin 证据、采集或私有探测。
