// Simulator UI test entry only. Production index.ts never imports this module.
import {registerRootComponent,requireNativeModule} from 'expo';
import * as Crypto from 'expo-crypto';
import {MusicApplication} from '../../App.tsx';
import {createServices,type Services} from '../../src/app/services.ts';
import {parseProviderJSON,type HTTPClient,type TextHTTPClient} from '../../src/providers/http.ts';
import type {PlaylistLinkExpander} from '../../src/providers/playlistLink.ts';
const requestOnlineText=async(url:string,request:Parameters<TextHTTPClient>[1],signal:AbortSignal)=>{
  const response=await fetch('http://127.0.0.1:18439/nexus-ui-test-online-adapter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,request}),signal});
  if(!response.ok)throw new Error('Synthetic provider unavailable');return response.text();
};
const http:HTTPClient=async(url,request,signal)=>parseProviderJSON(await requestOnlineText(url,request,signal));
const textHTTP:TextHTTPClient=requestOnlineText;
let pending:Promise<Services>|undefined;
const expandPlaylistLink:PlaylistLinkExpander=async(url,signal)=>{
  const response=await fetch('http://127.0.0.1:18439/nexus-ui-test-playlist-link-expander',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url}),signal});
  if(!response.ok)throw new Error('Synthetic playlist short-link service unavailable');
  const value=parseProviderJSON(await response.text()) as {url?:unknown;connectionError?:unknown};
  if(value.connectionError===true)throw new TypeError('Network request failed');
  if(typeof value.url!=='string')throw new Error('Synthetic playlist short-link response invalid');
  return value.url;
};
const initialize=()=>pending??=(async()=>{
  const services=await createServices({onlineHTTP:http,onlineTextHTTP:textHTTP,playlistLinkExpander:expandPlaylistLink});
  const fixtureAccount=requireNativeModule<{launchArgument(name:string):string|null}>('NexusNative').launchArgument('NEXUS_UI_ACCOUNT_FM_FIXTURE')==='1';
  if(fixtureAccount){
    // Simulator-only account/session fixture. The production entry does not
    // import this module; the account, secure session, FM guard and playback
    // path below are the real services used by the App.
    const username='netease:9000000000000000001';
    const accountId=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,JSON.stringify(['wy',username]));
    const session=Object.freeze({version:1,platform:'wy',accountId,userId:'9000000000000000001',cookies:Object.freeze({MUSIC_U:'synthetic-fm',__csrf:'synthetic-csrf'})});
    await services.musicAccounts.save({platform:'wy',label:'Synthetic NetEase FM',username,displayName:'Synthetic NetEase FM',capabilities:['daily','fm']},session);
  }
  return services;
})().catch(error=>{pending=undefined;throw error;});
function FixtureApp(){return <MusicApplication initialize={initialize}/>;}
registerRootComponent(FixtureApp);
