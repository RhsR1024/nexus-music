# 2026-11-02 顺序 TTML App 验证与歌词手势修复

有效 `timeContainer="seq"` 歌词已从合成在线响应进入正式解析、歌词优选、原生绘制和播放定位路径。验证时发现全部歌词展开层实际双击没有定位；现复用既有 UIKit 歌词手势容器修复全部歌词、舞台活动组及经典歌词行。单击保持进度，双击定位，长按经典歌词打开设置，暂停意图保持。

本批是原创歌词功能的回归和既有交互缺陷修复，未增加 Sollin 逆向或采纳结论，不伪报新 strict review。功能/范围沿用决策0015、0043、0076和[0077](decisions/0077-native-lyric-double-tap.md)。无参考代码、依赖或原生识别器改动，仍使用一个权威音乐队列。真实TTML库、实体机、VoiceOver实际操作、签名及iOS27终态仍开放。

## 缺陷与修复证据

| 证据 | 发现 | 修复与验证路径 |
| --- | --- | --- |
| R1 `SourceUITests-1793589469451`，Info SHA-256 `a1aa6cb0…`，失败导出索引 `456b6031…` | 搜索结果准备阶段失败；AX历史出现截断查询，尚未请求歌词。不能归为TTML解析失败或声称已证实RN内部机制 | 搜索改为逐字符输入，提交前后断言完整查询；后续R2/R3及回退用例实际到达歌词 |
| R2 `SourceUITests-1793589888184`，Info `8d8c76d6…`，失败导出索引 `0c5ba0d7…` | 已取得有效seq TTML、第二段控件存在，实际双击后仍为`0:17 / 2:00`，未到`0:30 / 2:00`；展开层仍走JS Pressable两次点击守卫，区别于既有原生路径 | 全部歌词、舞台活动组和经典行复用原生`LyricGesture`；UIKit双击事件继续进入既有seek守卫、偏移和播放控制器 |
| R3 `SourceUITests-1793590412749`，Info `e725704a…` | 1通过/0失败/0跳过，176.862秒；有效seq优选、派生第二段30秒定位和三种界面手势通过 | 正常搜索→播放→跨平台歌词→舞台→经典→全部歌词；原有来源选择/保存/重启/恢复与夹具清理断言保留 |
| 回退 `SourceUITests-1793590732249`，Info `c8375f1a…` | 1/0/0，157.240秒；坏TTML继续采用富LRC，原跨平台行为通过 | 独立显式目标与响应，未用有效seq夹具替换原回退覆盖 |

R3响应的首段持续30秒、内含顺序跨度0–500ms与500–30000ms；第二段没有显式begin，时间由顺序容器派生。LRC备用文本特意不同，测试断言没有选中它，并实际定位到30秒，因此不是仅验证同名文本。R3歌词请求计数`wy=2 / tx=4 / ttmlSeq=2`；回退`wy=2 / tx=4`且无ttmlSeq。显式seq目标禁止与其他目标合跑，未实际请求该夹具时runner失败。

R3验证舞台单击保持位置、双击回0；全部歌词单击保持位置、第二段双击到30秒；经典单击保持30秒、双击回0、长按展开，始终暂停。不是连续手势动效一致性、滚动性能或真机验收。R1/R2完整xcresult、原附件、日志与manifest保留，失败不转换为通过。

## 构建与截图来源

两轮均为正式组件的Release构建、iPhone15ProMax / iOS26.3.1 x86_64模拟器、SDK26.2，`exitCode=0 / sourceUnchanged=true`。合成HTTP数据只通过`tests/e2e/entry.tsx`注入，分发入口仍为`index.ts`。

- 源码digest：`2beaae4b36ac828f62ddb937b178e1b11cca0077f9a951e2e6aa0fdfbc618038`。
- 捕获补丁SHA-256：`4d05bef5afb138495910f98bdf864358cd86f9aaa2205869f4a3d4852966f304`，完整补丁保存在R3目录。
- fixture SHA-256：`58b48953521ea0c7d6a2737de2b31d92342ec5115e39255c9bfe7dade577b07c`。
- 安装bundle digest：`f07d3c48fd975029e318febbbc274acff1233f27b3dd55b992d0fe80672af113`；JS：`289546e9faa57754778bc2e0bec41dc551c4df7dfa6419bb837ae4ebef515e92`。
- R3 manifest/index：`651af826…` / `b3b8e8a7…`；回退manifest/index：`fddb1f6f…` / `7340f504…`。

3+2张PNG通过`verifyCaptureEvidence`且逐张亲看，分别保存在`build/ttml-seq-valid-app-20261102-r3/`和`build/ttml-seq-fallback-app-20261102-r1/`。30秒图显示第二段高亮、进度30秒且暂停；舞台保留真实逐字组，手动来源图保留原歌词和同一音频。本批不宣称整页像素/材质或参考动效对齐。

`npm run check` **973/973、0失败**；Node语法、Swift parse、workflow YAML及diff检查通过。原生识别器未变，最终UI和设备归档实际编译通过。两轮捕获后仅补正runner的manifest退出状态：未请求seq夹具时记录有效失败状态；成功路径结果不变。`ttml-seq-e2e-capture-to-commit.json`确认产品、native及XCTest全部输入哈希与捕获一致，仅该runner元数据行变化，不将捕获伪写为之后的新源码digest。

复现需已配置项目工具链和模拟器，从仓库根执行：

```bash
source /Users/ningli/WorkSpace/Tools/env.sh
export NODE_OPTIONS= PYTHONPATH=
npm run check
NEXUS_UI_RUN_DIR="build/ttml-seq-repro-$(date +%s)" \
  node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testSequentialTTMLLyrics
NEXUS_UI_RUN_DIR="build/ttml-fallback-repro-$(date +%s)" \
  node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testCrossPlatformLyrics
```

## 清洁IPA、T7与空间

功能提交`a66a230`的clean unsigned IPA为 **12,889,094字节**，SHA-256 **`45decc82011501cc7122e88b5dde85c2d8e987d19b68ad0aed5c9c30fcc5f4f5`**。manifest对应提交、dirty=false、workingTreeChanges=[]；arm64 / iphoneos26.2 / iOS15.1 / [1,2] / com.nexusmusic.app。164项ZIP CRC和138项archive/IPA文件逐项字节一致，未签名、无描述文件。

生产seq解析器标记存在；夹具秘密、私人URL/token、测试adapter、seq备用文本/测试名、私人资源路径及签名材料排除通过。既有绝对构建路径元数据仍存在，不声明所有路径已剥离。完整验证为`build/logs/ttml-seq-e2e-archive-verification.json`，验证脚本同时保留。

T7真实挂载与写读探针通过。阶段`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-ttml-seq-e2e-45decc82/`包含 **480份、142,133,067字节**，逐文件SHA-256一致；包含IPA/manifest/检查、两次失败原证据和两轮通过xcresult/截图/来源。`copy-receipt.json`记录源/目标、字节、哈希及恢复路径，源原件保留；最新两个有效阶段45decc82与240ea23a保留。

收尾无活动构建；内盘可用约 **53.39GiB**，T7约 **606.29GiB**。`build/logs/cleanup-2026-11-02-ttml-seq-e2e.json`记录占用、保留范围与零删除/零移动决定。本批未迁移或删除个人文件，不重复计算此前22.70GiB安装日志迁移收益。用途不确定个人文件按用户授权优先完整迁到已挂载可写T7并保留逐文件核验与恢复记录；活动缓存、工具链及reverse证据继续保护。

## 云端与后续

提交前远端main实读为`df95a37`；2026-11-02 03:46Z核对iOS27为`41378728355`/`2abb0b6`运行、`41381592614`/`38af8c4`唯一pending，1运行/1排队。未取消运行中或重派旧提交。当前workflow增加独立seq专项；push后新队列与远端另行实核，不把待执行视为通过。

本批补齐合成有效seq的App端到端和三处歌词手势缺陷。真实TTML库矩阵、完整TTML2、实体机时间轴/性能/VoiceOver、签名和iOS27终态继续，S4/J35–42与总项目仍未完成。
