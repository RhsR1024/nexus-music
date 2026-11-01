import {execFileSync} from 'node:child_process';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
const app='build/distribution/NexusMusic.xcarchive/Products/Applications/app.app';
const plist=key=>execFileSync('/usr/libexec/PlistBuddy',['-c',`Print :${key}`,`${app}/Info.plist`],{encoding:'utf8'}).trim();
const manifest=JSON.parse(readFileSync('build/distribution/build-manifest.json','utf8'));
const architecture=execFileSync('xcrun',['lipo','-archs',`${app}/${plist('CFBundleExecutable')}`],{encoding:'utf8'}).trim();
if(architecture!=='arm64'||plist('DTPlatformName')!=='iphoneos'||plist('CFBundleIdentifier')!==manifest.bundleIdentifier||plist('DTSDKName')!==`iphoneos${manifest.iOSSDK}`||!statSync(`${app}/main.jsbundle`).size)throw new Error('Archive architecture, SDK, bundle ID or JavaScript bundle did not match the requested build');
const jsBundle=readFileSync(`${app}/main.jsbundle`);
for(const marker of ['nexus-ui-test-online-adapter','nexus-ui-test-playlist-link-expander','https://163cn.tv/AbCd']){
  if(jsBundle.includes(Buffer.from(marker)))throw new Error(`Test-only marker must never be included in the production archive: ${marker}`);
}
const deviceFamilies=[Number(plist('UIDeviceFamily:0')),Number(plist('UIDeviceFamily:1'))];
if(deviceFamilies.join(',')!=='1,2')throw new Error('The production archive must support native iPhone and iPad windows');
manifest.archive={architecture,SDK:plist('DTSDKName'),minimumOS:plist('MinimumOSVersion'),deviceFamilies};
writeFileSync('build/distribution/build-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Verified device archive: ${architecture}, ${manifest.archive.SDK}`);
