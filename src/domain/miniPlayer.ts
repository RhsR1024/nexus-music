export const miniActionLabels={previous:'上一首',toggle:'播放暂停',next:'下一首',favorite:'本地收藏',queue:'播放队列'} as const;
export type MiniAction=keyof typeof miniActionLabels;
export interface MiniPlayerOptions {miniActions:readonly MiniAction[];miniLyrics:boolean}
export const miniPlayerDefaults:MiniPlayerOptions={miniActions:['toggle','next'],miniLyrics:false};
export function normalizeMiniActions(value:unknown):MiniAction[]{
  if(!Array.isArray(value)||value.length<1||value.length>4||new Set(value).size!==value.length||!value.includes('toggle')||value.some(item=>typeof item!=='string'||!Object.prototype.hasOwnProperty.call(miniActionLabels,item)))throw new Error('迷你播放器需保留播放暂停，最多选择四个不同按钮');
  return [...value] as MiniAction[];
}
export function toggleMiniAction(actions:readonly MiniAction[],action:MiniAction):MiniAction[]{
  if(action==='toggle')throw new Error('请保留播放暂停按钮');
  return normalizeMiniActions(actions.includes(action)?actions.filter(item=>item!==action):[...actions,action]);
}
export function moveMiniAction(actions:readonly MiniAction[],action:MiniAction,delta:-1|1):MiniAction[]{
  const next=normalizeMiniActions(actions),from=next.indexOf(action),to=from+delta;
  if(from>=0&&to>=0&&to<next.length){next.splice(from,1);next.splice(to,0,action);}return next;
}
