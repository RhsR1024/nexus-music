# 歌词、字体与临时缓存

F09/F10/F17。对比悦音core/lyric/parser.ts（普通LRC/翻译映射）、Cy utils/lrcParser.ts（行级定位/偏移，但无时间文本映射为0不适用于本项目）、Q/wtf musicSdk/wy/lyric.js与tx/lyric.js（保留真实YRC/QRC/LX字时间）、Wayferar歌词/备份行为。原创统一解析层，普通LRC、多时间标签、LX/YRC/QRC/KRC的已解码字时间分别处理；不将纯文本或坏字时间伪装为均分逐字。

行定位二分查找，UI仅切换有效行并局部渲染；逐字以真实起止时间驱动原生动画，不逐帧setState整份列表。偏移单独保存并明确正值让歌词更晚显示；纯文本不标同步时间。翻译/罗马音只在实际有数据时显示。

字体由用户导入TTF/OTF，App沙箱保存文件和版本化元信息，歌词字体可恢复系统默认；不复制Mac/参考仓库受限字体或品牌资源。字体/歌词逻辑TS可复用Android，文件授权和原生加载需单独验证。

临时缓存按账户/平台/来源指纹/音质隔离；认证URL不作为可导出的音乐库数据。缓存有限容量，可清理、缺失/过期后重新请求，不把临时缓存冒充M10永久离线库。真实网络、坏数据、时间定位与缓存失效分别验收。

原生原创AudioCache接入Range资源加载器，每个加载器独立part文件；区间合并完整覆盖后原子提升，不以稀疏文件长度判断完整。来源指纹取当前完整脚本SHA256，不能用进程内revision代替版本指纹。清理提高epoch阻止旧写入复活，活动文件保留；解码失败使缓存失效并重新尝试网络。只缓存原始媒体字节，不复制另一套播放器；未来Android需替换原生流式资源加载器与文件实现，TS身份/限额设置仍可共用。封面缓存和持久离线另行实现。

封面对照CyMusic src/player/CacheManager.ts、悦音core/music/cache.ts/cacheSqlite.ts及Q/wtf的pic动作边界：不将原始封面/认证URL跨桥持久化，不复制RNTP或另一份数据库。原创CoverCache采用有界下载和ImageIO缩略图，32MiB LRU、512像素、清理代次；私有封面按账户和coverArtId隔离。Android替换原生图片下载/缩略图实现，TS身份和UI不变。

KRC网络容器按公开krc1/XOR/zlib格式解码，在原生utility队列执行、8MiB解压上限，合成字节由Node zlib独立生成核验；参考wtf固定版本kg/lyric.js的wire格式，未复制其完整解析器。LXMC按参考Backup/actions.ts、utils/tools.ts的gzip(JSON)容器处理；不静默接受未知版本或截断结果。

QRC网络密文对照Q-1515 tx/qrc/和wtf tx/qrcDecode.js：两者均使用自定义置换、密钥位布局和S-box的DES-EDE变体，不能用系统标准3DES替代。悦音/Cy侧以普通LRC为主，Wayferar的歌词显示不能替代该网络容器解码。原创新Swift实现仅参考协议常量，许可来源见THIRD_PARTY_NOTICES；保留固定提交，不引入BigInt JS逐块计算或另一原生加密依赖。原生串行队列解密，密文256KiB/解压8MiB上限，合成独立参考加密向量校验。TX已有数值songID时请求QRC；缺ID或错误回退普通LRC，翻译/罗马音独立失败不丢主歌词，取消后不发布迟到解码。Android需实现同一字节接口，TS容器提取/解析/降级逻辑可复用。真实网络通过与手机歌词同步仍须分别记录。
