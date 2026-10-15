// Original synthetic MPEG-1 Layer III silent frames and ID3v2.3 tags.
// No downloaded audio, personal metadata or third-party recording.
export function silentMP3(frameCount=80) {
  const frame=(id,body)=>{const head=Buffer.alloc(10);head.write(id);head.writeUInt32BE(body.length,4);return Buffer.concat([head,body]);};
  const text=value=>Buffer.concat([Buffer.from([0]),Buffer.from(value,'latin1')]);
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
  const tags=Buffer.concat([frame('TIT2',text('Synthetic tagged tone')),frame('TPE1',text('Fixture artist')),frame('TALB',text('Fixture album')),frame('USLT',Buffer.concat([Buffer.from([0]),Buffer.from('eng\0[00:00]Synthetic embedded lyric')])),frame('APIC',Buffer.concat([Buffer.from([0]),Buffer.from('image/png\0'),Buffer.from([3,0]),image]))]);
  const header=Buffer.from([73,68,51,3,0,0,(tags.length>>>21)&127,(tags.length>>>14)&127,(tags.length>>>7)&127,tags.length&127]);
  const audio=Buffer.alloc(417);audio.set([0xff,0xfb,0x90,0xc0]);
  return Buffer.concat([header,tags,...Array.from({length:frameCount},()=>audio)]);
}
