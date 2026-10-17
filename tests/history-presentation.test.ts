import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {historyTimestamp} from '../src/domain/historyPresentation.ts';

test('history dates reject unrepresentable timestamps while epoch zero remains a real instant',()=>{
  for(const value of [undefined,NaN,Infinity,-Infinity,-1,8.64e15+1])assert.deepEqual(historyTimestamp(value),{day:'日期未知',clock:'--:--'});
  assert.notEqual(historyTimestamp(0).clock,'--:--');
});
test('history uses local calendar days through midnight, leap day, year change and DST repeats',()=>{
  const samples=['2026-01-01T00:30:00Z','2026-03-08T06:59:00Z','2026-03-08T07:01:00Z','2026-11-01T05:30:00Z','2026-11-01T06:30:00Z','2024-03-01T00:01:00Z'];
  const cases={
    UTC:[['2026-01-01','00:30'],['2026-03-08','06:59'],['2026-03-08','07:01'],['2026-11-01','05:30'],['2026-11-01','06:30'],['2024-03-01','00:01']],
    'Asia/Shanghai':[['2026-01-01','08:30'],['2026-03-08','14:59'],['2026-03-08','15:01'],['2026-11-01','13:30'],['2026-11-01','14:30'],['2024-03-01','08:01']],
    'America/New_York':[['2025-12-31','19:30'],['2026-03-08','01:59'],['2026-03-08','03:01'],['2026-11-01','01:30'],['2026-11-01','01:30'],['2024-02-29','19:01']],
  };
  const moduleURL=new URL('../src/domain/historyPresentation.ts',import.meta.url).href;
  const script=`import {historyTimestamp} from ${JSON.stringify(moduleURL)};process.stdout.write(JSON.stringify(${JSON.stringify(samples)}.map(value=>historyTimestamp(Date.parse(value)))));`;
  for(const [TZ,expected] of Object.entries(cases)){
    const actual=JSON.parse(execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,TZ,NODE_NO_WARNINGS:'1'}}));
    assert.deepEqual(actual,expected.map(([day,clock])=>({day,clock})),TZ);
  }
});
