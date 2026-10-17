# Sollin 歌词舞台字符与时间分配证据

2026-10-17，普通移动逆向，flavor=null。沿前批独立舞台时间轴，补查分段阈值及均分时间算式。已确认字符计数调用和四字符比较；完整 flush、偏移字段来源及原生运行仍未恢复。音枢采用有界原创分组，不把该证据写成完整算法或视觉等价。

## 范围与复现

reverse-skill 固定 `cab634bd855fc287f6e420c1f36fd1a6b9245960`，macOS 原生路由 `work/master-route-20261017-230940/route-scope.md` → mobile-reverse。当前 `work/sollin-ipa/scope.md` 为用户授权本地样本、offline；case-guard与项目门禁通过，没有新增安装、服务或目标外连。

样本IPA SHA256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`；成员App.framework/App SHA256 `640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d`。索引Python3.12.14与cstool5.0.3解码限定原始字节；Blutter0039efb1/Dart3.12.2 no-analysis骨架只提供地址归属。表内为arm64 slice VA，__TEXT内VA等于slice偏移，FAT原始偏移另加0x4000。

加载 `scripts/environment.sh` 后先运行 `node scripts/sollin-reverse-gate.mjs ipa`。索引Python执行本机 `notes/stage-rules-probe.py`、`notes/stage-rules-evidence.py`；收据拒绝覆盖，重放应使用新输出名。更新WI-003和timeline后运行 `node scripts/sollin-reverse-gate.mjs ipa --review`。原始输出和字节不入Git。

## Evidence→Finding→Path

| 项目 | 证据与限制 |
| --- | --- |
| E-015 | `evidence/stage-rules-evidence.json`，SHA256 `b343a22e51b9098169cc9638a1a0e16d6c5a35ba9dc82bd62c1ed50a9a98c045`；原始BL、算术/阈值指令和解码输出摘要 |
| F-014 | info/design、candidate/high；字符计数/四字符阈值和均分算式约束原创设计，完整算法未恢复 |
| P-014 | E014时间轴→E015字符/阈值→时间算式→保留未知偏移→音枢既有契约；callflow |

严格review通过15E/14F/14P、7工作项/23事件、零错误/警告。timeline与证据记录中的观察时间已校正为本轮实际23:13:06；原始脚本收据保持不可变。

| 原始位置 | 可确认内容 |
| --- | --- |
| 0x69d3f8、0x69d6f8、0x69e578→0x184124 | StringCharacters.characters；后两条路径调用length0x2746fc，不把UTF16长度直接当grapheme |
| 0x69cc2c/78、0x69e824、0x69ea24 | 当前单位/累计短组与4比较；不能只据此推出整个舞台永远固定四字 |
| 0x69d430–440、0x69d4a4–4ac、0x69d504–51c | duration=end−start，除以数量，按index和index+1构造边界；具体运行舍入未实测 |
| 0x69d710、0x69d818–844 | length>4分支及2e80–9fff、20000–2ffff标量范围；分支极性保留原始输出，不据函数名推断最终保留/拆分策略 |
| 0x67e7e4–7ec | widget字段0x88转浮点后与当前进度相加；字段业务来源和偏移符号仍待 |

```mermaid
flowchart LR
  A[现有舞台时间轴证据] --> B[字符计数和短组阈值]
  B --> C[均分时间分支]
  C --> D[记录未知完整规则]
  D --> E[音枢原创分组与既有偏移契约]
  E --> F[独立App与构建验收]
```

图为可编辑职责图，不表示参考App已经运行。正式报告按 docs-generator、diagram-generator 使用源码图；原始工具只留本机，经验回写在当前case的field-journal，不改固定skill受控文件。没有向社区发送内容。

## 采纳边界

[0042](decisions/0042-bounded-lyric-stage.md)记录五参考、原生绘制与Android边界。音枢只使用真实单词时间，普通LRC保留整行，避免均分时间被误当作真实逐字。背景声专用舞台、完整转场/特效/排版、AM2、真实服务、签名、手机及其余A/F/J继续逐项验证。341项业务/类型属于音枢实现证据，不能反向证明参考算法正确或视觉等价。
