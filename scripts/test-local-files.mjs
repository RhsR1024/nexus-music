import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=mkdtempSync('build/tests/local-import-');
try{
  execFileSync('/usr/bin/afconvert',['-f','AIFF','-d','BEI16','build/tests/tone.wav','build/tests/tone.aiff']);
  execFileSync('/usr/bin/afconvert',['-f','adts','-d','aac','build/tests/tone.wav','build/tests/tone.aac']);
  for(const file of ['tone.wav','tone-aac.m4a','tone.aac','tone.aiff','tone-16.flac','tone-24.flac','tone-tagged.mp3']){
    const input=`build/tests/${file}`,value=JSON.parse(execFileSync('build/tests/native-local-files',[root,input,file],{encoding:'utf8',timeout:20000}));
    assert.equal(value.id,createHash('sha256').update(readFileSync(input)).digest('hex'));assert.ok(value.durationMs>1900&&value.durationMs<2400);assert.equal(value.created,true);
    if(file.endsWith('.mp3')){assert.equal(value.title,'Synthetic tagged tone');assert.equal(value.artist,'Fixture artist');assert.equal(value.album,'Fixture album');assert.equal(value.lyric,'[00:00]Synthetic embedded lyric');assert.equal(value.hasArtwork,true);}
    const again=JSON.parse(execFileSync('build/tests/native-local-files',[root,input,`renamed.${value.extension}`],{encoding:'utf8',timeout:20000}));assert.equal(again.created,false);assert.equal(again.id,value.id);
  }
  writeFileSync('build/tests/bad-audio.wav','not audio');
  for(const [file,name]of [['build/tests/bad-audio.wav','bad.wav'],['build/tests/tone.wav','bad.zip']])assert.equal(spawnSync('build/tests/native-local-files',[root,file,name],{encoding:'utf8',timeout:20000}).status,1);
  assert.ok(!readdirSync(root).some(file=>file.startsWith('import-')));
  console.log('Local audio native checks passed: WAV/M4A/AAC/AIFF/MP3/16-bit and 24-bit FLAC, content hash/deduplication, duration, active deletion protection, invalid file/format and staging cleanup, real ID3 title/artist/album/embedded LRC and cover');
}finally{rmSync(root,{recursive:true,force:true});}
