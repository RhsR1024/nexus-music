import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CoverThemeStore} from '../src/appearance/coverTheme.ts';
import {PlaybackController} from '../src/playback/controller.ts';
import {makeQueue} from '../src/domain/queue.ts';
import {appearanceDefaults,appearancePalette} from '../src/domain/appearance.ts';
import {track,deferred} from './fixtures.ts';
import type {Track} from '../src/domain/track.ts';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
function rig(){
  const requests:{track:Track;signal:AbortSignal;result:ReturnType<typeof deferred<string|undefined>>}[]=[],palettes:{uri:string;result:ReturnType<typeof deferred<string>>}[]=[];
  const controller=new PlaybackController({resolve:async()=>({url:'https://example.test/audio'})},{load(){},stop(){},play(){},pause(){}},makeQueue([],null));
  let enabled=true;const listeners=new Set<()=>void>();
  const store=new CoverThemeStore(controller,{getSnapshot:()=>({coverColor:enabled}),subscribe:listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};}},
    {loadTrack:async(track,signal)=>{const result=deferred<string|undefined>();requests.push({track,signal,result});return result.promise;}},
    {color:async uri=>{const result=deferred<string>();palettes.push({uri,result});return result.promise;}});
  const select=(id:string,t:Track=track)=>controller.setQueue(makeQueue([{id,track:t}],id));
  return{store,controller,requests,palettes,select,enable:(value:boolean)=>{enabled=value;for(const listener of listeners)listener();}};
}
test('global cover theme ignores late downloads and palette results after rapid song changes',async()=>{
  const r=rig();r.select('a');r.requests[0]!.result.resolve('file:///a');await tick();r.select('b');
  assert.equal(r.requests[0]!.signal.aborted,true);assert.deepEqual(r.store.getSnapshot(),{});
  r.requests[1]!.result.resolve('file:///b');await tick();r.palettes[1]!.result.resolve('#0033FF');await tick();
  assert.equal(r.store.getSnapshot().color,'#0033FF');r.palettes[0]!.result.resolve('#FF0000');await tick();assert.equal(r.store.getSnapshot().uri,'file:///b');
  r.select('c');r.select('d');r.requests[2]!.result.resolve('file:///c');await tick();assert.equal(r.palettes.length,2);
});
test('disabled, missing, rejected and broken covers have a stable fallback without retries on progress',async()=>{
  const r=rig();r.select('a');r.enable(false);r.requests[0]!.result.resolve('file:///old');await tick();assert.deepEqual(r.store.getSnapshot(),{});assert.equal(r.palettes.length,0);
  r.enable(true);r.requests[1]!.result.resolve(undefined);await tick();assert.deepEqual(r.store.getSnapshot(),{});
  r.select('b');r.requests[2]!.result.reject(new Error('private address'));await tick();assert.deepEqual(r.store.getSnapshot(),{});
  r.select('c');r.requests[3]!.result.resolve('file:///broken');await tick();r.palettes[0]!.result.resolve('#FF0000');await tick();r.store.rejectImage('file:///old');assert.equal(r.store.getSnapshot().uri,'file:///broken');r.store.rejectImage('file:///broken');assert.deepEqual(r.store.getSnapshot(),{color:'#FF0000'});
  await r.controller.play();const token=r.controller.getSnapshot().token!;for(let i=0;i<100;i++)r.controller.onProgress(token,i,120,false);assert.equal(r.requests.length,4);
  r.controller.setQueue(makeQueue([],null));assert.deepEqual(r.store.getSnapshot(),{});
});
test('actual matched recording drives the cover, pause and progress keep the same theme snapshot',async()=>{
  const r=rig(),matched:Track={...track,origin:{kind:'online',platform:'tx',id:'recording-b'},artwork:'https://example.test/blue'};
  const controller=new PlaybackController({resolve:async()=>({url:'https://example.test/audio',matchedTrack:matched})},{load(){},stop(){},play(){},pause(){}},makeQueue([{id:'original',track}],'original'));
  const seen:Track[]=[];let publishes=0;
  const store=new CoverThemeStore(controller,{getSnapshot:()=>({coverColor:true}),subscribe:()=>()=>{}},{loadTrack:async(t,signal)=>{seen.push(t);await tick();return signal.aborted?undefined:'file:///blue';}},{color:async()=> '#0000FF'});store.subscribe(()=>publishes++);
  await controller.play();await tick();await tick();assert.equal(seen.at(-1),matched);assert.equal(store.getSnapshot().color,'#0000FF');const before=store.getSnapshot(),count=publishes;
  controller.onReady(controller.getSnapshot().token!);controller.pause();for(let i=0;i<100;i++)controller.onProgress(controller.getSnapshot().token!,i,120,false);
  assert.equal(store.getSnapshot(),before);assert.equal(publishes,count);r.store.dispose();store.dispose();
});
test('same song cover/version changes and external invalidation cancel previous work',async()=>{
  const r=rig();r.select('same',{...track,metadata:{davVersion:'one'}});r.select('same',{...track,metadata:{davVersion:'two'}});assert.equal(r.requests[0]!.signal.aborted,true);
  r.store.invalidate();assert.equal(r.requests[1]!.signal.aborted,true);assert.equal(r.requests.length,3);r.requests[2]!.result.resolve('file:///two');await tick();r.palettes[0]!.result.resolve('invalid');await tick();assert.deepEqual(r.store.getSnapshot(),{});
  r.store.dispose();assert.equal(r.requests[2]!.signal.aborted,true);
});
function luminance(color:string){return [1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i]!,0);}
function contrast(a:string,b:string){const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(values[0]!+.05)/(values[1]!+.05);}
test('red and blue covers generate different light/dark backgrounds with readable semantic text',()=>{
  for(const mode of ['light','dark'] as const){
    const options={...appearanceDefaults,coverColor:true};assert.notDeepEqual(appearancePalette(mode,options,'#FF0000').background,appearancePalette(mode,options,'#0000FF').background);
    for(const color of ['#FF0000','#0000FF','#000000','#FFFFFF','#00FF00','#FF00FF']){
      const palette=appearancePalette(mode,options,color);
      for(const background of palette.background){
        // Include the worst possible pixel of the faint blurred cover layer.
        const opacity=mode==='light'?.035:.06,pixel=mode==='light'?0:255;
        const composite='#'+[1,3,5].map(i=>Math.round(parseInt(background.slice(i,i+2),16)*(1-opacity)+pixel*opacity).toString(16).padStart(2,'0')).join('');
        for(const text of [palette.text,palette.secondary])assert.ok(contrast(composite,text)>=4.5,`${mode} ${color}: ${composite}/${text}`);
      }
    }
    assert.deepEqual(appearancePalette(mode,appearanceDefaults,'#FF0000'),appearancePalette(mode,appearanceDefaults));
  }
});
