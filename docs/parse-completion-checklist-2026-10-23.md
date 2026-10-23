# Parse任务执行清单（2026-10-23）

用户要求继续全部parse任务。旧parse-completion工作树为detached3963c89，只有normalize.ts两个声明、lx.ts一个声明、playlistJSON.ts一个声明，均未接调用/测试，不能计完成或直接合入。该工作树保留，不覆盖。现按已有工作目标与实际调用链冻结以下执行项；相邻解析器作为回归范围，原项目总功能范围不因本表缩减。

|编号|实现与验收|代码/测试|当前状态|
|---|---|---|---|
|P1|空字段/坏rich格式逐级回退至另一rich或plain，保留可读文本；翻译/罗马音同样处理|lyrics/normalize.ts normalizeLyrics；lyrics/service.ts消费；lyric-normalize-fallback/lyric-service测试|代码/业务测试及合成服务App通过；真实来源/真机待，不计全部parse完成|
|P2|结构化offset/行词时间有限且合理；词间单调与所属行窗口、坏数据降级；最终展开行/总词预算、同起点行结束语义|structured.ts/normalize.ts；structured-lyrics/navidrome与activeLyric/stage测试|时序预算/声部与合成App通过；稀疏cue仍行级降级，真实服务/设备待|
|P3|LX能力声明name/quality长度数量预算，已知动作授权/未知音质兼容、坏源隔离与宿主初始化|providers/lx.ts readLXCapabilities；nativeLXAdapter.ts；lx-adapter.test.ts|已实施并通过业务/adapter→Registry/诊断边界测试；真实LX服务/真机待，见[P3回执](parse-lx-p3-2026-10-23.md)|
|P4|LX v2五平台身份/元数据一致、KG复合ID、MID/数值ID区分、长整数/有限duration/质量预算、预览与入库同验证|storage/playlistJSON.ts lxTrack/decodePlaylistJSON；playlist-json.test.ts|已实施，业务测试与全量check通过；真实LX导出/服务待，见[P4/P5回执](parse-p4-p5-2026-10-23.md)|
|P5|正式Files/LXMC→同parser→准确预览→取消零写入/确认原子导入→重启保身份顺序与重复项；失败原库保留|LibraryDataTools.tsx；library.importCollections；导入App测试|业务测试通过；正式App Files/LXMC合成夹具1/0/0通过；真实导出/真机/iOS27待，见[P4/P5回执](parse-p4-p5-2026-10-23.md)|

每项分开记录实现、业务测试、实际App入口、真实来源/设备证据。P1/P2回归LRC/LX/YRC/KRC/QRC、TTML和XML预算；共享XML改动需回归WebDAV。P4/P5回归Wayfarer、backup、parseProviderJSON的长整数/小数/指数；汽水完整分页已有测试，无新失败不随手改动。漫途KG/MG扩展必须有实际导出格式依据，不从本表臆造格式；持续双向同步按既定范围不实施。Swift语法parse/打包不等于这些用户功能完成。

## P1 2026-10-23 本轮证据

normalizeLyrics逐级尝试非空格式，优先首个可用同步文档，再保留可读plain字段；坏优先格式可回退到另一rich/普通格式。无任何可读替代时仍抛原格式错误；可选翻译/罗马音坏格式不丢主歌词。保留全响应2MiB边界与结构化变体路径，不修改UI排版。

新增4项归一化测试与1项真实LyricService→SourceRegistry→缓存链测试；全量check450/450，日志build/logs/check-lyric-fallback-full-20261023.log。正式App合成响应将旧单lyric改为坏ttml+空lxlyric/lyric+有效lrc，文字与时间保持；testCrossPlatformLyrics使用真实导航/渲染验证，build/SourceUITests-1792693708921.xcresult终态待。该App若通过仅证明合成服务，不是平台在线服务或真机验收。

App首采SourceUITests-1792693708921为0/1/0：约22秒在选择wave皮肤后，openSettings调用waitForHittable读取正在消失的skins-sheet-close.frame失败；尚未执行歌词请求与断言。已参照既有样式切换用例增加明确waitForGone，保持后续断言不变，原xcresult/日志及failure-evidence保留；新采集另目录。

P1修复后App终态：SourceUITests-1792693943621，Release1通过/0失败/0跳过，sourceUnchanged=true。真实导航经过搜索/播放、舞台逐字组、歌词偏移/来源切换，保留原断言；Stage real timed group截图已导出亲看，字组可读，无本批新增布局问题。候选SHA256 9754f7478d013270fe81d8ec27f2cef6341252ea5ae059edcb68f5c284fc8e66，源码digest dc2a43647c9e6b18522d08bdba05a20fca50aae1390708a322211284455e1c7a，安装包digest cc918d3c23ddd474217c73edfeaf2048c8d8d99675ff36d21c2838b24b52eb17；manifest/导出索引在build/lyric-fallback-app-r2-20261023。P1合成入口通过，真实来源/设备仍待，P2–P5不因该通过完成。

P1代码2987f1f已正常push，清洁本地unsigned归档与包校验通过，详见[BUILD_STATUS](BUILD_STATUS.md)。云端iOS27最新pending，合成服务/本地构建不代替真实来源和设备。

## P2 2026-10-23

有限时序、可选end推导、UTF8边界、错误增强回退、声部优先及10000/20000展开/全局预算已接线；Navidrome显式enhanced及legacy回退通过。check463/463，正式组件App r3 1/0/0，清洁归档已验证。精确来源、独立复核修复与末次类型保护见[P2回执](parse-structured-p2-2026-10-23.md)。稀疏cue虽保留时间，词动画未完成；一般LRC/TTML统一展开预算、P3–P5和真实设备仍待，不宣布全部parse完成。

## P3实施前调用链审计

实际入口services.ts的SourceRegistry→sourceCatalog.restoreEnabled/setManyEnabled→createNativeLX.initialize→readLXCapabilities，诊断也复用adapter。原生ScriptRuntime.event已有1MiB UTF8事件限制；TS当前直接JSON.parse，不能把它描述成原生无限制。Swift超时任务与脚本同queue，不声称可中断同步死循环。

下一批固定：五平台之外继续忽略；未知合法动作不授予，未知quality保留原值但不等于自动路由已支持；空quality数组仍允许lyric/pic源。预算先按原始数组数量检查再去重，名称缺省与显式坏类型分开；不截断/改写标识。声明坏平台使当前脚本整条声明失败，其他脚本由Registry隔离，不发布部分坏能力。建议以name256/action及quality128/数组64为待核定策略，不能称LX协议标准。TS初始化返回在parse前与原生1MiB UTF8边界一致，需兼容Hermes而非依赖Node Buffer。

验证须补真实adapter→parser→Registry组合：坏声明/超限源failed且匹配revision销毁，有效源ready并能request；多字节边界、重复洪泛、未知quality roundtrip和运行时未知action拒绝；诊断也不能绕过。上述仅审计/计划，P3仍未实施、不增加工程完成比例。

P3预算兼容性只读复核：本地V261008共24份脚本中，能静态识别的33处actions字面量数组最大4项/最长11个UTF16单元，20处qualitys最大4项/最长9单元；仍有变量数组和运行时拼装，不能外推24份动态兼容。Q1515固定547ccfe6的user-api-preload.js:153–168/319–327支持未知动作过滤，但其quality白名单不移植；CyMusic固定bf0d4694的脚本头name24是元信息策略，不是能力name标准。主代理已亲读Q1515这些行及本项目ScriptRuntime.swift:84–85的1MiB UTF8限制。因此256/128/64拟作为音枢本地预算，保持未知quality原值/顺序、缺省name回退平台、合法未知动作不授权、原数组先限后去重；尚未实施或执行新预算动态验证。

## P3 2026-10-23 实施结果

上述审计项已落地：`readLXInitialize` 在 parse 前按 UTF-8 字节校验 1MiB（Hermes 安全，不依赖 `Buffer`）；name 256、actions/qualitys 原始数组 64×128 先限后去重；未知动作不授权、未知 quality 保留原值但不扩展路由；空 qualitys 仍可用于 lyric/pic；坏声明使整脚本失败，Registry 按 revision 隔离销毁，诊断 adapter 同路径受预算。`tests/lx-adapter.test.ts` 8/8 覆盖 adapter→parser→Registry 隔离与诊断边界；`npm run check` 474/474、`npm run test:native` 通过。未做 24 份脚本逐份动态兼容、真实平台服务或真机验收，详见[P3回执](parse-lx-p3-2026-10-23.md)。

## P4/P5 2026-10-23 实施结果

P4 已实现五平台身份与元数据、kg 复合 `${songmid}_${hash}` 归一、tx `tx_` 前缀与 MID/长整数元数据分离、duration 有限且 ≤24h、qualitys 64×128 先限后去重且原始 metadata 保留；P5 用正式 Files 入口消费同一 `decodePlaylistJSON`，业务测试证明预览零写入、确认导入原子且保留身份/顺序/重复、重启恢复、失败保留旧库。App 用例 `testLXMCImportCancelAndRestart` 在模拟器 Files+合成 gzip LXMC 上 1/0/0，覆盖取消、追加导入、重启、删除。全量 check 480/480。真实 LX 导出文件、真实平台服务、云端 iOS 27 与真机仍未验收，详见[P4/P5回执](parse-p4-p5-2026-10-23.md)。

## 通用输出预算补齐

普通/逐字/TTML已补10000输出行与20000计时词全篇预算，多标签按展开后计；普通文本超限拒绝，不静默截尾。507/507检查通过，见[本批回执](parse-general-budget-2026-10-23.md)。历史“通用预算待”由本条更新；稀疏cue动画及真实来源/服务/签名/设备仍待，不宣布全部parse完成。
