# 公开热搜与输入联想实施回执

搜索从“只有本机历史匹配”增加五平台热搜与四平台公开联想。热搜在输入/历史均空时出现；输入联想贴近输入框，同查询重新聚焦也可请求。词条点击替换查询并搜索当前类型/来源，不播放、不改权威队列。本机历史匹配保持独立；咪咕联想旧路由跳到首页，明确不支持，不用首页假装词条接口。

## 证据、范围与来源

原生路由work/master-route-20261029-search-suggestions命中R1/APK，PRIMARY与本机工具索引核对后，APK gate及--review通过。它们只证明离线基线前提；功能案例另做严格哈希review，395E/101F/99P、3工作项/124事件、0错误/警告。记录在build/search-suggestions-20261029/functional-review-final.md。

复用已审E-1258/E-1259/E-1260→F-073→P-071（清空/重启/热词搜索）、E-1297→F-095→P-093（键入联想/替换重搜），空态建议语义由E-1254→F-072→P-070支持。没有新增Sollin采集、分析结论、E/F/P或scope初始化，不增加既有证据计数；接口不归因于Sollin。

五参考固定HEAD均复核为REFERENCE_COMPARISON的既定值。定向亲读Q-1515 547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a的十份musicSdk/{wy,tx,kw,kg,mg}/{hotSearch,tipSearch}.js及kg/util.js的signatureParams，连同LICENSE共12文件逐字节匹配固定Git对象；摘要见build/search-suggestions-20261029/reference-files-final.json。Apache-2.0/LX/lyswhut归属保留。wtf的咪咕建议仍指向同一旧路由，Cy腾讯模块及悦音既有歌曲入口职责不冒称完整五平台联想；Wayferar保持既有恢复工程边界。不移植依赖、原生补丁或参考运行时。

网易热搜采用独立实测的官方weapi/search/hot，未照搬Q当前eapi路径；QQ采用HotkeyService而非年代久的旧gethotkey结果。酷我仅HTTPS；酷狗热搜每次生成临时mid并带匿名请求头/签名，不复制参考静态设备标识。咪咕热词使用HTTPS常规端口，排除带url的推广/深链项；酷狗同样不采用带跳转的词条。不执行响应内链接、脚本或商业动作。公开读词与账号、LX解析、Navidrome及播放器分别隔离。

## 实现与真实服务

SearchAssistanceProvider做成功码/结构校验、文本清理和去重，每平台最多20词；仅向固定官方HTTPS地址请求，credentials=omit且无账号Cookie。协调器把热搜/联想、来源切换、清除及卸载的代次与取消统一，单平台错误不覆盖其它结果，传输失败和真实空词列表分别显示。不可用能力不提供无效重试。输入等待300ms是音枢设计，不作为Sollin时序结论；页面提示键入时会向所选平台取建议，不批量上传历史。

最终公开请求一次实测：

| 来源 | 热搜词数 | love联想词数 |
|---|---:|---:|
| 网易云 | 10 | 4 |
| QQ音乐 | 20 | 4 |
| 酷我 | 20 | 10 |
| 酷狗 | 20 | 10 |
| 咪咕 | 16 | 明确不支持 |

这是当次真实响应，不是写死的数据或全部时间/词库覆盖。原始公开响应与最终读词摘要留忽略目录build/search-suggestions-20261029/；旧接口404、空结果、酷狗缺mid头、咪咕跳首页等探查均保留，没有把失败当成功或照搬静态标识。

857项检查通过（新增8项关键词契约、无凭据/匿名标识、取消/迟到、单平台失败与重试隔离等）；脚本语法检查通过。无新增原生模块、播放器后端或依赖。

## 正式UI验证

使用V261020批准实源沿用的完整Shape of You MP3，SHA256 be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203；生产index.ts、真实HTTP、默认blush+rose/封面取色、自有iPhone15ProMax模拟器430×932pt/@3x、iOS26.3.1。先核验原生PCM标签、3:53总长和进度推进，再暂停经正常导航进入搜索。

首轮A：SourceUITests-1793287847584.xcresult，67.608秒1/0。来源校验通过，但亲看输入只有l，reveal滚动已收起键盘；旧断言不足，不能拿这轮接受love+键盘。保留A产物与4图，不改写为完整通过。

最终B：SourceUITests-1793288279427.xcresult，66.726秒1通过/0失败/0跳过。逐字输入且显式断言完整love、建议含love、首条无需滚动可点及键盘存在；实际截图亲看四条love建议与键盘并存。同查询提交后重新聚焦、热词/联想点击替换重搜、清空历史重启后恢复热词、原曲/暂停/进度稳定全部通过。

最终证据目录build/search-assistance-live-20261029-b/，4PNG均ready/亲看；source digest 5f9b40c45118d793048e44ad1a574ae7cede9a873c5012071952551aa0883e65，源码前后/current、candidate.patch及原音频输入保持。manifest SHA256 15edc2f39419bd64a96713b4d611681dbb5cdfaf320630557cfc231c3b842e24；screens/index.json 680f268df8891dd4a9706940954844cf786be521b6bf43737b3e3d64d02971e2；B开跑前[场景记录](ui-spec/search-assistance-real-2026-10-29.md)原副本2aacecdb242e03c6979d2646a001ad695f0d629ceac82a95d8afcde66f3067ce。

B数据库19→19条，仅queue.cursor.v1、library.v1、playbackStats.v1因真实播放变化，其余16条摘要和两份原音频字节/SHA保持；历史最后恢复为空。A另有search.history.v1正常变化，不把19条数量保持写成全记录相同。四张最终图可见正常导航、热词编号、键盘与建议、原曲暂停，不报整页像素相似度或连续动效一致。

当前0有效签名身份，未做实体机安装/声音/签名验收。其余平台UI、空态/失败/重试真实操作、全部类型×来源矩阵、输入法/高速输入差异、咪咕联想及原F/J仍开放，不以9项HTTP或网易UI替代全范围。磁盘与隐私回执build/search-suggestions-20261029/retention-privacy.json，0删除，保留A的语义验收反例、B和最新阶段、在用DerivedData及未解决证据，reverse原始材料未动。

下一复核咪咕公开数据能否支持音枢自己的关键词建议及其它依赖满足的批次2余项；不等待或反复请求私人账号，不扩大Sollin采集。背景手势的云端iOS27结果仍按实际新提交验证，不能用本轮模拟器代替。
