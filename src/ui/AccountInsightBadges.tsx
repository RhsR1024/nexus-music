import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatExpireDate, type AccountInsight } from '../providers/accountInsights.ts';
import { Text } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function MembershipPill({
  insight,
  loading,
  testID,
}: {
  insight?: AccountInsight;
  loading?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);

  if (loading && (!insight || insight.membership === 'unknown')) {
    return (
      <View
        testID={testID}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 9,
          backgroundColor: s.chip,
          borderWidth: 1,
          borderColor: s.chipBorder,
        }}
      >
        <ActivityIndicator size="small" color={s.muted} style={{ transform: [{ scale: 0.65 }] }} />
        <Text style={{ fontSize: 10.5, fontWeight: '600', color: s.muted }}>查询中</Text>
      </View>
    );
  }

  const isMember = insight?.isMember === true;
  const label = insight?.membershipLabel ?? '会员状态未知';
  const vipBg = s.dark ? 'rgba(245,158,11,0.20)' : 'rgba(217,119,6,0.13)';
  const vipBorder = s.dark ? 'rgba(251,191,36,0.38)' : 'rgba(217,119,6,0.28)';
  const vipInk = s.dark ? '#FBBF24' : '#B45309';

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 9,
        backgroundColor: isMember ? vipBg : s.chip,
        borderWidth: 1,
        borderColor: isMember ? vipBorder : s.chipBorder,
      }}
    >
      {isMember && <Ionicons name="diamond" size={10} color={vipInk} />}
      <Text style={{ fontSize: 10.5, fontWeight: '700', color: isMember ? vipInk : s.muted }}>{label}</Text>
    </View>
  );
}

export function AccountStatsStrip({
  insight,
  loading,
  extraPlaylistCount,
  extraLikedCount,
  inline = false,
}: {
  insight?: AccountInsight;
  loading?: boolean;
  extraPlaylistCount?: number;
  extraLikedCount?: number;
  inline?: boolean;
}) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);

  const isNetease = insight?.platform === 'wy';
  const playlistCount = insight?.playlistCount ?? extraPlaylistCount;
  const expireDate = insight?.isMember ? formatExpireDate(insight.expireAt) : undefined;

  const hasNeteaseStats =
    isNetease &&
    (insight.level !== undefined ||
      insight.listenSongs !== undefined ||
      insight.follows !== undefined ||
      insight.followeds !== undefined ||
      playlistCount !== undefined);

  const hasOtherStats = !isNetease && (playlistCount !== undefined || extraLikedCount !== undefined || !!expireDate);

  if (!hasNeteaseStats && !hasOtherStats && !loading) {
    return null;
  }

  const insetBg = s.dark ? 'rgba(255,255,255,0.045)' : 'rgba(42,36,31,0.032)';
  const lvBg = s.dark ? 'rgba(240,122,140,0.20)' : 'rgba(181,74,90,0.12)';
  const lvInk = s.accent;

  if (isNetease && hasNeteaseStats) {
    const metrics: Array<{ label: string; value: string }> = [];
    if (insight.follows !== undefined) metrics.push({ label: '关注', value: formatNumber(insight.follows) });
    if (insight.followeds !== undefined) metrics.push({ label: '粉丝', value: formatNumber(insight.followeds) });
    if (playlistCount !== undefined) metrics.push({ label: '歌单', value: `${formatNumber(playlistCount)} 个` });

    return (
      <View
        style={{
          marginHorizontal: inline ? 0 : 16,
          marginBottom: inline ? 0 : 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 14,
          backgroundColor: insetBg,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          {insight.level !== undefined && (
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: lvBg }}>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: lvInk, fontVariant: ['tabular-nums'] }}>
                Lv.{insight.level}
              </Text>
            </View>
          )}
          {insight.listenSongs !== undefined && (
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: s.ink, fontVariant: ['tabular-nums'] }}>
              累计听歌 {formatNumber(insight.listenSongs)} 首
            </Text>
          )}
          {!!expireDate && (
            <Text style={{ fontSize: 11.5, color: s.muted, marginLeft: 'auto', fontVariant: ['tabular-nums'] }}>
              有效期至 {expireDate}
            </Text>
          )}
        </View>
        {metrics.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {metrics.map(m => (
              <View key={m.label} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: s.ink, fontVariant: ['tabular-nums'] }}>
                  {m.value}
                </Text>
                <Text style={{ fontSize: 11.5, color: s.muted }}>{m.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      style={{
        marginHorizontal: inline ? 0 : 16,
        marginBottom: inline ? 0 : 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: insetBg,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      {playlistCount !== undefined && (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: s.ink, fontVariant: ['tabular-nums'] }}>
            {formatNumber(playlistCount)}
          </Text>
          <Text style={{ fontSize: 11.5, color: s.muted }}>个歌单</Text>
        </View>
      )}
      {extraLikedCount !== undefined && extraLikedCount > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: s.ink, fontVariant: ['tabular-nums'] }}>
            {formatNumber(extraLikedCount)}
          </Text>
          <Text style={{ fontSize: 11.5, color: s.muted }}>首喜欢</Text>
        </View>
      )}
      {!!expireDate && (
        <Text style={{ fontSize: 11.5, color: s.muted, fontVariant: ['tabular-nums'] }}>有效期至 {expireDate}</Text>
      )}
      {loading && !hasOtherStats && (
        <Text style={{ fontSize: 11.5, color: s.muted }}>正在同步账号统计…</Text>
      )}
    </View>
  );
}
