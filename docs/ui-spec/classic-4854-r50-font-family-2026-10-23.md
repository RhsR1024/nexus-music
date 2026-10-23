# 4854歌词字体族r50：公共PingFang SC失败与回退

r49（inactive 17.5pt Semibold、active 17pt Black+0.1pt膨胀）歌词区仍为 79.52%/ΔE5.34，未达到判定阈值。按 [UI_ALIGNMENT_WORKFLOW](../UI_ALIGNMENT_WORKFLOW.md) 的“连续两次同层数值尝试无改善即检查字体度量/渲染机制”，r50 改为机制级单批测试：`classic` 阶段改用公共 `PingFang SC` 家族（500→Medium、其余→Semibold），两行都按 17.5pt 渲染、保留 17pt 行盒；scene 的第1、3行同时去掉了转写的 ASCII 空格。

该批把“字体族”和“fixture 文案”两个变量一起改了，因此结果只能作为机制否定证据，不能归因为单一排版参数。

## 证据与来源

- 采集：`build/classic-reference-r50-20261023`，`exitCode:0`、`sourceUnchanged:true`、外部 scene/cover `unchanged:true`。
- `sourceBefore/sourceAfter` 均为 `cdfba10…`，diff `0854a7f8…`；installedBundle digest `4a9cc3fd…`；resultInfoSha256 `a828a145…`；xbresult `build/SourceUITests-1792721763317.xcresult`。
- 导出：`screenshots/001-Classic-reference-content.png`，sha256 `3f44c038b723…`，bytes 1649415，导出索引 `screenshots/index.json`。
- spec：`docs/ui-spec/batches/4854-classic-v3-r50-pingfang-sc.json`（绑定同一 sha/manifest/导出索引）。
- visual-lab：`build/visual-lab/classic-v3-r50-pingfang-sc-20261023/report.json`，`provenanceReady:true`、`pageAccepted:false`。

## 指标（vs r49）

| 区域 | r50 | r49 | 结论 |
| --- | --- | --- | --- |
| 整屏 | 94.03% / ΔE 2.39 | 95.14% / 2.11 | 退步 |
| 控件区 | 92.17% / 1.32 | 94.10% / 1.32 | 退步（主要来自歌词） |
| lyrics | **68.23% / ΔE 8.17 / ink 0.311** | 79.52% / 5.34 | 三项全部恶化 |
| 内容本身 | 85.28% / MAD 7.4 | — | 报告用 |

色块 upper/lyric/lower ΔE00 0.81/0.39/0.63，背景无回归。

## 逐行墨迹量测（luma<150，band 1560–1660 / 1670–1770 / 1790–1890）

| 行 | 参考 w / ink / minx | r49 | r50 | 观察 |
| --- | --- | --- | --- | --- |
| line1 非唱 | 527 / 8991 / 381 | 526 / 8839 / 381 | 519 / 10344 / 385 | r50 窄 8px、ink 多 15% |
| line2 唱 | 781 / 20916 / 254 | 781 / 19956 / 254 | 794 / 19004 / 248 | r50 宽 13px、ink 少 9% |
| line3 非唱 | 590 / 9514 / 335 | 578 / 9392 / 353 | 596 / 10937 / 332 | r50 宽度接近但 ink 多 15%、起点偏左 |

## 根因

1. 公共 `PingFang SC` 只有 Regular/Ultralight/Thin/Light/Medium/Semibold，**没有 Bold/Black**。weight 900 被夹到 Semibold，active 行失去参考的厚重感（ink −9%，宽度 +13px）。
2. 公共家族的 CJK advance 与 UIKit 私有 `.PingFangUITextSC` 不同（17.5 对 17.347pt 网格），inactive 行虽宽度接近，却同时变重（Semibold 替代原 Medium 观感）。
3. r49 用私有字体时 line1/line2 的宽与起点**逐像素对齐**参考（526/781、381/254），说明参考的非唱行进宽度并不支持“整族换成公共 PingFang SC”；r50 还叠加了 scene 去空格，无法把 line3 的改善单独归功于字体。
4. line3 的唯一稳定差异是私有字体在 `自` 与 `〖` 之间吸收了 ASCII 空格（r49 间隙 27px vs 参考 40px，宽度 578 vs 590）；这属于标点空格处理，不是字体族整体替换能解决的。

## 结论与后续

- **回退** r50：恢复 `classicLyricTypography = {size:17,inactiveSize:17.5,activeWeight:'900',inactiveWeight:'600',activeEmbolden:.1}` 与 UIKit 系统字体；scene 恢复 r44 的带空格文案。r49 仍是当前最佳歌词状态。
- 同层字重/字体族两次尝试均未改善，本层暂停继续试参；若继续，应从“标点前空格的 CoreText 行为”单变量入手（例如禁用该处 pair kerning 或等效处理），并先做离线 CoreText 宽度/间隙探针，不再整族替换。
- 该结果不改变 P1–P5 parse 任务状态；也不构成 4854 歌词区通过。
