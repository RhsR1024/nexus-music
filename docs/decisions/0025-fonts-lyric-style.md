# 0025 全局/歌词字体与歌词样式

2026-10-16；F10/F25/F27，J41/J44，延续0008/0015。参考固定提交与许可见REFERENCE_COMPARISON。

Q-1515和wtf `src/components/common/Text.tsx:1–55` 以公共Text控制字号/色彩，fontFamily并未开启，不能认定已完成导入全局字体；借鉴入口职责而非复制组件/动画。Cy `src/components/lyric/lyricItem.tsx` 将歌词字号与行动画分开，依然不能替代本项目原生逐字。悦音 `src/core/lyric/parser.ts` 是行数据，不承担字体文件生命周期。Sollin `src/pages/Settings.tsx:270–315` 用DOM @font-face和data URL，不能直接带入RN或把字体明文混在音乐库备份。Wayferar固定提交的docs/IMPORT_BROWSER_FONT_LIBRARY、LOCAL_SOURCE_IMPORT和CONSOLE_NAVIDROME_FOLLOWUP记录TTF/OTF导入、系统/导入回退与可滚动界面；Android路径/扫码接收/权限不移植。均原创重写、无新第三方字体、依赖或复制源码。原有MIT/Apache/自有资产边界保留。

继续使用App私有lyric-fonts目录及SHA256文件名，迁移旧fonts.v1的selected到独立歌词选择；新增全局选择及歌词跟随全局/系统/独立导入字体优先级。旧null默认跟随全局，此前没有全局字体时外观仍为系统。最多16个、单文件20MiB，真实字体加载成功且SQLite写入成功后发布；失败保留旧选择。删除回退相关选择，重启缺文件/加载失败可恢复；不保存外部绝对文件地址。公共Text/输入组件使用全局字体，歌词测量与原生绘制使用同一个有效歌词字体，图标字体不替换。

歌词颜色、行高/间距、非当前行模糊和逐字强调采用有界原子偏好，默认保持既有视觉。原生只刷新当前可见时间行，非当前行静态模糊缓存，不用每帧React列表更新。系统减少动态效果保留；字体/样式切换不重建播放器或改变队列。

字体UI验收使用项目原创最小TrueType字形，测试运行时通过真实Files选择器导入，不复制系统或参考字体到仓库/产物。TS状态/优先级和偏好可共享Android，Expo字体文件适配及原生TextKit/CoreImage需各平台实现。验证旧设置/缺文件/失败回滚/并发删除、字体优先级与原生真实字形、重启和切歌；本地及云端分开记录，真机性能继续保留。
