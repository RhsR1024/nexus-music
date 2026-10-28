# QQ独立官方日推授权实施回执

账号批次8新增正式QQ卡片的独立官方Skills授权入口、验证/绑定/保存与移除授权。原有QQ网页登录和私人雷达保持独立；不增加手工key输入，不将页面打开当成完整授权或日推成功。完整真实授权仍需专用非私人测试账号。

| Evidence | Finding | Path |
|---|---|---|
| 固定Q-music Android `5db858f32695d10c5e9ef0f7037d586aef6a8c4b` 的dailyAuthorization/daily/requests/qqCredentials/cookies、LoginPage及说明/三归属文件共十份逐字节一致 | Skills独立桌面页、qmk格式、官方读取与普通登录不同 | 原创非持久WebKit/主文档读取，不复制RN消息桥、依赖、Android原生补丁 |
| 26项账号/QQ相关自动检查，全量718通过 | 绑定身份、取消/迟到/写入回滚、清除授权保留登录、账号替换保护、内部取消可重试 | QQDailyAuthorization及MusicAccounts期望对象检查；映射不等于真实跨午夜验收 |
| 原生MusicWebLoginPolicy实际源码抽取编译测试 | QQ Skills允许y.qq.com/a.qq.com的HTTPS默认端口，拒绝伪域/用户信息/非HTTPS/异常端口 | 原生主文档来源门禁；不接受任意子frame消息 |

## 实施与隐私

独立官方网页使用新的非持久WebKit数据仓库、桌面UA与原生关闭/期限。仅当前主文档在y.qq.com/a.qq.com时读取qmk格式key；读取前后复核导航代次与URL，再从同一WebKit仓库取得白名单QQ Cookie。主页面导航变化、关闭、后台或失焦取消旧尝试。Cookie身份冲突/WX身份不绑定QQ。

协调器再次验证Cookie身份与目标账号（若指定），验证官方资料/音乐账号及独立日推读取，之后才把key及owner写入同一账号Keychain会话。读取响应本身不单独证明归属；身份还依赖同一官方网页/仓库与账号资料链，真实服务兼容性仍未验。普通QQ重新登录不会自动继承旧key；owner不匹配的key不发给日推接口。key不进可恢复元数据、URL、UI状态、日志或备份。

MusicAccounts新增可选期望账号对象/期望不存在检查，在串行写入内部防止旧尝试覆盖新账号；已有调用未启用该条件时保持原语义。取消贯穿验证/哈希/写入，写入中取消回滚。全局入口也保留开始时的账号快照，拒绝复活已退出或替换的同身份账号；设置页退出撤销待完成网页登录/日推授权。移除日推授权只清key/owner及daily能力，保留QQ会话。真实存储故障/崩溃仍需独立验收。

推荐读取内部取消（包括跨日期）现在进入可重试错误终态；外部Abort/旧代次仍由原调用方忽略。只验证消息映射/代码接线，没有伪称实际跨午夜运行。

原生路由/APK prerequisite与--review通过；既有动态功能case strict review通过，395E/101F/99P、3WI/124timeline，0错误/警告。默认安装case不作功能证据，没有新的Sollin采集或接口推断。Apache/Nshpiter/LX NOTICE继续保留，音枢自写原生/存储边界。

## 实际验证

718检查、相关26项、原生策略通过。真实公开音频库R1正式入口Release1/0/0、47.179秒通过，但人检取消提示部分被mini遮挡，因此将状态放在按钮上方并增加实际mini几何断言，R2初始设置首击未选中、停留发现，未进入新路径；R3新增实际tab选中断言与仅未选中时重复同一可见控件一次，原视口断言保留，R3阶段1/0/0、42.864秒通过（`build/SourceUITests-1793151527360.xcresult`），未触发重复点击。四张实际PNG均ready并亲看，取消提示完整位于mini上方，19记录及两份原音频摘要不变；源码`574a5c8d3837134cad94e98e56f984bdbf013ee73c98a137b074c034e52fdd63`与输入摘要保持，专用模拟器已关闭。首击未生效原因仍未确认；官网Skills正文有字形缺失（主要按钮可见），原因未确认，不记网页兼容通过。执行前只读检查19条记录无已知合成曲目，保持两份实际原音频。场景为正常设置导航→官方页面（不输入凭据）→关闭→重开/后台关闭→重启不产生账号或授权；详见[场景](ui-spec/qq-daily-authorization-live-2026-10-28.md)。

未验证：真实QQ授权后key捕获/身份链、实际日推与播放、真实会话失效/Keychain故障/崩溃、实际跨午夜、实体机/签名/后台完整性及动效。匿名网页、模拟验证/存储和编译不代表这些通过；全部开放项继续。

实体机只读复查仍为开发者模式关闭/DDI不可用。复验使用全新输出目录：

```bash
source scripts/environment.sh
NEXUS_SIMULATOR_ID=A8347A1F-0805-4731-B8CE-3FE48C156AC0 \
NEXUS_UI_RUN_DIR=build/qq-daily-auth-live-20261028-r3 \
NEXUS_UI_LOCAL_AUDIO="/Users/ningli/WorkSpace/NexusMusic/build/local-sort-live-20261025/Shape of You - Ed Sheeran.mp3" \
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLiveQQDailyAuthorization
```

最终R4在补充全局入口退出防复活测试后通过：Release1/0/0、49.582秒，`SourceUITests-1793168356960.xcresult`；四张真实PNG ready/亲看，取消提示完整位于mini上方。19记录/两原音频、源码`05978c6320c77bb848cdf254eb90dcbd693926c289d667bd441b7c90b6fa4600`及输入摘要均保持，专用模拟器已关闭；718检查、26相关与原生策略通过。R3作为之前阶段通过保留，最终采用R4。
