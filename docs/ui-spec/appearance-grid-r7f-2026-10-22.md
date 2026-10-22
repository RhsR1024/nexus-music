# 4855/4856 r7f 静态收敛回执

## 结论

在 iPhone 常态布局、默认 `blush + rose`、`solid`、卡片 30% 的同态下，4855 与 4856 的全部已声明关键区均通过 SSIM/颜色/边缘三轴。两次冻结源码独立采集得到相同分数；这不是动效、真机或签名验收。

## 证据

- 精确结果包：`build/SourceUITests-1792626911881.xcresult`，`testVisualLabAppearanceSheet` 1 passed / 0 failed / 0 skipped。
- 采集清单：`build/appearance-grid-r7f-20261022/run-manifest.json`，SHA-256 `a3fd9ffe1826ef680f65863dbb4112b7f51a58a3ae76b4d7e36477a6912f740e`。
- 导出索引：`build/appearance-grid-r7f-20261022/screenshots/index.json`，SHA-256 `94bba15271d40f691cc77fd3df5c40431c273c8cf8c4e30a1472ffa8dcec0884`。
- 源码提交 `b41c9de99cd8f55389bb01b3f6783fb1bca83ff7`；工作树 digest `fcc4cdf0c196294c26336dfd6fa719a32c681d013ffe955a553f58da9e650cfc`；采集前后 `sourceUnchanged=true`。
- 4855 PNG SHA-256 `1257cc6beb3f21686737f76569575c29dc8135e505b9705dd03445994d12b68b`。
- 4856 PNG SHA-256 `91717d7d432033ce595900924c74ed421268b58da0b493efdf694aa2767a42ee`。

## 指标

| 状态/区域 | SSIM | ΔE00 | 边缘 r | 结果 |
|---|---:|---:|---:|---|
| 4855 整屏 | 92.43% | 2.62 | 0.58 | 通过 |
| 4855 container | 94.38% | 2.07 | 0.72 | 通过 |
| 4855 title-actions | 91.10% | 2.23 | 0.77 | 通过 |
| 4855 preview | 94.67% | 1.39 | 0.49 | 通过 |
| 4855 themes | 90.52% | 3.74 | 0.55 | 通过 |
| 4855 background-type | 90.21% | 3.51 | 0.50 | 通过 |
| 4855 colors | 90.71% | 2.62 | 0.60 | 通过 |
| 4856 整屏 | 92.42% | 2.15 | 0.55 | 通过 |
| 4856 container | 95.07% | 2.29 | 0.74 | 通过 |
| 4856 type-tail | 97.39% | 1.49 | 0.99 | 通过 |
| 4856 colors | 92.97% | 2.34 | 0.69 | 通过 |
| 4856 visual-parameters | 90.14% | 2.31 | 0.42 | 通过 |

工具与报告哈希：

- 4855 报告 `build/visual-lab/appearance-grid-r7f-20261022/4855/report.json`，SHA-256 `a9f45b794f3fb0f6db44e46c78da3d5344cb595037fd40f57d9fd0af417580e6`。
- 4856 报告 `build/visual-lab/appearance-grid-r7f-20261022/4856/report.json`，SHA-256 `b6837bed70538a2642b44d8628ea4cd8983afb3e2df0c466bea25efeb85bac86`。
- `visual-lab.mjs` `b714a59a…`，`metrics.mjs` `35975b14…`，`visual-gate.mjs` `76a3d0d6…`，`png.mjs` `c1efb975…`，`ui-provenance.mjs` `fe1b51c8…`。

## 重复采集

`r7e` 与 `r7f` 使用同一冻结源码独立运行，各状态分数逐项一致。两张候选图相比只改变 4506 / 10820520 个通道样本，平均绝对通道差 `0.0335`，最大差 163（状态栏系统内容），噪声未影响门禁。

## 实施要点

- 使用参考低梯度采样生成的 17×33 二维 Sheet 材质，替代单轴渐变；源图与生成脚本均保留固定哈希。
- 主题主区 3/3/3/2、逐主题固定测量宽度、选中态 `#221919` 与参考色块/底面校准；音枢的 `柔和`、`经典` 仍在真实滚动扩展区。
- 预览摘要按参考的字宽与基线拆分为真实文本片段，并暴露单一无障碍摘要。
- 4856 使用测试启动参数在正式 `ScrollView` 中测量颜色字段并滚到 216pt；普通用户路径不受影响。
- 完整回归已覆盖图片导入/播放背景持久化和 `testZNavidromePlaybackAndCredentials`，两者本地均通过。

## 边界

- 本次只证明两个固定静态状态；动效/手势仍需真机录屏，不能由截图替代。
- UI 测试使用合成服务与模拟器；真实账号、真实音源、Apple 签名与真机仍未验收。
- 其他播放器页面仍需按主规范继续收敛，不能以本批两个状态推导全站完成。
