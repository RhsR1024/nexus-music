# Parse任务执行清单（2026-10-23）

用户要求继续全部parse任务。旧parse-completion工作树为detached3963c89，只有normalize.ts两个声明、lx.ts一个声明、playlistJSON.ts一个声明，均未接调用/测试，不能计完成或直接合入。该工作树保留，不覆盖。现按已有工作目标与实际调用链冻结以下执行项；相邻解析器作为回归范围，原项目总功能范围不因本表缩减。

|编号|实现与验收|代码/测试|当前状态|
|---|---|---|---|
|P1|空字段/坏rich格式逐级回退至另一rich或plain，保留可读文本；翻译/罗马音同样处理|lyrics/normalize.ts normalizeLyrics；lyrics/service.ts消费；lyric-normalize-fallback/lyric-service测试|代码/业务测试及合成服务App通过；真实来源/真机待，不计全部parse完成|
|P2|结构化offset/行词时间有限且合理；词间单调与所属行窗口、坏数据降级；最终展开行/总词预算、同起点行结束语义|normalize.ts structured；structured-lyrics.test.ts|待实施|
|P3|LX能力声明name/quality长度数量预算，已知动作授权/未知音质兼容、坏源隔离与宿主初始化|providers/lx.ts readLXCapabilities；nativeLXAdapter.ts；lx-adapter.test.ts|待实施|
|P4|LX v2五平台身份/元数据一致、KG复合ID、MID/数值ID区分、长整数/有限duration/质量预算、预览与入库同验证|storage/playlistJSON.ts lxTrack/decodePlaylistJSON；playlist-json.test.ts|待实施|
|P5|正式Files/LXMC→同parser→准确预览→取消零写入/确认原子导入→重启保身份顺序与重复项；失败原库保留|LibraryDataTools.tsx；library.importCollections；导入App测试|待实施|

每项分开记录实现、业务测试、实际App入口、真实来源/设备证据。P1/P2回归LRC/LX/YRC/KRC/QRC、TTML和XML预算；共享XML改动需回归WebDAV。P4/P5回归Wayfarer、backup、parseProviderJSON的长整数/小数/指数；汽水完整分页已有测试，无新失败不随手改动。漫途KG/MG扩展必须有实际导出格式依据，不从本表臆造格式；持续双向同步按既定范围不实施。Swift语法parse/打包不等于这些用户功能完成。

## P1 2026-10-23 本轮证据

normalizeLyrics逐级尝试非空格式，优先首个可用同步文档，再保留可读plain字段；坏优先格式可回退到另一rich/普通格式。无任何可读替代时仍抛原格式错误；可选翻译/罗马音坏格式不丢主歌词。保留全响应2MiB边界与结构化变体路径，不修改UI排版。

新增4项归一化测试与1项真实LyricService→SourceRegistry→缓存链测试；全量check450/450，日志build/logs/check-lyric-fallback-full-20261023.log。正式App合成响应将旧单lyric改为坏ttml+空lxlyric/lyric+有效lrc，文字与时间保持；testCrossPlatformLyrics使用真实导航/渲染验证，build/SourceUITests-1792693708921.xcresult终态待。该App若通过仅证明合成服务，不是平台在线服务或真机验收。

App首采SourceUITests-1792693708921为0/1/0：约22秒在选择wave皮肤后，openSettings调用waitForHittable读取正在消失的skins-sheet-close.frame失败；尚未执行歌词请求与断言。已参照既有样式切换用例增加明确waitForGone，保持后续断言不变，原xcresult/日志及failure-evidence保留；新采集另目录。

P1修复后App终态：SourceUITests-1792693943621，Release1通过/0失败/0跳过，sourceUnchanged=true。真实导航经过搜索/播放、舞台逐字组、歌词偏移/来源切换，保留原断言；Stage real timed group截图已导出亲看，字组可读，无本批新增布局问题。候选SHA256 9754f7478d013270fe81d8ec27f2cef6341252ea5ae059edcb68f5c284fc8e66，源码digest dc2a43647c9e6b18522d08bdba05a20fca50aae1390708a322211284455e1c7a，安装包digest cc918d3c23ddd474217c73edfeaf2048c8d8d99675ff36d21c2838b24b52eb17；manifest/导出索引在build/lyric-fallback-app-r2-20261023。P1合成入口通过，真实来源/设备仍待，P2–P5不因该通过完成。

P1代码2987f1f已正常push，清洁本地unsigned归档与包校验通过，详见[BUILD_STATUS](BUILD_STATUS.md)。云端iOS27最新pending，合成服务/本地构建不代替真实来源和设备。
