import {execFileSync} from 'node:child_process';
import {copyFileSync,mkdirSync,mkdtempSync,readdirSync,readFileSync,rmSync,statSync,writeFileSync,existsSync} from 'node:fs';
import {basename,extname,join,resolve,sep} from 'node:path';

// Export XCTest attachments through a private staging directory. Cleanup is
// limited to that directory and output files recorded in its own index.json.
const screenshotExtensions=new Set(['.png','.jpg','.jpeg','.heic']);

function usage(){
  console.log(`用法: node scripts/export-ui-screenshots.mjs [选项]

  --xcresult <path|latest>  结果包路径，默认 build/SourceUITests.xcresult（不存在则取最新）
  --match <子串>            按附件可读名过滤，可重复；默认导出全部截图
  --output <目录>           导出目录，默认 build/ui-screenshots
  --clean                   只删除该导出目录 index.json 中记录的旧产物
  --list                    仅列出匹配的附件，不复制`);
}

function parseArguments(argv){
  const options={xcresult:'latest',matches:[],output:'build/ui-screenshots',clean:false,list:false};
  for(let index=0;index<argv.length;index++){
    const argument=argv[index];
    if(argument==='--xcresult')options.xcresult=argv[++index]??'latest';
    else if(argument==='--match'){const value=argv[++index];if(value)options.matches.push(value);}
    else if(argument==='--output')options.output=argv[++index]??options.output;
    else if(argument==='--clean')options.clean=true;
    else if(argument==='--list')options.list=true;
    else if(argument==='--help'||argument==='-h'){usage();process.exit(0);}
    else throw new Error(`未知参数: ${argument}`);
  }
  return options;
}

function safeName(value,fallback){
  const trimmed=(value??'').normalize('NFKC').replace(/[\\/:*?"<>|\s]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  const base=trimmed.slice(0,80)||fallback;
  return base;
}

function cleanPrevious(outputDirectory){
  const index=join(outputDirectory,'index.json');
  if(!existsSync(index))return 0;
  let previous;
  try { previous=JSON.parse(readFileSync(index,'utf8')); } catch { return 0; }
  const root=resolve(outputDirectory)+sep;let removed=0;
  for(const file of previous.files??[]){
    const target=resolve(outputDirectory,file.exported??'');
    if(!target.startsWith(root))continue;
    if(existsSync(target)){rmSync(target,{force:true});removed++;}
  }
  return removed;
}

// Mirror scripts/environment.sh: the local toolchain lives in ../Tools/Xcode,
// so a bare `xcrun` cannot find xcresulttool until that DEVELOPER_DIR is set.
function toolchainEnvironment(){
  const environment={...process.env};
  if(environment.DEVELOPER_DIR)return environment;
  const local=resolve('..','Tools','Xcode','Xcode.app','Contents','Developer');
  if(existsSync(join(local,'usr','bin','xcresulttool')))environment.DEVELOPER_DIR=local;
  return environment;
}

// `build/SourceUITests.xcresult` is sometimes a truncated stub next to the real
// timestamped bundle, so walk candidates newest-first until one yields matches.
function candidateBundles(selection){
  if(selection!=='latest')return [resolve(selection)];
  return readdirSync('build',{withFileTypes:true})
    .filter(entry=>entry.isDirectory()&&entry.name.endsWith('.xcresult'))
    .map(entry=>join('build',entry.name))
    .sort((left,right)=>statSync(right).mtimeMs-statSync(left).mtimeMs)
    .map(path=>resolve(path));
}

function attachmentsIn(resultBundle,staging,wanted){
  execFileSync('xcrun',['xcresulttool','export','attachments','--path',resultBundle,'--output-path',staging],{stdio:'pipe',timeout:300000,env:toolchainEnvironment()});
  const manifestPath=join(staging,'manifest.json');
  const manifest=existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath,'utf8')):[];
  const attachments=[];
  for(const test of manifest){
    for(const attachment of test.attachments??[]){
      const file=attachment.exportedFileName;
      if(!file)continue;
      const source=join(staging,file);
      if(!existsSync(source))continue;
      if(!screenshotExtensions.has(extname(file).toLowerCase()))continue;
      const readable=attachment.suggestedHumanReadableName??'';
      if(wanted.length&&!wanted.some(value=>readable.toLowerCase().includes(value)||file.toLowerCase().includes(value)))continue;
      attachments.push({file,source,readable,test:test.testIdentifier??''});
    }
  }
  return attachments;
}

const options=parseArguments(process.argv.slice(2));
const outputDirectory=resolve(options.output);
const staging=mkdtempSync(join(resolve('build'),'ui-screenshot-staging-'));

try {
  const wanted=options.matches.map(value=>value.toLowerCase());
  let resultBundle,attachments=[];
  for(const candidate of candidateBundles(options.xcresult)){
    if(!existsSync(candidate))continue;
    rmSync(staging,{recursive:true,force:true});mkdirSync(staging,{recursive:true});
    try { attachments=attachmentsIn(candidate,staging,wanted); } catch { attachments=[]; }
    if(attachments.length){resultBundle=candidate;break;}
  }
  if(!attachments.length)throw new Error(`没有匹配的截图附件（--match ${JSON.stringify(options.matches)}）`);
  if(options.list){
    for(const attachment of attachments)console.log(`${attachment.readable||basename(attachment.file)}  <-  ${attachment.file}`);
  } else {
    const removed=options.clean?cleanPrevious(outputDirectory):0;
    mkdirSync(outputDirectory,{recursive:true});
    const files=[];const used=new Set();
    for(const [index,attachment] of attachments.entries()){
      const extension=extname(attachment.file).toLowerCase();
      // Xcode appends `_<index>_<UUID>` to suggested names; keep the readable part.
      const label=(attachment.readable||'').replace(/\.[A-Za-z0-9]+$/,'').replace(/_\d+_[0-9A-F-]{36}$/i,'');
      let name=`${String(index+1).padStart(3,'0')}-${safeName(label,basename(attachment.file,extension))}${extension}`;
      while(used.has(name))name=name.replace(extension,`-${index}${extension}`);
      used.add(name);
      copyFileSync(attachment.source,join(outputDirectory,name));
      files.push({exported:name,attachment:attachment.file,readable:attachment.readable,test:attachment.test,bytes:statSync(join(outputDirectory,name)).size});
    }
    writeFileSync(join(outputDirectory,'index.json'),JSON.stringify({resultBundle,files},null,2)+'\n');
    console.log(`导出 ${files.length} 张截图 -> ${outputDirectory}`);
    if(removed)console.log(`清理旧产物 ${removed} 个`);
    for(const file of files)console.log(`  ${file.exported}`);
  }
} finally {
  // Only this run's private staging copy is disposable.
  rmSync(staging,{recursive:true,force:true});
}
