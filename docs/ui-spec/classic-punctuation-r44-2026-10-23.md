# 4854标点可比性试验r44

以r42（17.5pt、34pt默认行盒、900/700）为同产品基准；恢复其源码后只改变本地scene中行的两枚引号，U+201C/U+201D→ASCII双引号。原参考码点未知，此为有轮廓/advance依据的输入假设，不是恢复原文结论。第三行空白、封面、所有容器/控制区不改。沿用完整v3七区/锚点/阈值/遮罩，默认blush/rose。新输入仅本地、不进生产包，前后摘要校验；新截图实际同秒，分别检查CJK、引号墨迹及两段advance。

相对r42只试输入，相对r43含字号恢复，结果不能混称单一产品改进。若标点仍不解释差异，检查CoreText fallback而非继续盲调tracking；独立高清封面/Parse不因该未知无限停滞。

## r44结果（2026-10-23）

Release 1通过/0失败/0跳过，`build/SourceUITests-1792717964811.xcresult`；实际截图为04:26/04:44同秒。候选`build/classic-reference-r44-20261023/screenshots/001-Classic-reference-content.png` SHA256 `76ee0f3a…4ff31c1a`，源码digest `30e907bf…d3a1556eda`，安装包digest `da327ad0…5ad9c0b51`，外部输入摘要`1816a1c0…42c10faf`未变。报告`build/visual-lab/classic-v3-r44-punctuation-20261023/report.json`。

|指标|r42（17.5pt+34，弯曲引号）|r44（同上，ASCII引号）|r41c（17pt，弯曲引号，参考）|
|---|---|---|---|
|歌词区SSIM|77.1670%|78.6984%|78.4089%|
|歌词区ΔE00|6.5012|5.5160|5.6013|

其余六区通过：header 97.03%、cover 94.59%（SSIM）、title-artist 95.59%、progress-time 94.08%、transport 96.38%、tools 90.35%；全屏SSIM 93.96%只作诊断，control 92.05%、可比区94.26%、ΔE00 2.27。控件/颜色覆盖按report的applicationCoverageFraction记录，不据此新增整页完成态。

结论：同一产品源下只把本地场景两枚引号改为ASCII，歌词区SSIM +1.53pp、ΔE −0.99但仍失败（阈值0.90/4）；与17pt弯曲引号的r41c相比仅+0.29pp/−0.085，仍失败。标点输入不能解释主要差异，也不足以支撑“参考原文为ASCII”的结论，不采纳为产品改动。原文码点/空格仍未知，禁止以继续猜Unicode或逐行padding制造通过。

产品源码已恢复17pt/原行盒（与27e19b7歌词排版一致，r42试验patch留`build/classic-reference-r42-20261023/font-trial.patch`）。下一诊断按计划检查CoreText fallback与实际字体族/度量；本条不阻塞高清封面r45与Parse P3–P5。
