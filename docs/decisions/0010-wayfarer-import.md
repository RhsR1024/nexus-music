# 漫途版本1迁移

M10在核心播放、公开歌单和双构建已形成证据后实施；真机外部验收不阻断独立导入开发。对照五项目固定提交：Wayferar版本1实际备份为数据格式权威（结构见WAYFARER_IMPORT_FORMAT，不复制私人资产）；Q/wtf的LX备份保留MusicInfo而漫途只有简化字段，不得强行当成LX v2；悦音的简化歌单迁移可参考预览/追加交互；Cy持久化/文件边界可参考但不引入其新版框架和数据库。原创TS解析器，不移植反编译Java或Android路径/设置/服务端账号。与当前SQLite单仓储和LibraryStore原子追加共用，不引入第二库。

严格识别version1、sources/favorites/playlists/settings结构。只读取曲目和歌单字段；sources仅计数不保留内容，settings完全不导入。按providerId与lx:<platform>:<id>一致性校验，WY/KW保留数值字符串，TX保留MID；其他平台缺乏已验证的v1 ID语义时计为未支持，不能臆测版权ID/hash。保持歌单顺序、重复条目和标题，收藏按音枢完整来源身份去重；新歌单全部追加且预览明确，不覆盖或回写服务端。用户可取消，不自动判定同名为同一歌单。

不迁移sourceUri、lyricUri、sourceUserAgent或曾解析的音质/源。封面仅允许不含凭据的公开HTTP(S)地址。TX仅有MID时播放前通过官方详情端点按MID精确补齐numeric ID/media_mid/音质，不用模糊搜索替换歌曲。网络补齐失败可重试，不写入伪造ID；歌词可继续普通LRC降级。

TS格式/原子仓储可复用Android，文件选择权限仍由平台适配。验收覆盖版本拒绝、错配ID、长数字、重复曲序、私人字段剔除和失败旧库不变；实际样本只在忽略目录统计，App文件选择/预览另验。此迁移不表示持久离线管理完成。
