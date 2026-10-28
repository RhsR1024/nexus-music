import { trackKey, type OnlinePlatform, type Track } from '../domain/track.ts';
import type { OnlineProvider } from './online.ts';
export const platforms: readonly OnlinePlatform[] = ['wy','tx','kw','kg','mg'];
export interface SearchGroup<T=Track> { platform: OnlinePlatform; items: readonly T[]; page: number; total?: number; hasMore: boolean; loading: boolean; error: string | null }
export interface PagedSearchPage<T>{items:readonly T[];total?:number;page:number;hasMore:boolean}
export class PagedSearchCoordinator<T> {
  private provider: {search(platform:OnlinePlatform,query:string,page:number,signal:AbortSignal):Promise<PagedSearchPage<T>>}; private pending = new AbortController(); private generation = 0;
  private value: { query: string; groups: readonly SearchGroup<T>[] } = {query:'',groups:[]};
  private listeners = new Set<() => void>();
  private readonly keyOf:(item:T)=>string;
  constructor(provider: {search(platform:OnlinePlatform,query:string,page:number,signal:AbortSignal):Promise<PagedSearchPage<T>>},keyOf:(item:T)=>string) { this.provider = provider; this.keyOf=keyOf; }
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(groups: readonly SearchGroup<T>[]) { this.value = {...this.value,groups}; for(const listener of this.listeners) listener(); }
  async search(query: string, selected: OnlinePlatform | 'all') {
    this.pending.abort(); this.pending = new AbortController(); const generation = ++this.generation;
    const cleaned = query.trim();
    const groups = (selected === 'all' ? platforms : [selected]).map(platform => ({
      ...(this.value.query === cleaned ? this.value.groups.find(item => item.platform === platform) : undefined),
      platform, items: this.value.query === cleaned ? this.value.groups.find(item => item.platform === platform)?.items ?? [] : [], page:0,hasMore:false,loading:true,error:null,
    }));
    this.value = { query: cleaned, groups }; this.publish(groups);
    if (!cleaned) { this.publish([]); return; }
    await Promise.all(groups.map(group => this.request(group.platform, 1, generation)));
  }
  async more(platform: OnlinePlatform) {
    const group = this.value.groups.find(item => item.platform === platform);
    if (!group || group.loading || !group.hasMore) return;
    this.publish(this.value.groups.map(item => item.platform === platform ? {...item,loading:true,error:null} : item));
    await this.request(platform, group.page+1, this.generation);
  }
  async retry(platform: OnlinePlatform) {
    const group = this.value.groups.find(item => item.platform === platform);
    if (!group || group.loading) return;
    this.publish(this.value.groups.map(item => item.platform === platform ? {...item,loading:true,error:null} : item));
    await this.request(platform, group.hasMore ? group.page+1 : 1, this.generation);
  }
  private async request(platform: OnlinePlatform, page: number, generation: number) {
    try {
      const result: PagedSearchPage<T> = await this.provider.search(platform,this.value.query,page,this.pending.signal);
      if (generation !== this.generation || this.pending.signal.aborted) return;
      this.publish(this.value.groups.map(group => {
        if (group.platform !== platform) return group;
        const items = page === 1 ? [] : [...group.items], keys = new Set(items.map(item => this.keyOf(item)));
        for(const item of result.items) { const key=this.keyOf(item); if(!keys.has(key)) { items.push(item); keys.add(key); } }
        if(page>1&&result.hasMore&&result.items.length>0&&items.length===group.items.length)throw Error('平台未推进分页');
        return {...group,items,page,hasMore:result.hasMore && result.items.length>0,total:result.total,loading:false,error:null};
      }));
    } catch {
      if (generation !== this.generation || this.pending.signal.aborted) return;
      this.publish(this.value.groups.map(group => group.platform === platform ? {...group,loading:false,error:group.items.length ? '刷新失败，保留现有结果；请重试' : '搜索失败，请重试或切换平台'} : group));
    }
  }
}

export class SearchCoordinator extends PagedSearchCoordinator<Track>{
  constructor(provider:Pick<OnlineProvider,'search'>){super(provider,item=>trackKey(item.origin));}
}
