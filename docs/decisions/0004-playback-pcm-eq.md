# 播放、PCM频谱与EQ

F06/F08/F09/F21。比较固定参考：悦音expo-audio1.1.1易接入但其采样事件不提供本项目所需原生EQ处理链；Cy RNTP5.9.2有独立许可和较高框架/补丁要求；Q的AppDelegate含libFLAC流式解码+AVAudioEngine及大型DSP，移植会引入第二条后端与维护成本；wtf仍依赖RN0.73播放器fork。Wayferar定义队列/失败行为，但Android效果器不能直接移植。选择原创AVPlayer单后端，通过AVAudioMix+MTAudioProcessingTap处理文件型媒体的PCM，不复制上述播放器或DSP代码。

Apple文档确认audioMix适用于文件型媒体，HLS有限制：[audioMix](https://developer.apple.com/documentation/avfoundation/avplayeritem/audiomix)、[MTAudioProcessingTap](https://developer.apple.com/documentation/MediaToolbox/MTAudioProcessingTap)。以本机26.2 SDK实际声明为准；不依赖更高系统新增能力。HLS或不支持的PCM格式必须明确报告处理不可用，不能显示假频谱/假EQ成功。MP3/AAC/FLAC等必须用实际样本验证解码/定位。

原创C++核心：10段peaking biquad，参数原子读取；实时回调不分配堆内存、不锁、不访问React/网络。PCM在原生环形队列传给低频采样任务，原生FFT得到32个频带，每秒最多10次发给UI；不跨桥逐样本传PCM。EQ开关/增益持久化，关闭原样旁路，提升频段自动留出前级余量并限制异常输出。使用合成正弦/静音/脉冲与旁路黄金检查，然后做播放验证。

AVAudioSession、MediaPlayer远程事件与一个TS队列/播放意图协作；所有命令和回调带generation/entryId，暂停、切歌、定位和迟到异步结果不能自动复播。临时缓存与正式离线分开；后者M10。Android未来替换音频适配，TS队列/偏好共享，DSP可共享但Android输出链需单独接入。
