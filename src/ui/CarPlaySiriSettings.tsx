import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Services } from '../app/services.ts';
import type { CarIntegrationStatus } from '../platform/carIntegration.ts';
import { Text } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

export function CarPlaySiriSettings({ services }: { services: Services }) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const [status, setStatus] = useState<CarIntegrationStatus | null>(null);
  const [message, setMessage] = useState('');

  async function refresh() {
    await services.carIntegration.syncCatalog(true);
    const snap = await services.carIntegration.status();
    setStatus(snap);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const badge = (ok: boolean, yes: string, no: string) => (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: ok ? 'rgba(49,194,124,0.16)' : s.chip }}>
      <Text style={{ color: ok ? '#249E62' : s.muted, fontSize: 12, fontWeight: '700' }}>{ok ? yes : no}</Text>
    </View>
  );

  return (
    <View testID="car-siri-settings" style={{ gap: 14, paddingTop: 6 }}>
      <View style={[{ borderRadius: 20, padding: 16, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, gap: 12 }, s.cardShadow]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: s.ink, fontSize: 16, fontWeight: '700' }}>Apple CarPlay 车载界面</Text>
            <Text style={{ color: s.muted, fontSize: 12, lineHeight: 18 }}>
              已内置 CPTabBarTemplate（收藏 / 歌单 / 最近播放）与 NowPlaying 控制桥接。
            </Text>
          </View>
          {badge(!!status?.carPlayCodeReady, '代码已就绪', Platform.OS === 'android' ? '仅 iOS' : '未加载')}
        </View>
        {Platform.OS === 'ios' && (
          <View style={{ padding: 12, borderRadius: 14, backgroundColor: s.chip, gap: 4 }}>
            <Text style={{ color: s.ink, fontSize: 13, fontWeight: '600' }}>
              签名证书权限状态：{status?.carPlayEntitlementActive ? '已签发 CarPlay Audio 权限' : '未签发（自签 / LiveContainer 环境）'}
            </Text>
            <Text style={{ color: s.muted, fontSize: 12, lineHeight: 17 }}>
              CarPlay 实机投屏需要 Apple 审批的 com.apple.developer.carplay-audio 证书权限；自签或 LiveContainer 下默认弱链接运行，不影响正常启动与蓝牙车载歌词。
            </Text>
          </View>
        )}
      </View>

      <View style={[{ borderRadius: 20, padding: 16, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, gap: 12 }, s.cardShadow]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: s.ink, fontSize: 16, fontWeight: '700' }}>Siri 快捷指令 (AppIntents)</Text>
            <Text style={{ color: s.muted, fontSize: 12, lineHeight: 18 }}>
              iOS 16+ 可直接在「快捷指令」App 或语音唤醒控制音枢播放。
            </Text>
          </View>
          {badge(!!status?.siriIntentsAvailable, '可用', Platform.OS === 'android' ? '仅 iOS' : '需 iOS 16+')}
        </View>
        <View style={{ gap: 6 }}>
          {['「用音枢继续播放」', '「用音枢播放收藏」', '「音枢下一首」'].map(phrase => (
            <View key={phrase} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
              <Ionicons name="mic-outline" size={16} color={s.accent} />
              <Text style={{ color: s.ink, fontSize: 13.5, fontWeight: '500' }}>{phrase}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[{ borderRadius: 20, padding: 16, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, gap: 12 }, s.cardShadow]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: s.ink, fontSize: 16, fontWeight: '700' }}>Android Auto 车载浏览服务</Text>
            <Text style={{ color: s.muted, fontSize: 12, lineHeight: 18 }}>
              已注册 MediaBrowserService，暴露收藏、歌单与最近播放目录树。
            </Text>
          </View>
          {badge(!!status?.androidAutoServiceReady, '服务就绪', Platform.OS === 'ios' ? '仅 Android' : '未启用')}
        </View>
      </View>

      <View style={[{ borderRadius: 20, padding: 16, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, gap: 12 }, s.cardShadow]}>
        <Text style={{ color: s.ink, fontSize: 15, fontWeight: '700' }}>车载曲库目录同步</Text>
        <Text style={{ color: s.muted, fontSize: 12.5 }}>
          已同步 {status?.catalogTracks ?? 0} 首收藏/近期曲目 · {status?.catalogPlaylists ?? 0} 个歌单至原生车载缓存
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Pressable
            testID="car-sync-now"
            accessibilityRole="button"
            onPress={() => {
              void refresh().then(() => setMessage('已将最新收藏、歌单与历史同步至车载目录'));
            }}
            style={{ paddingHorizontal: 15, paddingVertical: 10, borderRadius: 16, backgroundColor: s.control }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' }}>立即同步车载目录</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const ok = services.carIntegration.executeCommand({ source: 'settings-test', action: 'playFavorites' });
              setMessage(ok ? '已通过指令通道触发播放收藏' : '收藏列表为空，请先收藏歌曲再测试');
            }}
            style={{ paddingHorizontal: 15, paddingVertical: 10, borderRadius: 16, backgroundColor: s.chip, borderWidth: 1, borderColor: s.cardBorder }}
          >
            <Text style={{ color: s.ink, fontSize: 13.5, fontWeight: '600' }}>本地测试播放收藏指令</Text>
          </Pressable>
        </View>
        {!!message && <Text style={{ color: s.accent, fontSize: 12.5 }}>{message}</Text>}
      </View>
    </View>
  );
}
