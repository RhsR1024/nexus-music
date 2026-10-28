# QQ账号歌单只读复制

批次8接线QQ账号创建/收藏和“我喜欢”的只读目录、完整曲目预览、确认复制到音枢歌单本机副本，复用网易已有账号/请求/预览归属与取消提交保护。不会远端收藏/写入、同步、修改设备媒体库，凭据不进入Track、播放器或LX。不把QQ普通登录当作官方日推授权，也不新增微信PC配对。

## Evidence → Finding → Path

| Evidence | Finding | Path |
|---|---|---|
| Q-music Android固定5db858f，9个来源/许可文件逐字节匹配Git对象 | PlaylistBaseRead创建列表、PlaylistFavRead分页、DissInfo目录/曲目与特殊dir201，QQ登录类型与musicu认证字段 | 自写QQPlaylists，复用既有Cookie筛选/资料验证/清理Track及LibraryStore；不复制Android依赖、同步或远端写逻辑 |
| 实际原生路由/APK门禁及既有395E/101F/99P、3工作项/124事件严格审核 | 安装案例只作前提，既有可见功能范围未增加 | 采用现有脱敏资料；独立provider协议不冒充Sollin接口 |
| 新受控协议/存储检查 | 分页截断/重复、总数变化/遗忘、缺曲目元数据、超限、账号失效、取消写入回滚和私密错误隔离 | 完整结果才发布预览、显式确认后只写本机音乐库 |

来源检查在本机build/qq-playlists-20261028/reference-check.json，保留Apache-2.0与Nshpiter/LX归属，不重授权全项目。普通资料验证仅在返回已验证身份后附加有界encryptedUin供账号读取，登录保存仍只取userId/nickname和原Cookie，新增字段不落账号仓库。所有认证请求固定QQ官方HTTPS地址。

目录：创建API明确hasmore时拒绝截断；收藏按原始行数推进、拒绝循环/缺终态；“我喜欢”来自已成功读取的dir201实际总数，不制造未登录入口成功。目录最多10000张歌单、每张最多10000首；收藏/详情分页单页100、至多100页；QQ numeric参数只接受安全整数，不把长ID通过Number静默舍入。详情支持目录ID/歌单ID，逐页保序，稳定总数与终态一致、重复/缺MID/媒体信息拒绝预览。失败文案脱敏，封面token链接剔除。

完整读取后预览显示前5首和总数，导入后可查看全部；不宣称预览已逐行展示全歌单。正式卡片按平台隔离状态并复用既有滚动/独立预览弹层，取消或账号替换使迟到结果失效；确认回调验证当前页面/账号/预览归属。库提交仍是成功边界，写入中取消在串行队列内回滚。实际SQLite崩溃或回滚失败不据受控测试声称已验。

## 验证与开放范围

受控检查不访问真实账号/私人歌单。真实资料入口采用V261020来源公开Shape of You完整233.744秒MP3，SHA256 be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203；正常导航/官方匿名页/关闭/重启与原网易入口分别核验。精确结果见下方最终回执，见[场景](ui-spec/qq-account-playlists-live-2026-10-28.md)。

真实QQ账号目录、完整曲目与导入、Keychain/SQLite故障、实体机签名及动效仍开放；不使用私人凭据或真实个人歌单，不将受控HTTP检查称真实服务通过。原QQ官网缺字与普通取消提示完整可见边界保留；酷狗账号歌单和微信配对继续，不报F30或全项目完成。

## 最终回执

742项类型/业务检查全部通过：新增10项QQ歌单与1项资料字段检查，受控HTTP不访问真实账号。首轮Node strip-only拒绝构造器参数属性，已改为普通字段后验证通过；不把此失败记成功。R1 Release为1通过/0失败、65.382秒（SourceUITests-1793177112699.xcresult），其后补dir201缺目录数量与专辑对象检查，R1不作最终候选证明。

| 最终场景 | 精确xcresult | 结果 |
|---|---|---|
| QQ新入口、实际公开音频进度/PCM、官方快捷登录页、关闭/重启 | SourceUITests-1793177390205.xcresult | 1通过/0失败，62.292秒 |
| 网易原入口、实际公开音频进度/PCM、官方登录页、关闭/重启 | SourceUITests-1793177548133.xcresult | 1通过/0失败，56.658秒 |

两轮source digest均641be81339963d5495aaa1223de91347ca8cba47bd6e167ba4df55cfddcbf852，源码前后/校验时工作树一致、candidate.patch摘要匹配、实际安装JS/原生包身份及外部音频输入齐全，6张PNG均ready并亲看。回执分别保存在本机build/qq-playlists-live-20261028-r2/和build/qq-playlists-netease-live-20261028-r3/。所有目标卡片说明/登录按钮完整位于mini上方；实际QQ快捷登录及网易页中文可读，不把本次未打开的QQ密码表单/Skills历史缺字算修复。窗口取消与重启不保存账号、不显示目录加载，不测试私人授权。

两轮19条记录数量保持，仅queue.cursor.v1/library.v1/playbackStats.v1随实际播放更新，其余16条摘要保持；两原音频字节/SHA不变（Shape be80…3203，Perfect 086eb96aef026bf336cf5884037a17b28f519b453c19547f3b29093f32ddda39）。这不是授权态复制或实际云端服务验收。reverse-skill APK --review与功能案例严格复审均通过；未新增Sollin证据、没有用安装结果代替功能。

本阶段检查了磁盘与build主要占用，剩余约5GB；保留当前DerivedData、必要失败/来源证据与现用音频，未确认可安全删除的重复物，不盲删或迁移。清理审查在本机build/qq-playlists-20261028/retention-review.json。
