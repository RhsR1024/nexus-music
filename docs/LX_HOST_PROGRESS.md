# LX 宿主实现与验证边界

## 2026-10-15原生宿主增量（当前状态）

- `modules/nexus-native`本地Expo模块，Pods自动发现；每源独立JSContext/串行队列/临时URLSession/计时器，registry维护revision。bootstrap为Pod资源与Mac工具的单一来源。
- HTTP(S)、headers/body/form/formData、JSON/二进制、取消/超时；每源最多16个在途HTTP、响应8MiB上限、256个计时器；不共享App cookies/cache，错误不输出URL/原始脚本异常。
- CommonCrypto AES-128-CBC/PKCS7及AES-128-ECB/NoPadding；Security RSA无padding（PKCS1/SPKI）；MD5/安全随机/UTF8/Base64/hex/binary；系统zlib压缩/解压/gzip解压。
- SourceRegistry批量部分成功与版本隔离；MultiSourceResolver同档跨源后降档，保留原始档位传参。TS原生adapter按source/revision/requestID关联取消。来源/顺序持久化和管理UI尚未接入。
- `npm run check`：类型检查、35项测试通过。`npm run test:native`：24项字节/crypto/zlib与Node独立对照；真实Mac JSC→URLSession→本地HTTP验证表单/multipart/JSON/二进制/大小上限/超时/取消；同进程双context隔离、取消后继续请求、销毁/迟到初始化通过。
- Pods及iOS Release模拟器编译通过，包含NexusNative和bootstrap；安装/启动通过。尚未验收App内源管理和每个桥方法，不能将编译等同完整播放链路。
- `python3 scripts/probe-lx-native.py`使用真实HTTP/计时器初始化24份：23份成功，一份SCRIPT_TIMEOUT。报告build/logs/lx-native-initialization.json只含文件名/平台/安全状态，保持Git忽略。**23份初始化不表示23份可播放或全协议兼容。**
- 下一步：文件/URL导入、元信息/持久化/批量管理；真实五平台MusicInfo→musicUrl→单一播放后端；真实PCM频谱/EQ及锁屏下一首。剩余超时继续诊断，不默认判定脚本废弃。

限制：Buffer仍是字节子集；单次解析取消立即拒绝并忽略迟到结果，跨await的任意脚本HTTP无法可靠归属该Promise，不承诺中断其全部HTTP；脚本取消函数和源销毁实际终止网络，其他请求受超时限制。JSC不是系统沙箱，未用私有强制中断API，无限循环可能占用自身队列。Mac工具以隔离进程+25秒上限保护探针，不表示App具备强制CPU中断。真实iOS服务/后台/手机验收仍待进行。

实现原创，不复制第三方preload/加密代码；五项目比较与协议证据见[REFERENCE_COMPARISON](REFERENCE_COMPARISON.md)、[决策0001](decisions/0001-multi-source-routing.md)、[决策0002](decisions/0002-native-lx-host.md)。Android未来按相同transport契约替换原生实现。

## 首批离线基线历史记录

以下是此前离线探针记录，已实现内容以上方增量为准。测试资源保持在Git忽略的resource/V261008。

## 已实现 / 已验证

- 原创 bootstrap：mobile / 2.0.0 标识、EVENT_NAMES、初始化声明、请求监听、异步请求结果关联。
- HTTP 回调和取消的协议接口、定时回调和取消接口；二进制 buffer/hex/Base64/UTF8 操作接口。
- 仅在离线 Mac 探针中实现原生 MD5、随机字节和编码转换；没有接入真实HTTP、定时执行或生产生命周期管理。
- Node契约测试覆盖：独立上下文、重复初始化、取消后迟到HTTP响应、timer仅触发一次、非UTF8二进制与四字节UTF8、异步结果关联和错误消息去密。
- 24个本地脚本通过原生JSC逐个隔离执行；19个发出inited声明，5个没有声明。每个进程最多10秒，未请求任何脚本外部地址。
- Probe报告只保存文件名、平台声明、初始化/异常状态与未执行HTTP数量，不保存脚本内容、URL、密钥或原始异常。

运行 `npm run lx:probe`，结果为 `build/logs/lx-initialization.json`，该目录不提交。**19个声明初始化不等于19个完整兼容或可播放**；脚本声明额外平台也不改变本项目首期五平台范围。

## 待实现与真实验收

1. 将协议层接到iOS原生模块的独立串行队列，维护上下文generation，销毁后拒绝全部旧回调。
2. 原生URLSession HTTP方法/超时/headers/body/form/formData/JSON/二进制/取消；异步定时器；初始化/请求超时与失败分类。
3. 按实际脚本逐项补AES/RSA/zlib及需要的Buffer方法，并用确定性测试向量验收；当前明确抛出unsupported，不能用空字符串冒充加密成功。
4. 文件导入、脚本元信息、启用/停用/替换、源声明/动作/音质归一化、超出首期平台的过滤。
5. 五平台真实MusicInfo（保留meta/ID/音质字段）→musicUrl→单一原生后端→暂停/定位→后台下一首；以真实曲目证据记录，每个脚本/平台独立标注。
6. 初始化依赖网络或timer的5份脚本用真实原生桥复测，当前不猜测其失败原因或判定废弃。

宿主执行用户脚本不是一个已完备的安全沙箱；生产版仍须设计资源/超时/生命周期约束，不暴露App凭据或全局对象。Mac探针仅用于本次初始化研究。

## 三项目参考记录

没有复制原生实现、preload或业务逻辑代码，只据接口语义原创实现。

| 来源 / 固定提交 | 阅读证据 | 本项目采用的边界 |
| --- | --- | --- |
| CyMusic bf0d4694acb52973bcd594d31b3c61f655e166cb | modules/cymusic-native/ios/CyMusicUserApiRuntime.m | 独立JSC/串行队列/generation、native计时与工具桥；不能照搬tx固定解析或最新依赖图 |
| Q-1515 ios-adaptation 547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a | android/app/src/main/assets/script/user-api-preload.js；src/types/music.d.ts | EVENT_NAMES/inited/request/mobile协议与完整MusicInfo字段；不直接复制preload中的二进制转换 |
| 悦音 d6f1af7f911e84babce56cd07297b44cfe46eed9 | src/core/music/sources/joy.ts 390起 | 探测可用于定位，mock/new Function不能作为生产完整LX宿主 |

公开源码只读快照在本机 Tools/references（不属项目依赖）。如后续引用实现，另行记录适用许可证与文件修改，不宣告统一项目许可证。

最新增加的wtfdelphia及自有车机工程已纳入后续功能对照，见 [REFERENCE_COMPARISON.md](REFERENCE_COMPARISON.md)。当前表中的三份文件是本次离线实验最初读到的证据，不限制后续参考范围。
