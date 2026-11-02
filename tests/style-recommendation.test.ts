import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeStyleRecommendations,
  normalizeStyleSelection,
  styleTagsFromCategories,
  styleTagGroups,
  toggleStyleSelection,
  type StyleTag,
} from '../src/domain/styleRecommendation.ts';

const tag=(id:string,dimension:StyleTag['dimension']='genre'):StyleTag=>({id,name:id,dimension});

test('public category labels map to the five bounded style dimensions',()=>{
  const tags=styleTagsFromCategories([
    {id:'流行',title:'流行',group:'风格'},
    {id:'华语',title:'华语',group:'语种'},
    {id:'治愈',title:'治愈',group:'情感'},
    {id:'校园',title:'校园',group:'主题'},
    {id:'学习',title:'学习',group:'场景'},
    {id:'unknown',title:'无维度'},
    {id:'流行',title:'流行副本',group:'风格'},
  ]);
  assert.deepEqual(tags.map(value=>[value.id,value.dimension]),[
    ['流行','genre'],['华语','language'],['治愈','mood'],['校园','theme'],['学习','scene'],
  ]);
  const groups=styleTagGroups(tags);
  assert.deepEqual(groups.genre.map(value=>value.name),['流行']);
  assert.deepEqual(groups.language.map(value=>value.name),['华语']);
});

test('selection can remove or add tags but never accepts a sixth unique tag',()=>{
  const values=[tag('one'),tag('two'),tag('three'),tag('four'),tag('five')];
  const selected=normalizeStyleSelection(values);
  assert.equal(selected.length,5);
  assert.throws(()=>toggleStyleSelection(selected,tag('six')),/最多选择 5 个/);
  assert.deepEqual(toggleStyleSelection(selected,tag('one')).map(value=>value.id),['two','three','four','five']);
  assert.deepEqual(normalizeStyleSelection([tag('one'),tag('one'),tag('two')]).map(value=>value.id),['one','two']);
});

test('recommendations deduplicate by platform and playlist identity, rank by match count, then first appearance',()=>{
  const genre=tag('说唱','genre'),mood=tag('伤感','mood'),scene=tag('夜晚','scene');
  const items=mergeStyleRecommendations('wy',[
    {tag:genre,items:[
      {id:'single',title:'Single'},
      {id:'shared',title:'Shared first'},
    ]},
    {tag:mood,items:[
      {id:'shared',title:'Shared duplicate',artwork:'https://example.test/shared'},
      {id:'mood-only',title:'Mood only'},
    ]},
    {tag:scene,items:[
      {id:'shared',title:'Shared third'},
      {id:'scene-only',title:'Scene only'},
    ]},
  ]);
  assert.deepEqual(items.map(value=>value.playlist.id),['shared','single','mood-only','scene-only']);
  assert.deepEqual(items[0]?.matchedTags.map(value=>value.name),['说唱','伤感','夜晚']);
  assert.equal(items[0]?.playlist.title,'Shared first');
});
