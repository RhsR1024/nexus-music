import { bounded } from './async.ts';
export function parseProviderJSON(text: string): unknown {
  // Skip complete JSON string tokens, quote only long integer tokens outside
  // strings. Never round an ID through IEEE754 before mapping it to Track.
  const preserved = text.replace(/"(?:\\.|[^"\\])*"|(^|[\[,:\s])(-?\d{16,})(?=\s*[,}\]]|$)/g,
    (token, prefix: string | undefined, integer: string | undefined) => integer ? `${prefix}"${integer}"` : token);
  return JSON.parse(preserved);
}
export interface HTTPRequest { method?: string; headers?: Readonly<Record<string, string>>; body?: string }
export class HTTPResponseError extends Error {
  readonly status: number;
  constructor(status: number) { super('服务暂时不可用'); this.status=status; }
}
export type HTTPClient = (url: string, request: HTTPRequest, signal: AbortSignal) => Promise<unknown>;
export type TextHTTPClient=(url:string,request:HTTPRequest,signal:AbortSignal)=>Promise<string>;
export const requestText: TextHTTPClient = (url, request, signal) => bounded(async child => {
  const response = await fetch(url, { ...request, signal: child });
  if (!response.ok) throw new HTTPResponseError(response.status);
  const text = await response.text();
  if (text.length > 16 * 1024 * 1024) throw new Error('服务响应过大');
  return text;
}, signal, 12000);
export function queryURL(base: string, params: Readonly<Record<string, unknown>>) {
  const query = Object.entries(params).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&');
  return `${base}${base.includes('?') ? '&' : '?'}${query}`;
}

export const requestJSON:HTTPClient=async(url,request,signal)=>parseProviderJSON(await requestText(url,request,signal));
