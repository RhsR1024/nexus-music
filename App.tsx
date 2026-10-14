import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

type Tab = 'library' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('library');
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>NEXUS MUSIC</Text>
            <Text accessibilityRole="header" style={styles.brand}>音枢<Text style={styles.dot}> ·</Text></Text>
          </View>
          <View style={styles.badge}><Text style={styles.badgeText}>私人音乐空间</Text></View>
        </View>
        {tab === 'library' ? <>
          <View style={styles.hero}>
            <View accessible={false} style={styles.record}>
              <View style={styles.groove}><View style={styles.label}><View style={styles.spindle} /></View></View>
            </View>
            <Text style={styles.kicker}>让音乐回到你身边</Text>
            <Text accessibilityRole="header" style={styles.title}>不同的来源，{'\n'}同一个音乐世界。</Text>
            <Text style={styles.description}>把喜欢的歌与私人曲库放在一起。{ '\n'}从连接你的第一个来源开始。</Text>
            <Pressable accessibilityRole="button" onPress={() => setTab('settings')}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>查看来源设置　↗</Text>
            </Pressable>
          </View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>我的音乐库</Text><Text style={styles.muted}>尚无歌曲</Text>
          </View>
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Text style={styles.note}>♫</Text></View>
            <Text style={styles.emptyTitle}>为下一次聆听留个位置</Text>
            <Text style={styles.emptyText}>收藏、歌单和最近播放将在这里汇集。{ '\n'}当前还没有连接音乐来源。</Text>
          </View>
          <View style={styles.captionRow}><View style={styles.accentLine}/><Text style={styles.caption}>属于你的收藏，保持原有的顺序与记忆。</Text></View>
        </> : <>
          <Text style={styles.pageTitle}>音乐来源</Text>
          <Text style={styles.description}>连接你的曲库，选择播放来源。</Text>
          <View style={styles.sourceCard}>
            <View style={styles.sourceTop}><Text style={styles.sourceTitle}>Navidrome</Text><Text style={styles.sourceState}>尚未连接</Text></View>
            <Text style={styles.emptyText}>浏览自己的歌曲、专辑、歌手与服务端歌单。</Text>
            <Text style={styles.pending}>连接功能正在接入，暂不收集账号信息。</Text>
          </View>
          <View style={styles.sourceCard}>
            <View style={styles.sourceTop}><Text style={styles.sourceTitle}>LX 音源</Text><Text style={styles.sourceState}>尚未配置</Text></View>
            <Text style={styles.emptyText}>使用你提供的音源脚本解析播放地址。</Text>
            <Text style={styles.pending}>脚本导入功能正在接入。</Text>
          </View>
          <Text style={styles.footnote}>音枢 · 0.1 开发版{ '\n'}当前为首个工程基线，音乐播放尚未开放。</Text>
        </>}
      </ScrollView>
      <View style={styles.tabBar}>
        {([['library', '♫', '音乐库'], ['settings', '☷', '来源设置']] as const).map(([key, icon, title]) =>
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)} style={styles.tab}>
            <Text style={[styles.tabIcon, tab === key && styles.active]}>{icon}</Text>
            <Text style={[styles.tabText, tab === key && styles.active]}>{title}</Text>
          </Pressable>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111318' },
  content: { paddingTop: 68, paddingHorizontal: 24, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  eyebrow: { fontSize: 10, letterSpacing: 3, color: '#9D9EA9', marginBottom: 6 },
  brand: { color: '#F3F0E9', fontSize: 30, fontWeight: '700', letterSpacing: 1 },
  dot: { color: '#D9F49B' },
  badge: { backgroundColor: '#22272A', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: '#B3BBAF', fontSize: 11 },
  hero: { backgroundColor: '#25283A', borderRadius: 26, padding: 24, overflow: 'hidden' },
  record: { width: 154, height: 154, borderRadius: 77, borderWidth: 1, borderColor: '#4B4D62', alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B1D2C', marginRight: -52, marginTop: -47, marginBottom: -32 },
  groove: { width: 116, height: 116, borderRadius: 58, borderWidth: 14, borderColor: '#292C3F', justifyContent: 'center', alignItems: 'center' },
  label: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#C7A1E2', alignItems: 'center', justifyContent: 'center' },
  spindle: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#222534' },
  kicker: { color: '#C6B7D9', fontSize: 11, letterSpacing: 2, marginBottom: 14 },
  title: { color: '#F7F3ED', fontSize: 31, lineHeight: 43, fontWeight: '600', letterSpacing: -1 },
  description: { color: '#B5B4BF', fontSize: 13, lineHeight: 23, marginTop: 14 },
  primary: { backgroundColor: '#D9F49B', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, marginTop: 24, alignSelf: 'flex-start' },
  primaryText: { color: '#202919', fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 32, marginBottom: 14 },
  sectionTitle: { color: '#EEECE7', fontSize: 18, fontWeight: '600' },
  muted: { color: '#7C808C', fontSize: 11 },
  empty: { borderWidth: 1, borderColor: '#2A2D35', borderRadius: 22, padding: 25, alignItems: 'center' },
  emptyIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#242934', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  note: { color: '#B7C3DA', fontSize: 25 },
  emptyTitle: { color: '#D5D7DF', fontSize: 14, fontWeight: '500', marginBottom: 9 },
  emptyText: { color: '#9296A2', fontSize: 12, lineHeight: 21 },
  captionRow: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  accentLine: { width: 13, height: 2, backgroundColor: '#B6C993' },
  caption: { color: '#767D80', fontSize: 10 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#262A32', paddingBottom: 32, paddingTop: 14, backgroundColor: '#171A20' },
  tab: { flex: 1, alignItems: 'center', gap: 5 },
  tabIcon: { color: '#7E8592', fontSize: 23 },
  tabText: { color: '#7E8592', fontSize: 10 },
  active: { color: '#D9F49B' },
  pageTitle: { color: '#F1EDE7', fontSize: 27, fontWeight: '600' },
  sourceCard: { marginTop: 24, padding: 20, borderRadius: 20, backgroundColor: '#1D222B', borderWidth: 1, borderColor: '#2A303A' },
  sourceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sourceTitle: { color: '#ECEBF3', fontSize: 18, fontWeight: '600' },
  sourceState: { color: '#939AA6', fontSize: 11 },
  pending: { marginTop: 14, color: '#B9B39F', fontSize: 11, lineHeight: 20 },
  footnote: { marginTop: 32, color: '#777E89', fontSize: 11, lineHeight: 21 },
});
