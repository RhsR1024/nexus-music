# 通用歌曲菜单与真实音源验收（2026-10-24）

本批从功能清单第一批中尚未共享的歌曲菜单开始实施。搜索的六组常显操作改为正式更多入口，与发现详情共用 TrackActions；保留下一首、入队、原曲收藏、歌单，以及搜索页的评论和匹配。PlaylistPicker 在同一 Sheet 内切换；评论内联呈现；收藏写失败保留菜单和重试信息。播放和入队继续走 services 与唯一权威队列。

本批不是第一批全部完成：跨页面长按多选/批量矩阵、完整搜索类型与状态、音乐库双歌单体系等仍须继续；不增加全项目完成百分比。

## 证据边界

复用 Q125 的功能清单/状态契约，不再扩采 Sollin。原生路由 R1/apk-reverse、APK gate --review 通过（离线案例仅3E/2F/2P，不能作为功能证据）；动态案例独立 case-guard 与 strict/hash review 为395E/101F/99P、3工作项、117事件，零错误/警告。exFAT 的 AppleDouble 只在审查进程内过滤，未改原始证据或审查脚本。功能来源沿已有搜索歌曲动作/队列/收藏和歌单路径，详见 [清单](SOLLIN_ANDROID_FEATURE_INVENTORY.md) 与 [状态契约](SOLLIN_ANDROID_STATE_CONTRACTS.md)。没有新增逆向、参考运行或私有服务探测声明。

五参考固定 HEAD 再核对为 joy d6f1af7、Q 547ccfe、wtf 6624ab5、Cy bf0d469、自有 Wayferar 8e47cdc。维护/许可/Android 边界沿 [参考比较](REFERENCE_COMPARISON.md) 和决策0028；本批原创组合既有组件，不复制源码、依赖、补丁或资源。

## 用户授权的真实音源

用户本轮明确授权导入 resources/V261020 全部真实脚本并实际使用。递归共23份，两个子目录合计1,499,141字节。通过正式地址导入入口，从仅监听127.0.0.1的临时本机服务逐份导入原始字节；没有改写脚本名称/内容，也没有把脚本编入 bundle。23/23份在模拟器 SQLite 中与原件 SHA256 匹配，23份启用意图持久化；首次运行界面显示22/23初始化成功，另外1份保留失败态。启用意图不等于初始化成功，更不等于每平台/每档位可解析。

原件、ZIP、私有清单/哈希明细、下载音频和完整日志仅留本机忽略目录。真实脚本没有提交。临时导入地址仅用于本机测试，不是源的官方订阅地址。测试保留23份脚本；不读取个人歌单或账号凭据。后续合成UI回归应使用隔离模拟器，避免真实源影响确定性夹具。

## 真实数据暴露的问题与修复

1. 经典页长署名歌词自动折为多行，推低并裁切控制区。紧凑三行预览现在每行有界、省略尾部，RN测量与原生TextKit使用同一个maxLines；完整文本保留在可访问性标签/完整歌词入口，其他歌词页面默认不限行。
2. 网易公开搜索有歌曲但缺封面URL，且多数真实LX源只声明musicUrl。OnlineProvider现在按精确原歌曲ID读取公开song/detail元数据，CoverService在LX pic之前使用该结果；保留四并发、超时、取消、清理代次及HTTPS规范化。没有引入账号或第二播放器。

悦音固定 wy.ts:78–105 提供公开 /api/v3/song/detail 与精确ID/al.picUrl 的协议参考；Q/wtf 的 wy/index.js:26、musicInfo.js:6是独立weapi取图链，不复制其加密/原生工程；Cy与Wayferar沿既有封面职责比较。本批按音枢HTTP接口原创实现，不据任何参考声称Sollin使用相同接口。

## 验证

- 完整业务/类型检查511/511，新增公开元数据身份匹配、无LX pic仍可取图、清理后迟到响应不能取图。新增测试首轮漏type import的失败已保留，修正后通过。
- 完整native套件 exit0，日志 build/logs/live-lyrics-bounds-native-20261024.log；既有Swift Sendable警告保留。
- 菜单 Release 联合回归 SourceUITests-1792848208458.xcresult：2/0/0，sourceUnchanged=true。涵盖搜索评论分页/重试/旋转/返回，以及发现两种呈现的收藏往返、歌单写入/重复保留/清理。首轮搜索输入可达失败保留，后续实际通过不改写旧结果。
- 首轮真实流程 SourceUITests-1792848766231.xcresult：23份导入/启用/公开搜索已执行；最终频谱断言因沿用舞台布局失败，不写整组通过。真实播放r2 SourceUITests-1792849810377.xcresult：1/0/0，但截图暴露长歌词裁切及缺封面，不写UI质量通过。
- 最终真实 Release SourceUITests-1792850412464.xcresult：1/0/0，exitCode=0、sourceUnchanged=true。真实公开歌曲搜索→解析→经典布局→封面成功→PCM频谱→完整暂停按钮/上下一首可达→暂停通过。使用128k请求档位，不推断实际编码码率；音频可命中此前真实源下载的缓存，不称每次冷下载。
- 最终结果 Info SHA256：19bf3c5a7b45b605bbe95d5e688e71e37584249d551a3a900a7ceb789d919279；真实播放器PNG：c796b9a5c79bea5b44f9db2cd712a96512aba7b5e22213adf6809d9bc2062bb9。日志/规格哈希见本机 run-manifest/index.json。测试结束后模拟器进入Shutdown，installedBundle快照不可用，不宣称完整provenanceReady；实际测试、xcresult及附件单独保留。
- UI按0079亲看真实截图，封面已显示、长歌词省略、播放/工具行无裁切。无全局90%门槛或与Sollin一致的动效声明。场景详见 [UI回执](ui-spec/shared-actions-live-2026-10-24.md)。

手机已配对可用，但本批未配置设备签名/安装，不计真机、后台、锁屏、耳机或签名验收。单首真实播放不代表23源全部平台与音质通过。失败源原因、其他页面真实内容与剩余功能批次继续；本批提交/归档/远端及CI状态另在交接记录。
