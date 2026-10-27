import test from 'node:test';
import assert from 'node:assert/strict';
import {audioFileExtension,downloadBasename,downloadNamingDefaults as defaults,validateDownloadNaming} from '../src/domain/downloadNaming.ts';

test('export basenames preserve metadata while preventing paths, reserved characters and visual controls',()=>{
 const track={title:'../a/b\\c\u202e.mp3',artist:'  A : B  '};assert.equal(downloadBasename(track,defaults),'_a_b_c_.mp3 - A _ B');assert.equal(track.title,'../a/b\\c\u202e.mp3');
 assert.equal(downloadBasename({title:'Title',artist:'Artist'},{downloadNameOrder:'artist-title',downloadNameSeparator:'__'}),'Artist__Title');
 for(const separator of ['/',String.fromCharCode(0),'\u202e',':','x'.repeat(13)])assert.throws(()=>validateDownloadNaming({...defaults,downloadNameSeparator:separator}));
 assert.equal(downloadBasename({title:'',artist:''},{...defaults,downloadNameSeparator:''}),'未命名歌曲未知艺术家');
 const long=downloadBasename({title:'😀'.repeat(100),artist:'艺术家'},defaults);assert(new TextEncoder().encode(long).length<=180);assert(!long.includes('\ufffd'));
 assert.equal(downloadBasename({title:'CON',artist:'A'},{...defaults,downloadNameSeparator:'.'}),'_CON.A');
});
test('actual header chooses extension independently of requested quality, URL and title suffix',()=>{
 const bytes=(text:string)=>new TextEncoder().encode(text);assert.equal(audioFileExtension(bytes('ID3sample.flac')),'mp3');assert.equal(audioFileExtension(bytes('fLaCdata')),'flac');assert.equal(audioFileExtension(bytes('RIFF....WAVE')),'wav');assert.equal(audioFileExtension(bytes('....ftypM4A ')),'m4a');assert.equal(audioFileExtension(new Uint8Array([255,251])),'mp3');assert.equal(audioFileExtension(new Uint8Array([255,249])),'aac');for(const value of ['', '<html>error</html>','{"error":true}'])assert.throws(()=>audioFileExtension(bytes(value)));
});
