# 播放器高清封面r45实施前规格

当前CoverCache.store统一512px，services.ts Navidrome getCoverArt固定size512；Cover忽略显示size，308pt×3=924px需要放大。先实现网络封面两档512/1024；Cover按显示pt×屏幕scale选择有限档位，主题取色/系统媒体等默认512保持。缓存身份版本化并绑定档位，原生只允许这两档；输入8MiB、4并发、64等待、epoch清理/迟到隔离、32MiB共享磁盘LRU保留。无任意像素参数或常驻UIImage字典，不声称32MiB总内存。

Navidrome请求size与原生解码同步，public/LX保持服务返回URL语义。local/device/WebDAV当前返回直接提取URI，不升级源图，不称全来源高清完成；下一独立接线原始嵌入封面提取。

相对r44只改变高清链路；同外部scene及完整v3七区/遮罩/阈值，默认blush/rose。先TS验证身份/URL档位/并发取消与clear，原生验证512/1024比例/低分辨率不放大/非法档位和坏图；新App截图及实际cache尺寸检查，邻态/正常导航与阶段本地归档/云端另记。参考封面裁片已含圆角，不能借此证明裁切/取色机制。

## 实施结果 2026-10-23

实施范围：`CoverSize = 512 | 1024`；`src/providers/covers.ts` 缓存身份 `['cover-v2', size, identity]` 且 1024→512 回退；`src/ui/Cover.tsx` 以 `显示pt × window.scale` 选择档位（>512 取 1024，否则 512）；`src/app/services.ts` Navidrome `getCoverArt` 的 `size` 与请求档位同步；`CoverCache.store(_:key:maxPixelSize:)` 仅接受 512/1024，`NexusNativeModule.fetchCover(maxPixelSize:)` 拒绝其他值（`COVER_SIZE`）。主题取色、系统媒体、public/LX 保持默认 512/服务 URL 语义，未改动；local/device/WebDAV 未升级。

验证：

- TS：`tests/covers.test.ts` 3 通过（身份/档位、回退、clear）；全套 `npm run check` 474/474，`tests/lx-adapter.test.ts` 8/8。
- 原生：`tests/native/CoverCacheTests.swift` 编译运行通过：1024 解码、低分辨率不放大、非法档位 4096 拒绝、超 8MiB 输入拒绝。
- r45（诊断，非正式）：采集期间编辑了源码，manifest `sourceUnchanged:false`，不作为正式证据；但指标趋势可用。
- r46：后台未 `source scripts/environment.sh`，在构建前以 `xcode-select` 失败终止；目录保留为失败记录，未覆盖。
- r47（正式）：`build/classic-reference-r47-20261023`，manifest `exitCode:0`、`sourceUnchanged:true`、外部 scene/cover `unchanged:true`；导出 `screenshots/001-Classic-reference-content.png`（sha256 `9ee4fa4d…`，`resultInfoSha256 bd8d7a67…`）。visual-lab：`provenanceReady:true`。

指标（正式 r47 vs r39/r44）：

| 区域 | r47 SSIM | r47 ΔE00 | 结论 |
| --- | --- | --- | --- |
| 整屏 | 95.03% | 2.14 | 报告用 |
| 控件区 | 93.91% | 1.32 | 通过 |
| header | 97.03% | 1.75 | 通过 |
| cover | **98.83%**（前值 94.59%） | **1.39**（前值 ~3.4） | 通过；ink r 0.994，MAD 1.02 |
| title-artist | 95.59% | 3.19 | 通过 |
| lyrics | **78.41%** | **5.60** | 唯一未通过 |
| progress-time | 94.08% | 1.50 | 通过 |
| transport | 96.38% | 1.07 | 通过 |
| tools | 90.35% | 2.40 | 通过 |

缓存实检：r47 测试后 simulator `Library/Caches/NexusCovers` 新写入的封面为 **924×924** JPEG（248548 B），只有 1024 档可产生该尺寸；512 档仍在原生白名单内。

结论与边界：高清封面链路达到预期，封面区域提升 +4.2pp 且未影响其他区域；但整页仍未达 90% 门禁，唯一原因仍是歌词区（字体/字重/度量）。r47 只改变封面档位，不证明裁切/取色机制改变（参考裁片自带圆角）。下一轮转入歌词排版诊断（CoreText 字体族/字重/字距/行盒），不把封面结论外推为整页完成。
