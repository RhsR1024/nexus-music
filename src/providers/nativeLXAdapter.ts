import { abortError, throwIfAborted } from './async.ts';
import { readLXCapabilities } from './lx.ts';
import type { LXTransport } from './multiSourceResolver.ts';
import type { SourceLifecycle } from './sourceRegistry.ts';

interface NativeLX {
  initializeSource(id: string, revision: number, name: string, script: string): Promise<string>;
  requestSource(id: string, revision: number, requestID: string, payload: string): Promise<string>;
  cancelRequest(id: string, revision: number, requestID: string): Promise<void>;
  destroySource(id: string, revision: number): Promise<void>;
}

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
        return readLXCapabilities(JSON.parse(result));
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
