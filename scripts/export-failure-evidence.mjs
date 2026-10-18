import {execFileSync} from 'node:child_process';
import {copyFileSync,mkdirSync,mkdtempSync,readdirSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {basename,extname,join,resolve} from 'node:path';

// Keep screenshots and hierarchy text available independently of large videos
// and xcresult archives. The original result bundle remains untouched.
export function exportFailureEvidence(resultPath,testIdentifiers){
  const name=basename(resultPath,'.xcresult');
  const raw=resolve('build/failure-exports',name),output=resolve('build/failure-evidence',name);
  mkdirSync(raw,{recursive:true});mkdirSync(output,{recursive:true});
  let total=0;
  const files=[];
  for(const [index,testIdentifier] of [...new Set(testIdentifiers)].entries()){
    const directory=mkdtempSync(join(raw,`${index}-`)),destination=join(output,String(index));
    mkdirSync(destination,{recursive:true});
    try {
      // A named screenshot taken just before an assertion is not necessarily
      // tagged as a failure attachment. Export the failed test's attachments.
      execFileSync('xcrun',['xcresulttool','export','attachments','--path',resultPath,'--output-path',directory,'--test-id',testIdentifier],{stdio:'pipe',timeout:60000});
      for(const name of readdirSync(directory).sort()){
        const path=join(directory,name),stat=statSync(path);
        const included=stat.isFile()&&['.png','.jpg','.jpeg','.txt','.json'].includes(extname(name).toLowerCase())&&stat.size<=32*1024*1024&&total+stat.size<=128*1024*1024;
        files.push({testIdentifier,name,bytes:stat.size,included});
        if(included){copyFileSync(path,join(destination,name));total+=stat.size;}
      }
    } finally {
      // Only this call's private staging copy is disposable. The original
      // xcresult and the bounded, indexed evidence stay available.
      rmSync(directory,{recursive:true,force:true});
    }
  }
  writeFileSync(join(output,'export-index.json'),JSON.stringify({resultPath,bytes:total,files},null,2)+'\n');
  return output;
}
