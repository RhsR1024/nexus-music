# Parse任务执行清单（2026-10-23）

用户要求继续全部parse任务。旧parse-completion工作树为detached3963c89，只有normalize.ts两个声明、lx.ts一个声明、playlistJSON.ts一个声明，均未接调用/测试，不能计完成或直接合入。该工作树保留，不覆盖。现按已有工作目标与实际调用链冻结以下执行项；相邻解析器作为回归范围，原项目总功能范围不因本表缩减。

|编号|实现与验收|代码/测试|当前状态|
|---|---|---|---|
|P1|空字段/坏rich格式逐级回退至另一rich或plain，保留可读文本；翻译/罗马音同样处理|lyrics/normalize.ts normalizeLyrics；lyrics/service.ts消费；lyrics/structured-lyrics测试|待实施|
|P2|结构化offset/行词时间有限且合理；词间单调与所属行窗口、坏数据降级；最终展开行/总词预算、同起点行结束语义|normalize.ts structured；structured-lyrics.test.ts|待实施|
|P3|LX能力声明name/quality长度数量预算，已知动作授权/未知音质兼容、坏源隔离与宿主初始化|providers/lx.ts readLXCapabilities；nativeLXAdapter.ts；lx-adapter.test.ts|待实施|
|P4|LX v2五平台身份/元数据一致、KG复合ID、MID/数值ID区分、长整数/有限duration/质量预算、预览与入库同验证|storage/playlistJSON.ts lxTrack/decodePlaylistJSON；playlist-json.test.ts|待实施|
|P5|正式Files/LXMC→同parser→准确预览→取消零写入/确认原子导入→重启保身份顺序与重复项；失败原库保留|LibraryDataTools.tsx；library.importCollections；导入App测试|待实施|

每项分开记录实现、业务测试、实际App入口、真实来源/设备证据。P1/P2回归LRC/LX/YRC/KRC/QRC、TTML和XML预算；共享XML改动需回归WebDAV。P4/P5回归Wayfarer、backup、parseProviderJSON的长整数/小数/指数；汽水完整分页已有测试，无新失败不随手改动。漫途KG/MG扩展必须有实际导出格式依据，不从本表臆造格式；持续双向同步按既定范围不实施。Swift语法parse/打包不等于这些用户功能完成。
