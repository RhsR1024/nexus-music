import {FutureRecordError} from './src/storage/recovery.ts';
import {ThemeContext,useAppearance,type Theme} from './src/ui/theme.tsx';
import {AppearanceSettings} from './src/ui/AppearanceSettings.tsx';
import { useEffect, useState } from 'react';
import { getServices, type Services } from './src/app/services';
import { SourceSettings } from './src/ui/SourceSettings';
import { AudioSettings } from './src/ui/AudioSettings';
import { Player } from './src/ui/Player';
import { Search } from './src/ui/Search';
import { NavidromeSettings } from './src/ui/NavidromeSettings';
import { NavidromeLibrary } from './src/ui/NavidromeLibrary';
import { CacheSettings } from './src/ui/CacheSettings';
import { FontSettings } from './src/ui/FontSettings';
import { LibraryHome } from './src/ui/LibraryHome';
import { StatusBar } from 'expo-status-bar';
import {
  Linking, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

type Tab = 'library' | 'search' | 'private' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('library');
  const [services, setServices] = useState<Services>();
  const [startupError, setStartupError] = useState<string>();
  useEffect(() => {
    let active = true;
    void getServices().then(value => { if (active) setServices(value); }, error => { if (active) setStartupError(error instanceof FutureRecordError?error.message:'无法打开本地数据或原生模块，原始数据已保留，请重试。'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const open = (url: string | null) => { if (url?.startsWith('com.nexusmusic.app://settings')) setTab('settings'); };
    void Linking.getInitialURL().then(open);
    const subscription = Linking.addEventListener('url', event => open(event.url));
    return () => subscription.remove();
  }, []);
  const theme=useAppearance(services?.preferences),styles=makeStyles(theme);
  return (
    <ThemeContext.Provider value={theme}><View style={styles.root}>
      <StatusBar style={theme.mode==='dark'?'light':'dark'} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>NEXUS MUSIC</Text>
            <Text accessibilityRole="header" style={styles.brand}>音枢<Text style={styles.dot}> ·</Text></Text>
          </View>
          <View style={styles.badge}><Text style={styles.badgeText}>私人音乐空间</Text></View>
        </View>
        {startupError?<View><Text style={styles.pending}>{startupError}</Text><Pressable accessibilityRole="button" onPress={()=>{setStartupError(undefined);void getServices().then(setServices,error=>setStartupError(error instanceof FutureRecordError?error.message:'仍无法打开本地数据，请检查可用空间或重新启动应用。'));}}><Text style={styles.active}>重试打开</Text></Pressable></View>:tab === 'library' ? (services ? <LibraryHome services={services} openSearch={()=>setTab('search')} openSettings={()=>setTab('settings')}/> : <Text style={styles.pending}>正在打开音乐数据…</Text>) : tab === 'search' ? (services ? <Search services={services}/> : <Text style={styles.pending}>正在打开音乐数据…</Text>) : tab==='private' ? (services?<NavidromeLibrary services={services} openSettings={()=>setTab('settings')}/>:<Text style={styles.pending}>正在打开音乐数据…</Text>) : <>
          <Text style={styles.pageTitle}>音乐来源</Text>
          <Text style={styles.description}>连接你的曲库，选择播放来源。</Text>
          {services&&<NavidromeSettings services={services}/>}
          {services ? <SourceSettings catalog={services.catalog} /> : <Text style={styles.pending}>{startupError ? '无法打开本地数据库或原生模块，请重新启动应用；已有数据保留。' : '正在打开音乐数据…'}</Text>}
          {services && <><AudioSettings services={services} /><FontSettings services={services}/><CacheSettings services={services}/><AppearanceSettings services={services}/></>}
          <Text style={styles.footnote}>音枢 · 0.1 开发版{ '\n'}播放与真机后台验收进行中。</Text>
        </>}
      </ScrollView>
      {services && <Player services={services} />}
      <View style={styles.tabBar}>
        {([['library', '♫', '音乐库'], ['search', '⌕', '搜索'], ['private','▦','私人曲库'], ['settings', '☷', '来源设置']] as const).map(([key, icon, title]) =>
          <Pressable key={key} testID={`tab-${key}`} accessibilityLabel={title} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)} style={styles.tab}>
            <Text style={[styles.tabIcon, tab === key && styles.active]}>{icon}</Text>
            <Text style={[styles.tabText, tab === key && styles.active]}>{title}</Text>
          </Pressable>)}
      </View>
    </View></ThemeContext.Provider>
  );
}

const makeStyles=(theme:Theme)=>StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color('#111318') },
  content: { paddingTop: 68, paddingHorizontal: 24, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  eyebrow: { fontSize: 10, letterSpacing: 3, color: theme.color('#9D9EA9'), marginBottom: 6 },
  brand: { color: theme.color('#F3F0E9'), fontSize: 30, fontWeight: '700', letterSpacing: 1 },
  dot: { color: theme.color('#D9F49B') },
  badge: { backgroundColor: theme.color('#22272A'), borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: theme.color('#B3BBAF'), fontSize: 11 },
  hero: { backgroundColor: theme.color('#25283A'), borderRadius: 26, padding: 24, overflow: 'hidden' },
  record: { width: 154, height: 154, borderRadius: 77, borderWidth: 1, borderColor: theme.color('#4B4D62'), alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color('#1B1D2C'), marginRight: -52, marginTop: -47, marginBottom: -32 },
  groove: { width: 116, height: 116, borderRadius: 58, borderWidth: 14, borderColor: theme.color('#292C3F'), justifyContent: 'center', alignItems: 'center' },
  label: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.color('#C7A1E2'), alignItems: 'center', justifyContent: 'center' },
  spindle: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color('#222534') },
  kicker: { color: theme.color('#C6B7D9'), fontSize: 11, letterSpacing: 2, marginBottom: 14 },
  title: { color: theme.color('#F7F3ED'), fontSize: 31, lineHeight: 43, fontWeight: '600', letterSpacing: -1 },
  description: { color: theme.color('#B5B4BF'), fontSize: 13, lineHeight: 23, marginTop: 14 },
  primary: { backgroundColor: theme.color('#D9F49B'), paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, marginTop: 24, alignSelf: 'flex-start' },
  primaryText: { color: theme.color('#202919'), fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 32, marginBottom: 14 },
  sectionTitle: { color: theme.color('#EEECE7'), fontSize: 18, fontWeight: '600' },
  muted: { color: theme.color('#7C808C'), fontSize: 11 },
  empty: { borderWidth: 1, borderColor: theme.color('#2A2D35'), borderRadius: 22, padding: 25, alignItems: 'center' },
  emptyIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: theme.color('#242934'), alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  note: { color: theme.color('#B7C3DA'), fontSize: 25 },
  emptyTitle: { color: theme.color('#D5D7DF'), fontSize: 14, fontWeight: '500', marginBottom: 9 },
  emptyText: { color: theme.color('#9296A2'), fontSize: 12, lineHeight: 21 },
  captionRow: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  accentLine: { width: 13, height: 2, backgroundColor: theme.color('#B6C993') },
  caption: { color: theme.color('#767D80'), fontSize: 10 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.color('#262A32'), paddingBottom: 32, paddingTop: 14, backgroundColor: theme.color('#171A20') },
  tab: { flex: 1, alignItems: 'center', gap: 5 },
  tabIcon: { color: theme.color('#7E8592'), fontSize: 23 },
  tabText: { color: theme.color('#7E8592'), fontSize: 10 },
  active: { color: theme.color('#D9F49B') },
  pageTitle: { color: theme.color('#F1EDE7'), fontSize: 27, fontWeight: '600' },
  sourceCard: { marginTop: 24, padding: 20, borderRadius: 20, backgroundColor: theme.color('#1D222B'), borderWidth: 1, borderColor: theme.color('#2A303A') },
  sourceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sourceTitle: { color: theme.color('#ECEBF3'), fontSize: 18, fontWeight: '600' },
  sourceState: { color: theme.color('#939AA6'), fontSize: 11 },
  pending: { marginTop: 14, color: theme.color('#B9B39F'), fontSize: 11, lineHeight: 20 },
  footnote: { marginTop: 32, color: theme.color('#777E89'), fontSize: 11, lineHeight: 21 },
});
