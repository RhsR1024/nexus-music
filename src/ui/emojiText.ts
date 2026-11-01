export interface EmojiTextRun {text:string;emoji:boolean}

// Keep whole presentation sequences on the emoji font while leaving ordinary
// copy on the user's configured typography. The greedy ZWJ branch covers
// families/professions, and the remaining branches cover flags and keycaps.
const emojiSequence=/(?:\u{1F3F4}[\u{E0061}-\u{E007A}]+\u{E007F}|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*|[\u{1F1E6}-\u{1F1FF}]{2}|[#*0-9]\uFE0F?\u20E3)/gu;

export function splitEmojiText(value:string):EmojiTextRun[]{
 const runs:EmojiTextRun[]=[];let offset=0;
 for(const match of value.matchAll(emojiSequence)){
  const index=match.index;
  if(index===undefined)continue;
  if(index>offset)runs.push({text:value.slice(offset,index),emoji:false});
  runs.push({text:match[0],emoji:true});
  offset=index+match[0].length;
 }
 if(offset<value.length)runs.push({text:value.slice(offset),emoji:false});
 return runs;
}
