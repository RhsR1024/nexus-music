import {readFileSync,realpathSync,statSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileSha256,externalInputSnapshot} from './ui-provenance.mjs';

// Local measurement input only. Never imported by the application bundle.
export function loadReferenceScene(path,expectedPosition=266){
  const build=realpathSync(resolve('build'))+sep,scenePath=realpathSync(resolve(path));
  if(!scenePath.startsWith(build)||!scenePath.endsWith('.json')||statSync(scenePath).size>8192)throw new Error('Reference scene must be a small local build JSON');
  const scene=JSON.parse(readFileSync(scenePath,'utf8'));
  if(scene.duration!==284||scene.position!==expectedPosition||!Array.isArray(scene.lyrics)||scene.lyrics.length!==3||scene.lyrics.some(line=>typeof line!=='string'||!line.trim()||line.length>100)||typeof scene.cover!=='string')throw new Error(`Invalid fixed reference scene at ${expectedPosition}s`);
  const coverPath=realpathSync(resolve(dirname(scenePath),scene.cover));
  if(!coverPath.startsWith(dirname(scenePath)+sep)||statSync(coverPath).size>8*1024*1024)throw new Error('Reference cover must stay inside the local scene directory');
  const cover=readFileSync(coverPath);
  if(cover.length<24||cover.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||cover.readUInt32BE(16)!==924||cover.readUInt32BE(20)!==924)throw new Error('Expected the declared 924px PNG crop');
  const paths=[scenePath,coverPath];
  return {...scene,cover,paths,snapshot:externalInputSnapshot(paths),id:fileSha256(scenePath).slice(0,12)+'-'+fileSha256(coverPath).slice(0,12)};
}
