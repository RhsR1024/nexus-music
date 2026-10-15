# 音源管理与持久化

对应F04/F05/F11/F19。Wayferar的SourceSelection/startOperation将待操作勾选与启用状态分离，批量失败保留；悦音core/config/musicSource使用AsyncStorage并有selectedSourceId单选遗留；Cy的Source模块提供文件桥，Q/wtf的LX声明模型更完整。采用Wayferar批量语义及Q/wtf真实能力声明，原创手机列表/仓储，不直接复制UI或其状态库。

采用Expo54版本表中的SQLite16.0.10、DocumentPicker14.0.8、FileSystem19.0.24、Crypto15.0.9。单一SQLite仓储，版本化迁移、参数化SQL、事务写入；凭据单独Keychain。TS仓储通过小型SQL接口供Node内置SQLite做真实事务/重启/失败回滚测试；Android以后使用相同Expo模块，但文件权限/后台需独立验收。

脚本SHA256作去重ID；原始脚本只存App沙箱、不输出诊断。导入默认停用。保持列表顺序，多选批量启停/删除，成功清勾选、失败留勾选。启停意图先持久化再变更运行时；失败继续保留启用意图及可重试状态。订阅显式检查更新，旧脚本保留一版可回退，更新后重新初始化，不静默执行新脚本。

许可边界与固定提交见REFERENCE_COMPARISON；不采用参考项目的账号/接口密钥、品牌或依赖图。验收覆盖导入去重、错误事务、重启、顺序、回退、批量部分失败及真实iOS模块加载。
