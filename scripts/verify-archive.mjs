import {execFileSync} from 'node:child_process';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
const app='build/distribution/NexusMusic.xcarchive/Products/Applications/app.app';
const plist=key=>execFileSync('/usr/libexec/PlistBuddy',['-c',`Print :${key}`,`${app}/Info.plist`],{encoding:'utf8'}).trim();
const manifest=JSON.parse(readFileSync('build/distribution/build-manifest.json','utf8'));
const architecture=execFileSync('xcrun',['lipo','-archs',`${app}/${plist('CFBundleExecutable')}`],{encoding:'utf8'}).trim();
if(architecture!=='arm64'||plist('DTPlatformName')!=='iphoneos'||plist('CFBundleIdentifier')!==manifest.bundleIdentifier||plist('DTSDKName')!==`iphoneos${manifest.iOSSDK}`||!statSync(`${app}/main.jsbundle`).size)throw new Error('Archive architecture, SDK, bundle ID or JavaScript bundle did not match the requested build');
const jsBundle=readFileSync(`${app}/main.jsbundle`);
for(const marker of ['nexus-ui-test-online-adapter','nexus-ui-test-playlist-link-expander','nexus-ui-test-theme-observation','https://163cn.tv/AbCd']){
  if(jsBundle.includes(Buffer.from(marker)))throw new Error(`Test-only marker must never be included in the production archive: ${marker}`);
}
const deviceFamilies=[Number(plist('UIDeviceFamily:0')),Number(plist('UIDeviceFamily:1'))];
if(deviceFamilies.join(',')!=='1,2')throw new Error('The production archive must support native iPhone and iPad windows');
const hermesBin=`${app}/Frameworks/hermes.framework/hermes`;
const reactBin=`${app}/Frameworks/React.framework/React`;
const depsBin=`${app}/Frameworks/ReactNativeDependencies.framework/ReactNativeDependencies`;
for(const [label,bin] of [['hermes',hermesBin],['React',reactBin],['ReactNativeDependencies',depsBin]]){
  const arch=execFileSync('xcrun',['lipo','-archs',bin],{encoding:'utf8'}).trim();
  if(arch!=='arm64')throw new Error(`Expected arm64 ${label}.framework in Release archive, got: ${arch}`);
}
// Release React.framework is compiled without HERMES_ENABLE_DEBUGGER, placing
// IHermes::registerForProfiling() at vtable +0x80. A Debug hermes.framework
// inserts debugJavaScript() at +0x80 and crashes immediately on physical iOS
// devices (SIGSEGV at 0x17 in HermesRuntimeImpl::debugJavaScript).
const hermesSymbols=execFileSync('xcrun',['nm',hermesBin],{encoding:'utf8',maxBuffer:32*1024*1024});
if(hermesSymbols.includes('debugJavaScript')){
  throw new Error('Debug hermes.framework (HERMES_ENABLE_DEBUGGER=1) was packaged into a Release archive; aborting to prevent physical device launch SIGSEGV');
}
const uuidOf=bin=>execFileSync('xcrun',['dwarfdump','--uuid',bin],{encoding:'utf8'}).match(/UUID:\s+([0-9A-Fa-f-]+)/)?.[1]??null;
manifest.archive={architecture,SDK:plist('DTSDKName'),minimumOS:plist('MinimumOSVersion'),deviceFamilies,hermesUUID:uuidOf(hermesBin),reactUUID:uuidOf(reactBin),hermesConfiguration:'Release'};
writeFileSync('build/distribution/build-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Verified device archive: ${architecture}, ${manifest.archive.SDK}, hermes=${manifest.archive.hermesUUID} (Release)`);
