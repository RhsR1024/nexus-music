# 咪咕艺术家歌曲目录

正式艺术家详情改用咪咕官网当前公开的ID目录，替代持续返回`299996`的旧`querySingerSong`。搜索、歌曲菜单、筛选、刷新与唯一播放队列继续复用既有组件。本批不关闭完整J09：艺术家专辑目录、数字专辑详情、全平台错误矩阵、实体机和签名仍待。

## 来源与实现

官网`https://music.migu.cn/v5/`的公开模块`main-4f72ecaf.js`及`singerDetail-2b271d81.js`明确使用`/pc/bmw/singer/song/v1.0?pageNo=…&singerId=…&type=1`；匿名HTTPS响应与页面契约交叉核验。模块SHA-256分别为`543c2be4efa82f3cc87c67515c0088c1774b5307aba8cedd9108c65e120af810`、`6d71b98e1fb7cc5e83b572d5678ba94844b47a6397b2351bc2d122e3ec53bd00`。只采用公开协议事实，未复制网站代码、素材、依赖或登录逻辑。五参考项目既有职责/维护/Android/许可比较沿[参考比较](REFERENCE_COMPARISON.md)，无新增第三方实现采纳；无新增Sollin结论或私人服务探测。

Evidence：真实响应固定50首/页，并忽略`pageSize`；歌曲含`songId`、`copyrightId`与`singerList[].id`，外层给出旧HTTP续页提示。Finding：不能按请求limit直接计算下一页或跟随该URL，也不能用艺术家名称搜索替代ID目录。Path：原创`miguArtistSongs`按固定50条上游分页重新切片；仅请求固定HTTPS官方主机，校验续页的主机、路径、艺术家、页号及type，不请求响应提供的URL。逐曲核对歌手ID，保留原歌曲/版权身份、时长、音质及歌词字段；相对封面路径转官方HTTPS地址并作公开URL检查。短页结束时才能确认目录计数，搜索摘要不充当已核验总数。坏信封、陌生布局、错误身份、回退/重复分页和取消均拒绝，不发布半批结果。

纯适配器可用于未来Android；本批没有添加Android版本或原生补丁。未改变LX、Navidrome或播放器边界。

## 验证

`npm run check`为1001通过/0失败。14项聚焦测试覆盖五平台原有艺术家行为、新咪咕跨页无漏项、精确身份/元数据、终页、取消及畸形/错误响应；`node --check scripts/test-ui.mjs`通过。原生产品代码未改，真实Release UI构建已编译测试目标。

匿名真实样本艺术家`1001059221`：前两页各50个且共100个不同歌曲ID；第5页41首、没有下一页，观察到总数241。limit30/page2与独立50条分页的第30至59项完全一致。该抽样不证明全部歌曲、全库或播放成功。忽略目录`work/migu-artist-public-20261103/`保留原响应、官网模块及哈希；`live-oracle.json` SHA-256为`c82f8fc649f18876cbd99c0450abfba06f4027700ff89794db4140a20b623a79`。

正式生产入口Release专项：

```bash
source scripts/environment.sh
NEXUS_UI_RUN_DIR=build/migu-artist-songs-live-20261103-r2 node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLiveMiguArtistSongs
```

`SourceUITests-1793718304588.xcresult`为1通过/0失败/0跳过，45.376秒、exit0、`sourceUnchanged=true`；源码digest`a6e2322744b03a52764cbba2ac23ccc6ab4f0b7380d83126eed9c834e4e7c925`，安装bundle`81965b767456877d430e408e60878da5c119bf448e1008972da84ccc2c5a6dec`。正常底栏搜索咪咕艺术家→50首→本地零匹配筛选→加载至100首→清空筛选→刷新回50首→返回原搜索通过。3张1290×2796截图从精确xcresult导出并亲看：真实封面/曲名可读，搜索摘要和实际加载计数分开，局部筛选说明及暂停mini保持；只作音枢质量/功能验收，不声明Sollin像素或动效等价。

首轮`1793718042483`的业务操作已执行，末尾启动状态断言失败：测试过早记录mini不存在，异步恢复后mini出现。保留失败与附件；第二轮显式等待保存播放器恢复，并独立对比SQLite内指定记录哈希：`queue.v1`、`queue.cursor.v1`、`preferences.v1`均完全一致。浏览不播放、不解析媒体，不修改歌曲收藏或音频文件。

## 待验与下一步

咪咕艺术家专辑已发现新公开目录，但包含普通和数字专辑不同资源身份，尚未接入。继续按ID/资源类型建立详情与分页；不把未支持条目套入普通专辑接口。真实弱网/限流/大曲库、全部歌曲操作/播放、VoiceOver/小屏、实体签名和本提交iOS27终态仍待。本机SDK26.2/iOS26.3.1模拟器结果不替代这些证据，F/J目标继续。
