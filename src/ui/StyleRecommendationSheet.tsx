import {useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {BrowseItem} from '../providers/discovery.ts';
import {
  styleDimensions,
  styleSelectionLimit,
  styleTagKey,
  styleTagsFromCategories,
  styleTagGroups,
  toggleStyleSelection,
  type StyleDimensionId,
  type StyleRecommendation,
  type StyleTag,
} from '../domain/styleRecommendation.ts';
import {SheetModal} from './AdaptiveModal.tsx';
import {Cover} from './Cover.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space} from './tokens.ts';

export function StyleRecommendationSheet({
  services,
  visible,
  onClose,
  onOpenPlaylist,
}:{
  services:Services;
  visible:boolean;
  onClose:()=>void;
  onOpenPlaylist:(playlist:BrowseItem)=>void;
}){
  const theme=useTheme(),{width}=useWindowDimensions();
  const [dimension,setDimension]=useState<StyleDimensionId>('genre');
  const [tags,setTags]=useState<readonly StyleTag[]>([]);
  const [selected,setSelected]=useState<readonly StyleTag[]>([]);
  const [results,setResults]=useState<readonly StyleRecommendation[]>([]);
  const [failedTags,setFailedTags]=useState<readonly StyleTag[]>([]);
  const [loading,setLoading]=useState(false);
  const [generating,setGenerating]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const categoryAbort=useRef(new AbortController()),recommendAbort=useRef(new AbortController());
  const categoryGeneration=useRef(0),recommendGeneration=useRef(0);
  const groups=styleTagGroups(tags),active=groups[dimension];
  const atLimit=selected.length>=styleSelectionLimit;

  function cancelCategories(messageText='分类读取已取消，可重试。'){
    categoryGeneration.current++;
    categoryAbort.current.abort();
    setLoading(false);
    setError(messageText);
  }
  async function loadCategories(){
    categoryAbort.current.abort();
    categoryAbort.current=new AbortController();
    const signal=categoryAbort.current.signal,generation=++categoryGeneration.current;
    setLoading(true);setError('');setMessage('');
    try{
      const categories=await services.discovery.categories('wy',signal);
      if(signal.aborted||generation!==categoryGeneration.current)return;
      const next=styleTagsFromCategories(categories);
      if(!next.length)throw new Error('公开分类暂未返回可选择的风格标签');
      setTags(next);
      const first=styleDimensions.find(item=>styleTagGroups(next)[item.id].length);
      if(first)setDimension(first.id);
    }catch(failure){
      if(signal.aborted||generation!==categoryGeneration.current)return;
      setError(failure instanceof Error&&failure.message?failure.message:'公开分类暂时无法读取，请重试。');
    }finally{
      if(generation===categoryGeneration.current)setLoading(false);
    }
  }
  function cancelRecommendations(){
    recommendGeneration.current++;
    recommendAbort.current.abort();
    setGenerating(false);
    setMessage(results.length?'已取消生成，已取得的结果保留。':'已取消生成，可调整标签后重试。');
  }
  async function generate(){
    if(!selected.length||generating)return;
    recommendAbort.current.abort();
    recommendAbort.current=new AbortController();
    const signal=recommendAbort.current.signal,generation=++recommendGeneration.current;
    setGenerating(true);setError('');setMessage('');setFailedTags([]);
    try{
      const result=await services.discovery.styleRecommendations('wy',selected,signal);
      if(signal.aborted||generation!==recommendGeneration.current)return;
      setResults(result.items);
      setFailedTags(result.failedTags);
      if(result.failedTags.length){
        setMessage(result.items.length
          ?`${result.failedTags.length} 个标签读取失败，其余结果已保留。`
          :`${result.failedTags.length} 个标签读取失败，请重试生成。`);
      }else{
        setMessage(result.items.length?'':'没有找到匹配的公开歌单，请调整标签后重试。');
      }
    }catch(failure){
      if(signal.aborted||generation!==recommendGeneration.current)return;
      setMessage(results.length
        ?'生成失败，已取得的结果保留。'
        :failure instanceof Error&&failure.name==='AbortError'
          ?'已取消生成，可调整标签后重试。'
          :'生成失败，请检查网络后重试。');
    }finally{
      if(generation===recommendGeneration.current)setGenerating(false);
    }
  }
  function close(){
    categoryGeneration.current++;
    recommendGeneration.current++;
    categoryAbort.current.abort();
    recommendAbort.current.abort();
    setLoading(false);setGenerating(false);
    onClose();
  }

  useEffect(()=>{
    if(visible){
      setSelected([]);setResults([]);setFailedTags([]);setError('');setMessage('');setDimension('genre');
      void loadCategories();
    }
    return()=>{
      categoryGeneration.current++;
      recommendGeneration.current++;
      categoryAbort.current.abort();
      recommendAbort.current.abort();
    };
  },[visible]);

  const hit={
    minHeight:controls.hit,
    justifyContent:'center' as const,
    alignItems:'center' as const,
  };
  const button=(label:string,onPress:()=>void,disabled=false,testID?:string,destructive=false)=><Pressable
    testID={testID}
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    style={{...hit,paddingHorizontal:18,borderRadius:radius.md,backgroundColor:destructive?theme.palette.surface:theme.palette.selected,opacity:disabled?.42:1}}
  ><Text style={{color:destructive?theme.palette.secondary:theme.palette.accent,fontWeight:'600'}}>{label}</Text></Pressable>;

  return <SheetModal visible={visible} animationType="slide" onRequestClose={close}>
    <View testID="style-recommendation-sheet" style={{flex:1,backgroundColor:theme.palette.background[0]}}>
      <View style={{paddingHorizontal:space.lg,paddingTop:space.md,paddingBottom:space.sm,borderBottomWidth:1,borderColor:theme.palette.border,gap:space.sm}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:space.md}}>
          <View style={{flex:1,gap:4}}>
            <Text accessibilityRole="header" style={{fontSize:24,fontWeight:'800',color:theme.palette.text}}>定制风格化推荐</Text>
            <Text style={{color:theme.palette.secondary,lineHeight:20}}>基于网易云公开歌单分类，最多选择 {styleSelectionLimit} 个标签。音枢按公开目录去重并保留命中理由。</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭风格化推荐" onPress={close} style={{width:controls.hit,height:controls.hit,borderRadius:controls.hit/2,alignItems:'center',justifyContent:'center',backgroundColor:theme.palette.surface}}><Ionicons name="close" size={24} color={theme.palette.accent}/></Pressable>
        </View>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
          <Text testID="style-selected-count" accessibilityLiveRegion="polite" style={{color:atLimit?theme.palette.accent:theme.palette.text,fontWeight:'700'}}>已选 {selected.length}/{styleSelectionLimit}</Text>
          {button('清空',()=>{setSelected([]);setResults([]);setFailedTags([]);setMessage('');},!selected.length,'style-clear',true)}
        </View>
      </View>

      <ScrollView contentContainerStyle={{padding:space.lg,paddingBottom:space.xl*2,gap:space.lg}} keyboardShouldPersistTaps="handled">
        <View accessibilityRole="tablist" style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
          {styleDimensions.map(item=><Pressable
            key={item.id}
            testID={`style-dimension-${item.id}`}
            accessibilityRole="tab"
            accessibilityState={{selected:dimension===item.id,disabled:groups[item.id].length===0}}
            disabled={groups[item.id].length===0}
            onPress={()=>setDimension(item.id)}
            style={{...hit,paddingHorizontal:Math.max(12,width>420?16:12),borderRadius:20,backgroundColor:dimension===item.id?theme.palette.selected:theme.palette.surface,opacity:groups[item.id].length===0?.42:1}}
          ><Text style={{color:dimension===item.id?theme.palette.accent:theme.palette.secondary,fontWeight:dimension===item.id?'700':'500'}}>{item.label}{groups[item.id].length?` ${groups[item.id].length}`:''}</Text></Pressable>)}
        </View>

        {loading?<View style={{gap:space.md,padding:20,borderRadius:radius.lg,backgroundColor:theme.palette.surface}}><Text accessibilityLiveRegion="polite" style={{color:theme.palette.text}}>正在读取公开分类…</Text>{button('取消读取',()=>cancelCategories(),false,'style-category-cancel',true)}</View>:null}
        {!!error?<View style={{gap:space.md,padding:20,borderRadius:radius.lg,backgroundColor:theme.palette.surface}}><Text testID="style-category-error" accessibilityLiveRegion="polite" style={{color:theme.palette.accent,lineHeight:21}}>{error}</Text>{button('重试分类',()=>{void loadCategories();},false,'style-category-retry')}</View>:null}

        {!loading&&!error?<View style={{gap:space.md}}>
          <Text style={{fontSize:19,fontWeight:'700',color:theme.palette.text}}>推荐维度</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
            {active.map(tag=>{
              const checked=selected.some(value=>styleTagKey(value)===styleTagKey(tag)),disabled=!checked&&atLimit;
              return <Pressable
                key={styleTagKey(tag)}
                testID={`style-tag-${tag.dimension}-${tag.id}`}
                accessibilityRole="checkbox"
                accessibilityState={{checked,disabled}}
                accessibilityLabel={tag.name}
                disabled={disabled}
                onPress={()=>{
                  try{setSelected(current=>toggleStyleSelection(current,tag));setMessage('');}
                  catch(failure){setMessage(failure instanceof Error?failure.message:'无法更新风格标签');}
                }}
                style={{...hit,flexDirection:'row',gap:7,paddingHorizontal:14,paddingVertical:10,borderRadius:18,borderWidth:1,borderColor:checked?theme.palette.accent:theme.palette.border,backgroundColor:checked?theme.palette.selected:theme.palette.surface,opacity:disabled?.42:1}}
              >{checked?<Ionicons name="checkmark" size={16} color={theme.palette.accent}/>:null}<Text style={{color:checked?theme.palette.accent:theme.palette.text}}>{tag.name}</Text></Pressable>;
            })}
          </View>
          {active.length===0?<Text style={{color:theme.palette.secondary}}>此维度暂无公开标签。</Text>:null}
        </View>:null}

        {!!selected.length?<View style={{gap:space.sm}}>
          <Text style={{color:theme.palette.secondary,fontWeight:'600'}}>本次选择</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
            {selected.map(tag=><Pressable key={styleTagKey(tag)} testID={`style-selected-${tag.dimension}-${tag.id}`} accessibilityRole="button" accessibilityLabel={`移除${tag.name}`} onPress={()=>setSelected(current=>current.filter(value=>styleTagKey(value)!==styleTagKey(tag)))} style={{...hit,flexDirection:'row',gap:7,paddingHorizontal:13,borderRadius:17,backgroundColor:theme.palette.selected}}><Text style={{color:theme.palette.accent}}>{tag.name}</Text><Ionicons name="close" size={15} color={theme.palette.accent}/></Pressable>)}
          </View>
        </View>:null}

        <View style={{flexDirection:'row',gap:space.md,flexWrap:'wrap'}}>
          {button(generating?'正在生成…':'生成推荐',()=>{void generate();},!selected.length||generating,'style-generate-button')}
          {generating?button('取消生成',cancelRecommendations,false,'style-generate-cancel',true):null}
        </View>
        {!!message?<Text testID="style-recommendation-message" accessibilityLiveRegion="polite" style={{color:failedTags.length?theme.palette.accent:theme.palette.secondary,lineHeight:21}}>{message}</Text>:null}
        {!!failedTags.length?<Text testID="style-failed-tags" style={{color:theme.palette.secondary}}>未完成：{failedTags.map(tag=>tag.name).join('、')}</Text>:null}

        {!!results.length?<View style={{gap:space.md}}>
          <View style={{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between'}}><Text style={{fontSize:21,fontWeight:'800',color:theme.palette.text}}>风格化推荐</Text><Text style={{color:theme.palette.secondary}}>{results.length} 个公开歌单</Text></View>
          {results.map((item,index)=><Pressable
            key={`${item.platform}:${item.playlist.id}`}
            testID={`style-result-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`打开歌单：${item.playlist.title}；命中${item.matchedTags.map(tag=>tag.name).join('、')}`}
            onPress={()=>onOpenPlaylist(item.playlist)}
            style={{flexDirection:'row',gap:space.md,padding:space.md,borderRadius:radius.lg,backgroundColor:theme.palette.surface}}
          >
            <Cover services={services} url={item.playlist.artwork} size={82}/>
            <View style={{flex:1,gap:7}}>
              <Text numberOfLines={2} style={{fontSize:16,fontWeight:'700',color:theme.palette.text}}>{item.playlist.title}</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{item.matchedTags.map(tag=><View key={styleTagKey(tag)} style={{paddingHorizontal:8,paddingVertical:4,borderRadius:12,backgroundColor:theme.palette.selected}}><Text style={{color:theme.palette.accent,fontSize:12}}>{tag.name}</Text></View>)}</View>
              <Text numberOfLines={1} style={{color:theme.palette.secondary,fontSize:12}}>{`命中 ${item.matchedTags.length} 个标签${item.playlist.count!==undefined?` · ${item.playlist.count} 首`:''}`}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.palette.secondary}/>
          </Pressable>)}
        </View>:null}
      </ScrollView>
    </View>
  </SheetModal>;
}
