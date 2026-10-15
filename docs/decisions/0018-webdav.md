# 0018：WebDAV 独立来源与受限鉴权传输

2026-10-16，S6/F24，后续F32/F33复用协议边界，不把音乐浏览当作已完成云备份或冲突同步。

固定提交仍见 REFERENCE_COMPARISON。Sollin `src/services/webdavBackup.ts:9,178,212,259` 提供 Depth/目录/备份的职责参考，但 DOMParser、明文配置与响应日志不能直接搬入RN。Cy `src/store/config.ts:98` 只有配置类型证据；对四RN项目src的TS/TSX/Swift/ObjC范围检索WebDAV/PROPFIND，没有可直接采用的完整播放管线，不推导整仓无此能力。Wayferar已检出docs没有对应实现，Android文件权限不能替代iOS网络接口。均不引入参考依赖或复制代码，使用原创协议层与原生适配。

依据 [RFC4918](https://www.rfc-editor.org/rfc/rfc4918) 的9.1/13节，显式Depth:1读取目录，分别检查propstat成功状态，不以HTTP207推导每项成功。XML解析有大小/节点/深度限制、禁DTD/外部实体，使用DAV命名空间，不把其他命名空间的同名元素当作DAV字段。

- 多账号配置与凭据分离，密码只保存在Keychain；账户身份包含服务器根目录与用户名，Track只保存账号标识和相对编码路径，不带鉴权头/密码/服务器地址。
- 每个href和重定向都检查同源且仍在配置根目录，拒绝点段/编码斜杠/反斜杠/控制字符与嵌套编码。不能使用LX宿主不受此目录限制的重定向方式传递Basic凭据。
- 远程文件身份与LX/设备/本地文件分离；播放前探测当前版本，缓存包含账号/路径/ETag或修改时间/长度，未取得可靠版本时不复用旧媒体缓存。
- 仍使用一个AVPlayer/权威队列；通过受限Range传输读取音频和实际AVFoundation标签，文件名回退必须明确，不能写成已解析远程标签。
- TS目录/身份/竞态可共享Android；原生鉴权网络、AVAsset标签读取与音频Loader需各平台实现。真实服务兼容性、App合成服务器、缓存、账号移除与真机后台分别验收。

当前为实施决策，尚不代表WebDAV功能或云备份完成。

实施接入已推进：NexusDAVModule/DAVNativeTransport、WebDAVMedia与WebDAVLibrary连接到唯一播放器；RemoteAudioMetadata设置15秒/16MiB预算，分配两并发/64等待上限，标签缓存8MiB/100项，封面沿用现有32MiB缓存。强ETag配合If-Match与响应校验，cacheOnly缺缓存拒绝；原生和合成App验证见BUILD_STATUS。resolvedTrack仅允许同源身份的元数据补全，按版本刷新歌词/封面，保持队列权威。当前支持Basic，不声称所有WebDAV认证/个人服务均已验证；云备份与冲突同步继续后续实现。
