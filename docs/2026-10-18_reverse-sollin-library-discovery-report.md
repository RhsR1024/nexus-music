# Sollin 发现歌单与播放历史边界

2026-10-18，普通移动逆向，flavor=null；本批先建立静态证据，随后仅采纳原创历史日期分隔；完整发现/分页/参考运行仍待。reverse-skill固定cab634bd855fc287f6e420c1f36fd1a6b9245960，原生ipa-library-discovery路由R2/mobile-reverse，PRIMARY/索引/case-guard与项目门禁通过。授权仅本机离线样本，不运行目标或访问服务。

IPA SHA256 c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07；App.framework/App成员640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d。VA=slice偏移，FAT raw加0x4000。索引cstool5.0.3/Python限定解码，NO_CODE_ANALYSIS骨架仅作地址归属。notes/library-probe.py及library-evidence.py核对2033原始指令、15BL、5分配头和池偏移；不可变E022摘要a0a69e9757e0d613880df160bfca016e71c42850cb79fbcff07de43ecd40d693，观察2026-10-18T03:50:17+08:00。E022→F021 design/candidate/high→P021，WI008进行中。

| 地址 | 已证实及限制 |
| --- | --- |
| 3dfd94→3ba0c4→392d74；pool2cdf8、3ba16c | 歌单卡片→捕获闭包工厂→二级路由；工厂分配class4717详情，Navigator.of/push分别392d94/392e00 |
| 3a8174→3a8814 | 详情独立数量helper，pool3f1c0/2bf58/25818/3f1c8对应“已加载 / 首/首可用”；有简单/总量/可用分支，但精确字段与完整分页状态机仍待 |
| 3b39e8→3a8b68 | 另一回调进入loadAll；不等于已证明完整导入/失败恢复 |
| 3dfdf0→3bd52c、3dfea0→3bd720 | 发现失败块与清缓存重试分开；有效刷新/保留旧内容尚待 |
| 41d4ec、41d8a4/41d964 | 日期标记与历史行分别分配class1297/4290/4289；准确时区/日期分组规则不推断 |
| 41da84/41de9c/41ddf4 | 分别进入remove41da9c、clear41deb4、resolveAndPlay341270；确认对话/队列及运行效果另验 |

既有case-init误调用覆盖scope/workitems/timeline，恢复前严格review失败如实保留；全部36条原始完整事件及7条原工作项已从保留工具输出恢复，补回本批状态/事故后strict review22E/21F/21P、8WI/37事件零错误/警告，原始Evidence哈希不变。既有案例后续只case-guard，不再case-init。原始文件/恢复收据/journal均留忽略work/build目录，未进入产品或Git。

下一步比较五参考并独立审查音枢现有发现/详情/历史。不能凭静态名称扩展远端接口、登录态、完整分页或复制商业/品牌资产。真实服务、签名、手机及完整参考运行继续，全部A/F/J保留。报告遵循docs-generator普通逆向结构；本批无新增图形需求，核心映射已用表表达。

## 原创历史日期分隔验收

[0048](decisions/0048-history-calendar-sections.md)逐一比较五参考，保留音枢实际playedAt、原曲序/索引/稳定身份和权威播放入口；按本机日历增加相邻日期标题。精确参考时区/日期文案没有证据，不声称完整运行等价。352业务/类型通过，时区子进程覆盖跨年、午夜、闰日和夏令时两种变化；正式App1792267559956合成实音/PCM/八布局/歌词/统计/mini/凭据清理260.169秒通过，日期标题可达/重启保持和截图检查通过。鉴权8次成功/0失败，无新stream请求，允许已有音频缓存；不计真实服务或本次冷下载。

E022/F021/P021、WI008的采纳前review为38事件、验收后39事件，22E/21F/21P、8WI零错误/警告。范围沿本机work/sollin-ipa/scope.md；timeline、workitems与journal追加本地验收，不更改不可变Evidence。清洁归档/云端iOS27/真实服务/签名/手机继续独立记录。
