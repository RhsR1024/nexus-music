# 2026-10-27 背景透明度CI读取修正

99d5e5e的云端40434766673为21通过/1失败：`testVisualImagesAndPlayerBackgroundPersistence`在`visual-value-backgroundOpacity`定位失败。保留日志显示数值文本已存在，随后reveal继续向下拖动，最后背景弹层消失、只剩“外观与界面”页。此前滚动坐标修正已经包含于该版本，不能当作当前云端通过。

测试的`visible()`把只读StaticText也要求为hittable。修正为：文本仍须有有效尺寸且中心落在真实可见视口内，但无需作为点击目标；按钮/开关仍检查可点击性，禁用态入口保留几何检查。避免只为读取文本在顶部继续下拉，并保留所有正常导航、图片导入、数值编辑、重启、独立图片删除及空状态断言。未增加测试专用产品入口或改生产行为。

本机Release `build/SourceUITests-1793081365756.xcresult` 1/0/0、360.868秒，通过导入、三个数值编辑、重启核对、共享背景/照片分别删除及再次重启。`build/background-opacity-ci-20261027-r1/`保存候选补丁、精确manifest与日志；source digest f7fbbd24d739aa9d58d74c6b28a5efb8cdcba9debeae96c04b3c7696198781fb。`verification-receipt.json`确认233个src/modules文件与前批真实音质验证一致；两首批准的真实音频SHA仍保留，见`real-audio-preserved.json`。

该项使用CI导入夹具作功能回归，未导出或查看夹具PNG作UI验收，不增加UI完成量，不宣称本次真实播放或新业务637项检查。真实音质功能与实际MP3证据仍以[前批回执](2026-10-27_download-quality-report.md)为准。iOS26.3.1本机通过不替代iOS27云端终态；此次改动是否消除云端故障仍待最新运行证明。

云端小日志来自artifact12710018266，仅取三份文本：`build/ci-sidecars-99d-20261027/logs/`，保留`archive-receipt.json`和`summary.json`。重复下载ZIP已逐文件核对后清理，回执`build/logs/cleanup-quality-ci-20261027.json`；未下载534MB完整构建包、未查看故障夹具截图，未清理在用构建缓存或reverse证据。下一先核对本修正云端结果，继续平台封面/目录/托管侧车等开放功能，不结束总目标。
