import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream,readFileSync,realpathSync,statSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Project-scoped prerequisite, not a claim that reverse analysis is complete.
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const pin='cab634bd855fc287f6e420c1f36fd1a6b9245960';
const samples={
  ipa:{file:'Sollin-2.0.0 60-unsigned.ipa',sha256:'c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07',primary:'mobile-reverse/SKILL.md'},
  apk:{file:'Sollin-60-v8a.Apk',sha256:'668f590753e5c9d79d6b8835f68ba702be6ce90f484d0af2bd721afd50fe4c7f',primary:'apk-reverse/SKILL.md'},
};
try {
  const [kind,mode,...extra]=process.argv.slice(2),sample=samples[kind];
  if(!sample||extra.length||(mode!==undefined&&mode!=='--review'))throw new Error('Usage: node scripts/sollin-reverse-gate.mjs ipa|apk [--review]');
  const root=realpathSync(resolve(project,'../reverse-skill'));
  if(realpathSync(resolve(project,'.agents/skills/reverse-skill-router'))!==resolve(root,'skills'))throw new Error('Project skill link must resolve to the pinned sibling package');
  const actual=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(actual!==pin)throw new Error('reverse-skill revision changed; review and update the pin before use');
  if(execFileSync('git',['-C',root,'status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim())throw new Error('Tracked reverse-skill files changed; review before use');
  for(const file of ['README_AI.md','RULES.md','skills/SKILL.md','skills/MASTER-ROUTING.md',`skills/${sample.primary}`])statSync(resolve(root,file));
  const indexPath=resolve(root,'skills/tool-index.json'),index=JSON.parse(readFileSync(indexPath,'utf8'));
  if(index.platform!=='macos'||Date.now()-statSync(indexPath).mtimeMs>7*86400000)throw new Error('Refresh tool-index on this Mac before proceeding');
  const python=index.tools.find(tool=>tool.name==='python3'&&tool.available)?.path;
  if(!python)throw new Error('tool-index has no verified Python interpreter');
  const source=resolve(project,'../ReferenceProject',sample.file),digest=createHash('sha256');
  for await(const bytes of createReadStream(source))digest.update(bytes);
  if(digest.digest('hex')!==sample.sha256)throw new Error('Sollin sample hash differs from the reviewed reference');
  const caseRoot=resolve(project,`work/sollin-${kind}`),scope=readFileSync(resolve(caseRoot,'scope.md'),'utf8');
  if(!scope.includes(`- primary_skill: ${sample.primary}`)||!scope.includes(`  - ${source}`)||!scope.includes('- mode: offline'))throw new Error('Case does not cover this offline sample and PRIMARY');
  execFileSync('/bin/bash',[resolve(root,'skills/scripts/case-guard.sh'),'--case-root',caseRoot],{stdio:'inherit'});
  if(mode==='--review')execFileSync(python,[resolve(root,'skills/case-review/scripts/review_case.py'),caseRoot,'--verify-hashes','--strict'],{stdio:'inherit'});
  console.log(`Sollin ${kind} prerequisite PASS: pinned skill, local tool index, sample SHA256 and offline scope. Read PRIMARY and append evidence before implementation; this is not UI or runtime acceptance.`);
} catch(error) {
  console.error(`Sollin reverse gate FAILED: ${error.message}`);
  process.exitCode=1;
}
