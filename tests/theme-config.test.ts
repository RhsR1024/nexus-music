import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,PreferenceStore} from '../src/app/preferences.ts';
import {appearanceDefaults} from '../src/domain/appearance.ts';
import {encodeThemeConfig,decodeThemeConfig} from '../src/storage/themeConfig.ts';
import type {Repository} from '../src/storage/repository.ts';

test('portable theme retains every background parameter and excludes other domains and unknown keys',()=>{
  const source={...defaults,visualTheme:'mint' as const,cardOpacity:.3,backgroundOpacity:.6,backgroundMask:.2,maskColor:'#123456',playerBlur:12,playerDarkness:.7,coverRadius:8,glassNavigation:false,coverColor:false,globalBackgroundMotion:true,dynamicBackground:true,quality:'128k',volume:.2,credentials:'private',imageURI:'file:///private/image',fontURI:'file:///private/font'};
  const text=encodeThemeConfig(source),parsed=decodeThemeConfig(text);assert.equal(parsed.legacy,false);assert.equal(Object.keys(parsed.appearance).length,Object.keys(appearanceDefaults).length);assert.deepEqual(parsed.appearance,JSON.parse(text).appearance);assert.equal(parsed.appearance.visualTheme,'mint');assert.equal(parsed.appearance.playerBlur,12);assert.equal(parsed.appearance.maskColor,'#123456');for(const term of ['quality','volume','credentials','private','URI','eqPresets'])assert.equal(text.includes(term),false);
});
test('old four-field theme imports retain receiving device settings even across queued updates',async()=>{
  let stored:unknown;const repository={put:async(_key:string,value:unknown)=>{stored=value;}} as Repository;const store=new PreferenceStore(repository);await store.update({backgroundOpacity:.8,coverColor:false,playerBlur:9,volume:.3,quality:'128k'});
  const old=decodeThemeConfig(JSON.stringify({visualTheme:'azure',accent:'blue',backgroundStyle:'solid',cardOpacity:.4}));assert.equal(old.legacy,true);const volume=store.update({volume:.6});const applied=store.update(old.appearance);await Promise.all([volume,applied]);assert.equal(store.getSnapshot().visualTheme,'azure');assert.equal(store.getSnapshot().backgroundOpacity,.8);assert.equal(store.getSnapshot().playerBlur,9);assert.equal(store.getSnapshot().coverColor,false);assert.equal(store.getSnapshot().quality,'128k');assert.equal(store.getSnapshot().volume,.6);assert.deepEqual(stored,store.getSnapshot());
});
test('invalid or incomplete themes fail validation without accepting unrelated backup documents',()=>{
  const encoded=encodeThemeConfig(appearanceDefaults);for(const bad of [null,[],{format:'nexus-music',version:1},{format:'nexus-theme',version:2,appearance:appearanceDefaults},{format:'nexus-theme',version:1,appearance:[]},{visualTheme:'mint',accent:'rose',backgroundStyle:'solid'}])assert.throws(()=>decodeThemeConfig(JSON.stringify(bad)));
  for(const [key,value] of Object.entries({visualTheme:'alien',accent:'black',cardOpacity:2,backgroundMask:-1,backgroundOpacity:'0.5',maskColor:'url(file://private)',coverColor:'true',playerBlur:81,playerDarkness:0,coverRadius:49,glassNavigation:1})){const invalid=JSON.parse(encoded);invalid.appearance[key]=value;assert.throws(()=>decodeThemeConfig(JSON.stringify(invalid)),key);}
  const missing=JSON.parse(encoded);delete missing.appearance.coverRadius;assert.throws(()=>decodeThemeConfig(JSON.stringify(missing)));assert.throws(()=>decodeThemeConfig(encoded.replace('55','1e999')));
});
test('theme limit measures UTF8 bytes before parse and ignores unknown fields inside supported documents',()=>{
  const value=JSON.parse(encodeThemeConfig(defaults));value.padding='歌'.repeat(23000);assert.throws(()=>decodeThemeConfig(JSON.stringify(value)),/64KiB/);delete value.padding;value.appearance.quality='128k';value.appearance.account={secret:'not-adopted'};const parsed=decodeThemeConfig(JSON.stringify(value));assert.equal('account' in parsed.appearance,false);assert.equal('quality' in parsed.appearance,false);assert.equal('padding' in parsed.appearance,false);
});
test('theme persistence failure keeps the old snapshot and a retry applies one complete patch',async()=>{
  let fail=true;const saved:unknown[]=[];const store=new PreferenceStore({put:async(_key:string,value:unknown)=>{if(fail)throw Error('write failed');saved.push(value);}} as unknown as Repository);const before=store.getSnapshot(),patch=decodeThemeConfig(encodeThemeConfig({...defaults,visualTheme:'lotus',coverColor:false,cardOpacity:.35})).appearance;await assert.rejects(store.update(patch));assert.equal(store.getSnapshot(),before);assert.equal(saved.length,0);fail=false;await store.update(patch);assert.equal(store.getSnapshot().visualTheme,'lotus');assert.equal(store.getSnapshot().cardOpacity,.35);assert.equal(store.getSnapshot().coverColor,false);assert.equal(store.getSnapshot().quality,before.quality);assert.equal(saved.length,1);
});
test('fresh theme import keeps an explicit cover-color off across restart without disabling old-record migration',async()=>{
  let record:unknown;const repository={get:async<T>()=>structuredClone(record) as T,put:async(_key:string,value:unknown)=>{record=structuredClone(value);}} as unknown as Repository;
  const first=new PreferenceStore(repository);await first.update(decodeThemeConfig(encodeThemeConfig({...defaults,coverColor:false})).appearance);const restarted=new PreferenceStore(repository);await restarted.restore();assert.equal(restarted.getSnapshot().coverColor,false);assert.equal((record as {coverColorDefaultOn:boolean}).coverColorDefaultOn,true);
  record={...defaults,coverColor:false};const old=new PreferenceStore(repository);await old.restore();assert.equal(old.getSnapshot().coverColor,true);
});
