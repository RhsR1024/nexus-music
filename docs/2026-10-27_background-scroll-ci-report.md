# 2026-10-27 背景图片设置 CI 滚动回归修正

## 问题与证据

40376417168/b46d2f6最终21通过/1失败。通过连接器取得原始日志artifact12683155580；ui-catalog.log在照片导入成功、附件生成后，向上寻找background-image连续对background-sheet-scroll使用相对0.35→0.70坐标，随后该浮层从AX树消失，旧源码3426行失败。CI设备为iPhone17/iOS27.0。

滚动容器的AX frame可能包含被裁剪/滚出屏幕的内容，按该frame取相对点无法确保实际触点仍在内容滚动区；背景浮层顶部本身有下拉关闭手势。修正测试取viewport与App可见矩形交集，并把顶部限定在实际关闭手柄下方；用App绝对坐标执行滚动。手势前要求viewport和关闭手柄已就绪，几何无效则明确失败；不重新打开浮层掩盖消失。

可见性核对元素中心位于可见滚动区域。初始图片背景控件预期禁用，使用可见几何检查它，随后继续原有禁用断言；需要点击的已启用控件仍要求hittable。导入、两个槽位、三项数值、开关、重启一致性、共享图片保留及移除/回退等原产品断言全部保留。

## 验证

仅修改SourceSettingsTests.swift的该测试reveal辅助函数，src生产文件SHA与上批真实音频R7全部一致。未采纳或新增Sollin证据，没有产品UI布局/状态实现变化。

- 精确Release `build/SourceUITests-1793060783597.xcresult`：**1通过/0失败/0跳过，用例351.329秒**。
- 本机iPhone15ProMax/iOS26.3.1；正常设置/文件导入/重启路径执行完毕。实际手势日志使用可见坐标x24、y377.6↔694.4，原故障点继续执行后续持久化和删除检查。
- 此为既有CI功能回归，夹具PNG/自动附件未导出或查看作为UI验收，不计UI对齐完成量。真实音频与页面验收仍见[命名导出回执](2026-10-27_download-naming-export-report.md)。没有用夹具证明真实播放或真实服务。
- 测试编译和执行已覆盖本次Swift修改；627项业务检查沿上一批通过记录，不虚称本轮重跑。

## 绑定与收尾

- source digest：`ce1b5568270a3e9ac32e4739effab9c6cb5e11987a202a658fe407e3b5d223e6`
- run-manifest SHA256：`03c43a7a60301c02cc18994723d9da4ef8c7686531d4c5ed5709f615c0a12779`
- xcresult Info.plist SHA256：`a5f13faa75d86148bfaff01df206d050951edea714b2ed08d3ac89104d4fbc90`
- 原CI下载ZIP SHA256：`7210f1578069a5799a59e24646d1d31d3566656e6fadc4ae39b994eb81368c4c`

run-manifest记录采集前后源码一致，verification-receipt确认生产源码与上一批实际曲目构建相同。没有导出本轮夹具截图作UI报告。只关闭自用A834模拟器。

下载ZIP与三个保留日志逐字节核对后删除545326字节重复包，日志/summary/计数及各自SHA保留于build/ci-background-b46-20261027/logs，清理回执在build/logs/cleanup-background-ci-20261027.json。删除的ZIP不再作为当前可取附件。磁盘已检查，未清理活跃构建或逆向素材。

当前本地专项通过仍不能替代iOS27云端结果。最新6a5fe8a云端40425677666沿运行队列观察，修正提交后核对single队列，不取消运行中任务或重派旧版。真机/签名、系统后台及下载侧车等原目标继续。
