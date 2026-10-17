# Sollin 设置对象关系与音枢分类入口

2026-10-17，A03/A04/A06/A07，mobile-reverse PRIMARY；docs-generator 普通逆向报告，flavor=null。

## 结论与范围

固定 IPA 的对象骨架和独立原始 ARM64 BL 指令支持设置分类分派、二级页创建及播放分类下的 EQ 入口。音枢据此把四个实际可用分类置于同一分组，将 EQ 保留为“播放与歌词”的独立叶页；音乐来源仍独立，音枢原有能力保留。截图34只补充视觉顺序，枚举索引不视为显示顺序。

本批仅分析用户授权离线样本，未运行参考 App、业务入口、私有服务或生成的 Frida/IDA 脚本。scope、WI-002、timeline 和原始输出留本机 `work/sollin-ipa/`，不提交样本、账户截图、对象池或反编译资源。来源、固定工具与修复回执见[强制工作流](REVERSE_SKILL_WORKFLOW.md)。

## 工具与证据

IPA SHA256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`，App.framework/App SHA256 `640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d`。Blutter实验PR204固定 `0039efb1b29d68ca6e5caece4d412d15e6f49428`，匹配Dart3.12.2固定 `d684a576a6aa954ae107a03b2b4e1d61c3bebe93`，官方15文件格式MD5与快照 `ace654289f5abc240509fc941453ebc5` 一致。iOS为非压缩指针；APK为压缩指针，不混用布局。

两平台构建和断网解析成功；NO_CODE_ANALYSIS=true只生成对象/函数骨架。独立容器脚本确认FAT slice起点0x4000、长度0x11cf770，24,298个非零函数入口全部在可执行文件段。另进程重放1,455个骨架逐字节一致只证明重复性；限定函数再以原始BL解码及cstool核对。不声称完整反编译、动态调用图或所有语义已验证。

| 链节点 | 证据 | 可采纳范围 |
| --- | --- | --- |
| E-008 | `evidence/settings-object-evidence.json`，SHA256 `d286108af4402637c8240244c76d47e85881f0c7de152f79b8040e5d939a2494`；独立地址/BL检查及截图摘要 | 对象归属、分类常量、限定直接调用 |
| F-007 | info / high / candidate，关联E-008、WI-002 | 设置分派和EQ位置，尚非完整运行确认 |
| P-007 | callflow：固定解析→独立原始指令核对→音枢原创分类与入口→独立验收 | 实施依据，不代表完整参考Widget树 |

首次review因不支持的finding状态`confirmed`失败，改为合法`candidate`并保留限制后严格review通过：8E/7F/7P、7工作项、12事件、零错误/警告。采纳前已通过，实施后再次通过。

## 已核查关系

以下为slice VA；本段__TEXT的VA与slice file offset相同，原始IPA成员offset需加0x4000。对象池的pp标签不当作文件偏移。

| 起点 | 原始BL位置→目标 | 关系 |
| --- | --- | --- |
| `_SettingsCategoryPage.build` 0x395790 | 0x395888→0x3a2464 | `_appearance` |
| 同上 | 0x3958a0→0x39cbc4 | `_playback` |
| 同上 | 0x3958b8→0x39a28c | `_sourceDownload` |
| 同上 | 0x3958d8→0x397c18 | `_data` |
| 同上 | 0x3958f0→0x3959b4 | `_services`，不采纳私有服务分类 |
| `_OrganizedSettingsTab._open` 0x392cf8 | 0x392d58→0x392d74 | `_pushSecondaryPage`；归属闭包0x392e2c返回分类页 |
| `_playback` 0x39cbc4 | 0x39ccc4→0x39e140 | `_equalizerSettingsRow` |

分类常量分别为“外观与界面、播放与歌词、下载管理、数据与存储、服务与支持”；亲看截图34补充的可见顺序是播放、外观、下载、数据、服务。服务与支持、私有账户/商业权益继续排除。样式/字体/mini/主题包装方法可定位，具体Sheet运行行为与全部默认值仍待核查。

A04纠正：`resolveCoverTheme`0x4a4a20→`loadResilientCoverTheme`0x4a7954→`applyCoverTheme`0x4a7b50→`extractPalette`0x4a8034属于`_ArtworkSummaryState`。另有`_BlushingBeautyPlayerBackgroundState`自己的取色链。`_effectiveAppTheme`0x3311ec读取appTheme provider并调用`AppThemeSettings.resolveFor`0x33129c，尚未证明它与封面颜色源相连。旧字符串共存线索不得升级为全局背景算法；三个动态provider仍分开。

## 本机复现

先按工具索引使用Python3.12.14；系统python3可能不是该解释器。以下从项目根执行，原始样本必须与scope摘要一致：

```sh
source scripts/environment.sh
node scripts/sollin-reverse-gate.mjs ipa
/Users/ningli/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 work/tooling/validate-ipa-object-output.py
/Users/ningli/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 work/sollin-ipa/notes/settings-object-evidence.py
node scripts/sollin-reverse-gate.mjs ipa --review
```

解析器重放、输出摘要和原始指令收据留在本机证据manifest；仅有摘要一致不足以证明参考运行等价。

## 原创实现与验收

五参考固定提交与许可沿[比较表](REFERENCE_COMPARISON.md)，本批亲读悦音Library806–824、Q设置Main14–25、wtf设置Main16–36、Cy settingModal403–435、自有Wayferar SourceSettings8–18。仅比较分组/平台边界，不复制代码或依赖。TS设置可共享未来Android；iOS焦点/键盘/返回、Android原生能力分别验收。

四类行统一分组、显示当前音质/布局摘要，大字号隐藏右侧摘要但保留AX值；返回、页面实例、草稿、滚动、来源隔离及唯一播放器/队列保持。EQ页从播放分类进入，返回播放分类。

328项业务/类型通过。正式入口`1792240097837.xcresult`：EQ97.259秒、分组/草稿/滚动/隐藏AX/返回85.620秒，2/2、零失败/跳过；主代理亲看首页及草稿截图，布局清晰。最大辅助字号及清洁设备归档后续回执见[构建状态](BUILD_STATUS.md)。本批没有DSP变更；本地模拟器不替代iOS27、签名、真实音效/服务和手机验收。

继续先收敛A03配置Sheet和A04全局背景关系，再完成A06–A09剩余对齐；平台登录/真实推荐/FM、识曲、后台下载、漫途导入及全部F/J范围保留。

最大辅助字号补记：1792240831918.xcresult，经新首页→播放→EQ入口，单列卡片32.744秒通过，1/1、零失败/跳过。清洁归档/本批云端仍待。
