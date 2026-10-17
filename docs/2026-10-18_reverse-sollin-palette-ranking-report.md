# Sollin 全局背景三色取样、加权与回退

全局背景的createScene以命名count参数请求3色；共享helper的默认5色不能当作全局有效值。取样使用24×24、24色相桶、饱和度与亮度权重；低饱和图改按相对亮度分位取样。原始间接调用现由离线恢复的分派表定位到Color.computeLuminance。此次只恢复有限算法与元数据，没有执行Sollin、测量原始GPU采样/场景/帧率或请求私有服务。普通逆向flavor=null。

## Scope、工具与证据

固定skill/样本及离线scope见[强制工作流](REVERSE_SKILL_WORKFLOW.md)。新路由work/master-route-20261018-055157为R2/mobile-reverse；既有work/sollin-ipa/scope.md的auth=granted、offline、ready=true和case-guard保持，不重新初始化。IPA SHA256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`，App成员SHA256 `640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d`。导入/依赖沿E001/E002；Dart3.12.2/固定格式及NO_CODE_ANALYSIS限制见[IPA分析](SOLLIN_IPA_ANALYSIS.md)。

| 记录 | 可复现证据与有限结论 |
| --- | --- |
| E025 | work/sollin-ipa/evidence/palette-detail-evidence.json，SHA256 `bbbe9b6ca141522143d1f24be98aa95b76f39c70d3c26f0bca1599e61b43946c`；2307原始ARM64指令、9BL、12池条目，独立核验11组加载。notes/palette-detail-evidence.py创建不可变收据，build/verify-palette-detail-evidence.py独立重放，不覆盖旧Evidence。 |
| F024 | candidate/high，仅针对palette0x4a8034、HSV0x4a9050、分离0x4a9d54、桶排序0x4a9dd8、灰阶排序0x4a9e80与亮度0x90b814的已核算法。 |
| P024 | 全局count3 → RGB/HSV/加权桶 → 低饱和分位或色相分离 → 原创原生实现及独立验收；每步关联E025/F024。 |

采纳前strict review25E/24F/24P、8WI/49事件零错误/警告；独立日志reverse-palette-detail-independent.log。时间线和工作项、case-local field-journal已更新。原字节/解包/工具/索引和解析输出只留本机忽略目录。

## 恢复规则

- 全局调用0x4b4794传入tagged6，经helper参数Smi解码为3；缺省路径0x4a8084为5。不是从字符串或截图猜测数量。
- 每4字节读取前三字节作为RGB，按255归一化并构造alpha=1的Color；没有在像素循环读取第4字节或做alpha阈值过滤。传入Image.toByteData的枚举索引为0，与官方首项rawRgba契约一致；官方定义为预乘alpha的RGBA，不能据此宣称参考实际GPU字节已观测。[Flutter格式契约](https://api.flutter.dev/flutter/dart-ui/ImageByteFormat.html)
- HSV字段依次为h/s/v。权重为`s × (0.25 + 0.75 × clamp(1 − abs(v − 0.55) / 0.55, 0, 1))`。桶编号为`floor(h / 360 × 24) % 24`；每桶累加权重，代表色只在当前像素权重严格更大时替换，不取RGB平均。
- 若图中最大s小于0.08，像素颜色按相对亮度升序排序，在`floor((i + 0.5) / count × N)`处取样并限制索引范围。比较器确认为Color.computeLuminance，其原始末段及池常量支持线性RGB的0.2126/0.7152/0.0722权重；官方实现仅作契约交叉核对。[Flutter相对亮度契约](https://api.flutter.dev/flutter/dart-ui/Color/computeLuminance.html)
- 其他图按桶总权重降序，跳过无代表或非正分数的桶；候选与所有已选色的环形色相距离需至少40°，40°等号可通过。不足3色时循环补齐最初选出的颜色；空选择有原像素列表中点回退。高饱和正常输入下空选择是否实际可达，未声称动态验证。
- 原始24桶比较器与固定Dart SDK的32阈值插入排序相符，排序相等时没有主动打乱桶序；灰阶大列表等亮度色的精确并列次序仍不作等价保证。音枢可明确定义稳定并列策略，不能将其标为参考运行结果。[固定Dart排序源码](https://raw.githubusercontent.com/dart-lang/sdk/d684a576a6aa954ae107a03b2b4e1d61c3bebe93/sdk/lib/internal/sort.dart)

## 间接调用与工具复核

独立目录Tools/Reverse/source/blutter-dispatch-review复用已批准的固定Blutter与DartVM依赖，仅增加恢复后全局分派表导出；不覆盖原索引解析器。新工具SHA256 `eb75aff088091002b957ac4af22f03b33007f6982cf311a5da26e315f4e7a3f8`，help和deny-network离线解析通过。首轮配置遗漏原构建已有的NO_METHOD_EXTRACTOR_STUB/UNIFORM_INTEGER_ACCESS而失败，按原CMakeCache恢复后构建通过；原失败与链接最低macOS版本警告保留，本机15.8.1上验证CLI，不代表可分发工具。

Color分配头解出cid2695，原始比较器选择偏移−0xfbe，固定ARM64 ABI原点4096，得到表索引2761，条目为0x90b814/Color.computeLuminance。它证明恢复元数据中的静态分派，不能称目标真实调用已发生。73320条函数地址/名称记录保持；完整pp/objs/addNames在明确归一化对象ASLR、映射代码ASLR与具名host-native地址后相等。首次原字节相等断言因ASLR失败，未篡改原始输出或宣称原字节一致。

## 原创实施与剩余验证

采纳取色行为前的五参考比较和维护/Android/许可取舍见[0053](decisions/0053-three-color-flow-palette.md)。音枢原创增加独立24×24原生三色接口、共享缓存预算/迟到隔离及有界三色渐变；既有单色主色、私人图片/凭据边界及唯一播放器保留。366业务/类型及完整native通过，包括独立RGBA数值、实际三色/透明PNG、文件边界、跨曲目/拒图/清理和432组三色明暗组合文字对比度。首轮测试的Swift抛错autoclosure及未启动播放便发进度事件错误已修正，失败日志保留。正式iOS首轮编译因灰阶长表达式推断超时、0测试；拆分后原生专项及iOS编译通过。第二轮App265.536秒停在新增三色步骤前的音乐库子页导航，AX层级确认本地页，测试补显式私人页导航后重跑；均保留失败日志。稀疏数组拒绝补齐后366业务/类型复验通过。第三轮289.932秒失败于固定红→蓝排序假设，录屏已亲看蓝/红/绿三处不同色相；原有CoverCache JPEG重编码使等宽PNG权重不再相等。补真实JPEG三色集合原生专项通过，App升级为三处同时覆盖红/绿/蓝的排序无关断言，第四轮1792276291425在约300秒清理阶段中断，xcresult缺Info.plist且无终态，未计通过；partial日志与第三轮旧摘要/计数分开留存。第五轮1792277163729最终完整通过，见下文。

图像插值/颜色空间、soft-light、场景shader/连续变换、真实封面、功耗、签名及真机均不由本收据证明。

## 最终本地验收

正式入口SourceUITests-1792277163729完整背景专项329.540秒通过，1/0/0；两页实际三色像素、原红蓝跨页/开关/重启、经典页PCM、Home→激活、收起/暂停及开关恢复/凭据清理通过，截图已亲看。build/logs/ui-flow-palette-passed.log、-summary.json、-counts.json与build/flow-palette-passed留存。12次合成鉴权成功/0失败，无新增stream，本轮使用既有临时音频缓存，不计真实私人服务或冷下载。366业务/类型、完整native及JPEG专项通过；清洁归档/push/对应iOS27继续。第四轮partial无终态不算通过，后续成功不改写历史失败；原始E025不变。完整场景/功耗、参考运行与真实服务/签名/手机另验。
