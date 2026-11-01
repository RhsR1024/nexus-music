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
