import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
// Compile the actual Foundation-only policy from the Expo module, not a copy.
const source=readFileSync('modules/nexus-native/ios/NexusMusicAuthModule.swift','utf8');
const start=source.indexOf('enum MusicWebLoginPolicy {'),end=source.indexOf('public final class NexusMusicAuthModule:');
if(start<0||end<=start)throw new Error('Native music web login policy anchors changed');
mkdirSync('build/tests',{recursive:true});
writeFileSync('build/tests/MusicWebLoginPolicy.swift',`import Foundation\n${source.slice(start,end)}`);
execFileSync('xcrun',['swiftc','-swift-version','5','build/tests/MusicWebLoginPolicy.swift','tests/native/MusicWebLoginPolicyTests.swift','-o','build/tests/native-music-web-login'],{stdio:'inherit'});
execFileSync('build/tests/native-music-web-login',[],{stdio:'inherit'});
