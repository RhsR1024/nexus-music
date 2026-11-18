import {AccountDailyError} from '../providers/accountDaily.ts';
import {AccountFmError} from '../providers/accountFm.ts';
import {AccountHeartbeatError} from '../providers/accountHeartbeat.ts';
import {AccountRecommendedPlaylistsError} from '../providers/accountRecommendedPlaylists.ts';
export const ACCOUNT_LOGIN_REQUIRED='登录已失效，请重新登录';
/** External aborts/obsolete operations are discarded by the caller. A current
 * operation cancelled by a date rollover still needs a retryable terminal UI. */
export function accountRecommendationFailure(error:unknown,fallback:string):string{
  if(error instanceof AccountDailyError||error instanceof AccountFmError||error instanceof AccountRecommendedPlaylistsError||error instanceof AccountHeartbeatError){
    if(error.kind==='login_required')return ACCOUNT_LOGIN_REQUIRED;
    if(error.kind==='account_changed')return '平台账号已更改，请重试';
    if(error.kind==='cancelled')return '读取已取消，请重试';
    if(error instanceof AccountHeartbeatError&&(error.kind==='favorite_playlist_missing'||error.kind==='liked_empty'||error.kind==='seed_unavailable'||error.kind==='recommendations_empty'))return error.message;
    return fallback;
  }
  return error instanceof Error&&/会话|登录/.test(error.message)?ACCOUNT_LOGIN_REQUIRED:fallback;
}
