import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';

const sim=(args)=>execFileSync('xcrun',['simctl',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const sleep=(ms)=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);

const inventory=JSON.parse(sim(['list','--json']));
const runtime=inventory.runtimes.find(item=>item.isAvailable&&item.identifier.includes('iOS-27-0'));
if(!runtime)throw new Error('Expected an available iOS 27.0 simulator runtime');
const name=process.argv[2]??'iPhone 17';
if(!['iPhone 17','iPad Pro 13-inch (M5)'].includes(name))throw new Error('Unsupported CI simulator target');
const device=inventory.devicetypes.find(item=>item.name===name);
if(!device)throw new Error(`Expected ${name} simulator device type`);

let bootedId='';
let lastError;
for(let attempt=1;attempt<=3;attempt++){
  let id='';
  try{
    id=sim(['create',`NexusMusic CI ${name}`,device.identifier,runtime.identifier]);
    try{
      sim(['boot',id]);
    }catch(err){
      const msg=String(err?.stderr||err?.message||'');
      if(!msg.includes('Booted'))throw err;
    }
    sim(['bootstatus',id,'-b']);
    bootedId=id;
    break;
  }catch(err){
    lastError=err;
    console.error(`[ci-simulator] attempt ${attempt}/3 failed: ${err?.message||err}`);
    if(id){
      try{sim(['shutdown',id]);}catch{}
      try{sim(['delete',id]);}catch{}
    }
    if(attempt<3)sleep(3000);
  }
}
if(!bootedId)throw lastError??new Error('Failed to boot CI simulator after 3 attempts');
if(!process.env.GITHUB_ENV)throw new Error('This helper expects a GitHub Actions environment file');
appendFileSync(process.env.GITHUB_ENV,`NEXUS_SIMULATOR_ID=${bootedId}\n`);
