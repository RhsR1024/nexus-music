# 汽水公开歌单：正式 App 导入、追加与重启回归

2026-11-01。F12/F13 增量把已有汽水公开歌单读取、原曲身份保留和“待匹配”展示接到正式音乐库组件，完成读取拒绝、取消与重试、两页完整预览、追加保存、歌单顺序/重复项校验及 App 重启持久化。不登录汽水，不使用汽水音频；写入后的条目继续通过其他平台匹配播放。

## 实现与边界

- `QishuiImport` 的入口、展开/收起、读取、取消、确认追加和消息区使用稳定标识；所有按钮最小高度为 44pt。
- 超长纯数字歌单 ID 以字符串传递，不经过 JavaScript 安全整数或有损转换。
- `QishuiProvider.complete` 在首轮请求被取消后仍可重新读取；第二页使用服务端 `next_cursor`，只有累计曲数与声明总数一致且分页终态完整时才发布预览。
- 追加继续调用正式 `LibraryStore.createPlaylist`。三项合成条目的原始顺序 `one, two, one`、重复项和独立 `imported/qishui` 身份均保留；音乐库行显示“Fixture artist · 汽水 · 待匹配”，没有静默替换为其他平台歌曲。
- 修复正式服务装配遗漏：`createServices(options)` 现在把注入的 HTTP client 传给 `QishuiProvider`，e2e 测试不会再绕过夹具访问真实外部网络。未传 client 的生产调用仍使用默认公开传输。
- UI 测试只创建并清理唯一的合成歌单 `Nexus Qishui Fixture 20261101`，不触碰用户歌单。

对应交互和布局场景见 [UI 规格](ui-spec/qishui-import-2026-11-01.md)。

## 已验证

- `node --check scripts/test-ui.mjs` 与 `git diff --check` 通过。
- `npm run check`：类型检查及 **931/931** 项测试通过，0 失败、0 取消、0 跳过。
- 最终合成 HTTP Release UI `SourceUITests-1793540640449.xcresult`：**1 通过 / 0 失败 / 0 跳过**，测试区间 259.133 秒。
- 第一次读取先被夹具挂起，测试实际看到“取消汽水读取”并取消；第二次读取重新从 `cursor=0` 开始，随后完整读取 `cursor=1`。服务计数为：

  - `beta-luna.douyin.com` 共 3 次请求；
  - 三次请求的歌单 ID 均为 `90071992547409931234`，`count` 均为 200；
  - 游标依次为 `0, 0, 1`，证明取消后重试没有续用已中止会话；
  - 夹具实际挂起并释放 1 个首请求。

- 保存后实际进入音乐库歌单，验证三行数量、`one/two/one` 顺序、重复行末位、待匹配文字与 44pt 可点区域；终止并重新启动 App 后再次验证同一内容。
- 运行前后产品源码摘要均为 `94fc477e16f50c99e44fe2dcb340aa0adc735d9955993aa89025cf6f7d5f7a64`，diff SHA-256 为 `0875d82903030dccb1a22df03336ff49d17ccd63a44bcc9e87f21f3eecdd289b`，`sourceUnchanged=true`。
- 精确 xcresult 的 `Info.plist` SHA-256 为 `ce121bab877601b8be7d065fc0cb9d0758209e27b01aa1fcaee97379d30a8754`。
- 5 张最终截图逐张亲看，分别覆盖超长数字 ID、读取中的取消入口、两页完整预览、保存成功及重启持久化。截图索引 SHA-256 为 `050dd9549c7eca2cb406e220c0bf6c8cbd09fd5e1a84497ab1df8381479ed809`。

最终运行目录为 `build/qishui-import-live-20261101-e/`：

| 文件 | SHA-256 |
| --- | --- |
| `run-manifest.json` | `1cb0b9618667eca0acab718ab195c6909b50b7a472b2e30a226a65c960065e06` |
| `run-manifest-provenance-recovered.json` | `b9bc96affbb14e7ea22fc565c1294c75392348b938c257afaf7e400a6cfeaa84` |
| `provenance-review.json` | `86a7965778490be71c2c8a9ba28d486e1ed0edab5775e2d457e443515906771b` |
| `screens/index.json` | `050dd9549c7eca2cb406e220c0bf6c8cbd09fd5e1a84497ab1df8381479ed809` |

原始 manifest 在测试结束时因 WorkBuddy 子进程没有完整 Xcode PATH、设备已经关机而把 `installedBundle` 记为 unavailable，因此直接对原文件运行 `verifyCaptureEvidence` 会失败。之后使用记录中的同一模拟器 UUID 启动原设备，未重新构建或安装，取得当前安装包快照并写入独立的 `run-manifest-provenance-recovered.json`；原始 manifest 保留且未覆盖。5/5 截图对该“事后恢复”manifest 均为 `ready=true`，回执明确标注了恢复方式。恢复后的安装包 digest 为 `95b0fe07481f34eb1927d4f48890864d7d54e3e742d89c0e6f21df72dc03ba39`，`main.jsbundle` 为 `b296f7751e65e8abe546d3a580083da7fb755dfe2d74310c8c8a4a7cc4e3c89c`。这项恢复不能冒充原次同步采集的已就绪 bundle 快照，后续正式 artifact 仍单独验收。

## 失败与根因

四轮失败结果及原始附件均保留，没有用最终成功覆盖：

1. `SourceUITests-1793539340798`：首次点击 `tab-library` 后选中态尚未生效，后续入口不可达。测试改为等待真实 `isSelected`，必要时第二次点击并再次确认。
2. `SourceUITests-1793539685857`：测试把“我的歌单”当作始终在首屏，实际它位于页面下方并向错误方向回弹。改为按真实元素位置上下拖动，只滚动到可点。
3. `SourceUITests-1793540034315`：取消按钮没有出现。根因不是 UI 缺失，而是 `createServices` 未把注入 HTTP client 传给 `QishuiProvider`，测试请求绕到真实网络。修复服务装配后，夹具可稳定挂起并验证取消。
4. `SourceUITests-1793540337686`：歌单歌曲行实际是带复合标签的 `Button`，测试按 `StaticText` 查询。改为检查按钮 label 的行数、顺序、Y 坐标和待匹配文字，保留真实可点击断言。

失败目录 `build/qishui-import-live-20261101-{a,b,c,d}`、对应 xcresult 与 `build/failure-evidence/` 是尚未完成清理回执的必要回归证据。

## 反向证据与未完成边界

本批是汽水产品功能回归，不新增 Sollin 逆向结论，也没有新增 Sollin 采集。沿用既有本机忽略案例：

- IPA gate 与严格 review 通过：52 Evidence / 17 Work items / 107 timeline / 43 Findings / 43 Paths，0 错误、0 警告；
- APK gate 与严格 review 通过：3 Evidence / 2 Work items / 3 timeline / 2 Findings / 2 Paths，0 错误、0 警告；
- Android 外置功能案例 case-guard 与 `--verify-hashes --strict` 通过：395 Evidence / 3 Work items / 125 timeline / 101 Findings / 99 Paths，0 错误、0 警告。

该合成 HTTP UI 证明正式 App 的分页、取消、保存和持久化链路，不是真实汽水服务在本次 App 测试中的返回；沿用产品既有真实匿名读取探测，但不能代替本批真实服务端到端。跨平台匹配后的实际音频播放、真实私有/可变歌单、超过两页和 20000 条上限、弱网/服务变化、Android、实体机、Apple 签名、录屏/动效与 iOS 27 云端终态仍分别待验。不将模拟器通过、未签名 IPA 或测试数写成完整 F12/F13 交付。

## 复现

```bash
source scripts/environment.sh
node --check scripts/test-ui.mjs
npm run check
git diff --check
node scripts/sollin-reverse-gate.mjs ipa --review
node scripts/sollin-reverse-gate.mjs apk --review
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testQishuiPublicPlaylistImport
```

每轮必须使用新的精确 xcresult、运行目录和截图导出目录；合成截图只留忽略目录，不提交。
