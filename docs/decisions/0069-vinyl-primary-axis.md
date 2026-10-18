# 0069 黑胶主轴方向与后部配重

2026-10-18，继续既有A09对齐，不计全部播放器或交付完成。按[新报告](../2026-10-18_reverse-sollin-vinyl-vector-report.md)的R2路由203610、原IPA scope门禁、E038→F037→P037和独立1886原始指令/258BL/108池引用/20方向向量，采纳前38E/37F/37P strict review零错误/警告。

0068只恢复父坐标，保留了原创4°/24°与较长唱臂。本批补齐cos/sin身份、主轴端点和不泄漏的局部画布变换后，才将RN向下主轴改为0°/21.6°，可见中心线从支点+.035S到+.395S。增加支点后方局部配重中心-.095S，RN对应宽.078S/高.112S、顶-.151S。唱头暂以原创矩形外观覆盖末端附近，完整多点路径/渐变/高光不宣称恢复；三次缓动与系统门控仍为音枢策略。没有新增拖针行为或第二播放状态。

五参考沿本轮亲读与固定HEAD比较[0068](0068-vinyl-layered-geometry.md)：悦音d6f1af7 NowPlaying290–314匀速native loop；Q547ccfe/wtf6624ab5 Vertical/Pic15–44静态图片/导航；Cybf0d469 PlayerControls30–45实际播放与意图区分；自有Wayferar8e47cdc QueueIndicator16–44动画缩放/附着/可见。均不提供本批机械主轴/配重实现；有限几何依据门禁后的Sollin证据，音枢自己写View。许可保留悦音MIT/README限制冲突、Q/wtf Apache2与逐文件独立头、Cy Apache2/RNTP独立、Wayferar自有/反编译/第三方及无根LICENSE边界。维护避免引入旧RN导航或Cy新Expo/RNTP/原生补丁；TS几何未来可共享Android，渲染与生命周期分别验收。无代码/资产/依赖移植。

保留歌曲身份相位、13513.514ms匀速native旋转、独立620/480ms唱针、ready/intent/buffering、减少动态效果/前后台/呈现门控，以及PCM/EQ和唯一队列。实际App保留81点非空停转/旋转、Home恢复和唱针frame往返，并增加实际唱头向左进入盘托、暂停返回原位置、固定支点不移动、后部配重在画布内。所有原八布局/PCM/歌词/统计/重启/凭据清理继续；业务/类型、App、截图、归档、云端分别记终态。

本批独立App最终结果SourceUITests-1792327473473：299.054秒、1通过/0失败/0跳过。唱头/配重/支点范围、停转/旋转像素、Home恢复及全部原PCM/八布局/歌词/统计/重启/凭据清理通过；两张必要PNG已导出并亲看，留build/vinyl-vector-passed，原xcresult和ui-vinyl-vector-*保留，临时完整导出自动删除。随后0070另修主体尺寸并单独回归，不用本批成功替代其验收。
