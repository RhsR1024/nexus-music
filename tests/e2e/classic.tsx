// Capture-only entry: the shipping index never imports this module.
// Use production services, queue, native playback, navigation and Player.
import {registerRootComponent} from 'expo';
import {MusicApplication} from '../../App.tsx';
import {getServices,type Services} from '../../src/app/services.ts';
import {defaults} from '../../src/app/preferences.ts';
import {appearanceDefaults} from '../../src/domain/appearance.ts';
import {makeQueue} from '../../src/domain/queue.ts';
let pending:Promise<Services>|undefined;
const initialize=()=>pending??=getServices().then(async services=>{
  services.playback.controller.pause();
  await services.preferences.update({...appearanceDefaults,coverRadius:20,theme:'light',fontScale:1,playerLayout:'classic',lyricOffsetMs:0,lyricOffsets:{},lyricStyle:defaults.lyricStyle,stageStyle:defaults.stageStyle,stageBackdrop:defaults.stageBackdrop,rate:1,repeat:'off',shuffle:false,miniLyrics:false});
  await services.fonts.selectGlobal(null);
  await services.fonts.followGlobal();
  const {account}=await services.accounts.connect('http://127.0.0.1:18439','fixture-user','fixture-password');
  const result=await(await services.accounts.client(account.id)).songs('classic visual fixture');
  const track=result.items.find(item=>item.origin.kind==='navidrome'&&item.origin.id.startsWith('fixture-classic-'));
  if(!track)throw new Error('Classic capture fixture identity missing');
  services.playback.controller.setQueue(makeQueue([{id:'classic-capture-entry',track}]));
  return services;
}).catch(error=>{pending=undefined;throw error;});
function ClassicFixture(){return <MusicApplication initialize={initialize}/>;}
registerRootComponent(ClassicFixture);
