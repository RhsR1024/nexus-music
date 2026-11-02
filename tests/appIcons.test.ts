import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  appIconIDForNativeName,
  isAllowedNativeAppIconName,
  nativeNameForAppIcon,
  nexusAppIcons,
} from '../src/domain/appIcons.ts';

test('app icon choices map to a bounded native allowlist',()=>{
  assert.deepEqual(nexusAppIcons.map(choice=>choice.id),['primary','orange','green','blue','purple','graphite']);
  assert.equal(nativeNameForAppIcon('primary'),null);
  assert.equal(nativeNameForAppIcon('orange'),'NexusAltOrange');
  assert.equal(appIconIDForNativeName(null),'primary');
  assert.equal(appIconIDForNativeName('NexusAltGraphite'),'graphite');
  assert.equal(appIconIDForNativeName('UnexpectedIcon'),undefined);
  assert.equal(isAllowedNativeAppIconName(null),true);
  assert.equal(isAllowedNativeAppIconName('NexusAltBlue'),true);
  assert.equal(isAllowedNativeAppIconName('UnexpectedIcon'),false);
});

test('generated icon previews are opaque square PNG files',()=>{
  for(const choice of nexusAppIcons){
    for(const [path,size] of [
      [`assets/app-icons/nexus-${choice.id}.png`,256],
      ...(choice.nativeName?[[`ios/app/Images.xcassets/${choice.nativeName}.appiconset/${choice.nativeName}-1024.png`,1024] as const]:[]),
    ] as const){
      const bytes=readFileSync(path);
      assert.equal(bytes.subarray(1,4).toString(),'PNG');
      assert.equal(bytes.readUInt32BE(16),size);
      assert.equal(bytes.readUInt32BE(20),size);
      assert.equal(bytes[25],2,'PNG color type must be RGB without alpha');
    }
  }
});

test('alternate icon catalogs expose one opaque universal iOS image',()=>{
  for(const choice of nexusAppIcons.filter(item=>item.nativeName)){
    const catalog=JSON.parse(readFileSync(`ios/app/Images.xcassets/${choice.nativeName}.appiconset/Contents.json`,'utf8'));
    assert.deepEqual(catalog.images,[{
      filename:`${choice.nativeName}-1024.png`,
      idiom:'universal',
      platform:'ios',
      size:'1024x1024',
    }]);
  }
});
