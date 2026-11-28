import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import {
  DEFAULT_NETWORK_CHECK_KEYWORD,
  formatNetworkSummary,
  NETWORK_CHECK_PHASES,
  type NetworkCheckRow,
  type PhaseState,
  type RowKind,
} from '../providers/networkDiagnostics.ts';
import { SheetModal } from './AdaptiveModal.tsx';
import { PlatformLogo } from './PlatformLogo.tsx';
import { Text, TextInput } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

export function NetworkCheckScreen({ services }: { services: Services }) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const state = useSyncExternalStore(
    services.networkDiagnostics.subscribe,
    services.networkDiagnostics.getSnapshot,
  );
  const [keyword, setKeyword] = useState(state.sampleKeyword || DEFAULT_NETWORK_CHECK_KEYWORD);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState('');

  useEffect(() => {
    void services.networkDiagnostics.refreshNetwork();
    return () => {
      services.networkDiagnostics.stop('离开检测页，已停止');
    };
  }, [services.networkDiagnostics]);

  const okColor = s.dark ? '#5EE0A0' : '#1D8A56';
  const okBg = s.dark ? 'rgba(94,224,160,0.14)' : 'rgba(29,138,86,0.11)';
  const warnColor = s.dark ? '#FFB86C' : '#B8640B';
  const warnBg = s.dark ? 'rgba(255,184,108,0.15)' : 'rgba(184,100,11,0.11)';
  const failColor = s.dark ? '#FF7A8A' : '#C93849';
  const failBg = s.dark ? 'rgba(255,122,138,0.15)' : 'rgba(201,56,73,0.10)';

  const colorForKind = (kind: RowKind): { text: string; bg: string } => {
    if (kind === 'ok') return { text: okColor, bg: okBg };
    if (kind === 'failed') return { text: failColor, bg: failBg };
    if (kind === 'uncertain') return { text: warnColor, bg: warnBg };
    if (kind === 'running') return { text: s.control, bg: s.accentSoft };
    return { text: s.muted, bg: s.chip };
  };

  const colorForPhase = (phaseState: PhaseState): string => {
    if (phaseState === 'ok') return okColor;
    if (phaseState === 'failed') return failColor;
    if (phaseState === 'uncertain' || phaseState === 'skipped') return warnColor;
    if (phaseState === 'running') return s.control;
    return s.subtle;
  };

  const platformRunning = state.running && state.activeMode === 'platform';
  const sourceRunning = state.running && state.activeMode === 'source';

  const platformDone = state.platformRows.filter(
    row => row.kind !== 'pending' && row.kind !== 'running',
  ).length;
  const platformOk = state.platformRows.filter(row => row.kind === 'ok').length;
  const platformFailed = state.platformRows.filter(row => row.kind === 'failed').length;

  const allSourceRows = state.sourceGroups.flatMap(g => g.rows).filter(r => r.kind !== 'unsupported');
  const sourceDone = allSourceRows.filter(r => r.kind !== 'pending' && r.kind !== 'running').length;
  const sourceOk = allSourceRows.filter(r => r.kind === 'ok').length;
  const sourceFailed = allSourceRows.filter(r => r.kind === 'failed').length;
  const sourceUncertain = allSourceRows.filter(r => r.kind === 'uncertain').length;

  const selectedRow: NetworkCheckRow | undefined = selectedRowId
    ? state.platformRows.find(r => r.id === selectedRowId) ??
      state.sourceGroups.flatMap(g => g.rows).find(r => r.id === selectedRowId)
    : undefined;

  const shareLocalReport = async () => {
    setShareNote('');
    try {
      await Share.share({
        title: '音枢网络与音源检测结果',
        message: services.networkDiagnostics.formatLocalReport(),
      });
    } catch {
      setShareNote('未能调起系统分享，请重试。');
    }
  };

  const networkDetailsText = [
    `系统连通性：${
      state.network.transport === 'unknown'
        ? '待读取，以各平台实测结果为准'
        : state.network.validated
          ? '已验证'
          : '未验证；仍以各平台实测结果为准'
    }`,
    `计费/低数据模式：${state.network.isExpensive ? '计费网络' : '非计费'}${
      state.network.isConstrained ? ' · 低数据模式' : ''
    }${state.network.dnsCount !== undefined && state.network.dnsCount >= 0 ? ` · DNS ${state.network.dnsCount} 项` : ''}`,
    '检测流程：发现 → 搜索 → 解析 → 音频；每项仅校验 4 KiB 媒体头，单轮上限 90 秒。',
    '所有结果仅保留在本机，绝不上传；检测期间不影响当前播放与队列。',
  ].join('\n');

  const platformPairs: (readonly [NetworkCheckRow, NetworkCheckRow?])[] = [];
  for (let i = 0; i < state.platformRows.length; i += 2) {
    platformPairs.push([state.platformRows[i]!, state.platformRows[i + 1]]);
  }

  return (
    <View style={{ gap: 14, paddingTop: 4 }}>
      {/* Top summary card matching Wayferar-Music structure with Sollin polish */}
      <View
        testID="network-check-summary-card"
        style={[
          {
            padding: 16,
            borderRadius: 20,
            backgroundColor: s.card,
            borderWidth: 1,
            borderColor: s.cardBorder,
            gap: 10,
          },
          s.cardShadow,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={{ color: s.ink, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 }}>
              一次检测，看清音乐链路
            </Text>
            <Text style={{ color: s.muted, fontSize: 12 }}>
              7 平台四阶段分层诊断 · 检测完成后可截图或分享脱敏报告
            </Text>
          </View>
          <Pressable
            testID="network-check-share"
            accessibilityRole="button"
            accessibilityLabel="分享本地检测结果"
            onPress={() => {
              void shareLocalReport();
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: s.chip,
              borderWidth: 1,
              borderColor: s.chipBorder,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="share-outline" size={17} color={s.control} />
          </Pressable>
        </View>

        {/* System network status row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 14,
            backgroundColor: s.dark ? 'rgba(255,255,255,0.045)' : 'rgba(42,36,31,0.035)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
            <Ionicons
              name={
                state.network.transport === 'wifi'
                  ? 'wifi-outline'
                  : state.network.transport === 'cellular'
                    ? 'cellular-outline'
                    : state.network.transport === 'none'
                      ? 'cloud-offline-outline'
                      : 'globe-outline'
              }
              size={16}
              color={state.network.connected ? okColor : s.muted}
            />
            <Text testID="network-check-system-status" numberOfLines={1} style={{ color: s.ink, fontSize: 12.5, fontWeight: '600', flex: 1 }}>
              {formatNetworkSummary(state.network)}
            </Text>
          </View>
          <Pressable
            testID="network-check-toggle-details"
            accessibilityRole="button"
            accessibilityState={{ expanded: detailsOpen }}
            onPress={() => {
              setDetailsOpen(v => !v);
              void services.networkDiagnostics.refreshNetwork();
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2 }}
          >
            <Text style={{ color: s.control, fontSize: 12, fontWeight: '600' }}>
              {detailsOpen ? '收起详情' : '诊断详情'}
            </Text>
            <Ionicons name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={14} color={s.control} />
          </Pressable>
        </View>

        {detailsOpen && (
          <View
            testID="network-check-details-panel"
            style={{
              padding: 12,
              borderRadius: 14,
              backgroundColor: s.dark ? 'rgba(255,255,255,0.035)' : 'rgba(42,36,31,0.03)',
              gap: 6,
            }}
          >
            <Text style={{ color: s.muted, fontSize: 11.5, lineHeight: 18 }}>{networkDetailsText}</Text>
          </View>
        )}

        {/* Editable sample keyword (prefilled for 1-tap launch) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              minHeight: 40,
              paddingHorizontal: 11,
              borderRadius: 14,
              backgroundColor: s.inputBg,
              borderWidth: 1,
              borderColor: s.cardBorder,
            }}
          >
            <Ionicons name="musical-notes-outline" size={15} color={s.subtle} />
            <TextInput
              testID="network-check-keyword-input"
              accessibilityLabel="测试样本歌曲关键词"
              value={keyword}
              onChangeText={setKeyword}
              editable={!state.running}
              maxLength={64}
              placeholder={`测试样本词（默认：${DEFAULT_NETWORK_CHECK_KEYWORD}）`}
              placeholderTextColor={s.subtle}
              style={{ flex: 1, color: s.ink, fontSize: 13.5, paddingVertical: 7 }}
            />
          </View>
          <Pressable
            testID="network-check-start-platforms"
            accessibilityRole="button"
            accessibilityLabel={platformRunning ? '停止平台检测' : '开始平台检测'}
            disabled={sourceRunning}
            onPress={() => {
              if (platformRunning) {
                services.networkDiagnostics.stop('检测已取消');
              } else {
                void services.networkDiagnostics.startPlatformCheck(keyword);
              }
            }}
            style={{
              minHeight: 40,
              paddingHorizontal: 15,
              borderRadius: 20,
              backgroundColor: platformRunning ? failBg : s.control,
              borderWidth: platformRunning ? 1 : 0,
              borderColor: platformRunning ? failColor + '55' : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: sourceRunning ? 0.42 : 1,
            }}
          >
            {platformRunning ? (
              <ActivityIndicator size="small" color={failColor} />
            ) : (
              <Ionicons name="pulse-outline" size={16} color="#FFFFFF" />
            )}
            <Text
              style={{
                color: platformRunning ? failColor : '#FFFFFF',
                fontSize: 13.5,
                fontWeight: '700',
              }}
            >
              {platformRunning ? '停止检测' : '开始检测'}
            </Text>
          </Pressable>
        </View>

        <Text style={{ color: s.subtle, fontSize: 11, lineHeight: 16 }}>
          {state.running
            ? '检测中 · 点击任意平台卡片可查看分层详情，结果仅代表当前样本与网络。'
            : state.finishReason
              ? `不上传报告 · ${state.finishReason}（正常 ${platformOk} · 异常 ${platformFailed} · 已测 ${platformDone}/${state.platformRows.length}）`
              : '不上传报告 · 点击平台卡片可查看发现/搜索/解析/音频四阶段完整结果。'}
        </Text>
        {!!shareNote && (
          <Text accessibilityRole="alert" style={{ color: failColor, fontSize: 12 }}>
            {shareNote}
          </Text>
        )}
      </View>

      {/* 7-platform 2-column matrix */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <Text accessibilityRole="header" style={{ color: s.muted, fontSize: 13, fontWeight: '600' }}>
            平台全链路检测（7 平台）
          </Text>
          {platformDone > 0 && (
            <Text style={{ color: s.muted, fontSize: 12, fontVariant: ['tabular-nums'] }}>
              {platformOk}/{state.platformRows.length} 正常
            </Text>
          )}
        </View>

        {platformPairs.map(([left, right], pairIdx) => (
          <View key={pairIdx} style={{ flexDirection: 'row', gap: 10 }}>
            {[left, right].map((row, colIdx) => {
              if (!row) return <View key={`spacer-${colIdx}`} style={{ flex: 1 }} />;
              const tone = colorForKind(row.kind);
              return (
                <Pressable
                  key={row.id}
                  testID={`network-platform-card-${row.platform}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.platformLabel}检测状态 ${row.badge}，点击查看分层详情`}
                  onPress={() => setSelectedRowId(row.id)}
                  style={[
                    {
                      flex: 1,
                      padding: 13,
                      borderRadius: 18,
                      backgroundColor: s.card,
                      borderWidth: 1,
                      borderColor: s.cardBorder,
                      gap: 10,
                    },
                    s.cardShadow,
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <PlatformLogo platform={row.platform} size={20} />
                    <Text numberOfLines={1} style={{ flex: 1, color: s.ink, fontSize: 13.5, fontWeight: '700' }}>
                      {row.platformShort}
                    </Text>
                    <View style={{ paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 999, backgroundColor: tone.bg }}>
                      <Text numberOfLines={1} style={{ color: tone.text, fontSize: 10.5, fontWeight: '700' }}>
                        {row.badge}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {NETWORK_CHECK_PHASES.map((phaseName, idx) => {
                      const cell = row.phases[idx]!;
                      return (
                        <View key={phaseName} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                          <Text style={{ color: s.subtle, fontSize: 10 }}>{phaseName}</Text>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: colorForPhase(cell.state),
                              fontSize: 10.5,
                              fontWeight: '700',
                              fontVariant: ['tabular-nums'],
                            }}
                          >
                            {cell.shortText}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* All custom LX sources check card */}
      <View
        testID="network-check-sources-card"
        style={[
          {
            padding: 16,
            borderRadius: 20,
            backgroundColor: s.card,
            borderWidth: 1,
            borderColor: s.cardBorder,
            gap: 10,
          },
          s.cardShadow,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text accessibilityRole="header" style={{ color: s.ink, fontSize: 16, fontWeight: '700' }}>
              自定义 LX 音源结果
            </Text>
            <Text style={{ color: s.muted, fontSize: 12, lineHeight: 17 }}>
              {state.sourceGroups.length > 0
                ? `${state.sourceFinishReason ? `${state.sourceFinishReason} · ` : ''}${state.sourceGroups.length} 个音源 · 已测 ${sourceDone}/${allSourceRows.length}（正常 ${sourceOk} · 异常 ${sourceFailed} · 未确认 ${sourceUncertain}）`
                : state.sourceFinishReason ?? '独立诊断会话逐源检验 5 平台解析与音频头，不改选源顺序'}
            </Text>
          </View>

          <Pressable
            testID="network-check-start-sources"
            accessibilityRole="button"
            accessibilityLabel={sourceRunning ? '停止测试全部音源' : '测试全部音源'}
            disabled={platformRunning}
            onPress={() => {
              if (sourceRunning) {
                services.networkDiagnostics.stop('检测已取消');
              } else {
                void services.networkDiagnostics.startAllSourcesCheck(keyword);
              }
            }}
            style={{
              minHeight: 38,
              paddingHorizontal: 13,
              borderRadius: 19,
              backgroundColor: sourceRunning ? failBg : s.accentSoft,
              borderWidth: 1,
              borderColor: sourceRunning ? failColor + '55' : s.control + '44',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              opacity: platformRunning ? 0.42 : 1,
            }}
          >
            {sourceRunning && <ActivityIndicator size="small" color={failColor} />}
            <Text
              style={{
                color: sourceRunning ? failColor : s.control,
                fontSize: 12.5,
                fontWeight: '700',
              }}
            >
              {sourceRunning ? '停止测试' : '测试全部音源'}
            </Text>
          </Pressable>
        </View>

        {state.sourceGroups.map((group, gIdx) => {
          const declaredRows = group.rows.filter(r => r.kind !== 'unsupported');
          const okCount = declaredRows.filter(r => r.kind === 'ok').length;
          const allDone = declaredRows.every(r => r.kind !== 'pending' && r.kind !== 'running');
          const summaryColor =
            declaredRows.length > 0 && okCount === declaredRows.length
              ? okColor
              : allDone
                ? warnColor
                : s.muted;

          return (
            <View key={group.sourceId} style={{ gap: 8 }}>
              <View
                accessible={false}
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: s.hairline,
                  marginTop: gIdx === 0 ? 2 : 4,
                }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, color: s.ink, fontSize: 13.5, fontWeight: '700' }}>
                  {group.sourceName}
                </Text>
                <Text style={{ color: summaryColor, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  {okCount}/{declaredRows.length} 正常
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {group.rows.map(row => {
                  const tone = colorForKind(row.kind);
                  return (
                    <Pressable
                      key={row.id}
                      testID={`network-source-cell-${group.sourceId}-${row.platform}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${group.sourceName} ${row.platformLabel} ${row.badge}`}
                      onPress={() => setSelectedRowId(row.id)}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        paddingHorizontal: 4,
                        borderRadius: 12,
                        backgroundColor: s.dark ? 'rgba(255,255,255,0.04)' : 'rgba(42,36,31,0.03)',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Text numberOfLines={1} style={{ color: s.muted, fontSize: 11, fontWeight: '600' }}>
                        {row.platformShort}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: row.kind === 'unsupported' ? s.subtle : tone.text,
                          fontSize: 11,
                          fontWeight: '700',
                        }}
                      >
                        {row.badge}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      {/* Layered detail modal when user taps any platform card or source cell */}
      <SheetModal
        allowSwipeDismissal
        visible={!!selectedRow}
        animationType="slide"
        onRequestClose={() => setSelectedRowId(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: s.sheetGradient[0] }} edges={['bottom']}>
          <LinearGradient
            pointerEvents="none"
            colors={[...s.sheetGradient]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              alignSelf: 'center',
              width: 38,
              height: 4.5,
              borderRadius: 2.25,
              backgroundColor: s.subtle + '66',
              marginTop: 10,
              marginBottom: 4,
            }}
          />
          {selectedRow && (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <PlatformLogo platform={selectedRow.platform} size={28} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: s.ink, fontSize: 18, fontWeight: '700' }}>
                      {selectedRow.sourceName
                        ? `${selectedRow.sourceName} · ${selectedRow.platformLabel}`
                        : selectedRow.platformLabel}
                    </Text>
                    <Text style={{ color: colorForKind(selectedRow.kind).text, fontSize: 12.5, fontWeight: '700' }}>
                      当前结论：{selectedRow.badge}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="关闭分层详情"
                  onPress={() => setSelectedRowId(null)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: s.chip,
                    borderWidth: 1,
                    borderColor: s.chipBorder,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={20} color={s.ink} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36, gap: 10 }}
              >
                {!!selectedRow.sampleTitle && (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      backgroundColor: s.card,
                      borderWidth: 1,
                      borderColor: s.cardBorder,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Ionicons name="musical-note-outline" size={16} color={s.control} />
                    <Text style={{ flex: 1, color: s.ink, fontSize: 13, fontWeight: '600' }}>
                      测试样本：{selectedRow.sampleTitle}
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    {
                      borderRadius: 20,
                      backgroundColor: s.card,
                      borderWidth: 1,
                      borderColor: s.cardBorder,
                      overflow: 'hidden',
                    },
                    s.cardShadow,
                  ]}
                >
                  {NETWORK_CHECK_PHASES.map((phaseName, idx) => {
                    const phase = selectedRow.phases[idx]!;
                    return (
                      <View key={phaseName}>
                        {idx > 0 && (
                          <View
                            accessible={false}
                            style={{ height: StyleSheet.hairlineWidth, marginLeft: 16, backgroundColor: s.hairline }}
                          />
                        )}
                        <View style={{ padding: 14, gap: 4 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ color: s.ink, fontSize: 14.5, fontWeight: '700' }}>
                              {idx + 1}. {phaseName}
                            </Text>
                            <Text
                              style={{
                                color: colorForPhase(phase.state),
                                fontSize: 12.5,
                                fontWeight: '700',
                                fontVariant: ['tabular-nums'],
                              }}
                            >
                              {phase.shortText}
                            </Text>
                          </View>
                          <Text style={{ color: s.muted, fontSize: 12.5, lineHeight: 18 }}>{phase.detail}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <Text style={{ color: s.subtle, fontSize: 11.5, lineHeight: 17, paddingHorizontal: 4 }}>
                  结果仅代表本次网络与测试样本：音频头识别证明远端响应有效且为音频流，不等同于全部曲目权限或真实无损码率；本页不保留音频 URL 与账号凭据。
                </Text>
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </SheetModal>
    </View>
  );
}
