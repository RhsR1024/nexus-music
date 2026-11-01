import {test} from 'node:test';
import assert from 'node:assert/strict';
import {splitEmojiText} from '../src/ui/emojiText.ts';

test('comment emoji segmentation preserves complete Unicode clusters and ordinary text',()=>{
 const value='前🎵中👩‍💻后❤️🇨🇳1️⃣👨🏽‍🚀🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F} e\u0301';
 const runs=splitEmojiText(value);
 assert.equal(runs.map(run=>run.text).join(''),value);
 assert.deepEqual(runs.filter(run=>run.emoji).map(run=>run.text),[
  '🎵','👩‍💻','❤️','🇨🇳','1️⃣','👨🏽‍🚀','🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
 ]);
 assert.equal(runs.filter(run=>run.emoji).length,7);
});

test('comment text without emoji remains one ordinary run',()=>{
 assert.deepEqual(splitEmojiText('普通评论 é'),[{text:'普通评论 é',emoji:false}]);
 assert.deepEqual(splitEmojiText(''),[]);
});
