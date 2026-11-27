import { CatalogFavoriteButton } from './CatalogFavoriteButton.tsx';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { requireNativeView } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import type { OnlinePlatform } from '../domain/track.ts';
import type { VideoItem, VideoResolution } from '../providers/videos.ts';
import { Modal, usePresentationVisible } from './AdaptiveModal.tsx';
import { Cover } from './Cover.tsx';
import { Text } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { controls, space, radius, sollinTokens } from './tokens.ts';

type Phase = 'loading' | 'ready' | 'error' | 'blocked';
type MediaState = 'none' | 'playing' | 'paused' | 'suspended' | 'unknown';
type FullscreenState = 'inline' | 'entering' | 'fullscreen' | 'exiting' | 'unknown';
type NativeVideoPhase = 'loading' | 'ready' | 'ended' | 'error';

const NativePage = requireNativeView<
  ViewProps & {
    source: string;
    active: boolean;
    onState: (event: { nativeEvent: { phase?: Phase; notice?: string; media?: MediaState; fullscreen?: FullscreenState } }) => void;
  }
>('NexusNative', 'PublicMV');

const NativeVideo = requireNativeView<
  ViewProps & {
    source: string;
    active: boolean;
    paused?: boolean;
    seekTo?: number;
    onState: (event: { nativeEvent: { phase?: NativeVideoPhase; playing?: boolean; position?: number; duration?: number; error?: string } }) => void;
  }
>('NexusNative', 'NativeVideo');

const names: Record<OnlinePlatform, string> = { wy: '网易云', tx: 'QQ音乐', kw: '酷我', kg: '酷狗', mg: '咪咕' };
const resolutions: readonly VideoResolution[] = [1080, 720, 480, 240];

export function videoDuration(seconds?: number) {
  if (seconds === undefined || !Number.isFinite(seconds)) return '';
  const n = Math.max(0, Math.floor(seconds));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

function formatPlayCount(n?: number) {
  if (!n || n <= 0) return '';
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)} 亿次播放`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万次播放`;
  return `${n} 次播放`;
}

function Page({
  services,
  platform,
  video,
  onSwitchVideo,
}: {
  services: Services;
  platform: OnlinePlatform;
  video: VideoItem;
  onSwitchVideo: (next: VideoItem) => void;
}) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const visible = usePresentationVisible();
  const playback = useSyncExternalStore(services.playback.controller.subscribe, services.playback.controller.getSnapshot);

  const [mode, setMode] = useState<'resolving' | 'native' | 'web'>(platform === 'wy' ? 'resolving' : 'web');
  const [resolution, setResolution] = useState<VideoResolution>(1080);
  const [availableRes, setAvailableRes] = useState<readonly VideoResolution[]>([]);
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [streamReason, setStreamReason] = useState<string>('');
  const [videoPhase, setVideoPhase] = useState<NativeVideoPhase>('loading');
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const [videoPos, setVideoPos] = useState(0);
  const [videoDur, setVideoDur] = useState(video.durationSeconds ?? 0);
  const [related, setRelated] = useState<readonly VideoItem[]>([]);

  const [url, setURL] = useState<string>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [notice, setNotice] = useState('');
  const [media, setMedia] = useState<MediaState>('none');
  const [fullscreen, setFullscreen] = useState<FullscreenState>('inline');
  const alive = useRef(true);

  useEffect(() => {
    if (services.playback.controller.getSnapshot().intent === 'playing') {
      services.playback.controller.pause();
    }
  }, [services]);

  useEffect(() => {
    const pending = new AbortController();
    alive.current = true;
    void services.videos.publicPage(platform, video, pending.signal).then(value => {
      if (!pending.signal.aborted) setURL(value);
    }).catch(() => {
      if (!pending.signal.aborted) setPhase('error');
    });
    if (platform === 'wy') {
      void services.videos.topNetease(pending.signal, 12).then(list => {
        if (!pending.signal.aborted) setRelated(list.filter(item => item.id !== video.id).slice(0, 8));
      }).catch(() => {});
    }
    return () => {
      alive.current = false;
      pending.abort();
    };
  }, [services, platform, video]);

  useEffect(() => {
    if (platform !== 'wy') {
      setMode('web');
      return;
    }
    const pending = new AbortController();
    setMode('resolving');
    setVideoPhase('loading');
    setStreamReason('');
    void (async () => {
      let cookieHeader: string | undefined;
      try {
        const wyAcc = services.musicAccounts.getSnapshot().find(a => a.platform === 'wy');
        if (wyAcc) {
          const sess = await services.musicAccounts.session(wyAcc.id);
          const c = (sess.cookies ?? {}) as Record<string, string>;
          const parts = Object.entries(c)
            .filter(([k, v]) => ['MUSIC_U', '__csrf', 'NMTID'].includes(k) && typeof v === 'string' && v)
            .map(([k, v]) => `${k}=${v}`);
          if (parts.length) cookieHeader = parts.join('; ');
        }
      } catch {}
      const resolved = await services.videos.resolveStream(platform, video, resolution, pending.signal, cookieHeader);
      if (pending.signal.aborted) return;
      if (resolved.url) {
        setStreamUrl(resolved.url);
        setAvailableRes(resolved.availableResolutions);
        if (resolved.resolution !== resolution) setResolution(resolved.resolution);
        setMode('native');
      } else {
        setStreamReason(resolved.reason ?? '');
        setMode('web');
      }
    })().catch(() => {
      if (!pending.signal.aborted) setMode('web');
    });
    return () => pending.abort();
  }, [services, platform, video, resolution]);

  const progressRatio = videoDur > 0 ? Math.max(0, Math.min(1, videoPos / videoDur)) : 0;
  const message =
    phase === 'loading'
      ? '正在加载 MV 页面…'
      : phase === 'ready'
        ? '页面已载入'
        : phase === 'blocked'
          ? '此跳转无法在应用内打开'
          : '此平台 MV 页面暂时无法读取，请刷新或在浏览器打开';

  if (mode === 'resolving') {
    return (
      <View style={{ flex: 1, gap: 14 }}>
        <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {video.artwork && <View style={[StyleSheet.absoluteFill, { opacity: 0.35 }]}><Cover services={services} url={video.artwork} size={400} aspectRatio={16 / 9} radius={0} /></View>}
          <ActivityIndicator color="#FFFFFF" size="large" />
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' }}>正在解析高清 MV 视频流…</Text>
        </View>
      </View>
    );
  }

  if (mode === 'native' && streamUrl) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
        {/* Cinema 16:9 native player stage */}
        <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
          <NativeVideo
            testID="mv-native-video"
            source={streamUrl}
            active={visible && playback.intent !== 'playing'}
            paused={videoPaused}
            onState={event => {
              if (!alive.current) return;
              const e = event.nativeEvent;
              if (e.phase) setVideoPhase(e.phase);
              if (typeof e.playing === 'boolean') setVideoPlaying(e.playing);
              if (typeof e.position === 'number') setVideoPos(e.position);
              if (typeof e.duration === 'number' && e.duration > 0) setVideoDur(e.duration);
              if (e.phase === 'error') {
                setStreamReason(e.error ?? '视频直链播放失败，已切换官方页面');
                setMode('web');
              }
            }}
            style={{ flex: 1 }}
          />
          {videoPhase === 'loading' && (
            <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.42)', gap: 8 }}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12 }}>缓冲视频画面…</Text>
            </View>
          )}
        </View>

        {/* Sleek glass cinema control bar */}
        <View style={{ padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', gap: 12 }}>
          <View style={{ gap: 6 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${Math.round(progressRatio * 100)}%`, backgroundColor: s.accent, borderRadius: 2 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11.5, fontVariant: ['tabular-nums'] }}>{videoDuration(videoPos)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.52)', fontSize: 11.5, fontVariant: ['tabular-nums'] }}>{videoDuration(videoDur)}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={videoPlaying ? '暂停MV' : '播放MV'}
              onPress={() => setVideoPaused(p => !p)}
              style={{ minHeight: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: s.accent, flexDirection: 'row', alignItems: 'center', gap: 7 }}
            >
              <Ionicons name={videoPlaying ? 'pause' : 'play'} size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' }}>{videoPlaying ? '暂停' : '继续播放'}</Text>
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="切换官方网页播放"
                onPress={() => setMode('web')}
                style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <Ionicons name="globe-outline" size={14} color="rgba(255,255,255,0.82)" />
                <Text style={{ color: 'rgba(255,255,255,0.86)', fontSize: 12, fontWeight: '600' }}>官方网页</Text>
              </Pressable>
            </View>
          </View>

          {availableRes.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' }}>
              <Text style={{ color: 'rgba(255,255,255,0.58)', fontSize: 12 }}>清晰度</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                {resolutions.filter(r => availableRes.includes(r)).map(r => {
                  const active = resolution === r;
                  return (
                    <Pressable
                      key={r}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      onPress={() => setResolution(r)}
                      style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12, backgroundColor: active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.12)' }}
                    >
                      <Text style={{ color: active ? '#11131A' : 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' }}>{r}P</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Related / Recommended MVs */}
        {related.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={{ color: '#F3F6FA', fontSize: 15.5, fontWeight: '700' }}>更多推荐 MV</Text>
            <View style={{ gap: 10 }}>
              {related.map(item => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`切换播放MV：${item.title}`}
                  onPress={() => onSwitchVideo(item)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  <View style={{ width: 112, height: 63, borderRadius: 10, overflow: 'hidden', backgroundColor: '#191D29' }}>
                    <Cover services={services} url={item.artwork} size={112} aspectRatio={16 / 9} radius={10} />
                    {item.durationSeconds ? (
                      <View style={{ position: 'absolute', right: 5, bottom: 4, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.68)' }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 10, fontVariant: ['tabular-nums'] }}>{videoDuration(item.durationSeconds)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text numberOfLines={2} style={{ color: '#F3F6FA', fontSize: 13.5, fontWeight: '600', lineHeight: 18 }}>{item.title}</Text>
                    <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.58)', fontSize: 12 }}>{item.author || '精选 MV'}</Text>
                  </View>
                  <Ionicons name="play-circle-outline" size={22} color="rgba(255,255,255,0.75)" />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, gap: space.sm }}>
      {!!streamReason && <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{streamReason}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {phase === 'loading' && <ActivityIndicator color={s.accent} />}
        <Text testID="mv-page-status" accessibilityLiveRegion="polite" style={{ flex: 1, color: 'rgba(255,255,255,0.72)', fontSize: 12.5 }}>{message}</Text>
      </View>
      {phase === 'ready' && (
        <Text
          testID="mv-media-status"
          accessibilityLiveRegion="polite"
          accessibilityValue={{ text: `media:${media},fullscreen:${fullscreen}` }}
          style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}
        >
          {media === 'playing' ? 'MV 播放中' : media === 'suspended' ? 'MV 已在后台暂停' : media === 'paused' ? 'MV 已暂停' : '点击页面内控件开始 MV'}
          {fullscreen === 'entering' ? ' · 正在进入全屏' : fullscreen === 'fullscreen' ? ' · 全屏' : fullscreen === 'exiting' ? ' · 正在退出全屏' : ''}
        </Text>
      )}
      {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: 'rgba(255,255,255,0.68)', fontSize: 12 }}>{notice}</Text>}
      {url && playback.intent === 'playing' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="暂停音乐以播放MV"
          onPress={() => services.playback.controller.pause()}
          style={{ minHeight: controls.hit, padding: space.sm, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, justifyContent: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>暂停音乐以播放 MV</Text>
        </Pressable>
      )}
      {url && (
        <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000000' }}>
          <NativePage
            testID="mv-native-page"
            source={url}
            active={visible && playback.intent !== 'playing'}
            onState={event => {
              if (!alive.current) return;
              const { phase: nextPhase, notice: nextNotice, media: nextMedia, fullscreen: nextFull } = event.nativeEvent;
              if (nextPhase) {
                setPhase(nextPhase);
                if (nextPhase === 'loading') setNotice('');
              }
              if (nextMedia) setMedia(nextMedia);
              if (nextFull) setFullscreen(nextFull);
              if (nextNotice) setNotice('此链接无法在应用内打开，可继续查看当前页面。');
            }}
            style={{ flex: 1 }}
          />
        </View>
      )}
      {url && (phase === 'error' || phase === 'blocked') && (
        <Pressable
          accessibilityRole="button"
          onPress={() => { void Linking.openURL(url).catch(() => setPhase('error')); }}
          style={{ minHeight: controls.hit, justifyContent: 'center' }}
        >
          <Text style={{ color: s.accent, fontWeight: '600' }}>在浏览器打开官方 MV 页面</Text>
        </Pressable>
      )}
    </View>
  );
}

export function MVDetail({
  services,
  platform,
  video,
  onClose,
}: {
  services: Services;
  platform: OnlinePlatform;
  video: VideoItem;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<VideoItem>(video);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setCurrent(video);
  }, [video.id, video.platform]);

  const activePlatform = current.platform ?? platform;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#090B12' }}>
        <LinearGradient colors={['#151927', '#0B0D14', '#07080D']} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, paddingTop: Math.max(insets.top + 8, 50), paddingBottom: Math.max(insets.bottom + 8, 16), paddingLeft: insets.left + 16, paddingRight: insets.right + 16, gap: 12 }}>
          {/* Sleek Cinema Top Bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Pressable
              testID="mv-back"
              accessibilityRole="button"
              accessibilityLabel="返回"
              onPress={onClose}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
            >
              <Ionicons name="chevron-back" size={18} color="#F3F6FA" />
              <Text style={{ color: '#F3F6FA', fontSize: 13.5, fontWeight: '600' }}>返回</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CatalogFavoriteButton services={services} target={{ ...current, kind: 'mv', platform: activePlatform }} />
              <Pressable
                testID="mv-refresh"
                accessibilityRole="button"
                accessibilityLabel="刷新MV"
                onPress={() => setRevision(value => value + 1)}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="refresh" size={18} color="#F3F6FA" />
              </Pressable>
            </View>
          </View>

          {/* MV Title & Metadata */}
          <View style={{ gap: 4, paddingHorizontal: 2 }}>
            <Text testID="mv-title" numberOfLines={2} style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.3, lineHeight: 26 }}>
              {current.title}
            </Text>
            <Text testID="mv-source" style={{ color: 'rgba(255,255,255,0.62)', fontSize: 12.5 }}>
              {[names[activePlatform], current.author, current.durationSeconds !== undefined ? videoDuration(current.durationSeconds) : '', formatPlayCount(current.playCount)].filter(Boolean).join(' · ')}
            </Text>
          </View>

          <Page key={`${activePlatform}:${current.id}:${revision}`} services={services} platform={activePlatform} video={current} onSwitchVideo={next => { setCurrent(next); setRevision(0); }} />
        </View>
      </View>
    </Modal>
  );
}
