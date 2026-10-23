// Capture-only entry: the shipping index never imports this module.
// Use production services, queue, native playback, navigation and Player.
import {registerRootComponent} from 'expo';
import {VisualSamplingContext} from '../../src/ui/VisualSampling.ts';
import {MusicApplication} from '../../App.tsx';
import {getServices,type Services} from '../../src/app/services.ts';
import {defaults} from '../../src/app/preferences.ts';
import {appearanceDefaults} from '../../src/domain/appearance.ts';
import {makeQueue} from '../../src/domain/queue.ts';
let pending:Promise<Services>|undefined;
const initialize=()=>pending??=getServices().then(async services=>{
  services.playback.controller.pause();
  await services.preferences.update({...appearanceDefaults,coverRadius:20,theme:'light',fontScale:1,playerLayout:'vinyl',lyricOffsetMs:0,lyricOffsets:{},lyricStyle:defaults.lyricStyle,rate:1,repeat:'off',shuffle:false,miniLyrics:false});
  await services.fonts.selectGlobal(null);
  await services.fonts.followGlobal();
  const {account}=await services.accounts.connect('http://127.0.0.1:18439','fixture-user','fixture-password');
  const result=await(await services.accounts.client(account.id)).songs('vinyl visual fixture');
  const track=result.items.find(item=>item.origin.kind==='navidrome'&&item.origin.id.startsWith('fixture-classic-'));
  if(!track)throw new Error('Vinyl capture fixture identity missing');
  services.playback.controller.setQueue(makeQueue([{id:'vinyl-capture-entry',track}]));
  return services;
}).catch(error=>{pending=undefined;throw error;});
const sampling={recordPhase:160/360} as const;
function VinylFixture(){return <VisualSamplingContext.Provider value={sampling}><MusicApplication initialize={initialize}/></VisualSamplingContext.Provider>;}
registerRootComponent(VinylFixture);
