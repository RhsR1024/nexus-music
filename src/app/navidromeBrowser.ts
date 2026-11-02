import {NavidromeError,type NavidromeClient,type ServerAlbum,type ServerPlaylist} from '../providers/navidrome.ts';
import type {Track} from '../domain/track.ts';
export type NavidromeRoot='songs'|'albums'|'artists'|'playlists';
export type NavidromeView={[K in NavidromeRoot]:{kind:K;query?:string}}[NavidromeRoot]|{kind:'album'|'artist'|'playlist';id:string};
export type NavidromeItem={kind:'track';track:Track}|{kind:'album';album:ServerAlbum}|{kind:'artist';id:string;name:string}|{kind:'playlist';playlist:ServerPlaylist};
export interface NavidromeFrame {
  view:NavidromeView;items:readonly NavidromeItem[];title:string;query:string;name:string;
  offset:number;visiblePage:number;more:boolean;loaded:boolean;error:string;retryAppend:boolean;
}
type BrowserClient=Pick<NavidromeClient,'songs'|'albums'|'artists'|'playlists'|'albumDetail'|'artistDetail'|'playlistDetail'>;
const labels={songs:'歌曲',albums:'最近添加的专辑',artists:'歌手',playlists:'服务端歌单',album:'专辑',artist:'歌手',playlist:'服务端歌单'};
function frame(view:NavidromeView):NavidromeFrame {return {view,items:[],title:labels[view.kind],query:'query'in view?view.query??'':'',name:'',offset:0,visiblePage:0,more:false,loaded:false,error:'',retryAppend:false};}
export class NavidromeBrowser {
  private value={accountId:'',frame:frame({kind:'albums'}),parents:[] as readonly NavidromeFrame[],loading:false};
  private roots=new Map<NavidromeRoot,NavidromeFrame>();
  private listeners=new Set<()=>void>();private generation=0;private pending=new AbortController();
  private client:(id:string)=>Promise<BrowserClient>;
  constructor(client:(id:string)=>Promise<BrowserClient>){this.client=client;}
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(change:Partial<typeof this.value>){this.value={...this.value,...change};for(const listener of this.listeners)listener();}
  private update(change:Partial<NavidromeFrame>){this.publish({frame:{...this.value.frame,...change}});}
  cancel=()=>{this.generation++;this.pending.abort();};
  setAccount(id:string,reset=false){
    if(id===this.value.accountId&&!reset)return;
    this.cancel();this.roots.clear();this.publish({accountId:id,frame:frame({kind:'albums'}),parents:[],loading:false});
    if(id)void this.load();
  }
  selectRoot(kind:NavidromeRoot){
    const root=this.value.parents[0]??this.value.frame;
    if(['songs','albums','artists','playlists'].includes(root.view.kind))this.roots.set(root.view.kind as NavidromeRoot,root);
    this.cancel();const next=this.roots.get(kind)??frame({kind});
    this.publish({frame:next,parents:[],loading:false});if(!next.loaded)void this.load();
  }
  open(view:Extract<NavidromeView,{id:string}>){
    this.cancel();this.publish({parents:[...this.value.parents,this.value.frame],frame:frame(view),loading:false});void this.load();
  }
  back(){
    const previous=this.value.parents.at(-1);if(!previous)return;
    this.cancel();this.publish({frame:previous,parents:this.value.parents.slice(0,-1),loading:false});if(!previous.loaded)void this.load();
  }
  setQuery(query:string){this.update({query});}
  setName(name:string){this.update({name});}
  search(){this.cancel();this.update({view:{kind:'songs',query:this.value.frame.query}});void this.load();}
  page(value:number){this.update({visiblePage:Math.max(0,Math.min(value,Math.ceil(this.value.frame.items.length/50)-1))});}
  error(message:string){this.update({error:message});}
  // Only call after the server acknowledges a star/unstar. Keep the same page
  // and update every saved occurrence; neither the queue nor local favorites change.
  setStarred(id:string,starred:boolean){
    const apply=(saved:NavidromeFrame):NavidromeFrame=>{
      let changed=false;
      const items=saved.items.map(item=>{
        if(item.kind!=='track'||item.track.origin.kind!=='navidrome'||item.track.origin.accountId!==this.value.accountId||item.track.origin.id!==id)return item;
        changed=true;return {...item,track:{...item.track,metadata:{...item.track.metadata,starred}}};
      });
      return changed?{...saved,items}:saved;
    };
    this.publish({frame:apply(this.value.frame),parents:this.value.parents.map(apply)});
    for(const [key,saved] of this.roots)this.roots.set(key,apply(saved));
  }
  // Keep renamed playlist titles consistent without discarding loaded pages.
  renameSavedPlaylist(id:string,title:string){
    const rename=(f:NavidromeFrame):NavidromeFrame=>({...f,items:f.items.map(item=>item.kind==='playlist'&&item.playlist.id===id?{...item,playlist:{...item.playlist,title}}:item)});
    this.publish({parents:this.value.parents.map(rename)});for(const [key,f] of this.roots)this.roots.set(key,rename(f));
  }
  async load(append=false){
    if(!this.value.accountId)return;
    this.cancel();this.pending=new AbortController();const signal=this.pending.signal,version=this.generation;
    const {accountId,frame:current}=this.value,{view}=current,start=append?current.offset:0;
    this.publish({loading:true});this.update({error:'',retryAppend:append});
    const valid=()=>version===this.generation&&!signal.aborted;
    try {
      const client=await this.client(accountId);if(!valid())return;
      let values:NavidromeItem[]=[],more=false,title=labels[view.kind] as string;
      if(view.kind==='songs'){const page=await client.songs(view.query??'',start,50,signal);values=page.items.map(track=>({kind:'track',track}));more=page.hasMore;}
      else if(view.kind==='albums'){const page=await client.albums('newest',start,50,signal);values=page.items.map(album=>({kind:'album',album}));more=page.hasMore;}
      else if(view.kind==='artists'){const all=await client.artists(signal);values=all.slice(start,start+100).map(artist=>({kind:'artist',...artist}));more=start+100<all.length;}
      else if(view.kind==='playlists'){const all=await client.playlists(signal);values=all.slice(start,start+100).map(playlist=>({kind:'playlist',playlist}));more=start+100<all.length;}
      else if(view.kind==='album'){const album=await client.albumDetail(view.id,signal);values=album.tracks.map(track=>({kind:'track',track}));title=album.title;}
      else if(view.kind==='artist'){const artist=await client.artistDetail(view.id,signal);values=artist.albums.map(album=>({kind:'album',album}));title=artist.name;}
      else {const playlist=await client.playlistDetail(view.id,signal);values=playlist.tracks.map(track=>({kind:'track',track}));title=playlist.title;}
      if(!valid())return;
      this.update({items:append?[...current.items,...values]:values,more,title,name:title,offset:start+values.length,visiblePage:append?Math.floor(start/50):0,loaded:true,error:'',retryAppend:false});
    }catch(error){if(valid())this.update({error:error instanceof NavidromeError?error.message:'无法读取此连接，请重新连接后重试',retryAppend:append});}
    finally{if(valid())this.publish({loading:false});}
  }
}
