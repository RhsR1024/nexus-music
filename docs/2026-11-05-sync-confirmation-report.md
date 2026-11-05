# 多设备同步确认与预览身份绑定

旧同步确认弹窗只保存冲突选择，确认时却提交服务当前的预览。弹窗打开期间回到前台会刷新预览，旧选择可能被用于用户没有确认过的新内容；同一冲突 ID 和新 ETag 仍可让上传通过。本批把弹窗绑定到打开时的预览对象与选择副本，旧确认在上传前拒绝，显示“合并预览已改变，请核对当前预览并重新确认”。

## 实现与复现

`CloudSync.confirm()`捕获当前`SyncPreview`及`{...choices}`；Alert回调把两者交给`WebDAVSync.commit()`。服务先比较预览对象身份，再解析冲突选择、进入提交和共享事务。预览被刷新、取消或替换时拒绝旧对象，保留当前预览供重新核对。不新增持久化字段、迁移、后台上传或第二音乐库；ETag与本机签名检查继续分别执行。

两个纯业务复现先在未修复产品上运行，均因“Missing expected rejection”失败：一项使用相同冲突 ID 的 Remote A→Remote B；另一项取消后重新读取相同内容。修复后均通过，并断言没有新增PUT、本机音乐库与基线不变、当前预览保留，且绑定新预览的确认能成功。全文件16项测试通过；完整`npm run check`为1030/1030，完整native退出0，Swift解析、Node语法和diff检查通过。

| 证据 | SHA-256 | 结论/路径 |
| --- | --- | --- |
| `build/logs/sync-confirmation-before-20261105.log` | `804f81b16fecd39355c0587ef930d20a48101ce42ee56f1a9ac76403a46bb41a` | 两项旧确认均未被拒绝，支持上述竞态 |
| `build/logs/sync-confirmation-after-20261105.log` | `99bd036559818f2f97dcb676763d78f9b8f2c2f8af7c0351d09f6ee6e9a6dd78` | 16项通过，拒绝旧身份且能重新确认 |
| `build/logs/sync-confirmation-check-20261105.log` | `c590cc7d95fa71f5ef8b258b3c3ae83c1ba0933e09a747f9d5aaa44cae1a3f84` | 1030项通过 |
| `build/logs/sync-confirmation-native-20261105.log` | `51bfcdb0fafaf187b1df72755f6af8b1f8c4ba434dc89b16c8b05945fd7c4e0d` | 原生条件请求/音频等回归通过，保留既有警告 |

从项目根复现：

```bash
source scripts/environment.sh
node --experimental-strip-types --test tests/webdav-sync.test.ts
export NODE_OPTIONS= PYTHONPATH=
NEXUS_UI_RUN_DIR=build/sync-confirmation-independent node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testUCloudSyncPreviewConflictRestartAndDeletion
```

运行目录须为新目录；正式证据不覆盖既有结果。

## 正式 App 验收

Release`build/SourceUITests-1793860542219.xcresult`的`testUCloudSyncPreviewConflictRestartAndDeletion`为1通过/0失败/0跳过、247.520秒，exit0、`sourceUnchanged=true`。真实设置/连接/建歌单/双侧冲突路径打开系统确认弹窗后按Home返回，fixture GET计数证明前台刷新已发生；原弹窗仍在，点击确认后准确错误出现，PUT计数不增加。随后保留本机改名、重新读取并选择云端、提交/重启/删除传播和移除测试连接全链通过。

- 基线：`2eb037f77c38e80f13790cf8b176e4770e211c43`。
- source digest：`929e3ffb508d11f9f946a632a4f0e852021ba80874c87bd562498424f785bf0b`。
- 安装bundle digest：`1791dc61e5cf5895a9a7a94092c69dc225ba8beb44a3086ad550eda2fe4d3cf2`。
- result Info SHA-256：`3ae9c3701ac12f2bbdb1621e86c4cc3470faf7eb1075b6e123dc0e2b837c8647`。
- run manifest SHA-256：`ec991f66090346a106e8e08f772b619a2708847ff76c1b0387566bf0dd177741`。
- 截图索引 SHA-256：`2feec8c8834a4e639176d4a510b211cab0025f928368554dc5b9db25cabb6c89`。

两张1290×2796截图均来源核验`ready=true`并亲看。旧确认拒绝图SHA-256`28ad8943e90ee65f3726f9b424b6f1fd53a5b09d817561f3375c075743593125`，三方冲突图`2a379e87b721a617c8697b7639dbec0dc3bfecbfa97213a9a83347573d041e9c`。当前预览仍含本机/云端版本，选择已清空且确认禁用，不把单纯React清空选择当根因修复。

## 清洁设备包与源码

产品提交`ca38b9f1f72c2801e63ab20f5ea1a8a44cc30502`已完成clean unsigned归档，位于`build/sync-confirmation-delivery-20261105/distribution/`。manifest为`dirty=false`、`workingTreeChanges=[]`、`signed=false`；arm64/iphoneos26.2/iOS15.1/[1,2]。独立检查ZIP CRC、90项ZIP/63份载荷逐字节、生产`previewChanged`标记、私人/测试标记排除及未签名状态均通过，`ready=true`。

- IPA：17,821,645字节，SHA-256`609e0ccaf414598ecd3e6ff75d8ae0872f64b234639898e3f90fc0a31a04607f`。
- manifest：`25afdb0b38aa7c78801e45f6643eb4155d8d15bb44a37cc3558e0cc02af2904c`。
- verification JSON：`265af3efb03e0c6c835950c0776e86d33b9c19cbc140c9d1620066bc857173e6`。
- 历史distribution符号链接已原样恢复，6个顶层文件哈希/字节/mtime保持；恢复回执`62c0b43a32effac508a052925dfba8668de8d98002832d3254c6ba0a0acc03f9`。
- 源码tar：`9dc0372e3034124d1d830d4e627f34024d697a9f450cc1f833d660af47c82807`；逐Git blob核对1,095个tracked条目，0差异。
- 完整提交补丁：`63f229afa2dbdaf2f487fb2bb654aad002b1641bcb1a57b95f9489239277b603`。

## T7 副本

外置阶段`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-05-sync-confirmation-ca38b9f`保存clean分发包/xcarchive、源码tar与补丁、独立核验脚本及回执、正式UI与xcresult、两图、五份检查日志、旧云端compact ZIP和报告快照。130份业务文件/105,236,040字节逐文件源/目标SHA-256一致，`ready=true`、0差异、源保留、零删除/个人文件迁移；清单SHA-256`7853617108c0c16bafc2f570970cc5363d7b638e64ba00f2864f39f5a259eeaf`。按清单相对路径恢复；产品源码也可从`ca38b9f`或tar/补丁重建。未复制本机DerivedData。

## Push 与云端队列

产品与clean交付文档已正常push，远端main实核为`69bfc2a13423d6f06eee3a7da1e0f3468d5fec86`。14:55（Asia/Shanghai）Actions网页显示`41973467272/258cac7`继续运行，`41983509535/69bfc2a`唯一排队，1运行/1排队；旧`41981102223/2eb037f`由队列自动替换，未手动取消/重派。新云端终态尚未取得。

## 边界与下一项

这是音枢自有F33事务确认修复，没有新Sollin分析、私有服务访问或参考代码采纳。私人WebDAV、实际双设备、长时并发、自动变更调度、实体机和签名仍待；F33/J54与项目不标记完成。

旧云端`41962294108/e6e5668`的compact日志已由GitHub connector取回，594,010字节，SHA-256`9631de0deee475268dbb9545feabfbd9e5519a5a251f7a392ab68b95edac2b23`，ZIP CRC通过。精确失败为歌单搜索排序用例在photo皮肤直接查找“查看播放队列”，当前AX只有写真操作开关，未显示该按钮；下一独立修复测试入口前置条件并重验，不混入本批产品修复，不将旧云端24/1改写为通过。
