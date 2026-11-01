import {DeadlineError} from './async.ts';
import {HTTPResponseError} from './http.ts';

export type DiscoveryFailureKind='timeout'|'connection'|'rate-limit'|'server'|'rejected'|'incomplete'|'invalid'|'unknown';
export interface DiscoveryFailure {kind:DiscoveryFailureKind;message:string;retryable:boolean}

const safeProviderMessage=/^(无法读取此公开歌单|部分歌曲不可读取，未导入不完整歌单|平台歌曲数量无效，未导入不完整歌单|读取期间歌曲数量变化，请重新读取完整歌单|歌单超过20000首，请分批导入|歌单分页过多，未导入不完整结果|平台未推进分页，已停止不完整导入|歌曲数量与平台声明不符，未导入不完整歌单|酷狗完整歌单暂不可用，未导入预览列表|酷狗完整歌单格式无效|歌单歌曲响应无效|酷狗歌曲响应无效|咪咕歌单响应无效)$/;

export function classifyDiscoveryFailure(error:unknown):DiscoveryFailure {
  if(error instanceof DeadlineError)return{kind:'timeout',message:'读取超时，请检查网络后重试。',retryable:true};
  if(error instanceof HTTPResponseError){
    if(error.status===429)return{kind:'rate-limit',message:'平台请求过于频繁，请稍后重试。',retryable:true};
    if(error.status>=500)return{kind:'server',message:'平台服务暂时异常，请稍后重试。',retryable:true};
    return{kind:'rejected',message:'平台拒绝读取此歌单，请确认它是公开内容后重试。',retryable:true};
  }
  if(error instanceof TypeError||error instanceof Error&&/(network request failed|network error|internet connection|connection (?:failed|lost|refused|reset)|failed host lookup|network is unreachable|offline)/i.test(error.message)){
    return{kind:'connection',message:'网络连接失败，请检查网络后重试。',retryable:true};
  }
  if(error instanceof Error&&safeProviderMessage.test(error.message)){
    if(/为空/.test(error.message))return{kind:'invalid',message:error.message,retryable:false};
    if(/无法读取|格式|响应无效|不可用/.test(error.message))return{kind:'invalid',message:error.message,retryable:true};
    return{kind:'incomplete',message:error.message,retryable:true};
  }
  return{kind:'unknown',message:'此平台暂时无法读取，请重试或选择其他平台。',retryable:true};
}

export function playlistLinkFailure(error:unknown):string {
  if(error instanceof DeadlineError)return'短链接解析超时，请展开完整链接或重试。';
  if(error instanceof TypeError||error instanceof Error&&/(network request failed|network error|internet connection|connection (?:failed|lost|refused|reset)|failed host lookup|network is unreachable|offline)/i.test(error.message))return'短链接网络连接失败，请展开完整链接或重试。';
  if(error instanceof HTTPResponseError)return'短链接服务暂时不可用，请展开完整链接或重试。';
  if(error instanceof Error&&error.name==='AbortError')return'已取消解析。';
  if(error instanceof Error&&/^(请输入平台公开歌单分享链接或选择平台后输入ID|分享链接无效|分享链接不能包含账号信息|尚未识别此分享链接，请展开链接或输入公开歌单ID|分享链接与所选平台不同|短链接服务暂时不可用)$/.test(error.message))return error.message;
  return'未能解析短链接，请展开完整链接或重试。';
}
