# 五平台歌单搜索实施回执

批次2补入歌单搜索：网易云、QQ音乐、酷我、酷狗、咪咕公开目录；歌曲/歌单切换、平台切换即时重搜、共用历史、加载/失败/空态/结束、追加分页及详情返回已接线。复用正式Discovery详情与权威队列，不新增播放器。专辑、艺术家、MV及原F/J全范围继续，不能把本批记五类型完成。

## 实现与来源

PlaylistSearchProvider持有五平台HTTPS契约，公开请求省略凭据；目录保留精确ID、真实封面/作者/曲数并限制响应。酷我真实接口返回单引号对象，原创字符串token转换后交给JSON解析，禁止eval。歌曲与歌单复用泛型分页协调器：旧查询隔离、取消、追加失败保留旧行、按ID去重，非末页完全重复时提示可重试而非虚假推进。正式搜索行点击/长按进入已有详情，关闭返回原结果。

五固定HEAD核对通过。主要采用Q-1515 547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a的五份src/utils/musicSdk/*/songList.js搜索契约（wy319、tx294、kw461、kg938、mg349），根LICENSE与源码逐字节匹配Git对象，保留Apache-2.0/LX/lyswhut归属。悦音固定搜索入口是歌曲职责对照；wtf固定songlist.ts独立聚合/分页可参考，但不采纳失败伪空态；Cy固定tx/songList.js契约交叉核对，旧HTTP与递归重试不移植。Wayferar仅沿既有固定范围/许可边界，不采用未跟踪恢复代码。未复制参考依赖、原生补丁、私人令牌或商业业务；不推断Sollin后端。哈希回执留本机build/search-playlists-20261028。

## 实际验证

npm run check：788通过/0失败，新增10项覆盖五契约/凭据隔离、畸形和空响应、酷我无执行解析、迟到与取消/重试/去重、分页不推进、数量类型。生产原生代码未改，本批不虚报重跑完整native套件。

真实公开HTTPS探测“欧美热歌榜”，page1/page2、limit10：网易10/10、QQ10/9、酷我10/10、酷狗10/10、咪咕10/10；第二页均有新增ID。仅目录元数据；实际详情只打开网易云音乐官方“网易云欧美热歌榜”，未读取私人账号/个人收藏或导入个人歌单。服务可变，不能外推所有平台详情和全状态矩阵。

最终正式Release专项testLivePlaylistSearch，SourceUITests-1793206230536.xcresult，1通过/0失败、74.113秒。先播放既有V261020链路的真实Shape of You（3:53、原生PCM可见及4秒进度推进）再暂停；正常底栏搜索，逐字输入并精确断言“欧美热歌榜”，官方作者校验、点击与长按详情、返回原结果、page2出现第31行、切回歌曲真实结果及暂停意图均通过。UI实见歌单30/341、详情100/200，目录总数不作固定断言。

最终源码digest d8787384f8c4e79ad9cfdfd2cc10703645c79747b61811a176b5c0773d65474c；5PNG全部ready并亲看，源码前后/current、candidate patch及外部输入一致。19条记录仅queue.cursor.v1/library.v1/playbackStats.v1/search.history.v1变化，两原音频SHA保持。音源与源脚本、原始响应/截图/xcresult仅本机忽略目录；未提交私人音源或凭据。

A/B是导航与radio的XCTest元素类型定位失败，已改Any查询；C虽链路通过，亲看发现中文一次输入仅首字“欧”，不采作完整查询验收。D增加逐字输入及精确值断言，截图显示完整关键词，作为最终回执。原始中间证据保留，不把失败或较弱证据写成最终通过。

## UI与未验边界

场景实施前登记见[规格](ui-spec/search-playlists-live-2026-10-28.md)，候选patch内原文SHA256 173ea4e65821a0c5e6a783d8cb0bbb08e38e9e19988c493511b2406618df5aeb. 实际1290×2796px/430×932pt@3x，blush/rose、system、coverColor=true，保留既有image背景；蓝色取色条件不充当纯默认渐变基线。亲看类型/平台行、封面/标题/作者/曲数、长标题换行、详情和mini安全区域，按体验质量验收，无同态Sollin量测或录屏，不编造visual-lab/动效分数。点击/长按及返回是实际交互，转场弹簧和连续手势一致性未验。

实体设备当前developerMode disabled、tunnel disconnected；未做实体机、签名、真实在线音频解析、五平台详情全矩阵、断网失败/空态真实UI和大字体矩阵。上述保持开放。既有ec40b10的CI40698493072：checks成功，iOS21通过/1失败；失败是testVisualImagesAndPlayerBackgroundPersistence读取backgroundOpacity时背景面板不在树中，未在本批声称修复。新提交CI另核对，不以本机专项替代全回归。

## 门禁与存储

原生master-route、APK gate和--review通过；原有功能案例严格verify-hashes仍395E/101F/99P、3WI/124事件、0错误/警告，无新增Sollin采集。安装前提3E不代替功能证据。阶段目录占用与磁盘审计约5.3GiB可用，正在使用的DerivedData与引用证据保留，无盲删；仅关闭本批自用模拟器。完整收据位于本机build/search-playlists-20261028与build/search-playlists-live-20261029-d。
