import {Directory,File,Paths} from 'expo-file-system';
import * as Font from 'expo-font';
import * as Crypto from 'expo-crypto';
import type {Repository} from './repository.ts';
import {FontCatalog,type ImportedFont} from './fontCatalog.ts';
export {effectiveLyricFont} from './fontCatalog.ts';
export class FontStore extends FontCatalog {
  constructor(repository:Repository){
    const directory=new Directory(Paths.document,'lyric-fonts');
    const file=(font:ImportedFont)=>new File(directory,font.file);
    super(repository,{
      exists:font=>file(font).exists,uri:font=>file(font).uri,
      load:font=>Font.loadAsync({[font.id]:file(font).uri}),
      remove:font=>{const owned=file(font);if(owned.exists)owned.delete();},
      prepare:async(uri,name)=>{
        const source=new File(uri);if(!/\.(ttf|otf)$/i.test(name)||name.length>200||source.size<12||source.size>20*1024*1024)throw new Error('请选择20MB以内的TTF或OTF字体');
        const bytes=await source.bytes(),signature=Array.from(bytes.slice(0,4)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
        if(!['00010000','4f54544f','74727565'].includes(signature))throw new Error('字体格式无效');
        const digest=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,await source.base64()),id=`nexusfont_${digest}`,font={id,name,file:`${id}.font`};
        directory.create({idempotent:true,intermediates:true});if(!file(font).exists)source.copy(file(font));return font;
      },
    });
  }
}
