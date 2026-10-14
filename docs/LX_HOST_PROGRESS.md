# LX 宿主实现与验证边界

首批代码采用独立 JavaScriptCore 兼容探针和原创建议宿主协议层；尚未接入应用原生模块。用户要求 LX 优先，测试资源保持在 Git 忽略的 resource/V261008。

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
