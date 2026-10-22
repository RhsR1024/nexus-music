import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';

export const fileSha256=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function sourceSnapshot(){
  const paths=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{encoding:'utf8'}).split('\0').filter(path=>/^(src|ios|modules|native|scripts|tests)\//.test(path)||(!path.includes('/')&&/\.(json|[cm]?[jt]sx?)$/.test(path))).concat(['ios/.xcode.env','ios/.xcode.env.local']).sort();
  const files={};for(const path of paths){try{if(lstatSync(path).isFile())files[path]=fileSha256(path);}catch{files[path]='missing';}}
  return {commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),diffSha256:createHash('sha256').update(execFileSync('git',['diff','--binary','HEAD'])).digest('hex'),digest:digest(files),files};
}
export function installedBundleSnapshot(simulator){
  try{
    const root=execFileSync('xcrun',['simctl','get_app_container',simulator,'com.nexusmusic.app','app'],{encoding:'utf8'}).trim();
    const files={};const visit=directory=>{for(const name of readdirSync(directory).sort()){const path=join(directory,name),info=lstatSync(path);if(info.isDirectory())visit(path);else if(info.isFile())files[relative(root,path)]=fileSha256(path);}};visit(root);
    const info=JSON.parse(execFileSync('plutil',['-convert','json','-o','-',join(root,'Info.plist')],{encoding:'utf8'}));
    return {identifier:info.CFBundleIdentifier,version:info.CFBundleShortVersionString,build:info.CFBundleVersion,executable:info.CFBundleExecutable,digest:digest(files),files};
  }catch(error){return {unavailable:error.message.split('\n')[0]};}
}

// Bind a successful XCTest export to the actual installed bytes and unchanged
// build inputs. This proves provenance only; state/geometry/manual review stay separate.
export function verifyCaptureEvidence(manifestPath,indexPath,candidatePath){
  const failures=[];if(!manifestPath||!indexPath)return {ready:false,failures:['capture manifest and export index are required']};
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8')),index=JSON.parse(readFileSync(indexPath,'utf8'));
  const isHash=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
  const checkSnapshot=(name,snapshot)=>{
    if(!snapshot?.files||!Object.keys(snapshot.files).length||!Object.values(snapshot.files).every(value=>isHash(value)||value==='missing')||!isHash(snapshot.digest)||digest(snapshot.files)!==snapshot.digest)failures.push(`${name} digest is missing or inconsistent`);
  };
  checkSnapshot('sourceBefore',manifest.sourceBefore);checkSnapshot('sourceAfter',manifest.sourceAfter);checkSnapshot('installedBundle',manifest.installedBundle);
  if(manifest.schemaVersion!==1||manifest.configuration!=='Release'||manifest.installedBundle?.identifier!=='com.nexusmusic.app')failures.push('capture schema/configuration/bundle identifier is invalid');
  if(manifest.exitCode!==0)failures.push('XCTest did not succeed');
  if(!manifest.sourceUnchanged||!isHash(manifest.sourceBefore?.digest)||manifest.sourceBefore?.digest!==manifest.sourceAfter?.digest)failures.push('source changed during capture');
  if(!manifest.fixture?.sha256||manifest.fixture.sha256!==manifest.sourceBefore?.files?.[manifest.fixture.path])failures.push('fixture hash is missing or inconsistent');
  if(!isHash(manifest.installedBundle?.files?.['main.jsbundle'])||!isHash(manifest.installedBundle?.files?.[manifest.installedBundle?.executable]))failures.push('installed JS/native bundle identity is missing');
  if(index.selection==='latest')failures.push('formal export must name an exact xcresult');
  if(resolve(index.resultBundle)!==resolve(manifest.resultBundle))failures.push('export xcresult differs from capture manifest');
  const resultInfo=join(manifest.resultBundle,'Info.plist');
  try{if(!isHash(manifest.resultInfoSha256)||manifest.resultInfoSha256!==fileSha256(resultInfo)||index.resultInfoSha256!==manifest.resultInfoSha256)failures.push('xcresult Info.plist hash is missing or inconsistent');}catch{failures.push('xcresult Info.plist is unavailable');}
  const entry=index.files?.find(file=>resolve(join(indexPath,'..',file.exported))===resolve(candidatePath));
  if(!entry?.sha256||entry.sha256!==fileSha256(candidatePath))failures.push('exported screenshot hash is missing or mismatched');
  return {ready:failures.length===0,failures,manifest:{path:manifestPath,sha256:fileSha256(manifestPath)},exportIndex:{path:indexPath,sha256:fileSha256(indexPath)},resultBundle:manifest.resultBundle,sourceDigest:manifest.sourceBefore?.digest,installedBundleDigest:manifest.installedBundle?.digest,fixture:manifest.fixture};
}
