// Output budgets apply after timestamp/layer expansion, across the whole document.
export const maxLyricLines=10000;
export const maxLyricWords=20000;
export function createLyricBudget(){
  let lines=0,words=0;
  return (wordCount=0)=>{
    if(++lines>maxLyricLines||(words+=wordCount)>maxLyricWords)throw new Error('歌词展开行或计时词数量过多');
  };
}
