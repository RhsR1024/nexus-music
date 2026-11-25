import {Text,TextInput} from './Typography.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import { useState, useSyncExternalStore } from 'react';
import {Alert, Pressable, StyleSheet, Switch, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { SourceCatalog } from '../providers/sourceCatalog.ts';
import type {SourceHealth} from '../providers/sourceHealth.ts';
import {SourceHealthModal} from './SourceHealthModal.tsx';
import { fetchSourceScript } from '../providers/nativeLX.ts';

const labels = { disabled: '已停用', initializing: '初始化中…', ready: '已启用', failed: '初始化失败 · 可重试' };
class SourceInputError extends Error {}
async function downloadScript(url: string) {
  let parsed: URL;
  try { parsed = new URL(url.trim()); } catch { throw new SourceInputError('请输入完整的HTTP(S)音源地址'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) throw new SourceInputError('请输入完整的HTTP(S)音源地址');
  return fetchSourceScript(parsed.toString());
}
export function SourceSettings({ catalog,health }: { catalog: SourceCatalog;health:SourceHealth }) {
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),styles=useThemedStyles(makeStyles);
  const sources = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [url, setURL] = useState('');
  const [checking,setChecking]=useState(false);
  async function perform(work: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await work(); } catch (error) { setMessage(error instanceof SourceInputError ? error.message : '操作失败。请检查文件、地址或网络后重试；已有数据已保留。'); }
    finally { setBusy(false); }
  }
  function batch(action: 'enable' | 'disable' | 'delete', ids = selected) {
    void perform(async () => {
      const result = await catalog.batch(ids, action);
      setSelected(current => current.filter(id => !result.succeeded.includes(id)));
      setMessage(`完成 ${result.succeeded.length} 项${result.failed.length ? `，失败 ${result.failed.length} 项已保留勾选` : ''}`);
    });
  }
  async function importFiles() {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    let added = 0, duplicates = 0, failed = 0;
    for (const asset of result.assets) {
      const file = new File(asset.uri);
      try {
        if (!/\.js$/i.test(asset.name) || file.size > 8 * 1024 * 1024) { failed++; continue; }
        const imported = await catalog.import(await file.text(), asset.name);
        if (imported.duplicate) duplicates++; else added++;
      } catch { failed++; }
      finally { if (file.exists) file.delete(); }
    }
    setMessage(`导入 ${added} 个 · 已存在 ${duplicates} 个 · 失败 ${failed} 个。新音源默认停用。`);
  }
  const button = (label: string, onPress: () => void, disabled = busy, accessibilityLabel = label, primary = false, compact = false) => <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} disabled={disabled}
    onPress={onPress} style={[styles.button, primary && styles.primaryButton, compact && styles.compactButton, disabled && styles.disabled]}><Text style={[styles.buttonText, primary && styles.primaryButtonText, compact && styles.compactButtonText]}>{label}</Text></Pressable>;
  return <View style={[styles.card, s.cardShadow]}>
    <View style={styles.row}>
      <View style={{gap:2}}>
        <Text style={styles.title}>LX 音源</Text>
        <Text style={styles.caption}>{sources.filter(item => item.status === 'ready').length} / {sources.length} 已启用 · 多个音源可协同解析</Text>
      </View>
      {button('音源健康批测',()=>setChecking(true),busy||!sources.length,'音源健康批测',false,true)}
    </View>
    <View style={styles.importGroup}>
      <View style={styles.importRow}>
        {button('导入本地 JS（可多选）', () => { void perform(importFiles); }, busy, '导入本地 JS（可多选）', true)}
      </View>
      <View style={styles.urlRow}>
        <TextInput accessibilityLabel="音源订阅地址" placeholder="HTTP(S) 音源或订阅地址" placeholderTextColor={s.subtle} autoCapitalize="none" autoCorrect={false} spellCheck={false} keyboardType="url" textContentType="URL"
          value={url} onChangeText={setURL} editable={!busy} style={styles.input} />
        {button('从地址导入', () => { void perform(async () => {
          const result = await catalog.import(await downloadScript(url), '网络音源', url.trim());
          setURL(''); setMessage(result.duplicate ? '此音源已存在' : '已导入，勾选后可批量启用');
        }); }, busy || !url.trim())}
      </View>
      <Text style={styles.caption}>检查勾选的音源；未勾选时检查已启用音源，不改变当前播放。</Text>
    </View>
    {!!sources.length && <>
      <View style={styles.batchBar}>
        {button(selected.length === sources.length ? '取消全选' : '全选', () => setSelected(selected.length === sources.length ? [] : sources.map(item => item.id)), busy, selected.length === sources.length ? '取消全选' : '全选', false, true)}
        {button('启用', () => batch('enable'), busy || !selected.length, '启用', false, true)}
        {button('停用', () => batch('disable'), busy || !selected.length, '停用', false, true)}
        {button('删除', () => Alert.alert('删除所选音源？', '仅删除音源配置，歌曲和歌单保留。', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => batch('delete') }]), busy || !selected.length, '删除', false, true)}
      </View>
      <View style={styles.listContainer}>
        {sources.map((source,index) => {
          const checked = selected.includes(source.id);
          const ready = source.status === 'ready';
          const failed = source.status === 'failed';
          return <View key={source.id}>
            {index > 0 && <View accessible={false} style={styles.rowDivider}/>}
            <View style={styles.source}>
              <View style={styles.sourceHeader}>
                <Pressable accessibilityRole="checkbox" accessibilityLabel={`选择音源：${source.name}`} accessibilityState={{ checked, disabled: busy }} disabled={busy}
                  onPress={() => setSelected(current => current.includes(source.id) ? current.filter(id => id !== source.id) : [...current, source.id])} style={styles.sourceSelect}>
                  <Ionicons name={checked ? 'checkbox' : 'document-text-outline'} size={20} color={checked || ready ? s.accent : s.muted}/>
                  <View style={{flex:1,minWidth:0,gap:2}}>
                    <Text numberOfLines={1} style={styles.name}>{source.name}</Text>
                    <Text numberOfLines={1} style={styles.caption}>{[source.version, source.author].filter(Boolean).join(' · ') || '未提供版本信息'}</Text>
                  </View>
                </Pressable>
                <View style={[styles.badge, ready ? styles.badgeReady : failed ? styles.badgeFailed : styles.badgeIdle]}>
                  <Text style={[styles.badgeText, ready && styles.badgeTextReady, failed && styles.badgeTextFailed]}>{labels[source.status]}</Text>
                </View>
                <Switch testID={`source-toggle-${source.id}`} accessibilityLabel={`切换音源开关：${source.name}`} value={source.enabled} disabled={busy} onValueChange={next => batch(next ? 'enable' : 'disable', [source.id])} trackColor={s.switchTrack} thumbColor={s.switchThumb(source.enabled)}/>
              </View>
              {!!source.capabilities.length && <Text numberOfLines={2} style={styles.caps}>{source.capabilities.map(item => `${item.platform}: ${item.qualities.join('/')}`).join(' · ')}</Text>}
              <View style={styles.compactActions}>
                {button(source.enabled ? '停用' : '启用', () => batch(source.enabled ? 'disable' : 'enable', [source.id]), busy, `${source.enabled ? '停用' : '启用'}音源：${source.name}`, false, true)}
                {failed && button('重试', () => batch('enable', [source.id]), busy, '重试', false, true)}
                {index>0 && button('优先级↑', () => { void perform(async () => { await catalog.move(source.id,-1); }); }, busy, '优先级↑', false, true)}
                {index<sources.length-1 && button('优先级↓', () => { void perform(async () => { await catalog.move(source.id,1); }); }, busy, '优先级↓', false, true)}
                {source.hasSubscription && button('检查更新', () => { void perform(async () => {
                  const changed = await catalog.update(source.id, await downloadScript(catalog.subscription(source.id)!));
                  setMessage(changed ? '已更新并停用，请检查版本后重新启用；可恢复旧版。' : '当前脚本没有变化');
                }); }, busy, '检查更新', false, true)}
                {source.canRollback && button('恢复旧版', () => { void perform(async () => { await catalog.rollback(source.id); setMessage('已恢复旧版，请重新启用'); }); }, busy, '恢复旧版', false, true)}
              </View>
            </View>
          </View>;
        })}
      </View>
    </>}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
    {busy && <Text accessibilityLiveRegion="polite" style={styles.caption}>正在处理，其他音源会继续工作…</Text>}
    <SourceHealthModal health={health} ids={selected.length?selected:sources.filter(item=>item.enabled).map(item=>item.id)} visible={checking} onClose={()=>setChecking(false)}/>
  </View>;
}
const makeStyles=(theme:Theme)=>{
  const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  return StyleSheet.create({
  card: { marginTop: 14, padding: 16, borderRadius: 20, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { color: s.ink, fontSize: 16.5, fontWeight: '700' },
  caption: { color: s.muted, fontSize: 12, lineHeight: 17, flexShrink: 1 },
  importGroup: { gap: 8 },
  importRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  batchBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 2 },
  button: { backgroundColor: s.chip, borderWidth: 1, borderColor: s.chipBorder, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8, minHeight: 36, justifyContent: 'center', alignItems: 'center' },
  primaryButton: { backgroundColor: s.control, borderColor: s.control },
  compactButton: { paddingHorizontal: 10, paddingVertical: 5, minHeight: 30, borderRadius: 15 },
  buttonText: { color: s.ink, fontSize: 13, fontWeight: '600' },
  primaryButtonText: { color: '#FFFFFF' },
  compactButtonText: { fontSize: 12 },
  disabled: { opacity: 0.4 },
  input: { flex: 1, color: s.ink, backgroundColor: s.inputBg, borderColor: s.cardBorder, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, minHeight: 38, fontSize: 13 },
  listContainer: { borderRadius: 16, backgroundColor: s.dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.34)', borderWidth: 1, borderColor: s.cardBorder, overflow: 'hidden' },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 44, backgroundColor: s.hairline },
  source: { paddingHorizontal: 12, paddingVertical: 11, gap: 7 },
  sourceHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourceSelect: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { color: s.ink, fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9 },
  badgeReady: { backgroundColor: s.accentSoft },
  badgeIdle: { backgroundColor: s.dark ? 'rgba(255,255,255,0.09)' : 'rgba(124,114,112,0.12)' },
  badgeFailed: { backgroundColor: 'rgba(217,67,85,0.16)' },
  badgeText: { color: s.muted, fontSize: 10.5, fontWeight: '600' },
  badgeTextReady: { color: s.control },
  badgeTextFailed: { color: s.accent },
  caps: { color: s.subtle, fontSize: 11, lineHeight: 16, paddingLeft: 30 },
  compactActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 30 },
  message: { color: s.control, fontSize: 12.5, lineHeight: 18 },
  });
};
