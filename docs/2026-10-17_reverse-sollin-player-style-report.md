# Sollin 播放样式选择静态关系与音枢 Sheet 报告

2026-10-17，普通移动逆向，flavor=null。固定IPA的限定原始ARM64指令确认样式选择的共用模态包装、八项标签与普通选择关闭分支。音枢据此原创调整已有六种布局的选择交互，保留全部实际播放器能力。未恢复完整参考渲染树、运行效果或持久化协议，不把静态标签当已实现布局。

## 范围、工具和复现

授权沿本机忽略案例`work/sollin-ipa/scope.md`，auth=granted、network=offline；不访问Sollin服务、不安装/签名/注入。reverse-skill固定cab634bd855fc287f6e420c1f36fd1a6b9245960；实际macOS路由`work/master-route-20261017-214002/route-scope.md` PRIMARY为mobile-reverse，项目预检及采纳前严格review通过。

IPA SHA256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`，App.framework/App SHA256 `640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d`。工具沿E-010容器界限：索引Python3.12.14、Capstone5.0.3，Blutter0039efb1/Dart3.12.2的NO_CODE_ANALYSIS骨架只用于对象和函数所有权；本批独立解码原始BL/ADD/LDR，非完整反编译。

本机复现：`source scripts/environment.sh`；`node scripts/sollin-reverse-gate.mjs ipa`；索引Python依次执行案例`notes/player-style-probe.py`和`notes/player-style-evidence.py`（固定本地样本/离线路径，重放收据另命名，拒绝覆盖不可变Evidence）；更新工作项/时间线后`node scripts/sollin-reverse-gate.mjs ipa --review`。原始地址为arm64 slice VA，__TEXT内VA=file offset；FAT成员起点另加0x4000。原始输出、样本、截图不提交。

## Evidence→Finding→Path

| ID | 可复核证据 | 限制 |
| --- | --- | --- |
| E-011 | evidence/player-style-evidence.json SHA256 `048a50b8b6565a90243993ae710d7cf8c06e095fa0ea6c82ba8c548a375c814d`；生成脚本与限定probe在案例notes | 独立字节解码与骨架归属核对，无动态执行 |
| F-010 | info/design/candidate，high；wrapper0x3a5ce4、build0x45fd00及普通选择尾部 | 普通选择分支之外存在鉴权/预览，商业行为排除 |
| P-010 | 共用模态→provider/八项标签→setter/pop→音枢六布局原子保存后关闭 | 不外推八套渲染器实现/保存耐久性/动画 |

`_showPlayerInterfaceStyleSheet`0x3a5ce4（size0x70）在0x3a5d38直接BL到0x330370，共用包装0x3306e0再BL到Flutter showModalBottomSheet0x3306f8。`_PlayerInterfaceStyleSheet.build`0x45fd00（size0x7b8，class4672）watch playerInterfaceStyleProvider槽0x2220，并迭代pp0x3f618的List<PlayerInterfaceStyle>(8)。限定分支处ADD/LDR独立解码为pp0x3f790…0x3f7c8八个标签：原始、经典、Apple Music、Apple Music 2、封面沉浸、声波核、写真歌词、歌词舞台。

普通callback尾部0x4609f4调用PlayerInterfaceStyleNotifier.setStyle0x460a24（app_providers.dart:1544骨架所有权），0x460a0c再调用Navigator.pop0x339464（navigator.dart:307）。这说明普通选择后关闭，不能推断写入落盘时机或完整运行时。`_PlayerLayerHost.build`0x32ee48的限定分派已由下方E-012补证；enum class6573与field_8不能直接当序列化名，深层渲染语义仍待。

```mermaid
flowchart LR
  A[样式入口 0x3a5ce4] --> B[共用包装 0x330370]
  B --> C[Flutter showModalBottomSheet]
  C --> D[style provider与八项标签]
  D --> E[普通分支 setStyle后pop]
  E --> F[音枢六布局 原子保存后关闭]
  F --> G[App交互和独立构建验证]
```

## 采纳、时间线及余项

[决策0040](decisions/0040-player-style-sheet.md)记录五参考逐项比较、许可/维护/Android边界和实现。没有复制参考源码/品牌/商业逻辑。主题与样式共用现有pageSheet基础设施，但选择关闭行为分别保持；保存失败留旧状态，重开session隔离迟到关闭。

案例WI-003、timeline和本机field-journal已更新，本批采纳前review为11E/10F/10P、7工作项/17事件、零错误/警告。331项业务/类型通过，最终App三项3/3、零失败/跳过，亲看最大字号截图；首轮分类行跳变已修正并保留失败，未放宽断言。Navidrome185.508秒属于摘要修正前的首轮通过证据。实际App详情及后续归档和云端结果分别见[BUILD_STATUS](BUILD_STATUS.md)。完整渲染映射、AM2/歌词舞台、动画/设备功耗、其余A03/A06–09、平台登录/真实推荐/FM/识曲、原生后台下载和完整迁移继续；真实服务/签名/手机不因模拟器或unsigned编译而完成。离线案例结论仅在本机/项目脱敏文档保存，未向社区发送内容。

## E-012 补充：宿主分派边界（未采纳额外布局）

新路由`work/master-route-20261017-220237/route-scope.md`仍为mobile-reverse；预检和严格review通过12E/11F/11P、7工作项/18事件，零错误/警告。不可变`evidence/player-host-evidence.json` SHA256 `11eb31891a5bab933da39650b54ce85bf172960610d1c7f8be3dd9a583ecb161`，脚本`notes/player-host-evidence.py`独立模拟已核CMP/B.GT决策并验证BL/分配头，与固定Dart class-id格式及骨架所有权核对。E-012→F-011→P-011为candidate/high，限定于host，不是完整渲染器恢复。

| 参考索引/标签 | host调用→分配 | class/布局参数 |
| --- | --- | --- |
| 0原始 / 1经典 | 0x32f1f4 / 0x32f2d0→0x32fa24 | 4620/_ClassicPlayerExpandLayer；原始另带OriginalPlayerSheet闭包，不能当两者等同 |
| 2 Apple Music | 0x32f3a0→0x32fa18 | 4588/AppleMusicPlayerLayer |
| 3 Apple Music 2 | 0x32f468→0x32f9e8 | 4587/AppleMusic2PlayerLayer |
| 4封面沉浸 / 5声波核 / 6写真歌词 / 7歌词舞台 | 0x32f558 / 0x32f65c / 0x32f768 / 0x32f864→0x32f9b8 | 4584/ImmersivePlayerLayer，分别注入ImmersivePlayerLayout0/1/2/3 |

host先处理商业激活/预览对effective style的变换，这部分明确排除；表格描述分派阶段输入索引。共用类不证明相同视觉、参数、歌词行为或动画；下一步追踪各renderer子树，现有音枢黑胶特有布局保留，AM2/歌词舞台继续待实现。没有将本表新增为产品选项。
