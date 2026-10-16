# 0020：LX 音源平台／音质健康批测

2026-10-16，S7 / F36 / J06。实施中，不把本决策本身算作功能验收。

固定提交见 REFERENCE_COMPARISON：悦音d6f1af7、Q547ccfe、wtf6624ab5、Cybf0d469、Wayferar8e47cdc、Sollinc9d446f，未安装参考依赖。

| 参考证据 | 结论、维护与采纳边界 |
| --- | --- |
| Cy `src/app/(modals)/settingModal.tsx:128–204` testMusicSource | 固定QQ曲目/128k、Promise.race超时、非空URL即正常；日志打印URL/原始错误。不复制。改为当前provider搜索结果、明确平台元数据、实际声明档位与分阶段安全报告 |
| Sollin `src/pages/Settings.tsx:913–943` handleTestLxSource；`src/services/lxSource.ts:281–318` checkAvailability | 显式sourceId、平台搜索、逐档结果组织可参考；仍以返回URL判available，未证明音频响应/解码。原创服务隔离，额外有界Range响应探测，不引入Electron |
| Q / wtf `src/core/userApi.ts:7–21` setUserApi / destroyUserApi | 单个全局脚本/qualityList初始化不是多源健康报告。继续本项目SourceRegistry代次与独立请求，不切换用户启用源或销毁在播宿主 |
| 悦音 `src/core/music/index.ts:99–136` getMusicPlayUrl / resolveMusicPlayUrl | 常规重试/自动换源不能用于精确音源诊断，会掩盖受测源失败；直接指定SourceState + quality，不走自动匹配/降级 |
| Wayferar `docs/SOURCE_UPDATES.md:24–38`，权威Smali与Java参考边界保持 | 逐源、停用跳过、取消和实例生命周期有参考价值；该文是更新机会而非播放健康验证，不能冒称已有逐档解码实现。不复制Android服务/权限/日志 |

新增实现原创，未复制上述代码/原生补丁/依赖，现有许可和第三方声明保持。TS调度/报告可共享Android；Swift URLSession有界探测需Android对应实现，不能把iOS实现说成Android已支持。

## 行为与验收

1. 用户选择源（或当前已启用源）、测试关键词和音质范围。只检测真实声明musicUrl的平台/档位，不自行启用停用源，不改变顺序、音质偏好、队列、播放意图。
2. 每次最多32源、5平台、9规范音质；两个源并发，同源逐项执行，平台搜索复用、超时/取消有界。对明确未就绪源单独报告；不伪造空成功。
3. 指定源/代次直接调用LX，禁止任何跨源/跨平台/低档回退。URL不写报告、不持久化、不回显原始错误；取消仅取消健康请求，不destroy源。
4. 返回地址后进行原生ephemeral HTTP Range前4096字节检查：有限重定向、12秒总预算、不带cookie/auth、不缓存、不播放、收到足够数据立即取消，忽略Range的服务不能导致整首下载。响应状态/实际可识别容器头与请求档位分别报告。
5. 标记“媒体头已识别”只是响应证据，MP4/ID3等头也不证明音轨可解码、文件完整或真实FLAC音质。实际播放/解码是独立验收，不把检查按钮返回绿色当全曲库可播。
6. 取消保留已完成项；重开任务隔离旧结果。更新/停用/删除源使对应报告过期并取消当前检查；不能用旧版本的成功替换新版本状态。
7. 末次报告仅在内存，用户可显式导出分阶段JSON；无完整URL、请求头、cookie、脚本文本、令牌或私人曲库。源名称、测试曲名由用户自行导出，不自动上报。
8. 契约测试：精确源/档位、不降级、部分失败、并发上限、搜索复用、取消/迟到、源版本变化、重启任务与报告脱敏；原生HTTP：真实Range/重定向/HTML/状态错误/超限与取消；App：批测报告与在播状态不变、取消/重新检查/导出入口、源管理和播放回归。然后本地/云端归档，真实音源另记录。

完整范围继续保留S2/S3/S4/S7其余项/S8/S9，不能以该批替代全部目标。
