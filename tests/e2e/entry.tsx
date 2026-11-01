// Simulator UI test entry only. Production index.ts never imports this module.
import {registerRootComponent} from 'expo';
import {MusicApplication} from '../../App.tsx';
import {createServices,type Services} from '../../src/app/services.ts';
import {parseProviderJSON,type HTTPClient} from '../../src/providers/http.ts';
import type {PlaylistLinkExpander} from '../../src/providers/playlistLink.ts';
const http:HTTPClient=async(url,request,signal)=>{
  const response=await fetch('http://127.0.0.1:18439/nexus-ui-test-online-adapter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,request}),signal});
  if(!response.ok)throw new Error('Synthetic provider unavailable');return parseProviderJSON(await response.text());
};
let pending:Promise<Services>|undefined;
const expandPlaylistLink:PlaylistLinkExpander=async(url,signal)=>{
  const response=await fetch('http://127.0.0.1:18439/nexus-ui-test-playlist-link-expander',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url}),signal});
  if(!response.ok)throw new Error('Synthetic playlist short-link service unavailable');
  const value=parseProviderJSON(await response.text()) as {url?:unknown;connectionError?:unknown};
  if(value.connectionError===true)throw new TypeError('Network request failed');
  if(typeof value.url!=='string')throw new Error('Synthetic playlist short-link response invalid');
  return value.url;
};
const initialize=()=>pending??=createServices({onlineHTTP:http,playlistLinkExpander:expandPlaylistLink}).catch(error=>{pending=undefined;throw error;});
function FixtureApp(){return <MusicApplication initialize={initialize}/>;}
registerRootComponent(FixtureApp);
