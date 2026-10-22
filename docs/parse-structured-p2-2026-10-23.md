# P2 结构化歌词时序与预算

本轮实现依据OpenSubsonic公开契约，不是Sollin私有服务或二进制推断：2026-10-23亲读[structuredLyrics](https://opensubsonic.netlify.app/docs/responses/structuredlyrics/)、[cueLine](https://opensubsonic.netlify.app/docs/responses/cueline/)、[cue](https://opensubsonic.netlify.app/docs/responses/cue/)与[endpoint implementation notes](https://opensubsonic.netlify.app/docs/endpoints/getlyricsbysongid/)，页面注明相关修订38d2d80/2c23506。协议字段语义独立实现，未复制第三方产品代码、账号或私有歌词。

- 拆出structured.ts：有限、非负、24小时内整数时序；offset为有限有界数字，正值提前。坏offset/基础行时间保留纯文本，坏增强数据回到parent combined line一次，不丢全文。
- end可全部存在或全部缺失；缺失时仅用下一cue、已知cueLine结束或下一parent边界推导，末个未知持续时间保留瞬时点。禁止同cueLine内重叠，跨声部可并行；UTF8字节边界严格校验，无Unicode重整。
- agents/id归属、main/voice/bg/group保留；primary/layerGroup使滚动/classic与stage在同parent主唱有效期间选主唱，主唱尚未进入时可选guest。背景onset不再作为主唱结束。普通无agent格式保留原选行规则。
- 合法未定时片段保留全文与timedCues稀疏时间/byte offsets，timingFallback=untimed_text；因现有原生完整words模型，界面实际走行级显示，不虚构未定时片段的词动画，也不声称新增可见降级原因提示。稀疏词的逐字动画仍为后续能力，不能记已完成。
- 全响应2MiB、最多16变体；每变体输入parent/cueLine各10000、最终展开10000（与stage上限一致），全变体累计输出行/处理词各20000、每cueLine最多2000词。超限明确失败，避免静默裁掉尾部。空顶层数组可读嵌套lyricsList。
- Navidrome正式请求enhanced=true；旧端点不支持时保留legacy getLyrics回退，认证错误继续拒绝。专用合成场景只在显式testStructuredNavidromeLyrics时启用正式组件初始化，分发/普通套件跳过该入口；CI step11增加独立调用与紧凑日志，不改变single队列或取消规则。

业务检查当前463/463，含optional end、坏类型/无穷值、乱序/重叠/越界、同起点、正反声部进入顺序与实际activeLyric/stage消费者、UTF8/emoji、官方重复词/未定时片段、10000/10001展开及跨变体行词预算、enhanced/legacy/auth边界。早期实现经过独立只读复核，原先允许重叠词、背景截断主唱、stage主唱顺序和输出预算不一致已修正；不将这些中间版计最终验收。

App前两次本地Release各1/0/0（SourceUITests-1792695074114、1792695486779），仅覆盖当时三行场景，不外推最终声部修正。最终r3增加Guest先入/Lead后入断言，SourceUITests-1792695740065.xcresult，Release1/0/0，三张功能截图已亲看；不作为页面相似度评分。真实Navidrome/OpenSubsonic服务器、真机/签名及稀疏词动画仍待；P3–P5继续开放。一般LRC/TTML等相邻解析器的展开预算继续作为后续统一核查，不因本次structured预算已接而宣布全部parse完成。

## r3精确来源与末次检查

sourceUnchanged=true，源码digest c76e5d986d945c88726d17ed0cc9e76269e0ff02e0a9522dd819b8238365c5a4，安装包digest d7f5934556161ec838ea6b33cecb971270a408d2981b750b4696629cf3ea3f80。manifest与export index位于build/structured-p2-app-r3-20261023。

- 001-Structured-later-main-replaces-guest.png SHA256 7668bff36125c1cdefb3c5b10af07fa30dd485c5ad942eea7b98253e1642b994。
- 002-Structured-invalid-words-readable-fallback.png SHA256 f6fe32592435201ff90796462fdd14d3db5b5221b362d95d8a0da53cb6f0882f。
- 003-Structured-start-only-timed-group.png SHA256 c7ace9299fd6a0d2d7122bfecc7e524c5e8844e788228fe5dd300fe495948e4e。

截图验证词高亮、坏词行级回退及Guest先入/Lead后入切换，不是同参考状态的UI对齐证据。r3后仅收紧agent.role为真正字符串，拒绝数组隐式转字符串；该末次类型保护经新增子场景和463/463全检查覆盖，不将r3冒称该类型分支的App测试。CI YAML/脚本语法通过。

6f2e413已正常push，清洁本地unsigned归档和包校验通过，见[BUILD_STATUS](BUILD_STATUS.md)；iOS27新任务仍pending，真实服务/签名/真机仍待。
