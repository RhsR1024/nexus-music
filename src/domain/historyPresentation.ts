// Display local calendar values without changing history order or identity.
export function historyTimestamp(value:number|undefined):{day:string;clock:string}{
  const date=new Date(value??NaN);
  if(value===undefined||value<0||!Number.isFinite(date.getTime()))return {day:'日期未知',clock:'--:--'};
  const pad=(part:number)=>String(part).padStart(2,'0');
  return {day:`${String(date.getFullYear()).padStart(4,'0')}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`,clock:`${pad(date.getHours())}:${pad(date.getMinutes())}`};
}
