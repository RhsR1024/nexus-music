import {cleanLibrary} from './backup.ts';
import {cleanBackupSettings,type BackupSettings} from './backupSettings.ts';
import {cleanPlaybackStats,type PlaybackStatsState,type PlaybackStatsStore} from './playbackStats.ts';
import type {LibraryState,LibraryStore} from './library.ts';
import type {PreferenceStore} from '../app/preferences.ts';
import type {Repository} from './repository.ts';
import type {MutationQueue} from './mutations.ts';

export function createBackupRestore(options:{repository:Pick<Repository,'putMany'>;mutations:MutationQueue;library:Pick<LibraryStore,'restore'>;statistics:Pick<PlaybackStatsStore,'restore'>;preferences:Pick<PreferenceStore,'getSnapshot'|'restore'>}){
  return (library:LibraryState,statistics:PlaybackStatsState,settings?:BackupSettings)=>{
    // Validate and strip unrecognized data before any transaction is queued.
    const safeLibrary=cleanLibrary(library),safeStats=cleanPlaybackStats(statistics),safeSettings=settings===undefined?undefined:cleanBackupSettings(settings);
    return options.mutations.run(async()=>{
      const rows:(readonly[string,unknown])[]=[['library.v1',safeLibrary],['playbackStats.v1',safeStats]];
      if(safeSettings)rows.push(['preferences.v1',{...options.preferences.getSnapshot(),...safeSettings.preferences,coverColorDefaultOn:true}]);
      await options.repository.putMany(rows);
      await Promise.all([options.library.restore(),options.statistics.restore(true),...(safeSettings?[options.preferences.restore()]:[])]);
    });
  };
}
