import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {encodePng} from '../scripts/lib/png.mjs';
import {fileSha256} from '../scripts/lib/ui-provenance.mjs';
test('CLI uses declared SSIM radius, records full coverage and refuses report/baseline overwrite',{skip:process.platform!=='darwin'},t=>{
  const root=mkdtempSync(join(tmpdir(),'nexus-lab-cli-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const png=join(root,'image.png'),pixels=Buffer.alloc(16*16*3);for(let i=0;i<pixels.length;i++)pixels[i]=(i*29)%251;
  writeFileSync(png,encodePng(16,16,pixels));const spec=join(root,'spec.json');writeFileSync(spec,JSON.stringify({id:'synthetic',reference:png,candidate:png,referenceSha256:fileSha256(png),candidateSha256:fileSha256(png),size:[16,16],ignoreTop:0,window:3}));
  const out=join(root,'report'),baseline=join(root,'baseline.json'),args=[resolve('scripts/visual-lab.mjs'),'--spec',spec,'--out',out,'--baseline',baseline];
  const run=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(run.status,0,run.stdout+run.stderr);
  const report=JSON.parse(readFileSync(join(out,'report.json')));assert.equal(report.control.pixels,14*14);assert.equal(report.control.coverage.applicationCoverageFraction,1);assert.equal(report.provenanceReady,false);assert.equal(report.pageAccepted,false);
  assert.ok(report.toolHashes['scripts/lib/metrics.mjs']);assert.ok(JSON.parse(readFileSync(baseline)).states[0].specSha256);
  const old=fileSha256(join(out,'report.json'));assert.notEqual(spawnSync(process.execPath,args).status,0);assert.equal(fileSha256(join(out,'report.json')),old);
});
