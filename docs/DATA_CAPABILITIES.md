# 数据接口与界面可展示信息

日期：2026-10-14。目的：先定义现有接口能够支持的内容，再设计界面。本文件不是线上接口长期可用性承诺；当前未连接用户Navidrome或真实音源进行联调。

## 证据层级与两条在线链路

- **已有映射**：参考源码实际取出并转换了字段，仍待真实平台验证。
- **协议能力**：官方API定义了端点/字段，但必须检查用户服务器版本、权限和返回。
- **条件能力**：只有部分平台、脚本、曲目或版本提供，UI应按能力显示。
- **未确认**：不设计成必须出现的信息，不以假数据填补。

在线内容分成两条链：

1. 平台元数据provider：搜索、歌单、榜单、封面、歌词/评论等。
2. 用户LX音源：加载脚本，按声明解析musicUrl及可选lyric/pic等。

一个脚本能解析播放URL，不代表它也能搜索、展示推荐、提供歌词或获取评论。脚本中的源名与歌曲的原始平台也要分别保存。

## 在线歌曲与播放页

| 信息 | 源码证据/来源 | 展示策略 |
| --- | --- | --- |
| 歌名、歌手 | LX MusicInfoBase.name/singer；悦音Track.title/artist；漫途歌曲模型 | 基础字段，缺失用明确占位文案 |
| 专辑名 | LX meta.albumName；悦音album；漫途album转换 | 有则展示；空值不制造专辑页 |
| 封面 | meta.picUrl、img、coverUrl、可选pic请求 | 有则加载；失败用音枢占位，不把第三方占位网址当依赖 |
| 时长 | LX interval；平台dt/duration/interval字段 | 规范化为毫秒；未知时不显示0秒冒充已知；实际播放时可由媒体校正 |
| 平台/来源 | kw/wy/tx/kg/mg；sourceId/providerId | 显示来源标签；搜索与音源来源分开 |
| 平台曲目ID | songId/songmid/hash/copyrightId及source | 内部完整保留；不把长数字转浮点，不必在主界面展示 |
| 可请求音质 | LX types/_types或qualitys/_qualitys、平台声明及脚本能力交集 | 标注为可请求档位，不等同解析成功 |
| 当前实际音质 | 本次成功解析/播放信息 | 独立于用户默认偏好；降级时明确显示实际档位 |
| 文件大小 | LX音质对象size；部分平台文件大小字段 | 只在字段存在且含义明确时显示；不是全平台通用，也不是缓存已下载大小 |
| 编码/真实码率/采样率/位深 | 通常需文件、媒体探测或服务器属性 | 在线页面不凭flac/hires标签伪造数值；播放链可能拿不到就隐藏 |
| 普通歌词 | provider歌词或脚本lyric | 解析LRC；无词显示无词 |
| 逐字歌词 | LX lxlyric等及平台特定格式 | 必须保留字级时间并解析；坏字级数据降为行级，不伪造匀速逐字 |
| 翻译/罗马音 | tlyric/rlyric或服务器扩展 | 有则提供开关，无则不显示空的切换项 |
| 音量、进度、缓冲、播放状态 | 播放后端/业务状态 | 音枢自己的实时数据；不是平台元数据 |
| 收藏/播放历史/队列 | 音枢数据库 | 可统一显示；本地收藏不冒充平台账号在线喜欢 |
| 会员/VIP/试听限制 | 不能从本次通用模型一致取得 | 不承诺展示全平台账号权益，不把播放失败自动归因为没会员 |

LX类型实际定义包括quality的可选size、QQ strMediaMid/albumMid、酷狗hash、咪咕copyrightId/lrcUrl/mrcUrl/trcUrl。它们应在provider数据模型中保留，不能像简化Track一样只留歌名/歌手/URL。证据：[LX music.d.ts](https://github.com/Q-1515/lx-music-mobile/blob/547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a/src/types/music.d.ts)。

不同音源的档位名称可能使用128k、128、flac24bit、hires等不同约定，应由adapter映射，不能直接透传UI显示名。八档偏好不构成对八档返回文件和设备输出的承诺。

## 在线发现、歌单、榜单、歌手与评论

| 页面 | 可展示的候选信息 | 边界 |
| --- | --- | --- |
| 搜索 | 歌曲、歌手文本、专辑文本、封面、时长、来源、分页状态 | 不是所有provider都支持独立歌手/专辑搜索或详情 |
| 热搜 | 返回的关键词与排序 | 无结果/失败可隐藏；搜索历史是音枢本地记录 |
| 歌单分类 | 分类名、层级、标签、排序方式 | 平台分别维护分类树，不能混用ID |
| 推荐歌单卡片 | 名称、封面、创建者、播放量、歌曲数量、简介、平台 | 多数字段可选；播放量来自平台返回值，不自行推算 |
| 歌单详情 | 标题/封面/作者/简介/总数/曲序/歌曲列表 | 分页全量完成前不声称完整导入；保留重复项 |
| 榜单 | 名称、封面、更新频率和曲目列表 | 更新时间/名次变化仅在有数据时展示，不捏造上升下降 |
| 在线歌手/专辑详情 | 若provider存在ID与独立接口，可展示专辑/歌曲等 | 文本字段不代表已取得歌手简介、头像、完整作品页；首版先保证基础浏览 |
| 评论 | 悦音有网易评论模块；LX部分provider也有comment模块 | 不是五平台统一能力，也不是用户音源默认能力；首版未要求，不默认增加 |
| 跨源候选 | 已匹配版本及平台标签 | 保留原曲ID；同名、翻唱、现场版不能自动替换不告知 |

悦音字段证据：[discover.ts](https://github.com/xiaoqi419/joy-music-mobile/blob/d6f1af7f911e84babce56cd07297b44cfe46eed9/src/types/discover.ts)、[搜索映射](https://github.com/xiaoqi419/joy-music-mobile/blob/d6f1af7f911e84babce56cd07297b44cfe46eed9/src/core/search/index.ts)、[网易评论](https://github.com/xiaoqi419/joy-music-mobile/blob/d6f1af7f911e84babce56cd07297b44cfe46eed9/src/core/comment/index.ts)。

## Navidrome：采用公开协议

推荐以Subsonic/OpenSubsonic `/rest/*`为主，连接时探测服务与扩展。Navidrome内部Web API和API v1不能自动视为长期稳定第三方接口。官方API v1页面说明仍处于不适合直接依赖的演进状态；实现前重查版本。[Navidrome Subsonic兼容](https://www.navidrome.org/docs/developers/subsonic-api/)、[API v1](https://www.navidrome.org/docs/developers/api-v1/)、[扩展探测](https://opensubsonic.netlify.app/docs/endpoints/getopensubsonicextensions/)

| 能力/信息 | 接口/数据 | 首版策略 |
| --- | --- | --- |
| 连接/版本 | ping及服务响应，getOpenSubsonicExtensions | 明确认证失败、版本、权限与网络错误；记录能力快照 |
| 歌曲列表/检索 | search3/getSong等 | 支持用户实际库分页搜索；不一次拉全量大库阻塞UI |
| 歌手 | getArtists/getArtist | 名称、作品数量/专辑等按返回展示 |
| 专辑 | getAlbumList2/getAlbum | 封面、名称、歌手、年份、歌曲数量/时长按返回展示 |
| 歌曲详情 | Child/歌曲对象 | 标题、歌手、专辑、时长、曲号、年份等有则显示 |
| 封面 | getCoverArt | 适当尺寸与缓存，账户身份纳入cache key |
| 格式/码率 | suffix/contentType/bitRate等 | 标明库内原文件属性；服务器转码后不冒充实际输出 |
| 采样率/位深/多艺人等扩展元数据 | OpenSubsonic扩展字段/服务器版本 | 可选，缺失不计算、不猜测 |
| 歌词 | getLyrics；结构化/同步歌词扩展按探测 | 有则显示；没有时不强制跨在线平台匹配私人库曲目 |
| 随机歌曲 | getRandomSongs | 可以提供随机入口；与稳定队列/真正随机无重复策略分别处理 |
| 新增/常听/最近专辑 | getAlbumList2对应type | 文案准确；“最近专辑”不冒充完整逐曲历史 |
| 星标 | getStarred2/star/unstar等 | 按权限；写入范围待Q02确认，失败不显示为已成功 |
| 服务端歌单 | getPlaylists/getPlaylist，写操作另议 | 首版至少浏览/播放；本地收藏与服务器歌单区分 |
| 播放/转码 | stream及格式/码率参数 | 按服务器能力控制；保留请求头/鉴权，不记录可泄露的完整鉴权URL |
| 播放统计 | scrobble等 | 直接请求stream不会自动等价记一次播放；是否回报作为明确选项/规则 |
| 用户权限 | 用户/错误响应 | 不根据UI按钮存在推定有权限，授权不足允许只读/隐藏操作 |

Navidrome原文件码率、当前请求上限、实际解码信息和设备输出采样率是四个不同概念，不能合并成一个“当前音质”字段。

原漫途代码中存在两种相关路径：

- `app/src/main/java/p016d2/p.java:158` getAlbum；`:166`开始构建`/rest/*.view`；`:303` search3，采用salt/token与1.16.1协议版本。
- `p016d2/q.java:122/141` getPlaylists；`:154` getAlbumList2；`:163` getArtists；`:241` getArtist；`:260` getPlaylist；`:335` getCoverArt；`:363` 转换title/artist/album/duration/coverArt。
- `Q1/q.java`是内部登录/排序相关辅助路径，不是全部Navidrome接入。

旧工程路径是调查证据，本仓库不依赖D盘目录存在；未来实现用本文件记录的协议与字段，按用户服务器验证。

## 建议首版界面组织

| 导航 | 内容 |
| --- | --- |
| 音乐库 | 我的收藏、最近播放、我的歌单、Navidrome歌曲/专辑/歌手/服务端歌单 |
| 发现 | 平台切换、推荐歌单、分类、排行榜；不混入未经证明的个性推荐 |
| 搜索 | 选择在线/私有库，按来源展示和筛选，分页/空态/错误态 |
| 设置 | 音源、Navidrome账号、音质偏好、歌词/字体、缓存、导入导出、外观与诊断 |
| 共用播放页 | 封面、歌名/歌手/专辑、来源、实际音质、进度、控制、歌词与队列 |

这是已获授权的重新设计建议，不是已确认视觉稿。高级玻璃/唱片动效可以服务交互，不能挤占主要信息，也不为它们承诺固定功耗或120Hz。

## 一次歌单迁移的语义

用户理解正确：漫途导出文件 → 音枢导入。它是数据导入，不是重新获得平台账号或复制所有音乐文件。

流程：选择文件→检查格式/版本→预览歌单数量与无法识别条目→选择追加/冲突处理→完整校验后写入→显示成功/失败统计。

必须保留：歌单名、来源/原始歌单ID（如有）、曲目顺序、重复项、歌曲原平台ID、标题/歌手/专辑/必要quality元数据。不能只导入名字再全库模糊搜索。

不默认导入：Android绝对路径、失效临时播放URL、系统授权、登录token/私有音源密钥。原文件有更多数据时按明确映射忽略或保留；对未知版本报告而不猜测。格式尚未拿到真实样本，不先承诺兼容任何叫JSON的文件。
