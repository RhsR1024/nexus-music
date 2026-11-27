// DLNA LAN Discovery + UPnP AVTransport / RenderingControl SOAP Casting Controller (Item #3).
import type { Track } from '../domain/track.ts';
import type { Repository } from '../storage/repository.ts';

export interface SsdpHit {
  readonly location: string;
  readonly usn: string;
  readonly st?: string;
  readonly server?: string;
}

export interface DlnaDevice {
  readonly id: string;
  readonly location: string;
  readonly friendlyName: string;
  readonly manufacturer?: string;
  readonly modelName?: string;
  readonly avTransportControlUrl: string;
  readonly renderingControlUrl?: string;
  readonly lastSeenAt: number;
}

export interface DlnaPositionInfo {
  readonly positionSec: number;
  readonly durationSec: number;
  readonly transportState: 'PLAYING' | 'PAUSED_PLAYBACK' | 'STOPPED' | 'TRANSITIONING' | 'UNKNOWN';
}

export interface DlnaCastState {
  readonly discovering: boolean;
  readonly devices: readonly DlnaDevice[];
  readonly recent: readonly DlnaDevice[];
  readonly activeDevice: DlnaDevice | null;
  readonly activeTrack: Track | null;
  readonly transportState: DlnaPositionInfo['transportState'];
  readonly positionSec: number;
  readonly durationSec: number;
  readonly volume: number;
  readonly busy: boolean;
  readonly error: string;
}

export interface DlnaNativeBridge {
  dlnaDiscover(timeoutMs: number): Promise<readonly SsdpHit[]>;
  dlnaStartRelay(sourceUrl: string, headersJSON: string): Promise<{ url: string; host: string; port: string }>;
  dlnaStopRelay(): Promise<void>;
  dlnaSetKeepAlive(enabled: boolean): Promise<void>;
}

export type DlnaHttpFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

const STORAGE_KEY = 'dlna.v1';
const AV_TRANSPORT_NS = 'urn:schemas-upnp-org:service:AVTransport:1';
const RENDERING_CONTROL_NS = 'urn:schemas-upnp-org:service:RenderingControl:1';

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function xmlTag(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tag}>`, 'i');
  const m = re.exec(xml);
  return m?.[1] ? unescapeXml(m[1].trim()) : undefined;
}

export function resolveControlUrl(baseLocation: string, controlPath: string): string | undefined {
  const trimmed = controlPath.trim();
  if (!trimmed) return undefined;
  try {
    const resolved = new URL(trimmed, baseLocation);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return undefined;
    return resolved.toString();
  } catch {
    return undefined;
  }
}

export function parseUpnpDeviceDescription(
  location: string,
  xml: string,
  now = Date.now(),
): DlnaDevice | null {
  const serviceRegex = /<service\b[^>]*>([\s\S]*?)<\/service>/gi;
  let avTransportControlUrl: string | undefined;
  let renderingControlUrl: string | undefined;

  let m: RegExpExecArray | null;
  while ((m = serviceRegex.exec(xml)) !== null) {
    const block = m[1] ?? '';
    const serviceType = xmlTag(block, 'serviceType') ?? '';
    const controlURL = xmlTag(block, 'controlURL') ?? '';
    if (!controlURL) continue;
    if (/AVTransport/i.test(serviceType) && !avTransportControlUrl) {
      avTransportControlUrl = resolveControlUrl(location, controlURL);
    } else if (/RenderingControl/i.test(serviceType) && !renderingControlUrl) {
      renderingControlUrl = resolveControlUrl(location, controlURL);
    }
  }
  if (!avTransportControlUrl) return null;

  const udn = xmlTag(xml, 'UDN') || location;
  const friendlyName = xmlTag(xml, 'friendlyName') || new URL(location).hostname;
  const manufacturer = xmlTag(xml, 'manufacturer');
  const modelName = xmlTag(xml, 'modelName');

  return {
    id: udn,
    location,
    friendlyName,
    ...(manufacturer ? { manufacturer } : {}),
    ...(modelName ? { modelName } : {}),
    avTransportControlUrl,
    ...(renderingControlUrl ? { renderingControlUrl } : {}),
    lastSeenAt: now,
  };
}

export function formatUpnpTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function parseUpnpTime(value?: string): number {
  if (!value) return 0;
  const m = /^(\d+):(\d{1,2}):(\d{1,2})(?:\.\d+)?$/.exec(value.trim());
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

export function buildDidlLiteMetadata(mediaUrl: string, track: Track): string {
  const title = escapeXml(track.title || '未知曲目');
  const artist = escapeXml(track.artist || '未知歌手');
  const album = escapeXml(track.album || '');
  const artwork = track.artwork && /^https?:\/\//i.test(track.artwork) ? escapeXml(track.artwork) : '';
  const url = escapeXml(mediaUrl);
  const protocolInfo = 'http-get:*:audio/mpeg:*';
  return (
    '<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
    'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">' +
    '<item id="0" parentID="-1" restricted="1">' +
    `<dc:title>${title}</dc:title>` +
    `<upnp:artist>${artist}</upnp:artist>` +
    (album ? `<upnp:album>${album}</upnp:album>` : '') +
    (artwork ? `<upnp:albumArtURI>${artwork}</upnp:albumArtURI>` : '') +
    '<upnp:class>object.item.audioItem.musicTrack</upnp:class>' +
    `<res protocolInfo="${protocolInfo}">${url}</res>` +
    '</item></DIDL-Lite>'
  );
}

export function buildSoapEnvelope(serviceNs: string, action: string, bodyInnerXml: string): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ' +
    's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
    `<s:Body><u:${action} xmlns:u="${serviceNs}">${bodyInnerXml}</u:${action}></s:Body>` +
    '</s:Envelope>'
  );
}

const initialState: DlnaCastState = {
  discovering: false,
  devices: [],
  recent: [],
  activeDevice: null,
  activeTrack: null,
  transportState: 'UNKNOWN',
  positionSec: 0,
  durationSec: 0,
  volume: 50,
  busy: false,
  error: '',
};

export class DlnaCastController {
  private state: DlnaCastState = initialState;
  private listeners = new Set<() => void>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private native: DlnaNativeBridge | null;
  private repo?: Pick<Repository, 'get' | 'put'>;
  private http: DlnaHttpFetch;

  constructor(deps: {
    native: DlnaNativeBridge | null;
    repository?: Pick<Repository, 'get' | 'put'>;
    http?: DlnaHttpFetch;
  }) {
    this.native = deps.native;
    this.repo = deps.repository;
    this.http =
      deps.http ??
      ((url, init) =>
        fetch(url, init).then(r => ({
          ok: r.ok,
          status: r.status,
          text: () => r.text(),
        })));
  }

  getSnapshot = (): DlnaCastState => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private setState(patch: Partial<DlnaCastState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  async restore(): Promise<void> {
    if (!this.repo) return;
    try {
      const saved = await this.repo.get<{ version?: number; recent?: DlnaDevice[] }>(STORAGE_KEY);
      if (saved && Array.isArray(saved.recent)) {
        const clean = saved.recent.filter(d => d && typeof d.avTransportControlUrl === 'string' && typeof d.friendlyName === 'string').slice(0, 12);
        this.setState({ recent: clean });
      }
    } catch {}
  }

  private async rememberDevice(device: DlnaDevice) {
    const next = [device, ...this.state.recent.filter(d => d.id !== device.id)].slice(0, 12);
    this.setState({ recent: next });
    if (this.repo) {
      await this.repo.put(STORAGE_KEY, { version: 1, recent: next }).catch(() => {});
    }
  }

  async discover(timeoutMs = 3000): Promise<readonly DlnaDevice[]> {
    if (!this.native) {
      this.setState({ error: '当前环境不支持原生局域网 DLNA 发现' });
      return [];
    }
    this.setState({ discovering: true, error: '' });
    try {
      const hits = await this.native.dlnaDiscover(timeoutMs);
      const parsed = await Promise.all(
        hits.map(async hit => {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 3500);
            try {
              const res = await this.http(hit.location, { method: 'GET', signal: ctrl.signal });
              if (!res.ok) return null;
              const xml = await res.text();
              return parseUpnpDeviceDescription(hit.location, xml);
            } finally {
              clearTimeout(timer);
            }
          } catch {
            return null;
          }
        }),
      );
      const unique = new Map<string, DlnaDevice>();
      for (const dev of parsed) {
        if (dev && !unique.has(dev.id)) unique.set(dev.id, dev);
      }
      const list = [...unique.values()];
      this.setState({
        discovering: false,
        devices: list,
        error: list.length === 0 ? '未发现支持 DLNA 的电视或音箱，请确认与手机在同一 Wi-Fi' : '',
      });
      return list;
    } catch (err) {
      this.setState({
        discovering: false,
        error: err instanceof Error ? err.message : '局域网扫描失败',
      });
      return [];
    }
  }

  private async soap(controlUrl: string, serviceNs: string, action: string, innerXml: string): Promise<string> {
    const body = buildSoapEnvelope(serviceNs, action, innerXml);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await this.http(controlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          SOAPACTION: `"${serviceNs}#${action}"`,
        },
        body,
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`DLNA 指令 ${action} 失败 (HTTP ${res.status})`);
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  async castTrack(
    device: DlnaDevice,
    sourceUrl: string,
    track: Track,
    headers?: Readonly<Record<string, string>>,
  ): Promise<void> {
    this.setState({ busy: true, error: '' });
    try {
      let targetUrl = sourceUrl;
      const needsRelay =
        sourceUrl.startsWith('file://') ||
        (headers !== undefined && Object.keys(headers).length > 0);
      if (needsRelay && this.native) {
        const relay = await this.native.dlnaStartRelay(sourceUrl, JSON.stringify(headers ?? {}));
        targetUrl = relay.url;
      }
      const didl = buildDidlLiteMetadata(targetUrl, track);
      await this.soap(
        device.avTransportControlUrl,
        AV_TRANSPORT_NS,
        'SetAVTransportURI',
        `<InstanceID>0</InstanceID><CurrentURI>${escapeXml(targetUrl)}</CurrentURI><CurrentURIMetaData>${escapeXml(didl)}</CurrentURIMetaData>`,
      );
      await this.soap(
        device.avTransportControlUrl,
        AV_TRANSPORT_NS,
        'Play',
        '<InstanceID>0</InstanceID><Speed>1</Speed>',
      );
      await this.native?.dlnaSetKeepAlive(true).catch(() => {});
      await this.rememberDevice(device);
      this.setState({
        busy: false,
        activeDevice: device,
        activeTrack: track,
        transportState: 'PLAYING',
        positionSec: 0,
        durationSec: Math.round((track.durationMs ?? 0) / 1000),
      });
      this.startPolling();
      void this.refreshStatus();
    } catch (err) {
      this.setState({
        busy: false,
        error: err instanceof Error ? err.message : '投屏启动失败，请确认设备在线',
      });
      throw err;
    }
  }

  async play(): Promise<void> {
    const dev = this.state.activeDevice;
    if (!dev) return;
    await this.soap(dev.avTransportControlUrl, AV_TRANSPORT_NS, 'Play', '<InstanceID>0</InstanceID><Speed>1</Speed>');
    this.setState({ transportState: 'PLAYING' });
  }

  async pause(): Promise<void> {
    const dev = this.state.activeDevice;
    if (!dev) return;
    await this.soap(dev.avTransportControlUrl, AV_TRANSPORT_NS, 'Pause', '<InstanceID>0</InstanceID>');
    this.setState({ transportState: 'PAUSED_PLAYBACK' });
  }

  async seek(seconds: number): Promise<void> {
    const dev = this.state.activeDevice;
    if (!dev) return;
    const clamped = Math.max(0, seconds);
    await this.soap(
      dev.avTransportControlUrl,
      AV_TRANSPORT_NS,
      'Seek',
      `<InstanceID>0</InstanceID><Unit>REL_TIME</Unit><Target>${formatUpnpTime(clamped)}</Target>`,
    );
    this.setState({ positionSec: clamped });
  }

  async setVolume(percent: number): Promise<void> {
    const dev = this.state.activeDevice;
    if (!dev?.renderingControlUrl) return;
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    await this.soap(
      dev.renderingControlUrl,
      RENDERING_CONTROL_NS,
      'SetVolume',
      `<InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>${clamped}</DesiredVolume>`,
    );
    this.setState({ volume: clamped });
  }

  async refreshStatus(): Promise<void> {
    const dev = this.state.activeDevice;
    if (!dev) return;
    try {
      const [posXml, transXml] = await Promise.all([
        this.soap(dev.avTransportControlUrl, AV_TRANSPORT_NS, 'GetPositionInfo', '<InstanceID>0</InstanceID>'),
        this.soap(dev.avTransportControlUrl, AV_TRANSPORT_NS, 'GetTransportInfo', '<InstanceID>0</InstanceID>'),
      ]);
      const pos = parseUpnpTime(xmlTag(posXml, 'RelTime'));
      const dur = parseUpnpTime(xmlTag(posXml, 'TrackDuration'));
      const rawState = (xmlTag(transXml, 'CurrentTransportState') ?? '').toUpperCase();
      const transportState: DlnaPositionInfo['transportState'] =
        rawState === 'PLAYING' || rawState === 'PAUSED_PLAYBACK' || rawState === 'STOPPED' || rawState === 'TRANSITIONING'
          ? rawState
          : 'UNKNOWN';

      let volume = this.state.volume;
      if (dev.renderingControlUrl) {
        try {
          const volXml = await this.soap(
            dev.renderingControlUrl,
            RENDERING_CONTROL_NS,
            'GetVolume',
            '<InstanceID>0</InstanceID><Channel>Master</Channel>',
          );
          const parsedVol = Number(xmlTag(volXml, 'CurrentVolume'));
          if (Number.isFinite(parsedVol)) volume = Math.max(0, Math.min(100, Math.round(parsedVol)));
        } catch {}
      }
      this.setState({
        positionSec: pos,
        durationSec: dur > 0 ? dur : this.state.durationSec,
        transportState,
        volume,
      });
    } catch {}
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    const dev = this.state.activeDevice;
    if (dev) {
      await this.soap(dev.avTransportControlUrl, AV_TRANSPORT_NS, 'Stop', '<InstanceID>0</InstanceID>').catch(() => {});
    }
    await this.native?.dlnaStopRelay().catch(() => {});
    await this.native?.dlnaSetKeepAlive(false).catch(() => {});
    this.setState({
      activeDevice: null,
      activeTrack: null,
      transportState: 'STOPPED',
      positionSec: 0,
      durationSec: 0,
      error: '',
    });
  }

  private startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      if (this.state.activeDevice) void this.refreshStatus();
    }, 2500);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
