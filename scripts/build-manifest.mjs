import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const run=(name,args)=>execFileSync(name,args,{encoding:'utf8'}).trim();
const sdk=run('xcrun',['--sdk','iphoneos','--show-sdk-version']);
const expected=process.env.NEXUS_EXPECTED_IOS_SDK_MAJOR;
if(expected&&sdk.split('.')[0]!==expected)throw new Error(`Expected iOS SDK ${expected}.x; installed ${sdk}`);
const workingTreeChanges=run('git',['status','--porcelain']).split('\n').filter(Boolean);
mkdirSync('build/distribution',{recursive:true});
writeFileSync('build/distribution/build-manifest.json',JSON.stringify({commit:run('git',['rev-parse','HEAD']),dirty:workingTreeChanges.length>0,workingTreeChanges,
  createdAt:new Date().toISOString(),hostArchitecture:run('uname',['-m']),macOS:run('sw_vers',['-productVersion']),
  xcode:run('xcodebuild',['-version']),iOSSDK:sdk,node:process.version,cocoaPods:process.env.CI==='true'?run('bundle',['exec','pod','--version']):run('pod',['--version']),
  signed:false,bundleIdentifier:'com.nexusmusic.app',githubRunURL:process.env.GITHUB_ACTIONS==='true'?`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:undefined},null,2)+'\n');
