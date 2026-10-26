import test from 'node:test';
import assert from 'node:assert/strict';
import {themeCovers} from '../scripts/fixtures/theme-covers.mjs';
test('cover regression inputs exceed the production safety floor',()=>{
  for(const [name,base64] of Object.entries(themeCovers)){
    const png=Buffer.from(base64,'base64');
    assert.equal(png.subarray(1,4).toString(),'PNG');
    assert.equal(png.readUInt32BE(16),name==='multi'?96:128);
    assert.equal(png.readUInt32BE(20),name==='multi'?96:128);
  }
});
