# 五平台元数据适配

F01/F02/F03/F08/F13。固定参考：Q/wtf的musicSdk五平台musicSearch/songList保留songId、strMediaMid、hash及各档类型；悦音discover/sources有页面字段组织和linuxapi加密请求，但统一Track简化了LX字段；Cy可参考平台业务接口，但不照搬tx固定解析；Wayferar作为已保存providerId/id行为参考。采用独立、原创TS适配器按wire字段转换；不复制整套musicSdk/状态/网络层，不引入参考项目依赖及私人账号。

逐平台读取wtf musicSdk/{wy,tx,kw,kg,mg}/musicSearch.js和悦音discover/sources。搜索协议包括WY公开search接口，TX SearchCgiService，KW r.s，KG song_search_v2，MG带MD5请求签名的searchAll。算法/字段为接口兼容实现；不复制代码文本。MG接口公开协议常量不作为用户凭据，设备标识随机生成。固定提交与许可边界见REFERENCE_COMPARISON；后续发现/榜单/歌单需分别验证，不能以搜索成功一并勾选。

HTTP仅输出安全错误；取消/超时有界。长整数JSON在解析前保留为字符串，转换时拒绝不安全数字。聚合搜索按来源保留，不按同名跨平台合并；每平台独立分页与失败状态，旧请求不可覆盖新查询。元数据档位只表示接口声明，LX实际可用性与真实媒体格式分别验收。TS接口可供Android共享，HTTP头/TLS/后台行为需另测。
