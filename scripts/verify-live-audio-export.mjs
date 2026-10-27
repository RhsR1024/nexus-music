// Explicit original-audio disk contract. The share port is a local disk adapter,
// not proof of an iOS OS sheet, provider service, or background execution.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,rmSync,statSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {OfflineDownloadStore} from '../src/storage/offlineDownloads.ts';
import {exportOfflineAudio} from '../src/storage/offlineExport.ts';
const args=process.argv.slice(2),get=key=>args[args.indexOf(key)+1];
if(args.length!==6||!['--audio','--expect','--output'].every(key=>args.includes(key)))throw Error('Use --audio MP3 --expect SHA256 --output NEW_DIRECTORY');
const audio=resolve(get('--audio')),output=resolve(get('--output')),expected=get('--expect'),hash=(path,kind='sha256')=>createHash(kind).update(readFileSync(path)).digest('hex');
assert(/^[a-f0-9]{64}$/.test(expected));assert(statSync(audio).size>100000&&statSync(audio).size<30000000);assert.equal(hash(audio),expected);assert(!existsSync(output));
const sourceFiles=['scripts/verify-live-audio-export.mjs','src/domain/downloadNaming.ts','src/domain/downloadAttachments.ts','src/providers/async.ts','src/storage/offlineExport.ts','src/storage/offlineDownloads.ts','src/ui/OfflineAudioExport.ts'],snapshot=()=>Object.fromEntries(sourceFiles.map(file=>[file,hash(file)])),sourceBefore=snapshot();
mkdirSync(output);const managed=join(output,'managed'),temporary=join(output,'temporary'),saved=join(output,'saved');for(const path of [managed,temporary,saved])mkdirSync(path);
let record,sequence=0,cancel=false,stageNumber=0;const names=[];
const path=name=>join(managed,name),store=new OfflineDownloadStore({get:async()=>record,put:async(_,value)=>{record=structuredClone(value);}},{uuid:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`,now:()=>sequence,resolve:async()=>({url:'http://127.0.0.1/not-requested'}),files:{async download(_,name){copyFileSync(audio,path(name));return statSync(path(name)).size;},async remove(name){rmSync(path(name));},exists:name=>existsSync(path(name)),size:name=>statSync(path(name)).size,partialSize:()=>0,digest:name=>hash(path(name),'md5'),uri:name=>pathToFileURL(path(name)).href}});
const title=basename(audio).replace(/\.mp3$/i,''),item=await store.enqueue({origin:{kind:'local',id:expected},title,artist:'未知艺术家',metadata:{},qualities:[]});await store.start(item.id);
const ports={stage(uri,name){const original=fileURLToPath(uri),filename=name(readFileSync(original).subarray(0,16)),directory=join(temporary,String(++stageNumber));mkdirSync(directory);const target=join(directory,filename);copyFileSync(original,target);assert.equal(hash(target),expected);names.push(filename);return{uri:pathToFileURL(target).href,remove:()=>rmSync(directory,{recursive:true})};},async share(uri){if(cancel)throw Error('simulated cancellation');const staged=fileURLToPath(uri);copyFileSync(staged,join(saved,basename(staged)));}};
await exportOfflineAudio(store,item.id,{downloadNameOrder:'artist-title',downloadNameSeparator:'__'},ports);assert.equal(names[0],`未知艺术家__${title}.mp3`);assert.equal(hash(join(saved,names[0])),expected);
cancel=true;await assert.rejects(exportOfflineAudio(store,item.id,{downloadNameOrder:'title-artist',downloadNameSeparator:' - '},ports),/simulated cancellation/);assert.equal(names[1],`${title} - 未知艺术家.mp3`);assert.equal(readdirSync(temporary).length,0);assert.equal(hash(path(item.fileName)),expected);assert.equal(store.getSnapshot()[0].status,'completed');assert.equal(hash(audio),expected);assert.deepEqual(snapshot(),sourceBefore);
writeFileSync(join(output,'receipt.json'),JSON.stringify({kind:'real MP3 JS store/exporter with disk share adapter',input:{name:basename(audio),sha256:expected,bytes:statSync(audio).size},names,stagedCopiesValidated:2,savedCopiesValidated:1,cancelledCopyCleaned:true,sourcePreserved:true,sourceBefore,sourceAfter:snapshot()},null,2)+'\n');console.log(JSON.stringify({receipt:join(output,'receipt.json'),names,sha256:expected}));
