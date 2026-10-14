export function abortError(): Error { const error = new Error('操作已取消'); error.name = 'AbortError'; return error; }
export function throwIfAborted(signal: AbortSignal): void { if (signal.aborted) throw abortError(); }
export class DeadlineError extends Error { constructor() { super('请求超时'); this.name = 'DeadlineError'; } }

// The race rejects even when a transport ignores AbortSignal; late completion
// has a rejection handler and cannot update caller state.
export function bounded<T>(run: (signal: AbortSignal) => Promise<T>, parent: AbortSignal, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    if (parent.aborted) { reject(abortError()); return; }
    const child = new AbortController();
    let settled = false;
    const finish = (value: T | undefined, error?: unknown) => {
      if (settled) return;
      settled = true; clearTimeout(timer); parent.removeEventListener('abort', cancel);
      if (error !== undefined) reject(error); else resolve(value as T);
    };
    const cancel = () => { finish(undefined, abortError()); child.abort(); };
    const timer = setTimeout(() => { finish(undefined, new DeadlineError()); child.abort(); }, timeoutMs);
    parent.addEventListener('abort', cancel, { once: true });
    Promise.resolve().then(() => { throwIfAborted(child.signal); return run(child.signal); }).then(
      value => finish(value), error => finish(undefined, error),
    );
  });
}
