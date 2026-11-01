# 2026-11-02 评论作者身份字段增量

本批为 F31 只读评论补齐作者头像与可选地区，复用现有昵称、日期、点赞数和回复层级。网易云、QQ、酷狗支持响应中的地区字段；酷我与本次咪咕响应没有地区时不补造。头像失败显示作者首字符。三组 Release UI 通过，完整检查最终为 937/937；这只关闭本次字段增量，完整 F31、各平台真实服务矩阵、emoji 字形、签名、实体机和动效仍开放。

## 实施与边界

`commentFields.ts` 统一接受有界公开图片地址：HTTP/协议相对地址规范为 HTTPS，拒绝用户信息、控制字符与超长地址，去除 query/fragment；地区移除全部 C0/DEL 控制字符、合并空白并限制 80 字符。远程头像经既有 Cover 缓存加载，不借用歌曲私有凭据。缺失/加载失败走明确回退；需查询签名的图片可能回退，不承诺所有远程图都可显示。

五平台 parser 只读公开字段。复核修正 QQ 回复缺字段时借用根作者头像/地区的问题，回复身份只取回复对象，缺失保留回退；测试同时覆盖回复独立头像/地区及不能继承根身份。咪咕根评论和完整回复均接头像。正式 Sheet 根头像 36pt、回复 28pt，采用既有 spacing/type/radius，昵称/地域可换行，正文保留最小宽度。分页、失败留旧、回复取消和队列边界沿用。

## 证据与验证

Sollin 范围继续限定本机离线样本；路由回执 `work/master-route-20261102-001027/route-scope.md` 为 mobile-reverse。已有 `work/sollin-ipa/` scope、不可变 Evidence 与 timeline 保留；本次没有新采集或商业逻辑移植。Evidence **E-033 → Finding F-032 → Path P-032** 只支持固定 Sheet/分区/刷新与列表结构，不证明作者头像精确尺寸或像素。IPA/APK case-guard、gate 与 `--review` 均通过；IPA strict 为 52E/17WI/107事件/43F/43P，APK 为 3E/2WI/3事件/2F/2P，均 0错误/0警告。报告采用 docs-generator 的通用结构（flavor=null）。

| 验证 | 精确结果 | 边界 |
| --- | --- | --- |
| 最终完整检查 | `build/logs/check-comment-identities-final2-20261102.log`，937/937 | 含最终 QQ 归属修正、控制字符回归 |
| 真实匿名咪咕 Release UI | `SourceUITests-1793550076559.xcresult`，1/0/0 | 真实头像经截图亲看；测试 ID 断言本身只证明容器可达 |
| 合成咪咕 Release UI | `SourceUITests-1793550362635.xcresult`，1/0/0 | 缺图首字符、完整回复/错误保留/空态 |
| 合成网易云 Release UI | `SourceUITests-1793550639789.xcresult`，1/0/0 | 上海地区、首字符回退、横屏可读、刷新/分页 |

三组 UI 来源均 `sourceUnchanged=true`；真实咪咕当时源码摘要为 `a64da895793670b28fb8d8ee53e0c051599503f82ad57ae619e30b9b9951185c`。最终 QQ parser 归属修正发生在这些 UI 之后，由完整契约检查覆盖；没有将原 UI 源码摘要冒充最终全源码摘要。三个目录 manifest 与 PNG 保留在本机忽略目录，真实用户内容不入 Git：

- `build/migu-comments-identities-final-20261102/`：首屏 SHA-256 `cbcd63b2a25b78ad06115ea9f988016ec97198b30080a5772fc4070073af1933`；回复 `10a6007b119a32d87ccb1305ebf79a6afce41375bb460d43a25daa35dfc62877`。
- `build/migu-comments-identities-synthetic-final-20261102/`：回退 `c0ee6680b65000a3effcfe4249c553ff8630d936bc09c99685929bfc21d3480f`。
- `build/comments-identities-netease-final-20261102/`：地区 Sheet `bcde85c9eba5d2fe1875672b8352abe0f80c7dce2f10d0a225e58747ff9b6e00`。

真实匿名咪咕探针为 HTTP200、code000000、总数311、热门5/最新20、25/25合法头像字段；该响应没有地区字段。原始/解析文件仅在 `build/migu-comments-identities-check-20261102/`；真实地区能力未据此宣称通过。标准 emoji 缺字仍为已知模拟器限制。

复现完整检查：在仓库执行 `source scripts/environment.sh`，清空本机注入的 `NODE_OPTIONS`/`PYTHONPATH`，运行 `npm run check`。UI 精确运行及原 manifest 使用上述 xcresult，不使用 latest 覆盖旧证据。归档执行 `npm run ios:archive`；dirty 候选和提交后 clean 包分别记录，不以未签名归档替代实际播放或真机。

## 空间与交付

本轮初查内盘约29GiB、T7真实挂载且可写；T7已有 Xcode xip 解压进程继续保留，没有重启提取或改当前权威工具链。当前 DerivedData、模拟器、reverse-skill 样本/Evidence、未解决失败和最新两批有效产物均受保护。空间维护与最终归档摘要在本报告后续精确收尾补记。

云端检查时 `41314376539`/`69c9316` 运行中，`41321953872`/`53bc294` 为唯一 pending；保持运行中，不重派旧提交。`7dc8dc4`为 docs-only，无独立运行；最终本批代码云端结果仍需实际运行核验。规格见[评论身份场景](ui-spec/comments-identities-2026-11-01.md)。

## 2026-11-02 空间维护与提交前归档

无使用者的 CocoaPods 下载缓存完整归档至 `/Volumes/T7 Touch/NexusMusic/DeveloperArchive/2026-11-02-cocoapods-cache/CocoaPods.tar`，17,225条目、1,392,008,366文件内容字节。逐文件SHA-256、目录类型/权限/符号链接及源清单二次核对后回收内盘副本；T7保留全部内容，无个人文件删除。归档SHA-256 `9b2e10daac786b5c9e3126e2d3070fec06a0aba5ce42d3cf038d3bcccfe1b2a1`；恢复时在无pod install活动下将tar解到 `~/Library/Caches`，源旁 `CocoaPods.T7-archive.txt` 与 `build/logs/cleanup-20261102-cocoapods-cache.json` 保留回执。当前内盘约30GiB；同时设备构建仍有占用变化，不把df净差冒充缓存净释放量。当前工具链/模拟器/DerivedData/逆向证据未动。

提交前 dirty IPA SHA-256 `8fc7eb9a9a385fdd896cc0f837e07b3d3f7b75409d9b46b81d0bf1dd5b58d676`，arm64/iphoneos26.2/最低iOS15.1/[1,2]，未签名。完整归档日志 `build/logs/archive-comment-identities-precommit-20261102.log`；包验证回执 `build/logs/comments-identities-archive-verification-dirty-20261102.json`。源码与文档diff、私有资源排除在提交前复核，最终clean包另记。

## 提交与 clean 交付

功能提交 `d1928944593749975677afe838d17372249d821d` 已正常 push 并核对远端 main。提交后 clean IPA 为12,865,345字节、SHA-256 `8cfef1d0b3ae564ede6e7584566d2682cdb272d8aa6831c7209f20a945b8ceff`；manifest `dirty:false`/`workingTreeChanges:[]`，摘要 `cc7dcffa3b81aeace6c0104e1da2f6f03b5003adc1601b904a8f5d0f98137576`，arm64/iphoneos26.2/最低iOS15.1/[1,2]、unsigned。164项ZIP CRC、archive/IPA中JS/可执行/Info.plist字节、正式评论身份标记、测试/私有/签名材料排除均通过。原 dirty 包由内容哈希快照保留。

clean IPA、manifest、校验/证据索引和清理回执已复制到 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-comment-identities-clean-d192894/` 并逐文件核对SHA-256；本机 `build/distribution-history/8cfef1d0b3ae564ede6e7584566d2682cdb272d8aa6831c7209f20a945b8ceff/` 保留内容快照。机器回执为 `build/logs/comments-identities-archive-verification-clean-20261102.json`、`build/logs/cleanup-20261102-comment-identities-stage.json`。

产品 push 后实核云端 `41327658103`/`d192894` 为唯一pending，`41314376539`/`69c9316`仍运行，旧pending `41321953872` 自动取消。未手动取消/重派任何旧任务。再次IPA/APK strict review均0错误/0警告。本批云端实际终态、签名和实体机继续；clean包仅证明所列源码的本地设备SDK归档。

每日空间维护追加：无活动使用者、已确认可重建的 WorkBuddy BundleMigration 缓存（4,501条目、1,521,251,585文件内容字节）完整封存到 `/Volumes/T7 Touch/NexusMusic/DeveloperArchive/2026-11-02-workbuddy-migration-cache/`，逐项类型/权限/大小/SHA-256与符号链接核验后回收内盘副本；归档摘要 `8201e9ddec6c7a315892d5efd2f2d966feb492979f5eced6911e6523293d2b8c`，回执 `build/logs/cleanup-20261102-workbuddy-migration-cache.json`。内盘可用现约35GiB。项目外个人内容仍完整保留在T7，未直接删除；Xcode外置提取已于后续核验，未清理或当成当前权威工具链。

T7 上由既有进程执行的 Xcode_26.3_Universal.xip 解压已以退出码0结束，目标 `/Volumes/T7 Touch/NexusMusic/DeveloperToolchains/Xcode-26.3-20261102/Xcode.app` 占用 51,214,080 KiB。目标与当前权威工具链均为 Xcode 26.3/17C529；`Contents/Info.plist` 与 `version.plist` 的 SHA-256 分别同为 `efa845c252a042614fd125371903f6cace479d39cb0a6127d5598c8c2ff505bd`、`79504c54fc47124dbc5945b628d9c9071923a57c0cd109ff5afdd7884c1c889c`。没有把整个产物逐文件摘要冒充完成，且直接让 exFAT 副本执行 `xcodebuild -version` 未在限定观察内返回、已停止该只读探测；当前构建继续使用 `/Users/ningli/WorkSpace/Tools/Xcode/Xcode.app`，不更换 `xcode-select`，也不把外置副本称为已验证可直接运行。精确回执为 `build/logs/cleanup-20261102-xcode-extraction.json`。
