# 0044 mini 与底栏设置 Sheet

2026-10-18。依据[专项报告](../2026-10-18_reverse-sollin-mini-settings-report.md)E-018/F-017/P-017严格review18E/17F/17P、29事件通过，现有mini按钮和玻璃底栏设置改为原生pageSheet。没有据九枚举和三底栏字符串新增能力。

## 五参考比较

五个本机HEAD已逐一核对，许可/来源沿[参考比较](../REFERENCE_COMPARISON.md)。

| 固定参考 | 本批亲读实现与采纳职责 | 维护、Android与许可 |
| --- | --- | --- |
| 悦音d6f1af7 | common/MiniPlayer.tsx:42使用onOpenPlayer和权威播放状态，歌词身份/进度独立；不让设置持有第二队列 | Expo54接近当前基线，动画/音频依赖不复制；根MIT与README/资源边界保留，Android生命周期另验 |
| Q547ccfe | TimeoutExitEditModal.tsx:163、169、215分开控制显示/关闭与设置/定时职责 | RN0.73旧弹窗/store不引入；Apache2及逐文件许可保留，Android返回/窗口分别验 |
| wtf6624ab5 | DownloadModal/QualityModal.tsx:51–80显式show、选择、onHide清理 | 不搬选择前关闭/旧Dialog；音枢原子保存保留失败值；Apache2/逐文件边界，Android需原生模态验收 |
| Cybf0d469 | settingModal.tsx:403设置项模型，615原生菜单选中/动作 | Expo57/MenuView/RNTP不引入；Apache2与RNTP独立许可，原生选项呈现双端另验 |
| 自有Wayferar8e47cdc | SourceSettings.java:8–18外观入口/owner职责，58–59对话框关闭/动作 | Android Activity/车机与本批iOS Sheet不等价；自有与第三方/反编译边界保留，不复制Dialog实现 |

采纳呈现与保存/清理职责、权威播放边界；实现使用项目已有SheetModal和PreferenceStore，无新依赖、源码/资产/原生补丁移植。

## 行为与验证

外观行打开mini或navigation时不压入叶页history，底层分类与滚动保持；两者有独立标题/关闭按钮，系统下滑和显式关闭走同一清理。每次打开使用新session/key清理局部错误状态；关闭后的旧样式保存不能关闭新Sheet。mini现有按钮/排序/歌词预览及必留toggle、最多四个不变；底栏仍为真实玻璃/实色切换及降低透明度回退。

348业务/类型检查通过；正式入口`SourceUITests-1792262213912.xcresult`三项通过、零失败/跳过：mini/底栏最大辅助字号关闭/下滑/重开/滚动/重启159.603秒，主题46.171秒，Navidrome合成实音/PCM/八布局/暂停定位/mini四项上限排序/原曲收藏/实际录音歌词/重启/恢复默认并关闭后验证队列按钮消失/凭据清理242.101秒。已亲看mini与底栏大字Sheet和真实四按钮mini截图；大字长内容仍需滚动。未修改原生播放/脚本后端，无新依赖。清洁归档/push及对应iOS27继续；真实服务、签名、真机和完整参考运行等价仍待。小屏/大字可滚动，不以原生Sheet替代完整参考样式/几何/动效、真实服务、签名或真机验收。
