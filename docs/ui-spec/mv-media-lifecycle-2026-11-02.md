# MV 真实媒体与全屏生命周期

本批补强现有 MV 独立 WebKit 页面的可观察结果。页面继续使用临时网站数据、官方 HTTPS 页面与单一权威音乐播放器；不读取或保存临时媒体 URL，不新增脚本消息桥、账号 Cookie、第二队列或自动播放。音枢自有适配，不采纳新的 Sollin 结论或第三方实现。

## 场景与质量要求

1. 在真实公开网易歌曲已播放时打开 QQ 公开 MV：正式搜索/详情入口先暂停音乐，MV 页面加载后可点击页面内原生控件开始媒体播放。
2. 页面真实进入 `playing` 后截图；通过 WebKit 自身的 `requestMediaPlaybackState` 读取状态，不解析私有媒体 URL，也不把 DOM 标题或海报当作起播。
3. 若页面提供全屏控件，实际进入全屏并核对可见系统全屏层；退出后回到原页面。若页面触发 WebKit 全屏，再单独核对 `fullscreenState` 的 `entering/fullscreen/exiting`；若页面改用系统原生媒体全屏，则以系统 `Close Button` 的开/关为验收，同时保留 `WKWebView.fullscreenState` 仍为 `inline` 的实际观测，不混写两种机制。
4. App 进入后台后 WebKit 媒体必须为 `paused` 或 `suspended`，回前台不自动续播；权威音乐仍保持暂停、原队列与原进度不变。
5. 返回后可重新打开原音乐播放页，确认仍是暂停状态且进度未因网页媒体改变；测试只清理本轮的 MV 收藏/页面状态，不处理账号或私人数据。

本批新增的是可读媒体生命周期提示，沿用现有标题、来源、收藏、返回/刷新和原生容器。当前 iPhone 常态范围下只做实际控件可达、状态准确与页面不遮挡验收，不声明与 Sollin 像素/动效一致。

## 验证证据

正式 Release `SourceUITests-1793583694048` 为 1/0/0、118.932 秒，`sourceUnchanged=true`。真实酷狗公开页面从 `media:paused,fullscreen:inline` 起播到 `media:playing,fullscreen:inline`；系统原生全屏期间仍报告 `paused,inline`，可见系统 `Close Button` 成功进入和退出；Home 后回前台稳定为 `suspended` 或 `paused` 且不自动续播。原合成音乐保持暂停、队列不变、进度停在 `00:12`。

四张 1290×2796 PNG 逐张 provenance ready 并亲看：暂停音乐/队列、后台挂起、原生全屏、WebKit 实际播放。精确截图、manifest、xcresult、源码与安装 bundle 摘要见[阶段回执](../2026-11-02_mv-media-lifecycle-report.md)。模拟器网页内媒体通过不等同于实体机声音路由、锁屏/通话中断、WebKit 自身全屏、全部平台全屏控件或真实签名；这些项继续开放。
