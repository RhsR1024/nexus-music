import { abortError, throwIfAborted } from './async.ts';
import { readLXInitialize } from './lx.ts';
import type { LXTransport } from './multiSourceResolver.ts';
import type { SourceLifecycle } from './sourceRegistry.ts';

interface NativeLX {
  initializeSource(id: string, revision: number, name: string, script: string): Promise<string>;
  requestSource(id: string, revision: number, requestID: string, payload: string): Promise<string>;
  cancelRequest(id: string, revision: number, requestID: string): Promise<void>;
  destroySource(id: string, revision: number): Promise<void>;
}
export interface NativeDiagnosticLX {
  initializeHealthSource(id:string,name:string,script:string):Promise<string>;
  requestHealthSource(id:string,requestID:string,payload:string):Promise<string>;
  cancelHealthRequest(id:string,requestID:string):Promise<void>;
  destroyHealthSource(id:string):Promise<void>;
}
export function createNativeDiagnosticLX(native:NativeDiagnosticLX){return createNativeLX({
  initializeSource:(id,_revision,name,script)=>native.initializeHealthSource(id,name,script),
  requestSource:(id,_revision,requestID,payload)=>native.requestHealthSource(id,requestID,payload),
  cancelRequest:(id,_revision,requestID)=>native.cancelHealthRequest(id,requestID),
  destroySource:(id)=>native.destroyHealthSource(id),
});}

// Dependency injection keeps the transport contract executable without RN.
export function createNativeLX(native: NativeLX): SourceLifecycle & LXTransport {
  let sequence = 0;
  return {
    async initialize(source, revision, signal) {
      throwIfAborted(signal);
      const cancel = () => { void native.destroySource(source.id, revision).catch(() => {}); };
      signal.addEventListener('abort', cancel, { once: true });
      try {
        const result = await native.initializeSource(source.id, revision, source.name, source.script);
        throwIfAborted(signal);
        return readLXInitialize(result);
      } finally { signal.removeEventListener('abort', cancel); }
    },
    destroy(id, revision) { void native.destroySource(id, revision).catch(() => {}); },
    async request(source, payload, signal) {
      throwIfAborted(signal);
      const requestID = `${source.revision}:${++sequence}`;
      let cancel!: () => void;
      const cancelled = new Promise<never>((_, reject) => {
        cancel = () => {
          void native.cancelRequest(source.id, source.revision, requestID).catch(() => {});
          reject(abortError());
        };
      });
      signal.addEventListener('abort', cancel, { once: true });
      try {
        const result = await Promise.race([native.requestSource(source.id, source.revision, requestID, JSON.stringify(payload)), cancelled]);
        throwIfAborted(signal);
        return JSON.parse(result) as unknown;
      } finally { signal.removeEventListener('abort', cancel); }
    },
  };
}
