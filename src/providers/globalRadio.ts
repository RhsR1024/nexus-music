// Public Radio Browser API client + persisted favorites/recent store for Global Radio.
// Station directory: https://www.radio-browser.info/ (open community directory).
import type { Track } from '../domain/track.ts';
import type { Repository } from '../storage/repository.ts';
import { safePublicURL } from '../storage/cleanTrack.ts';
import { queryURL, requestJSON, type HTTPClient } from './http.ts';
import { EARTH_BLUE_MARBLE_DATA_URI } from './earthTexture.ts';

type Row = Record<string, unknown>;
const row = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {});
const text = (v: unknown) =>
  typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';

const RADIO_BROWSER_MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
] as const;

export interface RadioStation {
  readonly uuid: string;
  readonly name: string;
  readonly streamUrl: string;
  readonly country: string;
  readonly countryCode: string;
  readonly state: string;
  readonly language: string;
  readonly tags: readonly string[];
  readonly codec: string;
  readonly bitrate: number;
  readonly favicon?: string;
  readonly homepage?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly votes: number;
}

export interface RadioFacet {
  readonly name: string;
  readonly value: string;
  readonly stationCount: number;
}

export interface RadioSearchFilter {
  readonly name?: string;
  readonly countryCode?: string;
  readonly state?: string;
  readonly language?: string;
  readonly tag?: string;
  readonly codec?: string;
  readonly hasGeoInfo?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export function validRadioStreamURL(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function stationToTrack(station: RadioStation): Track {
  const location = [station.country, station.state].filter(Boolean).join(' · ') || '全球电台';
  const tech = [station.codec, station.bitrate > 0 ? `${station.bitrate} kbps` : ''].filter(Boolean).join(' · ');
  return {
    origin: { kind: 'radio', id: station.uuid },
    title: station.name,
    artist: location,
    ...(tech ? { album: tech } : {}),
    ...(station.favicon ? { artwork: station.favicon } : {}),
    metadata: {
      isRadio: true,
      streamUrl: station.streamUrl,
      country: station.country,
      countryCode: station.countryCode,
      codec: station.codec,
      bitrate: station.bitrate,
      ...(station.lat !== undefined ? { geoLat: station.lat } : {}),
      ...(station.lng !== undefined ? { geoLng: station.lng } : {}),
    },
    qualities: [],
  };
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export class GlobalRadioApi {
  private readonly http: HTTPClient;
  private preferredMirror = 0;

  constructor(options: { http?: HTTPClient } = {}) {
    this.http = options.http ?? requestJSON;
  }

  private async request(path: string, params: Record<string, string | number | boolean | undefined>, signal: AbortSignal): Promise<unknown> {
    const queryParams: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === '') continue;
      queryParams[k] = typeof v === 'boolean' ? String(v) : v;
    }
    let lastError: unknown;
    for (let attempt = 0; attempt < RADIO_BROWSER_MIRRORS.length; attempt++) {
      const idx = (this.preferredMirror + attempt) % RADIO_BROWSER_MIRRORS.length;
      const base = RADIO_BROWSER_MIRRORS[idx]!;
      const url = queryURL(`${base}${path}`, queryParams);
      try {
        const res = await this.http(
          url,
          {
            method: 'GET',
            credentials: 'omit',
            headers: {
              Accept: 'application/json',
              'User-Agent': 'NexusMusic/1.0 (GlobalRadio)',
            },
          },
          signal,
        );
        this.preferredMirror = idx;
        return res;
      } catch (err) {
        if (signal.aborted) throw err;
        lastError = err;
      }
    }
    throw lastError ?? new Error('全球电台目录暂不可用，请稍后重试');
  }

  async search(filter: RadioSearchFilter, signal: AbortSignal): Promise<readonly RadioStation[]> {
    const raw = await this.request(
      '/json/stations/search',
      {
        name: filter.name?.trim(),
        countrycode: filter.countryCode?.trim().toUpperCase(),
        state: filter.state?.trim(),
        language: filter.language?.trim(),
        tag: filter.tag?.trim(),
        codec: filter.codec?.trim(),
        has_geo_info: filter.hasGeoInfo ? true : undefined,
        hidebroken: true,
        order: 'clickcount',
        reverse: true,
        limit: Math.min(200, Math.max(10, filter.limit ?? 80)),
        offset: Math.max(0, filter.offset ?? 0),
      },
      signal,
    );
    if (!Array.isArray(raw)) throw new Error('电台列表响应无效');
    const seen = new Set<string>();
    const healthy: RadioStation[] = [];
    const fallback: RadioStation[] = [];
    for (const entry of raw) {
      const v = row(entry);
      const uuid = text(v.stationuuid).trim();
      const name = text(v.name).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 140);
      const streamUrl = validRadioStreamURL(text(v.url_resolved || v.url));
      if (!uuid || !name || !streamUrl || seen.has(uuid)) continue;
      seen.add(uuid);
      const favRaw = text(v.favicon).trim();
      const favicon = favRaw && safePublicURL(favRaw) ? favRaw : undefined;
      const homeRaw = text(v.homepage).trim();
      const homepage = homeRaw && safePublicURL(homeRaw) ? homeRaw : undefined;
      const latNum = typeof v.geo_lat === 'number' ? v.geo_lat : Number(v.geo_lat);
      const lngNum = typeof v.geo_long === 'number' ? v.geo_long : Number(v.geo_long);
      const hasGeo =
        v.geo_lat !== null &&
        v.geo_lat !== undefined &&
        v.geo_lat !== '' &&
        v.geo_long !== null &&
        v.geo_long !== undefined &&
        v.geo_long !== '' &&
        Number.isFinite(latNum) &&
        Number.isFinite(lngNum) &&
        Math.abs(latNum) <= 90 &&
        Math.abs(lngNum) <= 180;
      const tags = text(v.tags)
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
        .slice(0, 6);
      const station: RadioStation = {
        uuid,
        name,
        streamUrl,
        country: text(v.country).trim().slice(0, 80),
        countryCode: text(v.countrycode).trim().toUpperCase().slice(0, 4),
        state: text(v.state).trim().slice(0, 80),
        language: text(v.language).trim().slice(0, 60),
        tags,
        codec: text(v.codec).trim().toUpperCase().slice(0, 16) || 'STREAM',
        bitrate: Math.max(0, Math.floor(Number(v.bitrate) || 0)),
        ...(favicon ? { favicon } : {}),
        ...(homepage ? { homepage } : {}),
        ...(hasGeo ? { lat: latNum, lng: lngNum } : {}),
        votes: Math.max(0, Math.floor(Number(v.votes) || 0)),
      };
      // Prioritize HTTPS and recently health-checked stations so playback succeeds on first tap
      const ok = v.lastcheckok === undefined || v.lastcheckok === 1 || v.lastcheckok === '1' || v.lastcheckok === true;
      if (ok && streamUrl.startsWith('https://')) healthy.push(station);
      else if (ok) fallback.push(station);
    }
    return [...healthy, ...fallback];
  }

  async facets(
    kind: 'countries' | 'states' | 'languages' | 'tags' | 'codecs',
    signal: AbortSignal,
    country?: string,
  ): Promise<readonly RadioFacet[]> {
    const path =
      kind === 'states' && country
        ? `/json/states/${encodeURIComponent(country)}`
        : `/json/${kind}`;
    const raw = await this.request(path, { order: 'stationcount', reverse: true, hidebroken: true, limit: 80 }, signal);
    if (!Array.isArray(raw)) return [];
    const out: RadioFacet[] = [];
    for (const entry of raw) {
      const v = row(entry);
      const name = text(v.name).trim();
      const stationCount = Math.floor(Number(v.stationcount) || 0);
      if (!name || stationCount <= 0) continue;
      const value = kind === 'countries' ? text(v.iso_3166_1).trim().toUpperCase() || name : name;
      out.push({ name, value, stationCount });
    }
    return out.slice(0, 60);
  }

  async reportClick(uuid: string, signal: AbortSignal): Promise<void> {
    if (!/^[A-Za-z0-9-]{8,64}$/.test(uuid)) return;
    try {
      await this.request(`/json/url/${encodeURIComponent(uuid)}`, {}, signal);
    } catch {}
  }
}

export interface GlobalRadioSnapshot {
  readonly favorites: readonly RadioStation[];
  readonly recent: readonly RadioStation[];
}

export class GlobalRadioStore {
  private readonly repository: Pick<Repository, 'get' | 'put'>;
  private snapshot: GlobalRadioSnapshot = { favorites: [], recent: [] };
  private readonly listeners = new Set<() => void>();

  constructor(repository: Pick<Repository, 'get' | 'put'>) {
    this.repository = repository;
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(next: GlobalRadioSnapshot) {
    this.snapshot = next;
    for (const l of this.listeners) l();
  }

  async restore() {
    const saved = await this.repository.get<GlobalRadioSnapshot>('radio.v1');
    if (saved && Array.isArray(saved.favorites) && Array.isArray(saved.recent)) {
      this.publish({
        favorites: saved.favorites.filter(s => s && typeof s.uuid === 'string' && validRadioStreamURL(s.streamUrl)).slice(0, 120),
        recent: saved.recent.filter(s => s && typeof s.uuid === 'string' && validRadioStreamURL(s.streamUrl)).slice(0, 60),
      });
    }
  }

  isFavorite(uuid: string) {
    return this.snapshot.favorites.some(s => s.uuid === uuid);
  }

  async toggleFavorite(station: RadioStation) {
    const exists = this.isFavorite(station.uuid);
    const favorites = exists
      ? this.snapshot.favorites.filter(s => s.uuid !== station.uuid)
      : [station, ...this.snapshot.favorites].slice(0, 120);
    const next = { ...this.snapshot, favorites };
    await this.repository.put('radio.v1', next);
    this.publish(next);
  }

  async recordRecent(station: RadioStation) {
    const recent = [station, ...this.snapshot.recent.filter(s => s.uuid !== station.uuid)].slice(0, 60);
    const next = { ...this.snapshot, recent };
    await this.repository.put('radio.v1', next);
    this.publish(next);
  }
}

/**
 * Self-contained offline photorealistic NASA Blue Marble 3D Earth renderer.
 * Uses NASA Visible Earth satellite imagery (Public Domain) mapped onto a
 * hardware-accelerated WebGL ray-traced sphere with ocean specular reflection,
 * drifting animated cloud layer, Rayleigh atmospheric Fresnel limb/halo,
 * starfield, interactive glowing station markers, inertial spin & pinch zoom.
 */
export const RADIO_GLOBE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#07121E;touch-action:none;user-select:none;-webkit-user-select:none}
  canvas{position:fixed;inset:0;width:100%;height:100%;display:block}
</style>
</head>
<body>
<canvas id="gl"></canvas>
<canvas id="ov"></canvas>
<script>
(function(){
  var TEX_SRC = "${EARTH_BLUE_MARBLE_DATA_URI}";
  var glc = document.getElementById('gl');
  var ovc = document.getElementById('ov');
  var octx = ovc.getContext('2d');
  var W = 320, H = 260, DPR = Math.min(window.devicePixelRatio || 2, 2.5);
  var rotLng = 104 * Math.PI / 180;
  var rotLat = 22 * Math.PI / 180;
  var targetLng = rotLng, targetLat = rotLat;
  var velLng = 0, velLat = 0;
  var zoom = 1.0, targetZoom = 1.0;
  var points = [], selectedId = '';
  var dragging = false, moved = false, lastX = 0, lastY = 0, pinchDist = 0;
  var autoRotate = true, lastInteract = 0, startTime = performance.now();

  var stars = [];
  for (var i = 0; i < 160; i++) {
    var s = Math.sin(i * 127.1 + 311.7) * 43758.5453; s -= Math.floor(s);
    var t = Math.sin(i * 269.5 + 183.3) * 43758.5453; t -= Math.floor(t);
    var u = Math.sin(i * 419.2 + 71.1) * 43758.5453; u -= Math.floor(u);
    stars.push({ x: s, y: t, r: 0.4 + u * 1.15, p: u * 6.2831, a: 0.25 + u * 0.65 });
  }

  // Load real NASA Blue Marble texture image
  var earthImg = new Image();
  var earthReady = false;
  var gl = glc.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: false }) || glc.getContext('experimental-webgl', { alpha: true, antialias: true });
  var glReady = false, prog = null, earthTex = null, uRes, uRot, uZoom, uTime, uEarth, uHasTex;

  if (gl) {
    var vsSrc = 'attribute vec2 p; varying vec2 v; void main(){ v=p; gl_Position=vec4(p,0.,1.); }';
    var fsSrc = [
      'precision highp float;',
      'varying vec2 v;',
      'uniform vec2 u_res;',
      'uniform vec2 u_rot;',
      'uniform float u_zoom;',
      'uniform float u_time;',
      'uniform sampler2D uEarth;',
      'uniform float u_hasTex;',
      'const float PI = 3.14159265359;',
      'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }',
      'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y); }',
      'float fbm(vec2 p){ float s=0.,a=.5; for(int i=0;i<4;i++){ s+=a*noise(p); p=mat2(.8,-.6,.6,.8)*p*2.05; a*=.5; } return s; }',
      'void main(){',
      '  vec2 uv = (gl_FragCoord.xy - 0.5*u_res) / (min(u_res.x,u_res.y)*0.44*u_zoom);',
      '  float r2 = dot(uv, uv);',
      '  vec3 bg = mix(vec3(0.022,0.055,0.098), vec3(0.036,0.085,0.145), clamp(0.55 - uv.y*0.35, 0., 1.));',
      '  float d = sqrt(max(r2, 1e-5));',
      '  if(r2 > 1.0){',
      '    float halo = exp(-(d - 1.0)*6.2)*0.56 + exp(-(d - 1.0)*18.0)*0.34;',
      '    vec3 atmo = vec3(0.24, 0.64, 1.0) * halo;',
      '    gl_FragColor = vec4(bg + atmo, 1.0);',
      '    return;',
      '  }',
      '  float z = sqrt(max(0.0, 1.0 - r2));',
      '  vec3 n = vec3(uv.x, uv.y, z);',
      '  float ca = cos(u_rot.y), sa = sin(u_rot.y);',
      '  vec3 r1 = vec3(n.x, n.y*ca + n.z*sa, -n.y*sa + n.z*ca);',
      '  float cl = cos(u_rot.x), sl = sin(u_rot.x);',
      '  vec3 w = vec3(r1.x*cl + r1.z*sl, r1.y, -r1.x*sl + r1.z*cl);',
      '  float lat = asin(clamp(w.y, -1.0, 1.0));',
      '  float lng = atan(w.x, w.z);',
      '  vec2 texUV = vec2(fract((lng / (2.0*PI)) + 0.5), clamp(0.5 - lat / PI, 0.002, 0.998));',
      '  vec3 albedo = u_hasTex > 0.5 ? texture2D(uEarth, texUV).rgb : vec3(0.08, 0.22, 0.42);',
      '  // Detect ocean vs land directly from NASA Blue Marble chromatic signature',
      '  float oceanMask = smoothstep(0.02, 0.14, albedo.b - max(albedo.r, albedo.g * 0.96));',
      '  // Rich satellite color boost for crisp Sollin-like globe vibrancy',
      '  albedo = pow(max(albedo, vec3(0.001)), vec3(0.92));',
      '  albedo = mix(albedo * vec3(1.12, 1.08, 1.02), albedo * vec3(0.92, 1.06, 1.24), oceanMask);',
      '  // Subtle drifting translucent cloud wisps',
      '  vec2 cloudUV = vec2(lng*2.3 + u_time*0.008, lat*2.6);',
      '  float cloud = smoothstep(0.56, 0.80, fbm(cloudUV + vec2(fbm(cloudUV*1.7)*0.45, 0.0)));',
      '  // Directional solar lighting + soft hemisphere fill so every continent stays readable',
      '  vec3 sunDir = normalize(vec3(-0.46, 0.36, 0.81));',
      '  float ndl = dot(n, sunDir);',
      '  float diffuse = smoothstep(-0.22, 0.92, ndl);',
      '  float ambient = 0.38;',
      '  vec3 col = albedo * (ambient + 0.82 * diffuse);',
      '  // Crisp solar ocean specular glint',
      '  vec3 halfV = normalize(sunDir + vec3(0., 0., 1.));',
      '  float spec = pow(max(dot(n, halfV), 0.0), 42.0) * oceanMask * smoothstep(0.0, 0.5, ndl) * 0.42;',
      '  col += vec3(0.75, 0.92, 1.0) * spec;',
      '  // Blend drifting sunlit clouds',
      '  col = mix(col, vec3(0.94, 0.97, 1.0) * (0.44 + 0.62*diffuse), cloud * 0.30);',
      '  // Subtle Rayleigh blue atmospheric Fresnel rim',
      '  float rim = pow(1.0 - max(n.z, 0.0), 2.75);',
      '  col += vec3(0.28, 0.68, 1.0) * rim * (0.55 + 0.45 * max(ndl, 0.0));',
      '  // Crisp edge anti-aliasing',
      '  float edge = smoothstep(1.0, 0.985, d);',
      '  vec3 edgeHalo = bg + vec3(0.26, 0.66, 1.0) * 0.72;',
      '  gl_FragColor = vec4(mix(edgeHalo, col, edge), 1.0);',
      '}'
    ].join('\\n');

    function compile(type, src){
      var sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    }
    var vs = compile(gl.VERTEX_SHADER, vsSrc), fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (vs && fs) {
      prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.useProgram(prog);
        var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        uRes = gl.getUniformLocation(prog, 'u_res');
        uRot = gl.getUniformLocation(prog, 'u_rot');
        uZoom = gl.getUniformLocation(prog, 'u_zoom');
        uTime = gl.getUniformLocation(prog, 'u_time');
        uEarth = gl.getUniformLocation(prog, 'uEarth');
        uHasTex = gl.getUniformLocation(prog, 'u_hasTex');
        earthTex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, earthTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([16, 48, 92, 255]));
        gl.uniform1i(uEarth, 0);
        glReady = true;
      }
    }
  }

  earthImg.onload = function(){
    earthReady = true;
    if (gl && glReady && earthTex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, earthTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, earthImg);
    }
  };
  earthImg.src = TEX_SRC;

  function resize(){
    W = window.innerWidth || 320; H = window.innerHeight || 260;
    glc.width = Math.round(W * DPR); glc.height = Math.round(H * DPR);
    ovc.width = Math.round(W * DPR); ovc.height = Math.round(H * DPR);
    octx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (gl && glReady) gl.viewport(0, 0, glc.width, glc.height);
  }
  resize();
  window.addEventListener('resize', resize);

  function project(latDeg, lngDeg){
    var lat = latDeg * Math.PI / 180, lng = lngDeg * Math.PI / 180;
    var cl = Math.cos(lat);
    var wx = cl * Math.sin(lng), wy = Math.sin(lat), wz = cl * Math.cos(lng);
    var cL = Math.cos(-rotLng), sL = Math.sin(-rotLng);
    var x1 = wx * cL + wz * sL, z1 = -wx * sL + wz * cL, y1 = wy;
    var cA = Math.cos(-rotLat), sA = Math.sin(-rotLat);
    var y2 = y1 * cA + z1 * sA, z2 = -y1 * sA + z1 * cA, x2 = x1;
    var R = Math.min(W, H) * 0.44 * zoom;
    return { x: W * 0.5 + x2 * R, y: H * 0.5 - y2 * R, z: z2 };
  }

  function screenToGeo(sx, sy){
    var R = Math.min(W, H) * 0.44 * zoom;
    var nx = (sx - W * 0.5) / R, ny = (H * 0.5 - sy) / R;
    var r2 = nx * nx + ny * ny;
    if (r2 > 1) return null;
    var nz = Math.sqrt(1 - r2);
    var cA = Math.cos(rotLat), sA = Math.sin(rotLat);
    var y1 = ny * cA + nz * sA, z1 = -ny * sA + nz * cA, x1 = nx;
    var cL = Math.cos(rotLng), sL = Math.sin(rotLng);
    var wx = x1 * cL + z1 * sL, wz = -x1 * sL + z1 * cL, wy = y1;
    return { lat: Math.asin(Math.max(-1, Math.min(1, wy))) * 180 / Math.PI, lng: Math.atan2(wx, wz) * 180 / Math.PI };
  }

  function postMsg(obj){
    try {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.RadioGlobe) {
        window.webkit.messageHandlers.RadioGlobe.postMessage(obj);
      } else if (window.RadioGlobeBridge && window.RadioGlobeBridge.postMessage) {
        window.RadioGlobeBridge.postMessage(JSON.stringify(obj));
      }
    } catch(e){}
  }

  function drawOverlay(now){
    octx.clearRect(0, 0, W, H);
    var R = Math.min(W, H) * 0.44 * zoom;
    var cx = W * 0.5, cy = H * 0.5;
    if (!glReady) {
      var bg = octx.createRadialGradient(cx, cy, R * 0.3, cx, cy, Math.max(W, H) * 0.8);
      bg.addColorStop(0, '#0C2236'); bg.addColorStop(1, '#06101B');
      octx.fillStyle = bg; octx.fillRect(0, 0, W, H);
    }
    // Deep-space twinkling stars outside Earth disc
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i], sx = st.x * W, sy = st.y * H;
      var dx = sx - cx, dy = sy - cy;
      if (dx * dx + dy * dy < (R + 3) * (R + 3)) continue;
      var tw = 0.65 + 0.35 * Math.sin(now * 0.0018 + st.p);
      octx.fillStyle = 'rgba(215,238,255,' + (st.a * tw).toFixed(2) + ')';
      octx.beginPath(); octx.arc(sx, sy, st.r, 0, 6.2832); octx.fill();
    }
    // Canvas 2D fallback sphere if WebGL is unavailable
    if (!glReady) {
      octx.save();
      octx.beginPath(); octx.arc(cx, cy, R, 0, 6.2832); octx.clip();
      var og = octx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.08, cx, cy, R);
      og.addColorStop(0, '#1B5A94'); og.addColorStop(0.65, '#0C325C'); og.addColorStop(1, '#061830');
      octx.fillStyle = og; octx.fillRect(cx - R, cy - R, R * 2, R * 2);
      if (earthReady) {
        var shift = ((rotLng / (Math.PI * 2)) % 1 + 1) % 1;
        var imgW = R * 4.2, imgH = R * 2.1;
        var drawX = cx - shift * imgW;
        var drawY = cy - imgH * 0.5 + (rotLat / (Math.PI * 0.5)) * R * 0.55;
        octx.globalAlpha = 0.92;
        octx.drawImage(earthImg, drawX, drawY, imgW, imgH);
        octx.drawImage(earthImg, drawX - imgW, drawY, imgW, imgH);
        octx.drawImage(earthImg, drawX + imgW, drawY, imgW, imgH);
        octx.globalAlpha = 1;
      }
      octx.restore();
    }

    // Glowing pulsing radio station pins
    var pulse = 0.5 + 0.5 * Math.sin(now * 0.005);
    for (var j = 0; j < points.length; j++) {
      var pt = points[j];
      var pr = project(pt.lat, pt.lng);
      if (pr.z < 0.06) continue;
      var isSel = pt.id === selectedId;
      var alpha = Math.min(1, pr.z * 1.45);
      if (isSel) {
        octx.beginPath(); octx.arc(pr.x, pr.y, 10 + pulse * 6, 0, 6.2832);
        octx.strokeStyle = 'rgba(255,214,102,' + ((0.65 - pulse * 0.35) * alpha).toFixed(2) + ')';
        octx.lineWidth = 1.6; octx.stroke();
        octx.beginPath(); octx.arc(pr.x, pr.y, 5.2, 0, 6.2832);
        octx.fillStyle = '#FFD666'; octx.fill();
        octx.beginPath(); octx.arc(pr.x, pr.y, 2.3, 0, 6.2832);
        octx.fillStyle = '#FFFFFF'; octx.fill();
      } else {
        octx.beginPath(); octx.arc(pr.x, pr.y, 5.0, 0, 6.2832);
        octx.fillStyle = 'rgba(92,229,207,' + (0.24 * alpha).toFixed(2) + ')'; octx.fill();
        octx.beginPath(); octx.arc(pr.x, pr.y, 2.5, 0, 6.2832);
        octx.fillStyle = 'rgba(130,255,235,' + (0.95 * alpha).toFixed(2) + ')'; octx.fill();
      }
    }
  }

  function frame(now){
    if (!dragging) {
      if (autoRotate && now - lastInteract > 2200) {
        targetLng += 0.0022;
      }
      targetLng += velLng; targetLat += velLat;
      velLng *= 0.92; velLat *= 0.92;
      targetLat = Math.max(-1.28, Math.min(1.28, targetLat));
      rotLng += (targetLng - rotLng) * 0.14;
      rotLat += (targetLat - rotLat) * 0.14;
    } else {
      rotLng = targetLng; rotLat = targetLat;
    }
    zoom += (targetZoom - zoom) * 0.16;

    if (gl && glReady) {
      gl.useProgram(prog);
      gl.uniform2f(uRes, glc.width, glc.height);
      gl.uniform2f(uRot, rotLng, rotLat);
      gl.uniform1f(uZoom, zoom);
      gl.uniform1f(uTime, (now - startTime) * 0.001);
      gl.uniform1f(uHasTex, earthReady ? 1.0 : 0.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    drawOverlay(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function handleTap(x, y){
    var best = null, bestD = 26;
    for (var i = 0; i < points.length; i++) {
      var pr = project(points[i].lat, points[i].lng);
      if (pr.z < 0.08) continue;
      var d = Math.hypot(pr.x - x, pr.y - y);
      if (d < bestD) { bestD = d; best = points[i]; }
    }
    if (best) {
      selectedId = best.id;
      postMsg({ type: 'station', uuid: best.id });
    } else {
      var geo = screenToGeo(x, y);
      if (geo) postMsg({ type: 'area', lat: geo.lat, lng: geo.lng });
    }
  }

  ovc.addEventListener('pointerdown', function(e){
    dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY;
    velLng = 0; velLat = 0; lastInteract = performance.now();
    ovc.setPointerCapture && ovc.setPointerCapture(e.pointerId);
  });
  ovc.addEventListener('pointermove', function(e){
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    var sens = 0.0068 / Math.max(0.7, zoom);
    targetLng -= dx * sens;
    targetLat = Math.max(-1.28, Math.min(1.28, targetLat + dy * sens));
    velLng = -dx * sens * 0.65;
    velLat = dy * sens * 0.65;
    lastX = e.clientX; lastY = e.clientY; lastInteract = performance.now();
  });
  ovc.addEventListener('pointerup', function(e){
    if (!dragging) return;
    dragging = false; lastInteract = performance.now();
    if (!moved) handleTap(e.clientX, e.clientY);
  });
  ovc.addEventListener('pointercancel', function(){ dragging = false; });
  ovc.addEventListener('touchstart', function(e){
    if (e.touches.length === 2) {
      dragging = false;
      pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });
  ovc.addEventListener('touchmove', function(e){
    if (e.touches.length === 2 && pinchDist > 0) {
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      targetZoom = Math.max(0.72, Math.min(2.6, targetZoom * (d / pinchDist)));
      pinchDist = d; lastInteract = performance.now();
    }
  }, { passive: true });

  window.nexusGlobe = {
    setData: function(jsonStr){
      try {
        var d = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        if (d && Array.isArray(d.points)) points = d.points;
        if (d && typeof d.selected === 'string') selectedId = d.selected;
      } catch(e){}
    },
    command: function(jsonStr){
      try {
        var c = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        if (!c || !c.type) return;
        lastInteract = performance.now();
        if (c.type === 'zoom') targetZoom = Math.max(0.72, Math.min(2.6, targetZoom * (c.factor || 1)));
        else if (c.type === 'reset') { targetZoom = 1.0; targetLat = 22 * Math.PI / 180; targetLng = 104 * Math.PI / 180; autoRotate = true; }
        else if (c.type === 'focus' && typeof c.lat === 'number' && typeof c.lng === 'number') {
          targetLat = Math.max(-1.28, Math.min(1.28, c.lat * Math.PI / 180));
          targetLng = c.lng * Math.PI / 180;
          if (c.zoom) targetZoom = Math.max(0.72, Math.min(2.6, c.zoom));
          velLng = 0; velLat = 0;
        }
      } catch(e){}
    }
  };
})();
</script>
</body>
</html>`;
