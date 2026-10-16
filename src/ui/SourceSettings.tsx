import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import { useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const theme=useTheme();const styles=useThemedStyles(makeStyles);
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
  const button = (label: string, onPress: () => void, disabled = busy, accessibilityLabel = label) => <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} disabled={disabled}
    onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  return <View style={styles.card}>
    <View style={styles.row}><Text style={styles.title}>LX 音源</Text><Text style={styles.caption}>{sources.filter(item => item.status === 'ready').length} / {sources.length} 已启用</Text></View>
    <Text style={styles.description}>多个音源可同时启用。播放时先尝试所有音源的偏好音质，再逐级降档。</Text>
    {button('音源健康批测',()=>setChecking(true),busy||!sources.length)}
    <Text style={styles.caption}>检查勾选的音源；未勾选时检查已启用音源，不改变当前播放。</Text>
    {button('导入本地 JS（可多选）', () => { void perform(importFiles); })}
    <TextInput accessibilityLabel="音源订阅地址" placeholder="HTTP(S) 音源或订阅地址" placeholderTextColor="#6E7788" autoCapitalize="none" autoCorrect={false} spellCheck={false} keyboardType="url" textContentType="URL"
      value={url} onChangeText={setURL} editable={!busy} style={styles.input} />
    {button('从地址导入', () => { void perform(async () => {
      const result = await catalog.import(await downloadScript(url), '网络音源', url.trim());
      setURL(''); setMessage(result.duplicate ? '此音源已存在' : '已导入，勾选后可批量启用');
    }); }, busy || !url.trim())}
    {!!sources.length && <>
      <View style={styles.actions}>
        {button(selected.length === sources.length ? '取消全选' : '全选', () => setSelected(selected.length === sources.length ? [] : sources.map(item => item.id)))}
        {button('启用', () => batch('enable'), busy || !selected.length)}
        {button('停用', () => batch('disable'), busy || !selected.length)}
        {button('删除', () => Alert.alert('删除所选音源？', '仅删除音源配置，歌曲和歌单保留。', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => batch('delete') }]), busy || !selected.length)}
      </View>
      {sources.map((source,index) => <View key={source.id} style={styles.source}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={`选择音源：${source.name}`} accessibilityState={{ checked: selected.includes(source.id), disabled: busy }} disabled={busy}
          onPress={() => setSelected(current => current.includes(source.id) ? current.filter(id => id !== source.id) : [...current, source.id])}>
          <Text style={styles.name}>{selected.includes(source.id) ? '☑' : '☐'}　{source.name}</Text>
          <Text style={styles.caption}>{[source.version, source.author].filter(Boolean).join(' · ') || '未提供版本信息'}</Text>
        </Pressable>
        <Text style={[styles.state, source.status === 'ready' && styles.ready]}>{labels[source.status]}</Text>
        {!!source.capabilities.length && <Text style={styles.caption}>{source.capabilities.map(item => `${item.platform}: ${item.qualities.join('/')}`).join('　')}</Text>}
        <View style={styles.actions}>
          {button(source.enabled ? '停用' : '启用', () => batch(source.enabled ? 'disable' : 'enable', [source.id]), busy, `${source.enabled ? '停用' : '启用'}音源：${source.name}`)}
          {source.status === 'failed' && button('重试', () => batch('enable', [source.id]))}
          {index>0 && button('优先级↑', () => { void perform(async () => { await catalog.move(source.id,-1); }); })}
          {index<sources.length-1 && button('优先级↓', () => { void perform(async () => { await catalog.move(source.id,1); }); })}
          {source.hasSubscription && button('检查更新', () => { void perform(async () => {
            const changed = await catalog.update(source.id, await downloadScript(catalog.subscription(source.id)!));
            setMessage(changed ? '已更新并停用，请检查版本后重新启用；可恢复旧版。' : '当前脚本没有变化');
          }); })}
          {source.canRollback && button('恢复旧版', () => { void perform(async () => { await catalog.rollback(source.id); setMessage('已恢复旧版，请重新启用'); }); })}
        </View>
      </View>)}
    </>}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
    {busy && <Text accessibilityLiveRegion="polite" style={styles.caption}>正在处理，其他音源会继续工作…</Text>}
    <SourceHealthModal health={health} ids={selected.length?selected:sources.filter(s=>s.enabled).map(s=>s.id)} visible={checking} onClose={()=>setChecking(false)}/>
  </View>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({
  card: { marginTop: 24, padding: 18, borderRadius: 20, backgroundColor: theme.color('#1D222B'), borderWidth: 1, borderColor: theme.color('#2A303A') },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: theme.color('#ECEBF3'), fontSize: 18, fontWeight: '600' },
  description: { color: theme.color('#9296A2'), fontSize: 12, lineHeight: 21, marginVertical: 12 },
  caption: { color: theme.color('#9296A2'), fontSize: 11, lineHeight: 20, flexShrink: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { backgroundColor: theme.color('#303A32'), borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginVertical: 5 },
  buttonText: { color: theme.color('#D9F49B'), fontSize: 12 }, disabled: { opacity: 0.4 },
  input: { color: theme.color('#EEECE7'), borderColor: theme.color('#414754'), borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 12, fontSize: 12 },
  source: { borderTopWidth: 1, borderTopColor: theme.color('#353A46'), paddingTop: 15, marginTop: 14 },
  name: { color: theme.color('#ECEBF3'), fontSize: 15, lineHeight: 23 },
  state: { color: theme.color('#C7AC90'), fontSize: 12, marginVertical: 8 }, ready: { color: theme.color('#D9F49B') },
  message: { color: theme.color('#C4C8D4'), fontSize: 12, lineHeight: 20, marginTop: 12 },
});
