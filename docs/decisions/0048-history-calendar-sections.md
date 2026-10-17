# 0048 播放历史本机日期分隔

2026-10-18，A08。reverse-skill mobile-reverse E022/F021/P021，strict review22E/21F/21P、8WI/38事件，零错误/警告；原始2033指令/15BL/5分配头及池偏移支持日期标记、日期标题/歌曲行分开、移除/清空/播放分别进入处理器。准确参考时区/日期文字/动态策略未知，采用原创本机YYYY-MM-DD及HH:mm，不声称完整等价。

## 五参考比较与边界

五个固定HEAD重新核对，来源与许可沿[参考比较](../REFERENCE_COMPARISON.md)。悦音d6f1af7的src/store/reducers/playlist.ts:25–55按id更新/移除和hydrate；保留音枢原子仓储，不引入另一Redux。Q547ccfe的SonglistDetail/state.ts:4–13独立详情上下文、Header.tsx:75–100提供详情状态/布局；不复制RN0.73导航/动画。wtf6624ab5的src/store/list/action.ts:5–24按列表身份发布更新/抓取状态；保留音枢稳定身份/重复曲序，不引入全局事件栈。Cybf0d469的src/store/library.tsx:9–28单独曲目/收藏/歌单/page/hasMore、commonConst.ts:4–10区分时间戳和历史表ID；声明不是日期分组实现证据，不复制其placeholder或RNTP/Expo57。自有Wayferar8e47cdc的docs/CORE_CLEANUP_REPORT.md:15–25保留最近播放/音乐数据库及媒体模块；Android/smali权威与反编译Java分开，不搬车机服务。

维护/许可：悦音Expo54近基线/root MIT及资源独立；Q/wtf旧RN/fork和Apache2/第三方边界；Cy超基线依赖、Apache2/原生许可独立；Wayferar自有改动/第三方分别保留。新逻辑是纯TS本机日期展示，未来Android可共享但系统时区/可访问性/运行另验。没有复制代码、资源、依赖、AOT或私有后端。

## 实施与验收

仅现有最近播放前20项及加载更多区间加入日期标题，比较相邻原始条目日期，不排序/重分组、不把标题算进歌曲索引。沿权威playedAt、最近300条去重记录和实际播放触发；歌单/收藏/批量列表保持各自边界。日期按本机日历而非UTC或固定24小时取整，避免夏令时/午夜混组；未知/超Date范围展示“日期未知/--:--”，epoch0有效。

纯逻辑覆盖UTC/上海/纽约跨年与夏令时重复时刻、午夜、闰日、无效/范围；App真实合成播放后日期标题/时间显示及重启保持，原PCM/统计/歌词/八布局/mini/凭据清理断言保留。352业务/类型检查通过；正式入口SourceUITests-1792267559956的Navidrome实际合成播放专项260.169秒通过、零失败/跳过，日期标题可达/重启保持及原PCM/统计/歌词/八布局/mini/凭据清理均保留。已亲看日期标题/时间轴/歌曲截图。鉴权8次成功/0失败，无新stream请求，允许既有缓存，不称本次冷下载。验收后strict review22E/21F/21P、8WI/39事件零错误/警告；无新原生后端/依赖，清洁归档/云端/真实服务/签名/手机另记。
