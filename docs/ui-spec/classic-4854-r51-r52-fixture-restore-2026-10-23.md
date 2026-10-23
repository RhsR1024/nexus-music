# 4854 歌词 r51 夹具错配与 r52 回退确认

日期：2026-10-23。前提：r50 字体族实验失败，源码回退到 r49 状态（`classicLyricTypography={size:17,inactiveSize:17.5,activeWeight:'900',inactiveWeight:'600',activeEmbolden:.1}`，使用 UIKit 系统字体，不覆盖 `PingFangSC-*`）。r51 与 r52 都是回退确认，不是新的调参。

## r51：夹具错配，不能作为源码回归证据

- r51 使用 `build/reference-scene-4854-r44-20261023/scene.json`（ASCII 引号），而 r45–r49 的评测夹具是 `build/reference-scene-4854-r32-20261023/scene.json`（弯引号“星辰集”且行内带空格）。
- 源码 digest 与 r49 相同（`b5d7fe8f…`），但 line2 宽度 766 vs r49 781、墨量 20040 vs 19956；line1/line3 与 r49 逐像素一致。
- 因此 r51 的歌词 0.7879 / ΔE5.546 是**夹具差异**，不能说明回退失败；r51 证据保留但不再作为基线。

证据：`build/classic-reference-r51-20261023/`（resultInfoSha256 `a7257d7e…`，候选 sha `90674ba4…`），spec `docs/ui-spec/batches/4854-classic-v3-r51-r49-restore.json`。

## r52：规范夹具下的回退确认

- 夹具：r32 canonical scene（`scene.json` sha `095b52b2…`，cover `983161e2…`）。
- run：`build/classic-reference-r52-20261023`，manifest `exitCode:0`、`sourceUnchanged:true`（before/after 均 `b5d7fe8f…`）、外部 scene/cover digest 前后一致 `5c1f9fce…`。
- 导出：`screenshots/001-Classic-reference-content.png`，sha256 `91ebe16e…`，bytes 1649529，resultInfoSha256 `aa570229…`，resultBundle `SourceUITests-1792722250624.xcresult`，installedBundle `0d6f64b7…`。
- spec：`docs/ui-spec/batches/4854-classic-v3-r52-r49-restore.json`。
- visual-lab：`build/visual-lab/classic-v3-r52-r49-restore-20261023`，`provenanceReady:true`、`pageAccepted:false`。

指标（r52 vs r49）：

| 区域 | r52 SSIM | r52 ΔE00 | r49 SSIM | r49 ΔE00 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 整屏 | 95.14% | 2.11 | 95.14% | 2.11 | 报告用 |
| 控件区 | 94.10% | 1.32 | 94.10% | 1.32 | 通过 |
| lyrics | **79.52%** | **5.34** | 79.52% | 5.34 | 唯一未通过 |

逐行墨迹（luma<150；band 1560–1660 / 1670–1770 / 1790–1890）：

| 行 | 参考 w / ink / minx | r52 | r49 |
| --- | --- | --- | --- |
| line1 非唱 | 527 / 8991 / 381 | 526 / 8839 / 381 | 526 / 8839 / 381 |
| line2 唱 | 781 / 20916 / 254 | 781 / 19956 / 254 | 781 / 19956 / 254 |
| line3 非唱 | 590 / 9514 / 335 | 578 / 9392 / 353 | 578 / 9392 / 353 |

r52 与 r49 三行指标完全相同，回退确认成立。对比图：`build/classic-reference-r52-20261023/cmp-ref-r49-r52-lyrics.png`（上：参考，中：r49，下：r52）。

## 边界与下一步

- r51 的夹具错配已隔离；后续捕获固定使用 r32 canonical scene，避免混用 r44。
- 歌词区剩余差异仍是：line2 墨量少 960（−4.6%）、line3 因私有字体吸收 `自` 与 `〖` 之间的 ASCII 空格而窄 12px、起点右移 18px。根因已分别记录在 r48 与 r50 文档，属于字重/标点空格两层机制，同层试参暂停。
- 本轮不改变 P1–P5 parse 任务状态；接下来转入 P4（LX 歌单身份、长整数、时长、音质预算）实现与测试，再回到 4851/4861/4855/4856 对齐。
