# iOS 27 核心组超时与独立断言诊断

## 来源与终态

GitHub Actions `41553030339` 对应 `295bf94`，终态 Cancelled，annotation 为超过 `3h0m0s` 最大执行时间。取消不计为通过。紧凑 artifact `13202412287` 的 ZIP SHA-256 为 `80c6975257660ea877de3dd210337e04680696a07ee9322f40ba3a6804f2c906`，摘要与 ZIP CRC 已核验；完整紧凑包及解压日志保留在 T7 `NexusMusic/BuildArchive/2026-11-03-ci-41553030339-timeout/`。564MB 完整诊断超过当前下载工具限制，尚未获取，不声明已查看其中截图。

## 已证实的问题

核心组计划25项，执行到第19项 UCloud 时预算耗尽。此前18项中16通过、2失败，不能将整组表述为仅超时。

- `testAppIconSelectionPersistsAndRestoresPrimary`：原生切换 completion 已成功、orange selected 已通过；失败发生在返回主屏后的 icon frame 可见性。测试只看 `isHittable`，连续左滑后仍不可达。相同运行的 `testAppIconOnHomeScreen` 已用实际截图的精确“音枢”标签 OCR 成功启动。修正共享这个真实屏幕定位过程，每页先识别再决定滑动，不用 activate、固定坐标或 skip 替代实际图标启动；失败保留截图、AX层级、frame和可点击信息。原生切换、重启选中与恢复主图标断言保留。本地主屏启动专项 `SourceUITests-1793679015220` 为1/0/0，实际用例16.364秒；切换专项 `SourceUITests-1793679227737` 为0/0/1，97.455秒后明确skip：Simulator LaunchServices返回POSIX EIO/EAGAIN且未应用alternate icon。两次 `sourceUnchanged=true`、同源digest `e2289de79d3e8826f27557cf1b24362b541a12af03854f19a6748988b87d864e`。只能确认共享真实主屏定位通过，不能宣称本机图标切换、重启持久化及恢复主图标通过。
- `testGlobalCoverThemeChangesAcrossPages`：活动场景在20秒窗口内找到三色边缘像素；重启后静止场景14点未同时出现RGB主导色，475.49秒失败。重启前暂停帧只验证不透明、稳定，未验证三色；原始三元palette和native applied颜色未记录。代码已确认动画时间不跨进程保存，但当前证据不足以判定palette丢失或相位行为属于缺陷。下一步补充真实取色/应用值及屏幕采样诊断，保持亮度、稳定和运动验收，不以减弱颜色断言或增加相位持久化掩盖问题。
- `testUCloudSyncPreviewConflictRestartAndDeletion`：WebDAV用户名首字符输入开始，XCTest反复记录等待动画通知60秒，累计92次；后续仍在输入与收起WebDAV。没有到达同步业务失败断言。逐字符 `typeText` 放大了每次系统idle等待；键盘/AutoFill是否为源头仍待定向证据。本批将同步/备份两项用例中的11处逐字符调用改为整串 `typeText`，保留真实键盘输入、字段值和业务断言；相同字符仍由XCTest输入，避免每个字符都重新等待系统idle。此修正减少等待倍增，不把它写成已确定系统动画源头；本地同步专项 `SourceUITests-1793679416860` 为1/0/0、实际用例221.697秒，完整执行冲突预览、取消保留本地、选择云端、重启恢复、删除同步和连接清理；`sourceUnchanged=true`。本地未复现系统60秒等待，不能据此宣布云端系统等待源头已消除。备份专项 `SourceUITests-1793679777552` 也为1/0/0、实际用例183.184秒，上传/摘要回读、重启、预览恢复、无效备份拒绝、保留与删除断言全部通过。同步/备份同源digest `8a7d1716266433e0beda6614797a449e752393ccad23d31a355e6c26830a36b4`，均 `sourceUnchanged=true`。暂不把工作流180分钟上限调大，不全局关闭动画。

## 验证边界与后续

本地SDK26.2与云端iOS27分别记录。模拟器系统图标服务若实际拒绝切换，应保留错误及既有明确skip，不能将其报告为图标切换通过。运行中 `41563617753` 与最新pending `41575342000` 保留，未手动取消、重派旧提交；后续修正验证后正常push，交由 queue:single 替换旧pending。

此批是音枢自有测试与CI诊断，不新增Sollin样本、逆向观察或参考对齐结论。动态字号产品阶段的clean IPA与T7交付另见[专项回执](2026-11-03-dynamic-type-ruby-full-lyrics-report.md)。

本批 `npm run check` 为995/995、零失败。主屏截图SHA-256 `6d4db987b59c3ea7924eec8a55d00fd7203d0ebd2e0d596002416bbef7ad69b3`，独立provenance ready，人工亲看确认真实“音枢”标签及图标可见。Xcode在同步专项结束后报告可选simulator诊断采集找不到simctl；测试、xcresult、摘要与bundle采集已成功，该警告保留，不报告可选系统诊断成功。

同步冲突截图SHA-256 `22d00a4d71a5efde993f4cde1f8dae14383213b7ec418fac774810a51a3903cd`，独立provenance ready。人工亲看确认同一冲突同时展示本地/云端版本、预览与采用按钮，未选择时确认按钮禁用；只作音枢功能界面证据，不计Sollin像素/动效对齐。
