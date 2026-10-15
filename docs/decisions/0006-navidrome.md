# Navidrome公开协议与凭据

F14/F15/F16及已确认的星标/服务端歌单写入。Wayferar p016d2/p.java与q.java已有/rest/、salt/token、search3、专辑/歌手/歌单映射，Q1/q.java的内部登录/排序不是全部实现。其Android/反编译网络层不能直接编译移植；其余四项目优先在线LX，不作为Navidrome完整客户端证据。采用原创TS Subsonic/OpenSubsonic client，协议参考官方[API](https://opensubsonic.netlify.app/docs/api-reference/)、[playlist写入](https://subsonic.org/pages/api.jsp)、[Navidrome兼容说明](https://www.navidrome.org/docs/developers/subsonic-api/)，不依赖内部Web API。

JSON请求使用POST表单并每次新salt，token=MD5(password+salt)，不发送明文p参数、不打印完整认证URL。stream/coverArt的GET认证地址仅在内存构造，Track持久化只保留accountId、歌曲/封面ID和无凭据元数据。密码/用户名保存在Keychain，AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY允许首次解锁后后台读取；账号展示配置与密码分开，退出清除Keychain。TLS验证不关闭，用户指定内网HTTP按其部署连接。

连接先ping再探测扩展；不将未实现扩展当连接失败。分页/错误分认证、权限、协议、网络。星标/歌单变更等待服务器确认再更新UI，保留原有条目和顺序；createPlaylist传重复songId保持重复/曲序。原文件码率不冒充转码输出；默认stream原文件。Android未来替换凭据适配即可共享TS client，但后台需另测。

合同测试用本地HTTP/无隐私夹具，真实服务器认证需在App内输入，不向聊天索要密码。未实际认证时不得标记真实联调通过。
