# 功能参考与移植决策规则

用户要求将以下项目保存在 `/Users/ningli/WorkSpace/ReferenceProject`，后续每项功能比较后再采纳。它们都是参考仓库，不作为音枢整体替换底座；没有安装这些仓库的依赖，也没有把其功能算作本项目完成。

## 固定源码基线

| 项目 / 本机目录 | 分支 / 提交 | 首要用途 |
| --- | --- | --- |
| 悦音 `joy-music-mobile` | master / d6f1af7f911e84babce56cd07297b44cfe46eed9 | iOS页面组织、发现/搜索provider、导入导出与主题 |
| Q-1515 `q1515-lx-music-mobile` | ios-adaptation / 547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a | 完整LX模型、宿主契约、原生音频/FLAC路径 |
| wtfdelphia `wtfdelphia-lx-music-mobile` | main / 6624ab58cbd2f5bda52ab8006912d3c60dc1f847 | 模块化iOS宿主、Rust加密边界、脚本回归/维护组织 |
| CyMusic `Cymusic` | main / bf0d4694acb52973bcd594d31b3c61f655e166cb | 独立JSC与生命周期、业务队列/播放意图、文件缓存与系统媒体控制 |
| 自有车机恢复项目 `Wayferar-Music` | main / 8e47cdc701cdbb772577b2bf7abb699e285b0fa6 | 既有用户行为与兼容需求的权威参考，尤其音源/队列/歌词/备份；不编译其反编译Java或将车机功能带入iOS |

不得只看默认分支README否定fork的iOS实现，也不得未经检查切到其他分支后沿用本表证据。需要新版本时记录新提交及差异，再跑音枢自己的回归。

## 已阅读源码的初步比较

下表是源码可见事实与工程判断，**不是五个项目实机性能比较或本项目最终选型**。

| 能力 | 事实与证据 | 初步采纳方向 / 仍要验证 |
| --- | --- | --- |
| LX原生宿主 | Q的JSC/串行队列/crypto较集中于ios/LxMusicMobile/AppDelegate.mm；wtf的ios/LxMusicMobile/Modules/UserApiModule.m独立，具备generation和preload事件通道；Cy为modules/cymusic-native/ios/CyMusicUserApiRuntime.m；悦音sources/joy.ts的new Function/mock属于探测 | 优先比较wtf/Cy的模块边界，用Q和自有旧工程校验完整契约；不把悦音探测器直接当生产宿主 |
| HTTP与后台下一首 | Q/wtf的src/core/init/userApi将request/response事件接到JS请求链；Cy宿主也有事件/生命周期设计 | 必须跟踪真正出站路径及锁屏行为；是否将HTTP放入原生URLSession须用实际脚本与十首锁屏测试验证 |
| 加密/编码 | wtf UserApiModule调用Rust lxcore C ABI；Q在原生代码中处理RSA/AES；Cy以native utils桥提供工具 | 对相同字节/模式/padding做黄金向量；Rust提高共享实现潜力但多一套构建工具，不能仅为复制功能立即引入。Buffer/Base64须含非UTF8和四字节UTF8测试 |
| 数据模型/provider | Q/wtf有LXMusicInfo/meta/qualitys等完整模型；悦音src/core/config/playlist.ts normalizeTrack保留部分字段但较简化；Cy存在平台适配与音质回退 | 统一模型保留平台原始ID、meta及实际档位；不整体照搬简化Track导致丢字段，也不固定tx平台。provider可移植部分先契约测试 |
| 播放器与队列 | Cy迁移到RNTP5.9.2并维护remote-control补丁与业务token；Q/wtf RN0.73依赖不同RNTP fork；悦音Expo54/expo-audio | 单独比较后台、FLAC、请求头、媒体事件、暂停竞态、维护/许可；只选一个后端，不把多个项目播放器叠加 |
| UI组织 | 悦音Library的来源/外观/缓存等分组，MiniPlayer将歌词加载与进度交互分开；Q/wtf现有导航体系不同；Cy使用Expo Router等较新栈 | 借鉴信息分组/触达路径，保留音枢的视觉与可选数据降级；不整屏复制或引入第二套导航/状态管理。首批界面仅工程空态 |
| 歌单持久化 | 悦音使用AsyncStorage持久化和归一化；旧漫途备份有来源、收藏、歌单与设置 | 本项目先定义版本化仓储、原子写入和重复曲序，不照搬忽略错误/字段的路径；真实漫途样本映射后置 |

## 维护与Android移植成本

| 项目 | 当前可见维护成本 | Android边界判断 |
| --- | --- | --- |
| 悦音 | Expo54/RN0.81.5与本机候选基线接近；仍要逐个核对原生库、长页面职责和临时adapter | TS数据/provider易共享；expo-audio等有跨平台实现，不能据此声称Android后台/媒体控制已满足音枢 |
| Q-1515 | RN0.73.11与新架构基线差距；AppDelegate承载多个模块，移植不能整文件覆盖 | 上游有Android协议资产；iOS自定义FLAC/DSP等需等价Android实现或明确能力差异 |
| wtfdelphia | RN0.73.11；iOS模块拆分、spec/回归和上游合并记录可供学习；Rust加密与fork依赖增加工具链成本 | Android仍有QuickJS等实现；文档说明Rust当前仅供iOS，不能宣称已双端共享加密库。复用前需逐字节双端对照 |
| CyMusic | Expo57/RN0.86.3；维护文档记录Xcode26.6和严格补丁，超出当前本机已验收基线；RNTP5另有独立许可 | TS与后端抽象有共享价值；iOS本地模块需要Android对应实现。新版本依赖不能未经构建证明直接复制 |
| 自有恢复工程 | 已阅读README与docs/BUILDING.md：正式入口tools/build_core_apk.ps1，app/src/main/smali为权威，Java为反编译参考；Windows构建工具链不能直接当作iOS工程 | 用作已有行为/测试向量基线；ECARX、Android文件路径、权限和后台服务不能直接搬到iOS |

“更易维护/移植”在这里是基于职责边界、依赖数量与版本差距的工程判断；实际成本要用最小移植和双端契约证据复核，不以星数或最新版本排名。

## 每项功能移植前必须留下的记录

1. 音枢需求/验收：对应F编号，输入、输出、错误与数据缺失行为。
2. 来源证据：候选仓库、固定提交、文件/符号；查清真实调用链，不只看README。
3. 对比：协议完整性、后台与竞态、数据保留、iOS版本/新架构、Android替代层、依赖/原生补丁和上游更新成本。
4. 来源与许可：自有代码/第三方代码区分，逐文件保留要求；悦音README与MIT文案并存需保留原信息，RNTP5不由Cy Apache许可覆盖。
5. 采纳结论：选择哪个模块、直接移植还是按契约重写、放弃其他候选的具体原因；不选“整个项目赢家”。
6. 实验证据：先黄金/契约测试，再本机Release构建、实际脚本/服务器和真机；记录未覆盖项。
7. 后续维护：固定版本、补丁位置、替换接口、回滚边界、升级后必跑的测试。

比较完成前允许推进独立领域接口与原创契约测试；涉及生产播放器、宿主加密或大块第三方实现时，先写该功能决策记录再移植。

## 当前已经做出的决定

- Expo54/RN0.81仅为已通过本机构建的工程候选基线，不自动决定播放器或音源引擎。
- PlaybackBackend、MediaResolver、MetadataProvider、ScriptHost各自分离；队列与播放意图只有一个权威。
- LX bootstrap/Swift宿主为原创实现，没有复制上述native模块；生产桥与AES/RSA/zlib采用系统框架，逐字节测试通过；App导入/真实曲目播放待验收，见决策0002及LX_HOST_PROGRESS。
- 最新功能优先级：LX→核心播放→Navidrome→在线/UI/歌词缓存；漫途导入后置。

2026-10-15：五个参考仓库均已通过本地Git取得。Wayferar-Music为SSH部分克隆，当前稀疏检出README、docs及app/src/main/assets/script；未检出根目录大型APK。工作树干净，后续按具体功能补取对应Smali/importer源码及测试，不把“已取得参考仓库”当作已完成逐项比较或运行验收。

歌词/缓存/LX导入收尾按[决策0008](decisions/0008-lyrics-fonts-cache.md)复核五项目：Q/wtf保留实际字时间、压缩容器和LXMC结构；悦音提供普通LRC与库交互，Cy缓存抽象但不引入其RNTP/新框架，Wayferar保序与数据边界继续采用。QRC仅协议常量适配并注明Apache来源，原生有界执行；其余解析/仓储/缓存原创。分类收尾按[决策0009](decisions/0009-discovery-playlist-import.md)：KW必须保留43/10000的不同协议，MG分类与推荐模板不同，不能用返回空数组掩盖未识别字段。TS可用于Android，QRC/图片缓存等原生接口需对应实现。
