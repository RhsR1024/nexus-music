import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FontCatalog,effectiveLyricFont,type FontFiles,type ImportedFont,type FontState} from '../src/storage/fontCatalog.ts';
import type {Repository} from '../src/storage/repository.ts';
import {deferred} from './fixtures.ts';
const font=(digit:string):ImportedFont=>({id:`nexusfont_${digit.repeat(64)}`,name:digit+'.ttf',file:`nexusfont_${digit.repeat(64)}.font`});
function setup(saved?:unknown){
  let stored=saved,failed=false,loadFailed=false;const owned=new Set<string>(),loaded:string[]=[],removed:string[]=[];
  for(const item of (saved as FontState|undefined)?.fonts??[])owned.add(item.id);
  const repository:Pick<Repository,'get'|'put'>={get:async<T>()=>structuredClone(stored) as T,put:async(_,value)=>{if(failed)throw Error('disk full');stored=structuredClone(value);}};
  const files:FontFiles={exists:item=>owned.has(item.id),uri:item=>'file:///private/lyric-fonts/'+item.file,
    prepare:async(uri)=>{const item=font(uri);owned.add(item.id);return item;},load:async item=>{if(loadFailed)throw Error('bad font');loaded.push(item.id);},remove:item=>{owned.delete(item.id);removed.push(item.id);}};
  const catalog=new FontCatalog(repository,files);
  return {catalog,repository,files,owned,loaded,removed,stored:()=>stored,fail:(value=true)=>{failed=value;},badLoad:(value=true)=>{loadFailed=value;}};
}
test('legacy font records retain explicit lyrics while global and system choices stay independent',async()=>{
  const a=font('a'),ctx=setup({version:1,fonts:[a],selected:a.id});await ctx.catalog.restore();assert.equal(ctx.catalog.getSnapshot().lyricMode,'custom');assert.equal(effectiveLyricFont(ctx.catalog.getSnapshot()),a.id);
  await ctx.catalog.import('b','b.ttf');await ctx.catalog.selectGlobal(a.id);assert.equal(effectiveLyricFont(ctx.catalog.getSnapshot()),font('b').id);
  await ctx.catalog.followGlobal();assert.equal(effectiveLyricFont(ctx.catalog.getSnapshot()),a.id);assert.equal(ctx.catalog.selectedURI(),'file:///private/lyric-fonts/'+a.file);
  await ctx.catalog.select(null);assert.equal(effectiveLyricFont(ctx.catalog.getSnapshot()),undefined);assert.equal(ctx.catalog.getSnapshot().global,a.id);
  const next=new FontCatalog(ctx.repository,ctx.files);await next.restore();assert.equal(next.getSnapshot().lyricMode,'system');assert.equal(next.getSnapshot().global,a.id);
});
test('font missing on restart falls back without retaining an absolute external path or invalid native selection',async()=>{
  const a=font('a'),ctx=setup({version:1,fonts:[a],selected:a.id,global:a.id,lyricMode:'custom'});ctx.owned.clear();await ctx.catalog.restore();assert.equal(effectiveLyricFont(ctx.catalog.getSnapshot()),undefined);assert.equal(ctx.catalog.selectedURI(),undefined);assert.equal(ctx.catalog.getSnapshot().global,null);assert.deepEqual(ctx.loaded,[]);
  await ctx.catalog.import('a','a.ttf');assert.equal(effectiveLyricFont(ctx.catalog.getSnapshot()),a.id);assert.ok(!JSON.stringify(ctx.stored()).includes('file:'));
});
test('font registration and storage failures retain both old selections and remove only newly owned imports',async()=>{
  const ctx=setup();await ctx.catalog.import('a','a.ttf');await ctx.catalog.selectGlobal(font('a').id);const before=ctx.catalog.getSnapshot();
  ctx.badLoad();await assert.rejects(ctx.catalog.import('b','b.ttf'));assert.equal(ctx.catalog.getSnapshot(),before);assert.equal(ctx.owned.has(font('b').id),false);
  ctx.badLoad(false);ctx.fail();await assert.rejects(ctx.catalog.import('b','b.ttf'));await assert.rejects(ctx.catalog.select(null));await assert.rejects(ctx.catalog.followGlobal());await assert.rejects(ctx.catalog.remove(font('a').id));assert.equal(ctx.catalog.getSnapshot(),before);assert.equal(ctx.owned.has(font('a').id),true);
  await assert.rejects(ctx.catalog.import('a','a.ttf'));assert.equal(ctx.owned.has(font('a').id),true);ctx.fail(false);await ctx.catalog.select(null);assert.equal(effectiveLyricFont(ctx.catalog.getSnapshot()),undefined);
});
test('concurrent select and delete serialize registration, persistence and fallback without resurrecting deleted files',async()=>{
  const ctx=setup();await ctx.catalog.import('a','a.ttf');await ctx.catalog.import('b','b.ttf');await ctx.catalog.selectGlobal(font('b').id);
  const started=deferred<void>(),finish=deferred<void>();ctx.files.load=async()=>{started.resolve();await finish.promise;};
  const choose=ctx.catalog.select(font('a').id);await started.promise;const remove=ctx.catalog.remove(font('a').id);assert.equal(ctx.owned.has(font('a').id),true);finish.resolve();await Promise.all([choose,remove]);
  assert.equal(ctx.catalog.getSnapshot().lyricMode,'inherit');assert.equal(effectiveLyricFont(ctx.catalog.getSnapshot()),font('b').id);assert.equal(ctx.owned.has(font('a').id),false);await assert.rejects(ctx.catalog.select(font('a').id));
});
test('malformed font record paths are rejected before loading or deleting any files',async()=>{
  const a=font('a');for(const saved of [{version:1,fonts:[{...a,file:'../../private.ttf'}],selected:a.id},{version:1,fonts:[a,a],selected:a.id},{version:1,fonts:[a],selected:'../../private'},{version:1,fonts:[a],selected:a.id,lyricMode:'unknown'}]){
    const ctx=setup(saved);await assert.rejects(ctx.catalog.restore());assert.deepEqual(ctx.loaded,[]);assert.deepEqual(ctx.removed,[]);
  }
});
test('native font registration failure during restart recovers both global and custom lyrics to system',async()=>{
  const a=font('a'),ctx=setup({version:1,fonts:[a],selected:a.id,global:a.id,lyricMode:'custom'});ctx.badLoad();await ctx.catalog.restore();assert.equal(effectiveLyricFont(ctx.catalog.getSnapshot()),undefined);assert.equal(ctx.catalog.getSnapshot().global,null);assert.equal(ctx.catalog.getSnapshot().fonts.length,1);ctx.badLoad(false);await ctx.catalog.selectGlobal(a.id);await ctx.catalog.followGlobal();assert.equal(effectiveLyricFont(ctx.catalog.getSnapshot()),a.id);
});

test('font capacity rejects new imports with cleanup while allowing a duplicate at capacity',async()=>{
  const ids='0123456789abcdef'.split('').map(font),ctx=setup({version:1,fonts:ids,selected:null});await ctx.catalog.restore();const before=ctx.catalog.getSnapshot();
  ctx.files.prepare=async()=>{const item={...font('a'),id:'nexusfont_'+'12'.repeat(32),file:'nexusfont_'+'12'.repeat(32)+'.font'};ctx.owned.add(item.id);return item;};
  await assert.rejects(ctx.catalog.import('new','new.ttf'));assert.equal(ctx.catalog.getSnapshot(),before);assert.equal(ctx.owned.size,16);
  ctx.files.prepare=async()=>ids[0]!;await ctx.catalog.import('duplicate','duplicate.ttf');assert.equal(ctx.catalog.getSnapshot().fonts.length,16);assert.equal(effectiveLyricFont(ctx.catalog.getSnapshot()),ids[0]!.id);
});
