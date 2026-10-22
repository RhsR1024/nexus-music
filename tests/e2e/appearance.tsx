// Simulator capture entry. The shipping index never imports this module.
// Seed services, then render the production navigation and appearance sheet.
import {registerRootComponent} from 'expo';
import {MusicApplication} from '../../App.tsx';
import {getServices,type Services} from '../../src/app/services.ts';
import {appearanceDefaults} from '../../src/domain/appearance.ts';
let pending:Promise<Services>|undefined;
const initialize=()=>pending??=getServices().then(async services=>{
  await services.preferences.update({...appearanceDefaults,favoriteVisualTheme:null,theme:'light',fontScale:1,backgroundStyle:'solid',backgroundOpacity:1,cardOpacity:.3,playerBlur:0});
  await services.fonts.selectGlobal(null);
  await services.fonts.followGlobal();
  return services;
}).catch(error=>{pending=undefined;throw error;});
function AppearanceFixture(){return <MusicApplication initialize={initialize} initialSettingsPage="background"/>;}
registerRootComponent(AppearanceFixture);
