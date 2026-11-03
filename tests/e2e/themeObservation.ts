import {requireNativeModule} from 'expo';
import * as Crypto from 'expo-crypto';
import type {Services} from '../../src/app/services.ts';
const endpoint='http://127.0.0.1:18439/nexus-ui-test-theme-observation';
export function observeTheme(services:Services,boot:string){
  const native=requireNativeModule<{themeObservationSnapshot():Promise<unknown[]>}>('NexusNative');
  let completed='',stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
  const startedAt=Date.now();
  async function poll(){
    let nonce='';
    try{
      const response=await fetch(endpoint+'?boot='+encodeURIComponent(boot));
      if(!response.ok)throw Error('Observation unavailable');
      const command=await response.json() as {boot?:string;nonce?:string};
      if(command.boot!==boot||!command.nonce||completed===command.nonce)return;
      nonce=command.nonce;
      const before=services.coverTheme.getSnapshot();
      const identityDigest=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,'identity-v1|'+(before.uri??''));
      const applied=await native.themeObservationSnapshot();
      if(before!==services.coverTheme.getSnapshot())return;
      const result=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        boot,nonce,store:{pending:!!before.pending,identityDigest,palette:(before.flowPalette??[]).map(color=>color.toUpperCase())},native:applied,
      })});
      if(result.ok)completed=nonce;
    }catch{
      // Persist a bounded failure for this checkpoint rather than silently
      // letting the test proceed with missing or stale observations.
      if(nonce)await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({boot,nonce,error:true})}).catch(()=>{});
    }finally{if(!stopped&&Date.now()-startedAt<15*60_000)timer=setTimeout(()=>{void poll();},500);}
  }
  void poll();
}
