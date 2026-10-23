import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileSha256,verifyCaptureEvidence,sourceSnapshot,externalInputSnapshot} from '../scripts/lib/ui-provenance.mjs';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function capture(t){
  const root=mkdtempSync(join(tmpdir(),'nexus-provenance-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const resultBundle=join(root,'run.xcresult');mkdirSync(resultBundle);writeFileSync(join(resultBundle,'Info.plist'),'synthetic result metadata');
  const candidate=join(root,'capture.png');writeFileSync(candidate,'synthetic screenshot bytes');
  const files={'scripts/test-ui.mjs':'1'.repeat(64),'metro.config.js':'2'.repeat(64)},bundleFiles={'main.jsbundle':'3'.repeat(64),app:'4'.repeat(64)};
  const snapshot={files,digest:digest(files)};
  const manifest={schemaVersion:1,configuration:'Release',exitCode:0,resultBundle,resultInfoSha256:fileSha256(join(resultBundle,'Info.plist')),sourceUnchanged:true,sourceBefore:snapshot,sourceAfter:structuredClone(snapshot),fixture:{path:'scripts/test-ui.mjs',sha256:files['scripts/test-ui.mjs']},installedBundle:{identifier:'com.nexusmusic.app',executable:'app',files:bundleFiles,digest:digest(bundleFiles)}};
  const index={resultBundle,resultInfoSha256:manifest.resultInfoSha256,selection:resultBundle,files:[{exported:'capture.png',sha256:fileSha256(candidate)}]};
  const manifestPath=join(root,'run-manifest.json'),indexPath=join(root,'index.json');
  return {manifest,index,candidate,check(){writeFileSync(manifestPath,JSON.stringify(manifest));writeFileSync(indexPath,JSON.stringify(index));return verifyCaptureEvidence(manifestPath,indexPath,candidate);}};
}
test('capture evidence binds source, native/JS bytes, exact xcresult and screenshot hashes',t=>{const c=capture(t);assert.equal(c.check().ready,true);writeFileSync(c.candidate,'changed');assert.equal(c.check().ready,false);});
test('missing digests cannot pass through undefined equality or truthy file placeholders',t=>{const c=capture(t);delete c.manifest.sourceBefore.digest;delete c.manifest.sourceAfter.digest;delete c.manifest.installedBundle.digest;assert.equal(c.check().ready,false);});
test('changed sources, mismatched export, latest selection and forged file maps fail closed',t=>{
  for(const mutate of [c=>{c.manifest.sourceAfter.files['metro.config.js']='5'.repeat(64);},c=>{c.index.resultBundle+='.other';},c=>{c.index.selection='latest';},c=>{c.manifest.installedBundle.files.app='present';},c=>{c.manifest.resultInfoSha256='6'.repeat(64);},c=>{c.manifest.exitCode=65;}]){const c=capture(t);mutate(c);assert.equal(c.check().ready,false);}
});
test('source identity includes Metro and local Xcode environment inputs',()=>{const snapshot=sourceSnapshot();assert.ok(snapshot.files['metro.config.js']);assert.ok('ios/.xcode.env.local' in snapshot.files);assert.equal(snapshot.digest,digest(snapshot.files));});
test('external scene inputs bind actual files, both snapshots and required asset membership',t=>{
  for(const scenario of ['valid','changed','missing-after','missing-required','forged']){
    const c=capture(t),path=join(c.candidate,'..','scene.json');writeFileSync(path,'local measurement input');
    const before=externalInputSnapshot([path]);c.manifest.externalInputs={before,after:structuredClone(before),unchanged:true,requiredPaths:[path]};
    if(scenario==='changed')writeFileSync(path,'changed input');
    if(scenario==='missing-after')delete c.manifest.externalInputs.after;
    if(scenario==='missing-required')c.manifest.externalInputs.requiredPaths.push(path+'.missing');
    if(scenario==='forged')c.manifest.externalInputs.before.digest='0'.repeat(64);
    assert.equal(c.check().ready,scenario==='valid',scenario);
  }
});
test('reference capture cannot omit external scene provenance',t=>{const c=capture(t);c.manifest.buildArguments=['-only-testing:NexusMusicUITests/SourceSettingsTests/testVisualLabClassicReferenceDirect'];assert.equal(c.check().ready,false);});
