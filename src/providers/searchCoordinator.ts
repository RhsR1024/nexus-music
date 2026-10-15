import { trackKey, type OnlinePlatform, type Track } from '../domain/track.ts';
import type { OnlineProvider, SearchPage } from './online.ts';
export const platforms: readonly OnlinePlatform[] = ['wy','tx','kw','kg','mg'];
export interface SearchGroup { platform: OnlinePlatform; items: readonly Track[]; page: number; total?: number; hasMore: boolean; loading: boolean; error: string | null }
export class SearchCoordinator {
  private provider: Pick<OnlineProvider, 'search'>; private pending = new AbortController(); private generation = 0;
  private value: { query: string; groups: readonly SearchGroup[] } = {query:'',groups:[]};
  private listeners = new Set<() => void>();
  constructor(provider: Pick<OnlineProvider, 'search'>) { this.provider = provider; }
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(groups: readonly SearchGroup[]) { this.value = {...this.value,groups}; for(const listener of this.listeners) listener(); }
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
      const result: SearchPage = await this.provider.search(platform,this.value.query,page,this.pending.signal);
      if (generation !== this.generation || this.pending.signal.aborted) return;
      this.publish(this.value.groups.map(group => {
        if (group.platform !== platform) return group;
        const items = page === 1 ? [] : [...group.items], keys = new Set(items.map(item => trackKey(item.origin)));
        for(const item of result.items) { const key=trackKey(item.origin); if(!keys.has(key)) { items.push(item); keys.add(key); } }
        return {...group,items,page,hasMore:result.hasMore && result.items.length>0,total:result.total,loading:false,error:null};
      }));
    } catch {
      if (generation !== this.generation || this.pending.signal.aborted) return;
      this.publish(this.value.groups.map(group => group.platform === platform ? {...group,loading:false,error:group.items.length ? '刷新失败，保留现有结果；请重试' : '搜索失败，请重试或切换平台'} : group));
    }
  }
}
