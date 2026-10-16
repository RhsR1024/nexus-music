// Simulator UI test entry only. Production index.ts never imports this module.
import {registerRootComponent} from 'expo';
import {MusicApplication} from '../../App.tsx';
import {createServices,type Services} from '../../src/app/services.ts';
import {parseProviderJSON,type HTTPClient} from '../../src/providers/http.ts';
const http:HTTPClient=async(url,request,signal)=>{
  const response=await fetch('http://127.0.0.1:18439/nexus-ui-test-online-adapter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,request}),signal});
  if(!response.ok)throw new Error('Synthetic provider unavailable');return parseProviderJSON(await response.text());
};
let pending:Promise<Services>|undefined;
const initialize=()=>pending??=createServices({onlineHTTP:http}).catch(error=>{pending=undefined;throw error;});
function FixtureApp(){return <MusicApplication initialize={initialize}/>;}
registerRootComponent(FixtureApp);
