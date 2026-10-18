# 0063 评论 Sheet、固定操作行与虚拟分区

2026-10-18，A09/S7/F31/J11。原评论全屏页面把收起、标题、刷新和全部热门评论放在FlatList的Header中，滚动会丢失操作入口，热门内容也未虚拟化。本批按Sollin IPA E033→F032→P032的原始指令/闭包/子节点关系，将独立评论改为Sheet，标题/刷新固定，热门/最新评论纳入SectionList虚拟分区。静态证据与边界见[报告](../2026-10-18_reverse-sollin-comments-report.md)。采纳前reverse-skill严格review33E/32F/32P、11WI/75事件通过，零错误/警告。

## 五参考核对

本机逐一核对固定HEAD并亲读下列实现，许可沿[参考比较](../REFERENCE_COMPARISON.md)及[0021](0021-public-comments.md)。不复制源码、图标资源、网络SDK、依赖或原生补丁。

| 参考 / 固定HEAD | 本批实现证据 | 维护、许可、Android与取舍 |
| --- | --- | --- |
| 悦音 d6f1af7f911e84babce56cd07297b44cfe46eed9 | `src/screens/NowPlaying/CommentSheet.tsx:194`刷新保留与`:250`追加；request token隔离 | 根MIT/README限制保留；可对照失败恢复职责，不复制其缓存/状态链，音枢保留已有Abort/session |
| Q-1515 547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a | `src/screens/Comment/utils.ts:26`普通/热门请求和列表去重 | Apache2/逐文件许可；旧RN/Android导航、递归重试与日志不迁入；本批不改provider |
| wtfdelphia 6624ab58cbd2f5bda52ab8006912d3c60dc1f847 | `src/screens/Comment/components/Header.tsx:27`独立标题返回；`components/List.tsx:89`FlatList/refresh/status footer | Apache2/逐文件许可；Header职责可对照，但不复制旧导航和Android状态栏、列表controller；使用音枢现有Sheet/SectionList |
| CyMusic bf0d4694acb52973bcd594d31b3c61f655e166cb | `src/components/utils/musicSdk/tx/comment.js:80`数值ID映射，`:95`评论请求 | Apache2/RNTP另许可；该局部仅后端，不能当Sheet证据；Map缺键、HTTP及Expo/RNTP不采纳 |
| 自有Wayferar 8e47cdc701cdbb772577b2bf7abb699e285b0fa6 | `docs/BUILDING.md:3/42`权威Smali/新增Java与构建边界 | 稀疏资料不证明评论UI，不称全仓无功能；Android/车机和反编译第三方资产不能整体迁入iOS，漫途持续同步不实现 |

## 边界与验证

- 保留精确原曲评论归属，换源不改变线程；不发表/点赞写入、不存全文、无凭据变化。
- 维持普通评论原始offset、1000项上限、失败保留旧内容、重试原游标、取消/迟到隔离。
- 标题使用22号与单行省略，刷新/关闭44点触控目标；热门/最新分区不吸顶，不逐帧重渲染。头像/精确配色/像素几何仍无该批证据，不冒称完整参考等价。
- 独立Sheet采用当前Modal的SafeAreaProvider/SafeAreaView，支持旋转和系统下滑收起；AM2嵌入内容继续受其父容器约束，无嵌套Modal。
- 验收沿现有公开评论App专项追加固定头的滚动前后坐标、横竖屏/可达、刷新及下滑关闭；原热门/普通、分页失败留旧、重试、刷新和不启动播放断言保留。387业务/类型通过；App/本地归档/云端各批实际结果另记，非真机或真实接口证明。
