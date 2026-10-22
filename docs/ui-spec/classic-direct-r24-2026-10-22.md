# 4854 r24 正式组件快速场景回执

按[classic-direct-scene-plan](classic-direct-scene-plan-2026-10-22.md)实施。新增独立测试entry，真实getServices/Navidrome connect/search3、权威队列、MusicApplication/Player/ClassicLyrics/原生播放全部复用；XCTest经正式mini展开。没有新增产品假入口、截图专用页或假背景。正式index.ts只导入App，测试脚本仅在单一显式目标选择classic.tsx，其余测试显式skip该目标。

固定默认blush/rose、light、classic、gradient、字体/偏移归零、歌词样式默认、rate1、shuffle=false/repeat=off。独立曲目fixture-classic-three-lines-v1，三行中文合成文案0/100/116s，约112s中行高亮。内容与r23两行夹具不同，不用前后分数证明产品改善；本批未改产品布局。原综合夹具不变。

本地Release：r24首轮27.120秒1/0/0；补齐歌词样式/rate/循环重置后r24b与r24c均1/0/0，r24b25.898秒。原综合r23需610.411秒；这里仅比较测试执行时间，不把原生打包时间排除后冒称整个采集总耗时。两次固定场景排除状态栏后3,374,640像素零差异（同色彩空间），复现收据见报告目录repro.json。该噪声结论只覆盖本场景。

精确结果包：r24b `build/SourceUITests-1792683378466.xcresult`，r24c `build/SourceUITests-1792683482956.xcresult`；manifest与导出index在各自build/classic-direct-r24{b,c}-20261022目录；entry及完整test-ui.mjs哈希保存在sourceBefore.files，安装包/JS摘要与sourceUnchanged亦由manifest记录。截图已亲看，正式三行/中行高亮确实呈现。

## 暴露的布局差距

原两行只占94pt最小块；三行实际行盒106pt，把后续控件下推12pt：播放圆钮中心766→778。歌词墨迹参考上缘535/570.33/606.67pt，首次候选558/593.67/630（约+23pt）。这是内容行数变化暴露的空间分配缺陷，不能用正常测试成功掩盖。

规格 `batches/4854-classic-direct-r24b.json`沿用原ROI/遮罩/门槛，明确新场景内容；全屏SSIM75.56%只报告，可比区89.06%，三区均未过，D1有>5pt偏差触发G2。本场景不计静态完成，原r23两行S=89.50只代表其旧固定场景，不外推三行。未改变参考、扩大遮罩或移动关键区。

r24b候选SHA256 `ae498cf1b78dd30bccb332f9670a41dfbb84796fdef617c40e473c324902fbf6`，报告 `build/visual-lab/classic-direct-r24b-20261022/report.json`，其中保存规格/工具/来源哈希。

下一组：先量测三行歌词块前后空间预算，以父容器统一修正起始位置与总高度，再验证控制区与全文正常操作；不能给轨道、播放、工具行分别加负边距。之后跳曲圆角/宽度、拇指材质与精确进度。阶段出口仍需五态/主题遮罩/正常入口及设备归档。真实服务、签名、真机与动效未新增证据。
