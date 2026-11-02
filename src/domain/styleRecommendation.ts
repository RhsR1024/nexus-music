import type {OnlinePlatform} from './track.ts';
import type {BrowseCategory,BrowseItem} from '../providers/discovery.ts';

export const styleSelectionLimit=5;
export const styleRecommendationLimit=36;

export const styleDimensions=[
  {id:'genre',label:'曲风',group:'风格'},
  {id:'language',label:'语种',group:'语种'},
  {id:'mood',label:'情感',group:'情感'},
  {id:'theme',label:'主题',group:'主题'},
  {id:'scene',label:'场景',group:'场景'},
]as const;

export type StyleDimensionId=typeof styleDimensions[number]['id'];
export interface StyleTag{id:string;name:string;dimension:StyleDimensionId}
export interface StyleRecommendation{platform:OnlinePlatform;playlist:BrowseItem;matchedTags:readonly StyleTag[]}
export interface StyleTagPlaylists{tag:StyleTag;items:readonly BrowseItem[]}
export interface StyleRecommendationResult{items:readonly StyleRecommendation[];failedTags:readonly StyleTag[]}

const dimensionByGroup=new Map<string,StyleDimensionId>([
  ['风格','genre'],['曲风','genre'],['1','genre'],
  ['语种','language'],['0','language'],
  ['情感','mood'],['3','mood'],
  ['主题','theme'],['4','theme'],
  ['场景','scene'],['2','scene'],
]);

export function styleTagKey(tag:Pick<StyleTag,'id'|'dimension'>){return `${tag.dimension}:${tag.id}`;}

export function styleTagsFromCategories(categories:readonly BrowseCategory[]):readonly StyleTag[]{
  const seen=new Set<string>();
  return categories.flatMap(category=>{
    const dimension=dimensionByGroup.get((category.group??'').trim());
    const id=category.id.trim(),name=category.title.trim();
    if(!dimension||!id||!name)return[];
    const tag={id,name,dimension};
    const key=styleTagKey(tag);
    if(seen.has(key))return[];
    seen.add(key);
    return[tag];
  });
}

export function styleTagGroups(tags:readonly StyleTag[]):Readonly<Record<StyleDimensionId,readonly StyleTag[]>>{
  return{
    genre:tags.filter(tag=>tag.dimension==='genre'),
    language:tags.filter(tag=>tag.dimension==='language'),
    mood:tags.filter(tag=>tag.dimension==='mood'),
    theme:tags.filter(tag=>tag.dimension==='theme'),
    scene:tags.filter(tag=>tag.dimension==='scene'),
  };
}

export function normalizeStyleSelection(tags:readonly StyleTag[],limit=styleSelectionLimit):readonly StyleTag[]{
  if(!Number.isInteger(limit)||limit<1)throw new Error('风格标签上限无效');
  const selected:StyleTag[]=[],seen=new Set<string>();
  for(const tag of tags){
    if(!tag.id.trim()||!tag.name.trim())throw new Error('风格标签无效');
    const key=styleTagKey(tag);
    if(seen.has(key))continue;
    if(selected.length>=limit)throw new Error(`最多选择 ${limit} 个风格标签`);
    seen.add(key);
    selected.push(tag);
  }
  return selected;
}

export function toggleStyleSelection(selected:readonly StyleTag[],tag:StyleTag,limit=styleSelectionLimit):readonly StyleTag[]{
  const current=normalizeStyleSelection(selected,limit),key=styleTagKey(tag);
  if(current.some(value=>styleTagKey(value)===key))return current.filter(value=>styleTagKey(value)!==key);
  if(current.length>=limit)throw new Error(`最多选择 ${limit} 个风格标签`);
  return [...current,tag];
}

export function mergeStyleRecommendations(platform:OnlinePlatform,groups:readonly StyleTagPlaylists[],limit=styleRecommendationLimit):readonly StyleRecommendation[]{
  if(!Number.isInteger(limit)||limit<1)throw new Error('推荐结果上限无效');
  const merged=new Map<string,{playlist:BrowseItem;matchedTags:StyleTag[];firstSeen:number}>();
  let firstSeen=0;
  for(const group of groups){
    for(const playlist of group.items){
      if(!playlist.id||!playlist.title)continue;
      const key=`${platform}:${playlist.id}`;
      const current=merged.get(key);
      if(current){
        if(!current.matchedTags.some(tag=>styleTagKey(tag)===styleTagKey(group.tag)))current.matchedTags.push(group.tag);
      }else{
        merged.set(key,{playlist,matchedTags:[group.tag],firstSeen:firstSeen++});
      }
    }
  }
  return [...merged.values()]
    .sort((left,right)=>right.matchedTags.length-left.matchedTags.length||left.firstSeen-right.firstSeen)
    .slice(0,limit)
    .map(value=>({platform,playlist:value.playlist,matchedTags:value.matchedTags}));
}
