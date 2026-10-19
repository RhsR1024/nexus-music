import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository, type SQLConnection } from '../src/storage/repository.ts';
import { SourceCatalog } from '../src/providers/sourceCatalog.ts';
import { SourceRegistry } from '../src/providers/sourceRegistry.ts';

function store(path = ':memory:') {
  const db = new DatabaseSync(path);
  const connection: SQLConnection = {
    exec: async sql => { db.exec(sql); },
    run: async (sql, ...params) => db.prepare(sql).run(...params),
    all: async <T>(sql: string, ...params: (string | number | null)[]) => db.prepare(sql).all(...params) as T[],
  };
  const repository = new Repository({ ...connection, transaction: async run => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = await run(connection); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } });
  return { db, repository };
}
const hash = async (script: string) => createHash('sha256').update(script).digest('hex');
function registry() {
  return new SourceRegistry({ initialize: async source => {
    if (source.name === 'bad') throw new Error('fixture');
    return [{ platform: 'wy', name: 'fixture', actions: ['musicUrl'], qualities: ['128k'] }];
  }, destroy: () => {} });
}
const script = (name: string, version = '1') => `/**\n * @name ${name}\n * @version ${version}\n */\nlx.send('inited',{sources:{}});`;

test('SQLite snapshots survive reopen and preserve strings, order and duplicates', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-sqlite-'));
  try {
    const path = join(dir, 'test.sqlite');
    const first = store(path); await first.repository.migrate();
    const entries = [{ id: '90071992547409931234' }, { id: '90071992547409931234' }];
    await first.repository.put('queue', entries); first.db.close();
    const second = store(path); await second.repository.migrate();
    assert.deepEqual(await second.repository.get('queue'), entries); second.db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('failed SQLite transaction keeps old snapshots and subsequent writes still succeed', async () => {
  const { repository, db } = store(); await repository.migrate();
  await repository.put('first', 'old');
  db.exec("CREATE TRIGGER reject_fixture BEFORE INSERT ON records WHEN NEW.key='reject' BEGIN SELECT RAISE(ABORT,'fixture'); END");
  await assert.rejects(repository.putMany([['first', 'new'], ['reject', 1]]));
  assert.equal(await repository.get('first'), 'old');
  await repository.put('after', true); assert.equal(await repository.get('after'), true); db.close();
});

test('newer database versions are rejected without modifying records', async () => {
  const { db, repository } = store(); db.exec('PRAGMA user_version=99');
  await assert.rejects(repository.migrate());
  assert.equal((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 99); db.close();
});

test('source imports serialize concurrent mutations, deduplicate and restore enabled order', async () => {
  const { repository, db } = store(); await repository.migrate();
  const catalog = new SourceCatalog(registry(), repository, hash);
  const [a, b] = await Promise.all([catalog.import(script('a'), 'a.js'), catalog.import(script('b'), 'b.js')]);
  assert.equal((await catalog.import(script('a'), 'duplicate.js')).duplicate, true);
  await catalog.batch([a.id, b.id], 'enable');
  await catalog.move(b.id,-1);
  const next = new SourceCatalog(registry(), repository, hash); await next.restore(); await next.restoreEnabled();
  assert.deepEqual(next.getSnapshot().map(item => item.id), [b.id, a.id]);
  assert.ok(next.getSnapshot().every(item => item.status === 'ready'));
  assert.ok(!JSON.stringify(next.getSnapshot()).includes('lx.send'));
  db.close();
});

test('batch initialization failure preserves enabled intent without breaking other sources', async () => {
  const { repository, db } = store(); await repository.migrate();
  const catalog = new SourceCatalog(registry(), repository, hash);
  const a = await catalog.import(script('bad'), 'a.js'), b = await catalog.import(script('good'), 'b.js');
  assert.deepEqual(await catalog.batch([a.id, b.id], 'enable'), { failed: [a.id], succeeded: [b.id] });
  const saved = await repository.get<Array<{ enabled: boolean }>>('sources.v1');
  assert.ok(saved!.every(item => item.enabled));
  assert.deepEqual(catalog.getSnapshot().map(item => item.status), ['failed', 'ready']); db.close();
});

test('update retains a reversible old version and requires explicit re-enable', async () => {
  const { repository, db } = store(); await repository.migrate();
  const catalog = new SourceCatalog(registry(), repository, hash);
  const a = await catalog.import(script('a'), 'a.js'); await catalog.batch([a.id], 'enable');
  await catalog.update(a.id, script('a', '2'));
  assert.equal(catalog.getSnapshot()[0]!.version, '2');
  assert.equal(catalog.getSnapshot()[0]!.status, 'disabled');
  await catalog.rollback(a.id); assert.equal(catalog.getSnapshot()[0]!.version, '1');
  await catalog.batch([a.id], 'delete');
  assert.deepEqual(await repository.get('sources.v1'), []); db.close();
});

test('failed source persistence does not alter runtime or existing catalog', async () => {
  const { repository, db } = store(); await repository.migrate();
  const catalog = new SourceCatalog(registry(), repository, hash);
  const a = await catalog.import(script('a'), 'a.js');
  db.exec("CREATE TRIGGER fail_update BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT,'fixture'); END");
  await assert.rejects(catalog.batch([a.id], 'enable'));
  assert.equal(catalog.getSnapshot()[0]!.status, 'disabled'); db.close();
});

test('quarantine preserves exact malformed JSON atomically before removing the active record',async()=>{
  const {db,repository}=store();await repository.migrate();
  db.prepare('INSERT INTO records(key,value) VALUES(?,?)').run('broken','{malformed private payload');
  await assert.rejects(repository.get('broken'),SyntaxError);
  await repository.quarantine('broken','recovery.broken.fixture');
  assert.equal(await repository.get('broken'),undefined);
  assert.equal((db.prepare('SELECT value FROM records WHERE key=?').get('recovery.broken.fixture') as {value:string}).value,'{malformed private payload');
  await repository.put('broken',{version:1});assert.deepEqual(await repository.get('broken'),{version:1});db.close();
});

test('source version fingerprints change on update while an older routing snapshot retains its digest',async()=>{
  const {db,repository}=store();await repository.migrate();const runtime=registry();const catalog=new SourceCatalog(runtime,repository,hash);
  const imported=await catalog.import(script('fixture','1'),'fixture.js');await catalog.batch([imported.id],'enable');const old=runtime.getSnapshot()[0]!;
  await catalog.update(imported.id,script('fixture','2'));const current=runtime.getSnapshot()[0]!;
  assert.equal(old.fingerprint,await hash(script('fixture','1')));assert.equal(current.fingerprint,await hash(script('fixture','2')));assert.notEqual(old.fingerprint,current.fingerprint);assert.equal(old.id,current.id);db.close();
});

test('appearance defaults migrate older preferences without changing playback settings',async()=>{
  const {db,repository}=store();await repository.migrate();
  const {PreferenceStore,defaults}=await import('../src/app/preferences.ts');
  const {visualTheme,accent,backgroundStyle,glassNavigation,playerLayout,...legacy}=defaults;
  await repository.put('preferences.v1',{...legacy,quality:'320k',lyricOffsetMs:350});
  const preferences=new PreferenceStore(repository);await preferences.restore();
  assert.equal(preferences.getSnapshot().playerLayout,'classic');assert.equal(preferences.getSnapshot().visualTheme,'blush');assert.equal(preferences.getSnapshot().quality,'320k');assert.equal(preferences.getSnapshot().lyricOffsetMs,350);
  await preferences.update({accent:'blue',glassNavigation:false});
  const restored=new PreferenceStore(repository);await restored.restore();assert.equal(restored.getSnapshot().accent,'blue');assert.equal(restored.getSnapshot().glassNavigation,false);db.close();
});

test('appearance failed writes and invalid fields preserve the last valid settings',async()=>{
  const {db,repository}=store();await repository.migrate();const {PreferenceStore}=await import('../src/app/preferences.ts');
  const preferences=new PreferenceStore(repository);await preferences.update({accent:'purple'});const before=preferences.getSnapshot();
  await assert.rejects(preferences.update({visualTheme:'unknown' as never}));assert.equal(preferences.getSnapshot(),before);
  const write=repository.put.bind(repository);repository.put=async()=>{throw new Error('disk full');};
  await assert.rejects(preferences.update({accent:'blue'}));assert.equal(preferences.getSnapshot(),before);
  repository.put=write;await preferences.update({visualTheme:'soft'});assert.equal(preferences.getSnapshot().accent,'purple');assert.equal(preferences.getSnapshot().visualTheme,'soft');db.close();
});

test('EQ migrates legacy records and serializes named preset capture with pending edits',async()=>{
  const {db,repository}=store();await repository.migrate();const {PreferenceStore,defaults}=await import('../src/app/preferences.ts');
  const {preampDB,eqPresets,...legacy}=defaults;await repository.put('preferences.v1',legacy);
  const preferences=new PreferenceStore(repository);await preferences.restore();assert.equal(preferences.getSnapshot().preampDB,0);assert.deepEqual(preferences.getSnapshot().eqPresets,[]);
  const values=[3,2,1,0,-1,0,1,2,3,4];const edit=preferences.update({preampDB:-3.5,gains:values});const save=preferences.saveEQPreset('  夜间  ');await Promise.all([edit,save]);
  values[0]=12;assert.equal(preferences.getSnapshot().eqPresets[0]!.gains[0],3);
  const restored=new PreferenceStore(repository);await restored.restore();assert.equal(restored.getSnapshot().eqPresets[0]!.name,'夜间');assert.equal(restored.getSnapshot().eqPresets[0]!.preampDB,-3.5);
  await restored.update({preampDB:2});await restored.saveEQPreset('夜间');assert.equal(restored.getSnapshot().eqPresets.length,1);assert.equal(restored.getSnapshot().eqPresets[0]!.preampDB,2);
  await restored.deleteEQPreset('夜间');assert.deepEqual(restored.getSnapshot().eqPresets,[]);db.close();
});

test('EQ rejects malformed presets, excess gain and failed persistence without changing the snapshot',async()=>{
  const {db,repository}=store();await repository.migrate();const {PreferenceStore}=await import('../src/app/preferences.ts');const preferences=new PreferenceStore(repository);const before=preferences.getSnapshot();
  for(const preampDB of [NaN,Infinity,12.1,-12.1])await assert.rejects(preferences.update({preampDB}));
  for(const name of ['', ' '.repeat(3), 'x'.repeat(33), 'bad\nname'])await assert.rejects(preferences.saveEQPreset(name));
  await assert.rejects(preferences.update({eqPresets:[{name:'bad',gains:[0],preampDB:0}]}));
  await assert.rejects(preferences.update({eqPresets:Array.from({length:25},(_,i)=>({name:String(i),gains:Array(10).fill(0),preampDB:0}))}));
  repository.put=async()=>{throw new Error('disk full');};await assert.rejects(preferences.saveEQPreset('test'));assert.equal(preferences.getSnapshot(),before);db.close();
});

test('per-track lyric offset persists independently from global offset and rejects malformed values',async()=>{
  const {db,repository}=store();await repository.migrate();const {PreferenceStore}=await import('../src/app/preferences.ts');const {lyricOffset}=await import('../src/lyrics/settings.ts');
  const key='["online","wy","fixture"]',other='["online","wy","other"]',preferences=new PreferenceStore(repository);
  await preferences.update({lyricOffsetMs:500,lyricAlignment:'center'});await preferences.setLyricOffset(key,-100);
  const restored=new PreferenceStore(repository);await restored.restore();assert.equal(lyricOffset(restored.getSnapshot().lyricOffsetMs,restored.getSnapshot().lyricOffsets,key),400);assert.equal(lyricOffset(500,restored.getSnapshot().lyricOffsets,other),500);
  const before=restored.getSnapshot();for(const offset of [NaN,Infinity,600001,-600001])await assert.rejects(restored.setLyricOffset(key,offset));assert.equal(restored.getSnapshot(),before);
  await restored.setLyricOffset(key,0);assert.equal(Object.keys(restored.getSnapshot().lyricOffsets).length,0);assert.equal(restored.getSnapshot().lyricAlignment,'center');db.close();
});

test('automatic matching preference migrates legacy records, persists and rejects invalid or failed writes',async()=>{
  const {db,repository}=store();await repository.migrate();const {PreferenceStore,defaults}=await import('../src/app/preferences.ts');
  const {autoMatch,...legacy}=defaults;await repository.put('preferences.v1',legacy);const preferences=new PreferenceStore(repository);await preferences.restore();assert.equal(preferences.getSnapshot().autoMatch,true);
  await preferences.update({autoMatch:false});const restored=new PreferenceStore(repository);await restored.restore();assert.equal(restored.getSnapshot().autoMatch,false);const before=preferences.getSnapshot();
  await assert.rejects(preferences.update({autoMatch:'true' as never}));assert.equal(preferences.getSnapshot(),before);repository.put=async()=>{throw Error('disk full');};await assert.rejects(preferences.update({autoMatch:true}));assert.equal(preferences.getSnapshot(),before);db.close();
});
test('automatic policy change clears matched or resolving media, preserving original and explicit manual playback',async()=>{
  const {db,repository}=store();await repository.migrate();const {PreferenceStore}=await import('../src/app/preferences.ts'),{LibraryStore}=await import('../src/storage/library.ts'),{bindMatchPolicy}=await import('../src/playback/matchBinding.ts'),{PlaybackController}=await import('../src/playback/controller.ts'),{makeQueue}=await import('../src/domain/queue.ts'),{track,deferred}=await import('./fixtures.ts');
  const preferences=new PreferenceStore(repository),library=new LibraryStore(repository,()=> 'uuid'),target={...track,origin:{kind:'online' as const,platform:'tx' as const,id:'target'}};let matched=true,stops=0;
  const controller=new PlaybackController({resolve:async()=>({url:'https://example.test/audio',...(matched?{matchedTrack:target}:{})})},{stop(){stops++;},pause(){},play(){},load(){}},makeQueue([{id:'a',track}]));
  const unbind=bindMatchPolicy(library,preferences,controller);await controller.play();controller.onReady(controller.getSnapshot().token!);await preferences.update({autoMatch:false});assert.equal(controller.getSnapshot().media,null);assert.equal(controller.getSnapshot().intent,'paused');
  matched=false;await controller.play();const before=stops;await preferences.update({autoMatch:true});assert.equal(stops,before);assert.equal(controller.getSnapshot().intent,'playing');
  await library.setMatch(track,target,'manual');matched=true;await controller.play();const manualStops=stops;await preferences.update({autoMatch:false});assert.equal(stops,manualStops);unbind();
  const pending=deferred<{url:string}>();const resolving=new PlaybackController({resolve:async()=>pending.promise},{stop(){},pause(){},play(){},load(){assert.fail('cancelled policy cannot load');}},makeQueue([{id:'a',track:{...track,origin:{kind:'online',platform:'wy',id:'other'}}}]));const unbindPending=bindMatchPolicy(library,preferences,resolving),play=resolving.play();await preferences.update({autoMatch:true});pending.resolve({url:'https://example.test/stale'});await play;assert.equal(resolving.getSnapshot().intent,'paused');unbindPending();db.close();
});

test('lyric style migrates old settings and persists independently from audio and fonts',async()=>{
  const {db,repository}=store();await repository.migrate();const {PreferenceStore,defaults}=await import('../src/app/preferences.ts');
  const {lyricStyle,...legacy}=defaults;await repository.put('preferences.v1',{...legacy,quality:'320k'});const preferences=new PreferenceStore(repository);await preferences.restore();assert.equal(preferences.getSnapshot().lyricStyle.lineHeight,1.35);
  await preferences.update({lyricStyle:{...lyricStyle,lineHeight:1.6,spacing:14,blur:2,activeColor:'#FFD7A0',emphasis:false}});
  const next=new PreferenceStore(repository);await next.restore();assert.equal(next.getSnapshot().lyricStyle.blur,2);assert.equal(next.getSnapshot().quality,'320k');assert.equal(next.getSnapshot().lyricStyle.emphasis,false);db.close();
});
test('invalid or failed lyric style writes preserve the previous valid style',async()=>{
  const {db,repository}=store();await repository.migrate();const {PreferenceStore}=await import('../src/app/preferences.ts');const preferences=new PreferenceStore(repository),before=preferences.getSnapshot(),style=before.lyricStyle;
  for(const patch of [{blur:NaN},{blur:5},{spacing:-1},{lineHeight:Infinity},{lineHeight:1},{activeColor:'url(private)'},{inactiveColor:'#ff'},{emphasis:'yes'}])await assert.rejects(preferences.update({lyricStyle:{...style,...patch} as never}));
  assert.equal(preferences.getSnapshot(),before);repository.put=async()=>{throw Error('full');};await assert.rejects(preferences.update({lyricStyle:{...style,blur:2}}));assert.equal(preferences.getSnapshot(),before);db.close();
});

test('queued lyric style changes merge fields and repeated adjustments against the committed value',async()=>{
  const {db,repository}=store();await repository.migrate();const {PreferenceStore}=await import('../src/app/preferences.ts');const preferences=new PreferenceStore(repository);
  await Promise.all([preferences.updateLyricStyle({activeColor:'#FFFFFF'}),preferences.updateLyricStyle({emphasis:false}),preferences.adjustLyricStyle('spacing',2),preferences.adjustLyricStyle('spacing',2)]);
  const style=preferences.getSnapshot().lyricStyle;assert.equal(style.activeColor,'#FFFFFF');assert.equal(style.emphasis,false);assert.equal(style.spacing,12);db.close();
});


test('stage layout persists and failed layout writes preserve the current style',async()=>{
  const {db,repository}=store();await repository.migrate();const {PreferenceStore}=await import('../src/app/preferences.ts');
  const preferences=new PreferenceStore(repository);await preferences.update({playerLayout:'stage'});
  const restored=new PreferenceStore(repository);await restored.restore();assert.equal(restored.getSnapshot().playerLayout,'stage');
  const write=repository.put.bind(repository);repository.put=async()=>{throw new Error('disk full');};
  await assert.rejects(restored.update({playerLayout:'wave'}));assert.equal(restored.getSnapshot().playerLayout,'stage');
  repository.put=write;db.close();
});

test('AM2 preferences migrate, persist independently and reject invalid or failed writes',async()=>{
  const {db,repository}=store();await repository.migrate();const {PreferenceStore}=await import('../src/app/preferences.ts');
  await repository.put('preferences.v1',{playerLayout:'am'});const preferences=new PreferenceStore(repository);await preferences.restore();
  assert.equal(preferences.getSnapshot().am2AutoLyrics,true);assert.equal(preferences.getSnapshot().am2DelaySeconds,5);assert.equal(preferences.getSnapshot().am2ShowVolume,false);
  await preferences.update({playerLayout:'am2',am2AutoLyrics:false,am2DelaySeconds:3,am2ShowVolume:true,volume:.4});
  const restored=new PreferenceStore(repository);await restored.restore();assert.equal(restored.getSnapshot().playerLayout,'am2');assert.equal(restored.getSnapshot().am2DelaySeconds,3);assert.equal(restored.getSnapshot().am2AutoLyrics,false);assert.equal(restored.getSnapshot().am2ShowVolume,true);assert.equal(restored.getSnapshot().volume,.4);
  await assert.rejects(restored.update({am2DelaySeconds:0}));assert.equal(restored.getSnapshot().am2DelaySeconds,3);
  repository.put=async()=>{throw new Error('disk full');};await assert.rejects(restored.update({am2AutoLyrics:true,volume:.8}));assert.equal(restored.getSnapshot().am2AutoLyrics,false);assert.equal(restored.getSnapshot().volume,.4);db.close();
});

test('EQ enable rejects nonboolean mutations before persistence or native subscribers',async()=>{
  const {db,repository}=store();await repository.migrate();const {PreferenceStore}=await import('../src/app/preferences.ts');
  const preferences=new PreferenceStore(repository);await preferences.update({eqEnabled:true,preampDB:-3,gains:[4,2,1,0,0,0,0,0,0,0]});const before=preferences.getSnapshot(),saved=await repository.get('preferences.v1');
  let notifications=0,writes=0;preferences.subscribe(()=>notifications++);const put=repository.put.bind(repository);repository.put=async(...args)=>{writes++;await put(...args);};
  for(const eqEnabled of ['false',0,1,null,undefined,{},[]])await assert.rejects(preferences.update({eqEnabled:eqEnabled as never}));
  assert.equal(preferences.getSnapshot(),before);assert.equal(writes,0);assert.equal(notifications,0);assert.deepEqual(await repository.get('preferences.v1'),saved);
  repository.put=async()=>{throw Error('disk full');};await assert.rejects(preferences.update({eqEnabled:false}));assert.equal(preferences.getSnapshot(),before);assert.equal(notifications,0);
  repository.put=put;await preferences.update({eqEnabled:false});const restored=new PreferenceStore(repository);await restored.restore();assert.equal(restored.getSnapshot().eqEnabled,false);assert.deepEqual(restored.getSnapshot().gains,before.gains);assert.equal(restored.getSnapshot().preampDB,-3);db.close();
});
test('EQ corrupted enable records are quarantined exactly while missing legacy flags default safely',async()=>{
  const {db,repository}=store();await repository.migrate();const {PreferenceStore,defaults}=await import('../src/app/preferences.ts'),{restoreRecord}=await import('../src/storage/recovery.ts');
  let i=0;
  for(const eqEnabled of ['false',0,1,null,{},[]]){
    const raw={...defaults,eqEnabled,preampDB:-4,gains:[3,2,1,0,0,0,0,0,0,0]};await repository.put('preferences.v1',raw);const preferences=new PreferenceStore(repository);const before=preferences.getSnapshot(),key=`recovery.preferences.v1.eq-${++i}`;
    assert.equal(await restoreRecord(repository,'preferences.v1',()=>preferences.restore(),()=>`eq-${i}`),false);assert.equal(preferences.getSnapshot(),before);assert.equal(preferences.getSnapshot().eqEnabled,false);assert.deepEqual(await repository.get(key),raw);assert.equal(await repository.get('preferences.v1'),undefined);
  }
  const {eqEnabled,...legacy}=defaults;await repository.put('preferences.v1',legacy);const preferences=new PreferenceStore(repository);await preferences.restore();assert.equal(preferences.getSnapshot().eqEnabled,false);
  await preferences.update({eqEnabled:true});const restored=new PreferenceStore(repository);await restored.restore();assert.equal(restored.getSnapshot().eqEnabled,true);db.close();
});


test('stage preferences migrate independently, persist and reject invalid or failed writes',async()=>{
  const {db,repository}=store();await repository.migrate();const {PreferenceStore,defaults}=await import('../src/app/preferences.ts');
  const {stageStyle,stageBackdrop,...legacy}=defaults;await repository.put('preferences.v1',{...legacy,playerLayout:'stage',lyricOffsetMs:250});
  const preferences=new PreferenceStore(repository);await preferences.restore();assert.equal(preferences.getSnapshot().stageStyle,'neon');assert.equal(preferences.getSnapshot().stageBackdrop,true);
  await Promise.all([preferences.update({stageStyle:'aurora'}),preferences.update({stageBackdrop:false})]);
  const restored=new PreferenceStore(repository);await restored.restore();assert.equal(restored.getSnapshot().stageStyle,'aurora');assert.equal(restored.getSnapshot().stageBackdrop,false);assert.equal(restored.getSnapshot().lyricOffsetMs,250);
  const before=preferences.getSnapshot();await assert.rejects(preferences.update({stageStyle:'unknown' as never}));await assert.rejects(preferences.update({stageBackdrop:1 as never}));assert.equal(preferences.getSnapshot(),before);
  const write=repository.put.bind(repository);repository.put=async()=>{throw new Error('disk full');};await assert.rejects(preferences.update({stageStyle:'classic'}));assert.equal(preferences.getSnapshot(),before);
  repository.put=write;await preferences.update({stageStyle:'cyberpunk'});assert.equal(preferences.getSnapshot().stageBackdrop,false);db.close();
});
