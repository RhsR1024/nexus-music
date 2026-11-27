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
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    setSyncing(true);
    try {
      await services.carIntegration.syncCatalog(true);
      const snap = await services.carIntegration.status();
      setStatus(snap);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const okBg = s.dark ? 'rgba(94,224,160,0.16)' : 'rgba(29,138,86,0.12)';
  const okInk = s.dark ? '#5EE0A0' : '#1A8550';
  const badge = (ok: boolean, yes: string, no: string) => (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: ok ? okBg : s.chip, borderWidth: 1, borderColor: ok ? okInk + '33' : s.chipBorder }}>
      <Text style={{ color: ok ? okInk : s.muted, fontSize: 11.5, fontWeight: '700' }}>{ok ? yes : no}</Text>
    </View>
  );

  const divider = <View accessible={false} style={{ height: StyleSheet.hairlineWidth, marginLeft: 56, backgroundColor: s.hairline }} />;

  return (
    <View testID="car-siri-settings" style={{ gap: 16, paddingTop: 4, paddingBottom: 32 }}>
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ color: s.muted, fontSize: 13, fontWeight: '500', marginLeft: 6 }}>
          {Platform.OS === 'ios' ? 'Apple 车载与语音' : 'Android 车载互联'}
        </Text>
        <View style={[{ borderRadius: 20, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, overflow: 'hidden' }, s.cardShadow]}>
          {Platform.OS === 'ios' ? (
            <>
              <View style={{ padding: 16, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: s.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="car-sport-outline" size={20} color={s.accent} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: s.ink, fontSize: 15.5, fontWeight: '700' }}>Apple CarPlay 车载界面</Text>
                    <Text style={{ color: s.muted, fontSize: 12 }}>收藏 / 歌单 / 最近播放目录与车机播控</Text>
                  </View>
                  {badge(!!status?.carPlayCodeReady, '已就绪', '未加载')}
                </View>
                <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: s.dark ? 'rgba(255,255,255,0.05)' : 'rgba(42,36,31,0.035)', gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name={status?.carPlayEntitlementActive ? 'checkmark-circle' : 'information-circle-outline'} size={15} color={status?.carPlayEntitlementActive ? okInk : s.muted} />
                    <Text style={{ color: s.ink, fontSize: 12.5, fontWeight: '600' }}>
                      {status?.carPlayEntitlementActive ? '已签发 CarPlay Audio 证书权限' : '自签 / LiveContainer 兼容模式'}
                    </Text>
                  </View>
                  <Text style={{ color: s.muted, fontSize: 11.5, lineHeight: 17 }}>
                    {status?.carPlayEntitlementActive
                      ? '连接 CarPlay 车机后将自动展示音枢目录树与正在播放界面。'
                      : '实机 CarPlay 投屏需 Apple 审批的 carplay-audio 证书权限；当前已启用弱链接保护，蓝牙车机控制与车载歌词正常可用。'}
                  </Text>
                </View>
              </View>
              {divider}
              <View style={{ padding: 16, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: s.dark ? 'rgba(130,110,255,0.18)' : 'rgba(110,88,232,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="mic-outline" size={20} color={s.dark ? '#B3A2FF' : '#654CD6'} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: s.ink, fontSize: 15.5, fontWeight: '700' }}>Siri 快捷指令</Text>
                    <Text style={{ color: s.muted, fontSize: 12 }}>支持 AppIntents 语音唤醒与「快捷指令」自动化</Text>
                  </View>
                  {badge(!!status?.siriIntentsAvailable, '可用', '需 iOS 16+')}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 50 }}>
                  {['用音枢继续播放', '用音枢播放收藏', '音枢下一首'].map(phrase => (
                    <View key={phrase} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: s.chip, borderWidth: 1, borderColor: s.chipBorder }}>
                      <Ionicons name="chatbubble-ellipses-outline" size={12} color={s.accent} />
                      <Text style={{ color: s.ink, fontSize: 12, fontWeight: '600' }}>「{phrase}」</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <View style={{ padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: okBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="car-sport-outline" size={20} color={okInk} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: s.ink, fontSize: 15.5, fontWeight: '700' }}>Android Auto 车载服务</Text>
                  <Text style={{ color: s.muted, fontSize: 12 }}>MediaBrowserService 收藏、歌单与最近播放目录树</Text>
                </View>
                {badge(!!status?.androidAutoServiceReady, '服务就绪', '未启用')}
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ color: s.muted, fontSize: 13, fontWeight: '500', marginLeft: 6 }}>车载曲库目录同步</Text>
        <View style={[{ borderRadius: 20, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, overflow: 'hidden' }, s.cardShadow]}>
          <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: s.dark ? 'rgba(66,153,225,0.18)' : 'rgba(43,140,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sync-outline" size={20} color={s.dark ? '#7CC4FF' : '#2476D8'} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: s.ink, fontSize: 15, fontWeight: '700' }}>原生车载曲库缓存</Text>
              <Text style={{ color: s.muted, fontSize: 12.5 }}>
                已同步 {status?.catalogTracks ?? 0} 首收藏/近期曲目 · {status?.catalogPlaylists ?? 0} 个歌单
              </Text>
            </View>
          </View>
          <View accessible={false} style={{ height: StyleSheet.hairlineWidth, backgroundColor: s.hairline }} />
          <View style={{ padding: 14, flexDirection: 'row', gap: 10 }}>
            <Pressable
              testID="car-sync-now"
              accessibilityRole="button"
              disabled={syncing}
              onPress={() => {
                void refresh().then(() => setMessage('已将最新收藏、歌单与历史同步至车载目录'));
              }}
              style={{ flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: s.control, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: syncing ? 0.6 : 1 }}
            >
              <Ionicons name="refresh" size={15} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' }}>{syncing ? '同步中…' : '立即同步目录'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const ok = services.carIntegration.executeCommand({ source: 'settings-test', action: 'playFavorites' });
                setMessage(ok ? '已通过车载指令通道触发播放收藏' : '收藏列表为空，请先收藏歌曲再测试');
              }}
              style={{ flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: s.chip, borderWidth: 1, borderColor: s.chipBorder, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
            >
              <Ionicons name="play-outline" size={15} color={s.ink} />
              <Text style={{ color: s.ink, fontSize: 13.5, fontWeight: '600' }}>测试播放收藏</Text>
            </Pressable>
          </View>
          {!!message && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
              <Text style={{ color: s.accent, fontSize: 12.5, lineHeight: 18 }}>{message}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
