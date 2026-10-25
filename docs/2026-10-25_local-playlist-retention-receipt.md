# 2026-10-25 本地歌单批次素材轮换回执

阶段前后检查磁盘与占用；当前内盘约17GiB可用，仍低于30GB优先清理线。本轮仅去除已完整展开的重复CI压缩包，保留原始xcresult、日志、截图及最新有效阶段产物；不清理当前DerivedData、reverse-skill或未解决故障证据。

| 已移除文件 | 字节 | 保留副本 | 校验 |
|---|---:|---|---|
| `build/ci-38832172978-diagnostics.zip` | 123659498 | `build/ci-38832172978` | 1696个文件逐项SHA256相同，0差异；无打开句柄 |
| `build/s1-ios27-diagnostics.zip` | 117630116 | `build/s1-ios27-diagnostics` | 1522个文件逐项SHA256相同，0差异；无打开句柄 |

共释放241289614字节。压缩包不再作为当前可取附件；完整展开目录仍保留。两包SHA256依次为：

- `3cc7e25676b00fdece339679d1370d8364d2a77b12b64211f9de8b967bc2e009`
- `ba291985adc2c4539c74668c43a8088bc21e74854b82f8cffe72f826aa5c8202`

候选清单与小型回执位于忽略目录`build/local-playlist-batch-retention-{inventory,receipt}.json`。较大的旧诊断目录和当前缓存未盲删，后续按引用与保留周期继续核对。
