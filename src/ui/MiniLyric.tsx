import {useEffect,useState,useSyncExternalStore} from 'react';
import type {Services} from '../app/services.ts';
import {lyricSignature} from '../domain/matching.ts';
import {trackKey,type Track} from '../domain/track.ts';
import {lyricOffset} from '../lyrics/settings.ts';
import {LyricPreview,miniLyricText} from '../lyrics/preview.ts';
import {convertLyricScript} from '../lyrics/chineseScript.ts';
import {effectiveLyricFont} from '../storage/fontCatalog.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {useStablePlaybackStatus} from './usePlaybackStatus.ts';
export function MiniLyric({services,track}:{services:Services;track:Track}){
  const theme=useTheme(),[preview]=useState(()=>new LyricPreview((track,signal)=>services.lyrics.load(track,signal)));
  const state=useSyncExternalStore(preview.subscribe,preview.getSnapshot),playback=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const status=useStablePlaybackStatus(playback,{resolving:'正在选择音源…',buffering:'缓冲中…'});
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),fonts=useSyncExternalStore(services.fonts.subscribe,services.fonts.getSnapshot);
  useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const choice=services.library.lyricChoiceFor(track),identity=lyricSignature(track);
  useEffect(()=>{void preview.load(track);return()=>preview.clear();},[preview,identity,choice]);
  const current=state.identity===identity?state:undefined,offset=lyricOffset(preferences.lyricOffsetMs,preferences.lyricOffsets,trackKey(track.origin));
  const rawText=status.text||(miniLyricText(current?.document,playback.position*1000,offset)??(!current||current.loading?track.artist||'正在获取歌词…':current.failed?track.artist||'歌词暂不可用':track.artist||'暂无歌词'));
  const text=convertLyricScript(rawText,preferences.lyricChineseMode);
  return <Text testID="mini-lyric" numberOfLines={1} style={{color:theme.palette.secondary,fontSize:12,lineHeight:16,fontFamily:effectiveLyricFont(fonts)}}>{text}</Text>;
}
