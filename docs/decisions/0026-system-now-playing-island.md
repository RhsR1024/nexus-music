# 0026 系统 Now Playing 与灵动岛媒体面板

日期：2026-10-16。状态：需求和技术边界确定，待补齐实现/双构建及真机验收。关联 F06/F37、J30/J59、TASK_PLAN S10。

## 用户目标

后台播放时紧凑灵动岛显示当前歌曲封面和右侧律动；展开后可以查看歌曲/歌手/进度，并进行上一首、播放暂停、下一首、收藏及输出路由操作。两张用户图片是视觉/操作目标，不作为参考 App 源码或功能已验证的证据，不复制其中封面资产。

## 官方边界与采用路径

已于2026-10-16查阅 Apple 官方页面：

- [iPhone Dynamic Island 使用说明](https://support.apple.com/guide/iphone/view-activities-in-the-dynamic-island-iph28f50d10d/ios)：长按展开活动、上滑收起。通常轻点回到对应 App，具体交互按 iOS27 真机核验。
- [MPNowPlayingInfoCenter](https://developer.apple.com/documentation/mediaplayer/mpnowplayinginfocenter)：App提供当前媒体字典，系统展示锁屏/控制中心等信息；文档明确应用不能直接控制系统显示的字段及格式。
- [MPRemoteCommandCenter](https://developer.apple.com/documentation/mediaplayer/mpremotecommandcenter)：注册系统媒体命令到 App 的播放行为。
- [likeCommand](https://developer.apple.com/documentation/mediaplayer/mpremotecommandcenter/likecommand)：反馈命令的处理与本地化含义由 App 实现；不保证所有系统表面都显示对应按钮。

图中标准媒体界面的外框、封面位置、律动和展开样式由 iOS 绘制；App应设置 AVAudioSession playback/后台音频、Now Playing 元数据/封面，并处理命令。系统律动不等价于音枢原生 FFT 输出，不能据此宣称频谱准确或自行控制条形动画。

优先扩展现有 MediaPlayer 接入。此目标没有证明需要独立 ActivityKit/Widget Extension，不先添加新 target、后台高频更新或第二套播放状态。以后如出现标准面板不能覆盖的明确自定义需求，另行核验系统公开能力并记录方案，不能通过自定义扩展承诺强制常驻/任意后台动画/复制系统路由控件。

## 当前代码证据

- `modules/nexus-native/ios/NativePlaybackEngine.swift`：init注册 play/pause/toggle/next/previous/changePlaybackPosition；play配置音频会话；updateNowPlaying发布标题、歌手、时长、进度及播放速率。
- 同文件未接入 `MPMediaItemArtwork`、`likeCommand`/收藏状态；已有封面 UI/缓存不能当作系统封面已实现。
- 当前无 ActivityKit/独立 Live Activity；基础原生播放/模拟器实音通过不能代替用户设备灵动岛验收。

## 应用需要补齐的行为

1. 复用已有封面获取/鉴权边界及受限缓存，把已解码封面发布到 Now Playing；使用条目与实际录音标识隔离迟到结果，换曲/清队列释放旧封面。向系统传图像和文字，不传认证 URL。
2. 同一队列处理播放、暂停、上一首、下一首及定位；暂停先进入原生权威意图，迟到解析/封面不得恢复播放；系统进度与实际媒体一致。
3. 收藏反馈指向音枢本地收藏，使用原曲身份，实际匹配录音只用于正确展示；外部变更回写命令状态，快速切曲、失败和重复点击保持一致。Navidrome服务器星标单独按已有写回语义验收。
4. 系统决定收藏按钮是否出现在展开面板，需在用户iOS27设备验证其可见/可达/状态；不显示时记录限制并保留App内入口，不把“已注册”算作系统收藏验收通过。
5. 输出图标、可选设备及布局由系统路由管理，核验真实耳机/蓝牙、断开和中断；不因此增加CarPlay/DLNA等范围。

## 验收证据

- 原生/业务测试：封面换曲竞态/缺图/失败/清理；控制意图与队列一致；收藏身份/状态/失败及迟到回调；凭据排除。
- 本地Intel/Xcode26.3/SDK26.2及云端Apple Silicon/Xcode27/iOS27分别编译、相关回归与IPA，记录对应提交和结果。
- 用户iPhone15 Pro Max/iOS27：真实后台紧凑封面/律动、长按展开/轻点返回、曲名/歌手/进度、暂停/继续/切歌/收藏/路由；长标题/无封面/弱网/快速切歌/自然结束/停止/其他媒体App接管/减少动态效果。
- 无灵动岛设备仍保留系统锁屏/控制中心。模拟器不具备的交互、签名/后台和设备路由，明确保留为真机缺口。

此记录只确定用户需求和系统职责；尚未实施的封面/收藏及未完成的验收不标完成。后续生产代码变更前继续按REFERENCE_COMPARISON复核五参考的具体系统媒体实现和许可；本次无第三方代码、资产或依赖采纳。Android需要自己的MediaSession/通知集成，不适用iOS灵动岛UI。
