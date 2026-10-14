# 音枢 NexusMusic

在线音乐与 Navidrome 私有曲库的统一播放器。iOS 优先，架构保留后续 Android 实现的可能。

仓库：<https://github.com/RhsR1024/nexus-music>

**当前状态：已进入实施。工程基线、队列/播放竞态核心与LX离线兼容探针已开始实现；尚无完整播放器、IPA或真机验收。**

## 从这里继续

先完整阅读 [HANDOFF.md](HANDOFF.md)，再按以下文档开展工作：

| 文档 | 内容 |
| --- | --- |
| [产品范围](docs/PRODUCT_SCOPE.md) | 已确认功能、排除项、待确认项和验收口径 |
| [技术决策](docs/TECH_DECISION.md) | SwiftUI/UIKit、Flutter、RN 对比及建议架构 |
| [数据与展示能力](docs/DATA_CAPABILITIES.md) | LX、漫途及 Navidrome 接口支持的信息与限制 |
| [Mac 开发环境](docs/MAC_ENVIRONMENT.md) | Intel MBP、Xcode、iOS 27 与远程构建路径 |
| [详细任务](docs/TASK_PLAN.md) | 当前优先级、阶段依赖与验收 |
| [参考比较](docs/REFERENCE_COMPARISON.md) | 功能移植前的实现、维护与Android成本比较 |
| [GitHub配置](docs/GITHUB_SETUP.md) | 本机SSH与阶段提交约定 |
| [构建指南](docs/BUILDING.md) | 本地启动、测试和iOS构建 |
| [LX进度](docs/LX_HOST_PROGRESS.md) | 原生JSC离线探针与完整宿主待办 |
| [实现计划](docs/IMPLEMENTATION_PLAN.md) | 验证关卡、分阶段交付和未完成清单 |
| [参考与证据](docs/REFERENCES.md) | 固定提交、关键文件和官方资料 |

## 当前约束

- 目标设备：iPhone 15 Pro Max，用户报告 iOS 27.0。
- 已核实开发设备：Intel MacBookPro15,1、16GB，macOS15.8.1、Xcode26.3；候选工程Release模拟器构建通过。
- 首期私有云只实现 Navidrome；先不做本地音乐管理。
- 不做汽水、ECARX、CarPlay、车机扫码上传和 Android/iOS 持续同步。
- 从漫途导出歌单后一次导入音枢；普通收藏与歌单管理保留。
- 推荐 React Native 新架构 + TypeScript，原生音频和脚本宿主；框架版本、播放器和构建环境仍须验证。
- 免费自签、尽量自动续签是使用目标，不是永久签名或零维护承诺。

本仓库未导入三个参考应用的源码或依赖，未决定本项目整体许可证。后续引用第三方实现时必须记录来源与适用许可。
