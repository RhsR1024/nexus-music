# 4854歌词字重r48：17.5pt Medium失败与17.5pt Semibold假设

r47正式证据显示歌词区 78.41%/ΔE5.60，唯一未通过区域；ink 相关系数 0.4788 说明行位置/字高基本对齐，剩余差异集中在墨迹密度与字宽。参考裁片的非唱行在 17pt 与 17.5pt 之间的测量出现矛盾：17.5pt 才能得到参考行宽（line1 w527、line2 w782），但 r47 17pt Semibold 的墨量（n9803）反而更接近参考（n9852）而宽度只有 511。r48 的假设是“宽度正确来自 17.5pt，墨量不足可用 Medium 修正”，即 inactive 17.5pt Medium。

相对 r47 只改 inactive 字号 17→17.5、字重 600→500；active 保持 17pt 900 + 0.1pt 膨胀；行高、墨色、区域、阈值与 scene 全部不变（默认 blush/rose）。

## 实施结果 2026-10-23

实施范围：`src/ui/tokens.ts` 的 `classicLyricTypography.inactiveSize=17.5`、`inactiveWeight='500'`；`classicLyricRow` 的布局字号仍按 17pt 计算行盒，避免行高变化。`src/ui/Lyrics.tsx`、`src/ui/NativeLyricLine.tsx`、`modules/nexus-native/ios/NexusLyricsModule.swift` 未改。

验证：

- TS：`npm run check` 474/474。
- r48（正式）：`build/classic-reference-r48-20261023`，manifest `exitCode:0`、`sourceUnchanged:true`、外部 scene/cover `unchanged:true`；sourceDigest `5b8c344a…`，installedBundle `ab0edaf9…`；导出 `screenshots/001-Classic-reference-content.png`（sha256 `45630ca2…`，bytes 1648432，resultInfoSha256 `abf23075…`，resultBundle `SourceUITests-1792720919669.xcresult`）。
- visual-lab（`build/visual-lab/classic-v3-r48-lyrics-typography-20261023`）：`provenanceReady:true`、`pageAccepted:false`，spec sha256 `8474a6fb…`。

指标（r48 vs r47）：

| 区域 | r48 SSIM | r48 ΔE00 | r47 SSIM | r47 ΔE00 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 整屏 | 95.15% | 2.11 | 95.03% | 2.14 | 报告用 |
| 控件区 | 94.12% | 1.32 | 93.91% | 1.32 | 通过 |
| header | 97.03% | 1.75 | 97.03% | 1.75 | 通过 |
| cover | 98.83% | 1.39 | 98.83% | 1.39 | 通过 |
| title-artist | 95.59% | 3.05 | 95.59% | 3.19 | 通过 |
| lyrics | **79.65%** | **5.32** | 78.41% | 5.60 | 唯一未通过 |
| progress-time | 94.08% | 1.50 | 94.08% | 1.50 | 通过 |
| transport | 96.38% | 1.07 | 96.38% | 1.07 | 通过 |
| tools | 90.35% | 2.40 | 90.35% | 2.40 | 通过 |

歌词区 ink 统计（阈值170，r48截图 vs 参考）：

| 指标 | 参考 | r48 17.5 Medium | r47 17 Semibold |
| --- | --- | --- | --- |
| line1 宽度 px | 527 | **527** | 511 |
| line1 墨量 n | 9852 | 8869 | 9803 |
| line1 竖干 stem px | 6.50 | **5.67** | 6.51 |
| line2 宽度 px | 782 | 781 | — |
| line2 墨量 n | 21455 | 20268 | — |
| line2 字高 px | 50 | 48 | — |
| line3 宽度 px | 592 | 578 | — |
| line3 墨量 n | 10496 | 9421 | — |
| line3 stem px | 5.63 | 4.94 | — |

墨色复核：inactive 参考 (129,111,104) vs r48 (128,111,106)；active 参考 (31,23,23) vs r48 (32,25,25)，均无需再调。

结论与边界：r48 证明 17.5pt 的 advance 正确（line1 527、line2 781 与参考一致），但 Medium 使竖干从 6.50 降到 5.67、墨量少约 10%，SSIM 仅 +1.2pp，歌词区仍未达门禁。宽度与墨量的矛盾指向 **17.5pt Semibold**：同一 17.5pt 网格上保留正确 advance，并用 Semibold 恢复 6.50 级竖干与墨量。r49 将只把 inactiveWeight 改为 600 做单变量验证，不提前声称完成；line3 的标点前间隙/整行偏移仍待独立处理，不计入字重结论。
