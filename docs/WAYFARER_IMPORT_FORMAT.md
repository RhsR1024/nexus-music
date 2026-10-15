# 漫途备份结构调查（导入后置）

用户已提供 `resource/wayfarer_music-backup.json`，不是缺失输入。整个resource目录已排除Git，本文只记录结构和计数，不记录私人歌单名称、曲目、ID、地址或凭据。

## 已核实结构

- 根对象：`version: 1`、`createdAtMs`、`sources`、`favorites`、`playlists`、`settings`。
- 来源配置25条；包含endpoint/username/password/apiKey/share/rootPath/script等字段。歌单导入默认不复制这些来源或认证字段。
- 收藏：`ids`与`tracks`各4条。
- 歌单3个，曲目数量分别为1187、38、1209。按providerId/id检查，当前样本各歌单内未发现重复；导入实现仍必须支持重复，不能用该样本推断禁止重复。
- 歌单字段：id/title/subtitle/cloudSourceId/cloudPlaylistId/lastSyncedAt/tracks。
- 歌曲字段：id/providerId/title/artist/album/durationMs/artworkUri/lyricUri/sourceKind/sourceUri/sourceUserAgent/sourceResolvedQuality/sourceResolvedProviderId。
- 设置包含Android相关扫描/显示/歌词/音质等偏好，不能整份透传给iOS。

## 后续映射任务

1. 版本1严格识别，未知版本拒绝并保留文件；显示来源/歌单/曲目数量预览。
2. 歌单名、曲序、重复项、来源ID及可识别元数据完整保留；导入只写本地收藏/歌单，不回写Navidrome。
3. id/providerId保持字符串，不经过浮点或全局模糊匹配；先验证其与LX musicInfo的映射，不能仅因都是字符串就宣称可直接播放。
4. sourceUri只作为待检查字段，不能直接作为永久播放URL；Android文件路径、过期临时地址和账号信息默认不迁移。
5. 导入事务、冲突追加/跳过策略、未知条目统计、失败保持旧库；另造去标识的重复曲序与长ID夹具验收。

该功能按用户要求放到主要LX支持和核心播放之后；现在完成的是格式调查，尚未实现导入器。

2026-10-15实现更新：已有严格v1解析、预览/原子追加、收藏去重与隐私剔除。现汽水原曲保留为独立imported身份，复用其他平台匹配；实际样本完整保留1187/38/1209条及4收藏，25来源配置不迁移。115项TS与导入入口选择/取消UI回归通过，真实文件在App内完整导入/跨平台实音仍需验收；详见FEATURE_STATUS和决策0010/0011。
