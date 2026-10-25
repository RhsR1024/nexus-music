import type {Track} from '../domain/track.ts';
import type {LibraryStore} from '../storage/library.ts';
import type {LocalAudioStore} from '../storage/localAudio.ts';

// Playback and song menus choose the owning domain. This adapter holds no
// favorite data: owned local files use device flags; other songs use library
// membership. Library collection management keeps its explicit store actions.
export function createSongFavorites(library:LibraryStore,files:LocalAudioStore) {
  let snapshot={library:library.getSnapshot(),files:files.getSnapshot()};
  return {
    getSnapshot:()=>{const nextLibrary=library.getSnapshot(),nextFiles=files.getSnapshot();if(snapshot.library!==nextLibrary||snapshot.files!==nextFiles)snapshot={library:nextLibrary,files:nextFiles};return snapshot;},
    subscribe:(listener:()=>void)=>{const a=library.subscribe(listener),b=files.subscribe(listener);return()=>{a();b();};},
    isFavorite:(track:Track)=>track.origin.kind==='local'?files.isFavorite(track.origin.id):library.isFavorite(track),
    toggle:(track:Track)=>track.origin.kind==='local'?files.toggleFavorite(track.origin.id):library.favorite(track),
  };
}
