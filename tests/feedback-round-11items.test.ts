import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { onlineTrack } from '../src/providers/online.ts';
import { formatTeletype2Line } from '../src/lyrics/teletype.ts';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

test('Item 1: QQ extractQQArtwork preserves raw vs[] slot indices and ignores non-image trailing vs slots', () => {
  // Real QQ UGC song shape (e.g. 小花生 / 图图 / Miss漫剪): vs[0] is "", vs[1] is the T062 cover ID,
  // and vs[4] is an unrelated ID that returns 404 on T062.
  const ugcTrack = onlineTrack('tx', {
    mid: '001s310M36Hf1w',
    name: '主角',
    singer: [{ name: '小花生', mid: '', id: 0, pmid: '' }],
    album: { id: 0, mid: '', name: '', pmid: '0030lak94GN5Ad_0' },
    vs: ['', '00391ydp1I8FXn', '', '', '0048VsaY2XYkt5', '', '', '', '', '004ULTsc1ppilv'],
    interval: 200,
  });
  assert.equal(ugcTrack.artwork, 'https://y.gtimg.cn/music/photo_new/T062R300x300M00000391ydp1I8FXn.jpg');

  // When both vs[0] and vs[1] are empty, must fall back to album.pmid rather than vs[4]
  const pmidFallback = onlineTrack('tx', {
    mid: '002fallback123',
    name: '主角',
    singer: [{ name: '图图', mid: '', id: 0, pmid: '' }],
    album: { id: 0, mid: '', name: '', pmid: '0030lak94GN5Ad_0' },
    vs: ['', '', '', '', '0048VsaY2XYkt5'],
    interval: 180,
  });
  assert.equal(pmidFallback.artwork, 'https://y.gtimg.cn/music/photo_new/T002R500x500M0000030lak94GN5Ad_0.jpg');
});

test('Item 2: Toast keeps onDismiss in a ref and memoizes useToast callbacks so playback ticks cannot flicker toast', () => {
  const src = read('src/ui/Toast.tsx');
  assert.match(src, /const dismissRef=useRef\(onDismiss\);dismissRef\.current=onDismiss;/);
  assert.match(src, /\},\[message,toastKey,opacity,visible\]\);/);
  assert.doesNotMatch(src, /\},\[[^\]]*onDismiss[^\]]*\]\);/);
  assert.match(src, /useCallback\(/);
});

test('Items 3 & 8: Standard player layouts render clean artwork without cassette overlay', () => {
  for (const file of ['src/ui/Player.tsx', 'src/ui/AMPlayer.tsx', 'src/ui/AM2Player.tsx', 'src/ui/ModernPlayer.tsx']) {
    const src = read(file);
    assert.doesNotMatch(src, /<PlayerCover\b/, `${file} must render clean <Cover>, not cassette <PlayerCover>`);
  }
  assert.doesNotMatch(read('src/ui/AppearanceOverview.tsx'), /id:'tape-style'/);
  assert.doesNotMatch(read('src/ui/VisualSettings.tsx'), /visual-tape-style/);
});

test('Item 4: Discovery preserves originating tab (featured/rankings/playlists) when returning from playlist detail', () => {
  const src = read('src/ui/Discovery.tsx');
  assert.match(src, /returnView\?:DiscoveryTabKind/);
  assert.match(src, /onOpenPlaylist=\{pl=>openCollection\(pl,false,'featured'\)\}/);
  assert.match(src, /detailReturnView==='featured'\?'返回精选':detailReturnView==='rankings'\?'返回排行榜':'返回歌单广场'/);
  assert.match(src, /onPress=\{\(\)=>setView\(\{kind:detailReturnView\}\)\}/);
});

test('Items 5, 6 & 7: Lyrics mode hides outer chevron cleanly, AM2/Wave clear top chrome, and Immersive aligns cleanly with single quality pill', () => {
  const playerSrc = read('src/ui/Player.tsx');
  const vinylSrc = read('src/ui/VinylPlayer.tsx');
  const am2Src = read('src/ui/AM2Player.tsx');
  const modernSrc = read('src/ui/ModernPlayer.tsx');
  const progressSrc = read('src/ui/PlaybackProgress.tsx');

  // Outer chevron and top chrome hide when child skin enters inline lyrics mode
  assert.match(playerSrc, /const \[classicLyricsMode,setClassicLyricsMode\]=useState\(false\),\[qualitySheetOpen,setQualitySheetOpen\]=useState\(false\),\[hideTopChrome,setHideTopChrome\]=useState\(false\);/);
  assert.match(playerSrc, /\{!hideTopChrome&&<Pressable testID="player-drag-handle"/);
  assert.match(playerSrc, /onChromeHiddenChange=\{setHideTopChrome\}/);

  // Vinyl, AM2, Immersive, Wave all notify chrome hiding and lift Row 1 small cover to insets.top + 10..12
  assert.match(vinylSrc, /onChromeHiddenChange\?\.\(inlineLyrics\)/);
  assert.match(vinylSrc, /paddingTop:inlineLyrics\?Math\.max\(insets\.top\+12,56\)/);
  assert.match(am2Src, /onChromeHiddenChange\?\.\(hidden\)/);
  assert.match(am2Src, /marginTop:Math\.max\(insets\.top\+10,56\)/);
  assert.match(am2Src, /paddingTop:Math\.max\(insets\.top\+60,108\)/);

  // Immersive uses single clickable quality pill inside PlaybackProgress (no duplicate bottom QualityPill)
  assert.match(progressSrc, /testID="progress-quality-pill"/);
  assert.match(modernSrc, /variant="immersive" qualityLabel=\{qualityLabel\} onQualityPress=\{onQuality\}/);
  const immersiveBlock = modernSrc.slice(modernSrc.indexOf("if(layout==='immersive')"), modernSrc.indexOf('// Wave skin'));
  assert.doesNotMatch(immersiveBlock, /<QualityPill\b/, 'Immersive must not duplicate QualityPill below footer');

  // Wave clears top header buttons when in cover mode and aligns Row 1 in lyrics mode
  assert.match(modernSrc, /paddingTop:inlineLyrics\?Math\.max\(insets\.top\+10,56\):Math\.max\(insets\.top\+58,108\)/);
});

test('Item 9: FrequencyHalo renders one unified radial bar ring instead of two overlapping tick rings', () => {
  const src = read('src/ui/PlayerVisuals.tsx');
  assert.equal((src.match(/Array\.from\(\{length:/g) ?? []).length, 1, 'FrequencyHalo must render only a single radial bar ring');
  assert.match(src, /testID=\{showSpectrum\?'wave-spectrum-bars':undefined\}/);
});

test('Item 10: Groove2Player elevates disc position and mathematically centers magnified active lyrics upright at 2.5x default', () => {
  const src = read('src/ui/Groove2Player.tsx');
  assert.match(src, /loupeZoom:\s*2\.5/);
  assert.match(src, /cy=H\*0\.455/);
  assert.match(src, /ctx\.translate\(lx,ly\);\s*ctx\.rotate\(-liveTheta\);\s*ctx\.scale\(z,z\);\s*ctx\.translate\(-focusX,-focusY\);/);
});

test('Item 11: Teletype 2 prints full timestamp immediately and syncs per-character typing strictly to lyric body', () => {
  // At line onset (progress = 0), timestamp prefix is 100% complete and first lyric char appears right away
  const onset = formatTeletype2Line('[01:23] ', '你好世界测试歌词', 0, true);
  assert.equal(onset.prefix, '[01:23] ');
  assert.equal(onset.body, '你');

  // Halfway through the singing duration, exactly half of the lyric body is typed (not consumed by timestamp length)
  const mid = formatTeletype2Line('[01:23] ', '你好世界测试歌词', 0.5, true);
  assert.equal(mid.prefix, '[01:23] ');
  assert.equal(mid.body, '你好世界');

  // At completion or on historical lines, both timestamp and body are complete
  const done = formatTeletype2Line('[01:23] ', '你好世界测试歌词', 1, true);
  assert.equal(done.prefix, '[01:23] ');
  assert.equal(done.body, '你好世界测试歌词');

  const teletype2Src = read('src/ui/Teletype2Player.tsx');
  assert.match(teletype2Src, /var tsPrefix=p\.showTimestamps\?fmtTime\(item\.ms\)\+' ':''/);
  assert.match(teletype2Src, /var bodyChars=Array\.from\(lyricBody\);/);
  assert.match(teletype2Src, /lineProgress:\s*Math\.round\(lineProgress \* 100\) \/ 100/);
});
