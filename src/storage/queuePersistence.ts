import { makeQueue, type QueueState } from '../domain/queue.ts';
export interface SavedQueue {version:1;queue:QueueState}
export interface SavedCursor {entryId:string|null;seconds:number}
export function decodeQueue(value:unknown):QueueState {
  const saved=value as SavedQueue;
  if(!saved||saved.version!==1||!saved.queue||!Array.isArray(saved.queue.entries)||saved.queue.entries.length>10000||!Array.isArray(saved.queue.priorityIds))throw new Error('播放队列数据无效');
  const queue=makeQueue(saved.queue.entries,saved.queue.currentId);
  const current=queue.entries.findIndex(item=>item.id===queue.currentId),priorities=saved.queue.priorityIds;
  let previous=current;
  for(const id of priorities){const index=queue.entries.findIndex(item=>item.id===id);if(index<=previous)throw new Error('下一首队列顺序无效');previous=index;}
  return {...queue,priorityIds:[...priorities]};
}
