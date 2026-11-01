# 2026-11-01 T7 构建证据迁移回执

内盘接近项目规定的 30GiB 余量线。用户授权把可再生成或已使用完毕的大文件迁往外接 T7 固态、保留原路径访问能力并继续清理；本轮回执只记录已经完成逐文件核验的内容，没有删除 `work/`、用户数据、reverse-skill scope/Evidence 或未解决失败的原始证据。

T7 在操作前确认挂载于 `/Volumes/T7 Touch` 且可写。迁移期间没有 Xcode、测试 UI、复制或解压进程持有源目录；先完成复制与比较，再替换为 symlink。

## 已核验归档

| 内容 | T7 路径 | 文件 / 目录 | 字节 | 核验 |
| --- | --- | ---: | ---: | --- |
| 旧构建与证据 | `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-01-legacy-build-evidence/root` | 73,381 / 474 个顶层路径 | 23,957,742,262 | 0 missing / 0 size / 0 byte mismatch |
| 已被新阶段取代的当前结果 | `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-01-current-superseded/root` | 27,762 / 1,887 个迁移项 | 6,749,245,714 | 0 missing / 0 size / 0 byte mismatch |
| 最新酷狗合成与真实 UI xcresult | `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-01-current-xcresults/root/build` | 114 / 4 | 12,171,090 | 0 missing / 0 size / 0 byte mismatch |
| 旧模拟器 DerivedData | `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-01-current-derived-data/root/build/DerivedData` | 7,260 / 453 | 1,175,916,282 | 0 missing / 0 type / 0 size / 0 byte mismatch |

最新两组 xcresult 的聚合 manifest SHA-256：

- `SourceUITests-1793515510913.xcresult`: `daf3da1ac1789c18e29cf66a7faf2ae7efbaa68bed30b7599686dac83ea98e6d`
- `SourceUITests-1793515901320.xcresult`: `30b22ffe79043a0f58c7afcd305394d0967549941ba5356364b5b93c8651a842`
- 旧模拟器 DerivedData: `93471a7f9be664579623c2e8cc13ba1450330d79d0be9a0ed01006021fb33c05`

exFAT 对每个条目生成 AppleDouble `._*` sidecar 并改变 POSIX mode；source 中没有 `._*` 文件，sidecar 不参与 manifest。全部可读源文件已逐字节 SHA-256 比较，目录/类型集合无缺失。

## 当前路径与空间

`build/logs`、`build/distribution`、`build/DerivedData` 以及两组最新 xcresult 的原始路径现为 T7 symlink，仍可按项目原路径读取。当前设备构建新增的 `build/DeviceDerivedData` 留在本机用于增量归档与测试。

迁移旧模拟器 DerivedData 后，内盘可用空间从 31,215,845,376 bytes 增至 32,397,365,248 bytes，约 30.17GiB；随后新建的当前设备 DerivedData 仍保留，检查时仍高于 30GiB。

精确机器可读回执保存在忽略目录：

- `build/logs/cleanup-20261101-t7-build-migration.json`
- `build/logs/cleanup-20261101-t7-current-superseded.json`
- `build/logs/cleanup-20261101-t7-current-xcresults.json`
- `build/logs/cleanup-20261101-t7-derived-data.json`

未移动七个含内部 symlink 的小型 `build/local-folder-native-20261025-*` 目录、当前 KuGou PNG/摘要、本机 `DeviceDerivedData`、工具链、当前工作树及 reverse-skill Evidence。T7 未挂载时不得在 `/Volumes` 下伪造同名目录；后续清理仍按临时文件 7 天、普通日志 14 天、已解决故障完整结果 30 天轮换。

## 2026-11-01 评论 emoji 阶段追加

评论 emoji 批次完成后，未签名 IPA `7a32aef8ba2e96bf7e5bbfb420e7bdbcdeac38ca0b5228f4fd0c281ed570f511`（12,843,556 字节）已连同 SHA 文件、archive manifest、归档日志和复核哈希迁移到 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-01-comment-emoji-window/`。本机 `build/distribution-history/7a32aef8ba2e96bf7e5bbfb420e7bdbcdeac38ca0b5228f4fd0c281ed570f511/` 也保留同一内容哈希快照。

公共 `build/distribution` 在本批归档前仍指向旧的 T7 legacy evidence 路径，脚本按既有逻辑覆盖了该公共 IPA；历史 `c834…` 的摘要仍可查，但旧字节不能再由原路径取得。现已在 `scripts/archive-unsigned.sh` 中增加覆盖前按 IPA 内容哈希保存 `build/distribution-history/<sha>/` 的步骤，后续成功阶段不会再被公共路径覆盖。本步没有删除用户数据、reverse-skill Evidence、未解决失败证据或最新阶段包。

## 2026-11-01 已完成 emoji UI 缓存迁移

评论 emoji 阶段的三组 Release UI 均已完成且没有 Xcode、测试或复制进程持有
`build/DerivedData-local-2026-11-01-emoji`。该缓存共 7,016 个条目、
1,120,749,964 字节，复制到
`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-01-emoji-ui-derived-data/root/build/DerivedData-local-2026-11-01-emoji`
后按文件类型、符号链接目标、大小和 SHA-256 逐项比较，缺失/多余/不符均为 0。
本机已核验重复缓存移除，原路径继续通过同名 symlink 读取，内盘释放
1,124,962,304 字节。

随后迁移六项已完成下载到
`/Volumes/T7 Touch/NexusMusic/DeveloperArchive/2026-11-01-local-downloads/`：
当前工具链已由 `WorkSpace/Tools/Xcode` 提供的冗余 `Xcode_26.3_Universal.xip`，
以及 2026-10-16 至 10-18 的五份旧 iOS 构建诊断 ZIP。六项共 5,150,842,160
字节，逐文件 SHA-256 一致；原 `~/Downloads` 路径全部保留为 T7 symlink，
没有直接删除这些下载。精确清单保存在 Git 忽略目录：

- `build/logs/cleanup-20261101-emoji-derived-data-precopy.json`
- `build/logs/cleanup-20261101-local-downloads-precopy.json`

两步完成后内盘可用空间为 32,143,605,760 字节（`df -h` 约 30 GiB）。
当前 `build/DeviceDerivedData`、最近两组 UI 结果、公开采集图片/摘要和仍未满
14 天的诊断证据继续留在本机；已运行整夜的模拟器设备与 reverse-skill
Evidence/scope 没有迁移或删除。
