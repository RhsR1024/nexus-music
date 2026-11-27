// Public Radio Browser API client + persisted favorites/recent store for Global Radio.
// Station directory: https://www.radio-browser.info/ (open community directory).
import type { Track } from '../domain/track.ts';
import type { Repository } from '../storage/repository.ts';
import { safePublicURL } from '../storage/cleanTrack.ts';
import { queryURL, requestJSON, type HTTPClient } from './http.ts';

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
    const out: RadioStation[] = [];
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
      out.push({
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
      });
    }
    return out;
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

/** Self-contained offline photorealistic 3D Earth (WebGL Blue-Marble shader + Canvas 2D fallback, high-detail coastlines, bathymetry, biomes, drifting clouds, Rayleigh atmosphere, starfield, inertial spin & pinch zoom). */
export const RADIO_GLOBE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#040a14;touch-action:none;user-select:none;-webkit-user-select:none;}
  canvas{position:absolute;inset:0;display:block;width:100%;height:100%;}
</style>
</head>
<body>
<canvas id="gl"></canvas>
<canvas id="ov"></canvas>
<script>
(function(){
  var glCanvas=document.getElementById('gl'),ovCanvas=document.getElementById('ov');
  var ov=ovCanvas.getContext('2d');
  var dpr=Math.min(window.devicePixelRatio||1,2.2),W=320,H=320;
  var rotLng=108,rotLat=25,zoom=1.0,points=[],selected='';
  var dragging=false,moved=false,sx=0,sy=0,slng=0,slat=0,vlng=0,vlat=0,lastX=0,lastY=0,lastT=0;
  var pinchDist=0,pinchZoom=1,anim=null,cloudShift=0,pulseT=0,screenPins=[],useGL=false;
  var touches={};

  // Detailed Natural Earth-inspired coastlines & major islands [lat, lng]
  var LAND=[
    // Eurasia main
    [[36,-9],[38,-9],[43,-9],[43,-2],[48,-5],[51,2],[54,8],[57,9],[55,12],[59,18],[64,21],[69,18],[71,28],[69,34],[66,40],[68,44],[70,60],[73,70],[74,85],[77,104],[73,125],[71,148],[69,168],[66,178],[60,166],[52,157],[59,144],[54,137],[46,138],[42,131],[38,128],[35,129],[35,126],[39,124],[40,121],[38,118],[37,122],[32,121],[28,121],[24,118],[22,114],[20,110],[21,106],[16,108],[11,109],[9,105],[13,100],[7,100],[2,103],[5,100],[10,98],[16,97],[21,92],[22,88],[16,81],[8,77],[15,74],[22,69],[25,67],[25,62],[26,56],[30,49],[26,50],[22,59],[13,45],[12,43],[21,39],[29,35],[31,34],[36,36],[36,28],[40,26],[41,29],[45,29],[47,36],[43,40],[41,28],[38,23],[40,19],[45,14],[41,16],[38,16],[40,14],[44,9],[43,4],[39,0],[36,-5],[36,-9]],
    // Africa
    [[36,-6],[37,10],[33,11],[31,18],[32,25],[31,32],[24,36],[15,41],[12,44],[11,51],[4,47],[-1,41],[-10,40],[-16,40],[-25,33],[-34,25],[-34,18],[-28,16],[-18,12],[-6,12],[4,9],[5,1],[5,-7],[10,-15],[15,-17],[21,-17],[28,-13],[35,-6],[36,-6]],
    // North & Central America
    [[70,-162],[71,-156],[69,-135],[69,-115],[67,-95],[62,-92],[55,-80],[61,-77],[60,-65],[53,-56],[47,-53],[45,-65],[42,-70],[39,-74],[35,-76],[25,-80],[29,-84],[29,-90],[26,-97],[19,-96],[21,-90],[21,-87],[16,-88],[15,-83],[10,-83],[8,-78],[8,-82],[14,-91],[19,-104],[23,-106],[29,-112],[23,-110],[32,-117],[38,-123],[45,-124],[50,-127],[58,-136],[60,-148],[55,-162],[61,-166],[66,-168],[70,-162]],
    // South America
    [[11,-75],[12,-70],[10,-62],[6,-53],[1,-50],[-2,-42],[-6,-35],[-13,-38],[-23,-42],[-34,-53],[-42,-65],[-52,-68],[-55,-67],[-53,-73],[-44,-74],[-33,-72],[-18,-71],[-5,-81],[2,-79],[8,-78],[11,-75]],
    // Australia
    [[-12,131],[-12,136],[-16,136],[-15,141],[-11,142],[-19,147],[-28,153],[-37,150],[-38,141],[-35,136],[-32,132],[-34,122],[-34,115],[-22,114],[-18,122],[-14,126],[-12,131]],
    // Greenland
    [[60,-44],[65,-38],[72,-22],[79,-18],[83,-32],[82,-52],[76,-68],[69,-54],[63,-51],[60,-44]],
    // Antarctica
    [[-65,-62],[-70,-40],[-71,-10],[-68,30],[-67,70],[-66,115],[-70,150],[-77,175],[-74,-145],[-72,-100],[-65,-62]],
    // Great Britain & Ireland
    [[50,-5],[53,-4],[58,-5],[58,-2],[55,-1],[52,1],[51,1],[50,-5]],
    [[52,-10],[55,-8],[55,-6],[52,-6],[52,-10]],
    // Iceland
    [[64,-24],[66,-23],[66,-14],[64,-14],[64,-24]],
    // Japan (Honshu, Hokkaido, Kyushu)
    [[34,131],[36,136],[41,141],[38,141],[35,140],[34,136],[34,131]],
    [[42,140],[45,142],[44,145],[42,144],[42,140]],
    [[31,130],[34,130],[33,132],[31,131],[31,130]],
    // Taiwan & Hainan & Sri Lanka
    [[22,120.5],[25.3,121.6],[23.5,121.5],[22,120.5]],
    [[18.2,109],[20,110.2],[19,110.8],[18.2,109]],
    [[6,80],[9.8,80.2],[7.5,81.8],[6,80]],
    // Philippines
    [[13,120],[18.5,121],[18,122.5],[12.5,124],[13,120]],
    [[6,122],[9.5,125.5],[7,126.5],[5.5,125],[6,122]],
    // Indonesia & Borneo & New Guinea
    [[5.5,95.5],[2,100],[-5.8,105.8],[-4,102],[1,98],[5.5,95.5]],
    [[-6,105.5],[-6.8,111],[-8.5,114.5],[-7.5,107],[-6,105.5]],
    [[7,117],[4,118.5],[-3.5,116],[-3,110.5],[2,109.5],[7,117]],
    [[-1,131],[-3,138],[-6,147],[-10,150],[-9,143],[-5,137],[-3,132],[-1,131]],
    // Madagascar & New Zealand & Cuba
    [[-12,49.3],[-15,50.3],[-25.5,47],[-25,44],[-16,44.5],[-12,49.3]],
    [[-34.5,173],[-37.5,178],[-41.5,175.5],[-39,174],[-34.5,173]],
    [[-41,172.5],[-44,171.5],[-46.5,167],[-44,168.5],[-41,172.5]],
    [[21.8,-84.5],[23,-81],[20.2,-74.2],[19.8,-77.5],[21.8,-84.5]],
    // Baffin & Ellesmere & Novaya Zemlya
    [[63,-75],[73,-80],[72,-72],[66,-62],[63,-75]],
    [[71,52],[77,67],[75,68],[70,57],[71,52]]
  ];

  // Subtle desert & arid zones [lat, lng, rx, ry, strength]
  var DESERTS=[
    [23,12,26,11,0.92],[23,46,12,8,0.88],[41,85,16,8,0.72],[43,104,13,6,0.68],
    [-25,133,15,8,0.85],[31,-110,9,7,0.62],[-22,-69,4,10,0.68],[-24,17,5,7,0.72],[10,47,6,5,0.62]
  ];
  // Lush tropical forest zones
  var JUNGLES=[
    [-4,-62,15,10,0.88],[0,21,12,8,0.85],[4,108,16,11,0.8],[16,100,10,8,0.65]
  ];
  // Mountain snow/relief bands
  var MOUNTAINS=[
    [31,86,13,5,0.85],[36,74,8,4,0.72],[-20,-69,4,22,0.55],[46,10,6,3,0.45],[46,-116,7,14,0.45]
  ];

  function hash2(x,y){
    var n=Math.sin(x*127.1+y*311.7)*43758.5453123;
    return n-Math.floor(n);
  }
  function vnoise(x,y){
    var ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
    var a=hash2(ix,iy),b=hash2(ix+1,iy),c=hash2(ix,iy+1),d=hash2(ix+1,iy+1);
    return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;
  }
  function fbm(x,y){
    return 0.52*vnoise(x,y)+0.28*vnoise(x*2.1+7.3,y*2.1+3.1)+0.14*vnoise(x*4.3+1.7,y*4.3+9.2)+0.06*vnoise(x*8.5,y*8.5);
  }

  function buildEarthTexture(){
    var tw=1024,th=512;
    var tc=document.createElement('canvas');tc.width=tw;tc.height=th;
    var g=tc.getContext('2d');
    var mask=document.createElement('canvas');mask.width=tw;mask.height=th;
    var mg=mask.getContext('2d');

    function traceLand(ctx2){
      for(var i=0;i<LAND.length;i++){
        var poly=LAND[i];
        ctx2.beginPath();
        for(var j=0;j<poly.length;j++){
          var px=(poly[j][1]+180)/360*tw;
          var py=(90-poly[j][0])/180*th;
          if(j===0)ctx2.moveTo(px,py);else ctx2.lineTo(px,py);
        }
        ctx2.closePath();ctx2.fill();
      }
    }

    // 1. Deep bathymetric ocean base
    var oGrad=g.createLinearGradient(0,0,0,th);
    oGrad.addColorStop(0,'#173a5e');
    oGrad.addColorStop(0.14,'#0a284d');
    oGrad.addColorStop(0.5,'#072347');
    oGrad.addColorStop(0.86,'#0a284d');
    oGrad.addColorStop(1,'#183959');
    g.fillStyle=oGrad;g.fillRect(0,0,tw,th);

    // 2. Shallow coastal shelf turquoise glow around continents
    g.save();
    g.shadowColor='rgba(36,156,196,0.68)';
    g.shadowBlur=16;
    g.fillStyle='rgba(30,136,174,0.42)';
    traceLand(g);
    g.shadowBlur=6;
    g.fillStyle='rgba(58,188,214,0.48)';
    traceLand(g);
    g.restore();

    // 3. Build crisp land mask
    mg.fillStyle='#ffffff';
    traceLand(mg);
    var mData=mg.getImageData(0,0,tw,th).data;
    var eImg=g.getImageData(0,0,tw,th),eData=eImg.data;

    // 4. Pixel-level NASA Blue-Marble biome, bathymetry & relief shading
    for(var y=0;y<th;y++){
      var lat=90-(y/th)*180;
      var absLat=Math.abs(lat);
      for(var x=0;x<tw;x++){
        var idx=(y*tw+x)*4;
        var lng=(x/tw)*360-180;
        var isLand=mData[idx+3]>90;
        var n1=fbm(x*0.022,y*0.022);
        var n2=vnoise(x*0.09+13,y*0.09+5);
        if(!isLand){
          // Subtle ocean trench & sea-floor texture
          var oMod=(n1-0.5)*16+(n2-0.5)*7;
          eData[idx]=Math.max(3,Math.min(255,eData[idx]+oMod*0.6));
          eData[idx+1]=Math.max(14,Math.min(255,eData[idx+1]+oMod*1.05));
          eData[idx+2]=Math.max(32,Math.min(255,eData[idx+2]+oMod*1.35));
          eData[idx+3]=255;
          continue;
        }
        // Base temperate forest / grassland palette
        var r=46+n1*42+(n2-0.5)*18;
        var gr=86+n1*46+(n2-0.5)*16;
        var b=48+n1*24+(n2-0.5)*10;

        // Polar ice & tundra
        if(absLat>62){
          var ice=Math.min(1,Math.max(0,(absLat-62+n1*10)/14));
          r=r*(1-ice)+222*ice;
          gr=gr*(1-ice)+230*ice;
          b=b*(1-ice)+236*ice;
        }
        // Tropical forests
        for(var k=0;k<JUNGLES.length;k++){
          var jz=JUNGLES[k];
          var d=Math.hypot((lat-jz[0])/jz[3],(lng-jz[1])/jz[2]);
          if(d<1.3){
            var w=Math.max(0,1-d/1.3)*jz[4];
            r=r*(1-w)+(24+n1*20)*w;
            gr=gr*(1-w)+(78+n1*30)*w;
            b=b*(1-w)+(34+n1*14)*w;
          }
        }
        // Deserts & arid plateaus
        for(var k=0;k<DESERTS.length;k++){
          var dz=DESERTS[k];
          var d=Math.hypot((lat-dz[0])/dz[3],(lng-dz[1])/dz[2]);
          if(d<1.35){
            var w=Math.max(0,1-d/1.35)*dz[4]*(0.75+0.4*n1);
            w=Math.min(1,w);
            r=r*(1-w)+(194+n2*28)*w;
            gr=gr*(1-w)+(160+n2*24)*w;
            b=b*(1-w)+(110+n2*18)*w;
          }
        }
        // Mountain ranges & snow peaks
        for(var k=0;k<MOUNTAINS.length;k++){
          var mz=MOUNTAINS[k];
          var d=Math.hypot((lat-mz[0])/mz[3],(lng-mz[1])/mz[2]);
          if(d<1.2){
            var w=Math.max(0,1-d/1.2)*mz[4]*n1;
            r=r*(1-w)+(168+n2*58)*w;
            gr=gr*(1-w)+(166+n2*56)*w;
            b=b*(1-w)+(164+n2*56)*w;
          }
        }
        eData[idx]=Math.max(0,Math.min(255,r));
        eData[idx+1]=Math.max(0,Math.min(255,gr));
        eData[idx+2]=Math.max(0,Math.min(255,b));
        // Store land mask in alpha channel (255 = land, 0 = ocean) for WebGL specular!
        eData[idx+3]=254;
      }
    }
    g.putImageData(eImg,0,0);

    // 5. Cloud layer texture (512x256 wispy swirling trade-wind clouds)
    var cw=512,ch=256;
    var cc=document.createElement('canvas');cc.width=cw;cc.height=ch;
    var cg=cc.getContext('2d');
    var cImg=cg.createImageData(cw,ch),cData=cImg.data;
    for(var y=0;y<ch;y++){
      var latV=Math.abs(y/ch-0.5)*2;
      for(var x=0;x<cw;x++){
        var swirl=Math.sin(y*0.075+x*0.015)*2.2;
        var c=fbm(x*0.028+swirl,y*0.042+11.4);
        var c2=vnoise(x*0.08-swirl*0.5,y*0.09);
        var dens=Math.max(0,(c*0.72+c2*0.28)-0.52)*2.6;
        // Slightly denser mid-latitude storm tracks
        dens*=0.72+0.45*Math.sin(latV*Math.PI);
        var alpha=Math.max(0,Math.min(220,Math.floor(dens*215)));
        var idx=(y*cw+x)*4;
        cData[idx]=244;cData[idx+1]=249;cData[idx+2]=255;cData[idx+3]=alpha;
      }
    }
    cg.putImageData(cImg,0,0);
    return {earth:tc,clouds:cc,landMask:mData};
  }

  var textures=buildEarthTexture();

  // Twinkling background starfield
  var stars=[];
  for(var s=0;s<140;s++){
    stars.push({x:hash2(s,1.3),y:hash2(s,7.9),r:0.55+hash2(s,3.7)*1.2,a:0.25+hash2(s,9.1)*0.65,p:hash2(s,4.2)*6.28});
  }

  // Try WebGL photorealistic ray-traced sphere shader
  var gl=null,prog=null,uLoc={};
  function initWebGL(){
    try{
      gl=glCanvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
      if(!gl)return false;
      var vs='attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0.0,1.0);}';
      var fs=[
        'precision highp float;',
        'varying vec2 v;',
        'uniform vec2 uRes;',
        'uniform vec2 uCenter;',
        'uniform float uRadius;',
        'uniform float uRotLng;',
        'uniform float uRotLat;',
        'uniform float uCloud;',
        'uniform sampler2D uEarth;',
        'uniform sampler2D uClouds;',
        'const float PI=3.14159265359;',
        'void main(){',
        '  vec2 px=vec2((v.x*0.5+0.5)*uRes.x,(0.5-v.y*0.5)*uRes.y);',
        '  vec2 d=(px-uCenter)/uRadius;',
        '  float r2=dot(d,d);',
        '  if(r2>1.0){',
        '    float dist=sqrt(r2)-1.0;',
        '    float halo=exp(-dist*7.5)*0.42;',
        '    gl_FragColor=vec4(vec3(0.24,0.68,0.96)*halo,halo);',
        '    return;',
        '  }',
        '  float z=sqrt(max(0.0,1.0-r2));',
        '  vec3 n=normalize(vec3(d.x,-d.y,z));',
        '  // Rotate sphere normal to world lat/lng',
        '  float cp=cos(uRotLat),sp=sin(uRotLat);',
        '  vec3 n1=vec3(n.x,n.y*cp+n.z*sp,-n.y*sp+n.z*cp);',
        '  float lat=asin(clamp(n1.y,-1.0,1.0));',
        '  float lng=atan(n1.x,n1.z)+uRotLng;',
        '  float u=fract((lng/(2.0*PI))+0.5);',
        '  float tv=0.5-(lat/PI);',
        '  vec4 eTex=texture2D(uEarth,vec2(u,tv));',
        '  vec4 cTex=texture2D(uClouds,vec2(fract(u+uCloud),tv));',
        '  vec4 cShd=texture2D(uClouds,vec2(fract(u+uCloud+0.005),clamp(tv+0.004,0.0,1.0)));',
        '  bool isLand=eTex.a<0.998;',
        '  vec3 sun=normalize(vec3(-0.58,0.42,0.70));',
        '  float ndl=dot(n,sun);',
        '  float diff=smoothstep(-0.18,0.85,ndl);',
        '  float ambient=0.22;',
        '  vec3 col=eTex.rgb*(ambient+0.96*diff);',
        '  // Subtle cloud shadow on surface',
        '  col*=1.0-cShd.a*0.28*max(0.0,ndl);',
        '  // Ocean solar specular highlight',
        '  if(!isLand){',
        '    vec3 h=normalize(sun+vec3(0.0,0.0,1.0));',
        '    float spec=pow(max(dot(n,h),0.0),42.0)*0.48*smoothstep(0.0,0.3,ndl);',
        '    col+=vec3(0.75,0.92,1.0)*spec;',
        '  }',
        '  // Blend drifting clouds',
        '  vec3 cloudCol=vec3(0.95,0.98,1.0)*(0.26+0.88*diff);',
        '  col=mix(col,cloudCol,cTex.a*0.72);',
        '  // Subtle twilight warm-blue terminator tint',
        '  float term=exp(-pow((ndl+0.05)*5.5,2.0));',
        '  col+=vec3(0.10,0.22,0.42)*term*0.35;',
        '  // Rayleigh blue atmospheric Fresnel limb glow',
        '  float fres=pow(1.0-z,3.2);',
        '  col+=vec3(0.24,0.68,0.98)*fres*(0.42+0.48*max(0.0,ndl+0.25));',
        '  // Anti-aliased edge',
        '  float aa=smoothstep(1.0,0.992,sqrt(r2));',
        '  gl_FragColor=vec4(col,aa);',
        '}'
      ].join('\\n');
      function sh(type,src){
        var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))return null;
        return s;
      }
      var vsh=sh(gl.VERTEX_SHADER,vs),fsh=sh(gl.FRAGMENT_SHADER,fs);
      if(!vsh||!fsh)return false;
      prog=gl.createProgram();gl.attachShader(prog,vsh);gl.attachShader(prog,fsh);gl.linkProgram(prog);
      if(!gl.getProgramParameter(prog,gl.LINK_STATUS))return false;
      gl.useProgram(prog);
      var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      var pLoc=gl.getAttribLocation(prog,'p');gl.enableVertexAttribArray(pLoc);gl.vertexAttribPointer(pLoc,2,gl.FLOAT,false,0,0);
      function makeTex(unit,cnv){
        var t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cnv);
        return t;
      }
      makeTex(0,textures.earth);
      makeTex(1,textures.clouds);
      gl.uniform1i(gl.getUniformLocation(prog,'uEarth'),0);
      gl.uniform1i(gl.getUniformLocation(prog,'uClouds'),1);
      uLoc.res=gl.getUniformLocation(prog,'uRes');
      uLoc.center=gl.getUniformLocation(prog,'uCenter');
      uLoc.radius=gl.getUniformLocation(prog,'uRadius');
      uLoc.rotLng=gl.getUniformLocation(prog,'uRotLng');
      uLoc.rotLat=gl.getUniformLocation(prog,'uRotLat');
      uLoc.cloud=gl.getUniformLocation(prog,'uCloud');
      return true;
    }catch(e){return false;}
  }
  useGL=initWebGL();

  function post(msg){
    try{
      if(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.RadioGlobe){
        window.webkit.messageHandlers.RadioGlobe.postMessage(msg);
      }else if(window.RadioGlobeBridge&&window.RadioGlobeBridge.postMessage){
        window.RadioGlobeBridge.postMessage(JSON.stringify(msg));
      }
    }catch(e){}
  }

  function resize(){
    W=window.innerWidth||320;H=window.innerHeight||320;
    glCanvas.width=Math.round(W*dpr);glCanvas.height=Math.round(H*dpr);
    ovCanvas.width=Math.round(W*dpr);ovCanvas.height=Math.round(H*dpr);
    ov.setTransform(dpr,0,0,dpr,0,0);
    if(useGL&&gl)gl.viewport(0,0,glCanvas.width,glCanvas.height);
    draw();
  }

  function proj(lat,lng,R,cx,cy){
    var p1=lat*Math.PI/180,l1=lng*Math.PI/180;
    var p0=rotLat*Math.PI/180,l0=rotLng*Math.PI/180;
    var dl=l1-l0;
    var cosc=Math.sin(p0)*Math.sin(p1)+Math.cos(p0)*Math.cos(p1)*Math.cos(dl);
    var x=cx+R*Math.cos(p1)*Math.sin(dl);
    var y=cy-R*(Math.cos(p0)*Math.sin(p1)-Math.sin(p0)*Math.cos(p1)*Math.cos(dl));
    return {x:x,y:y,z:cosc};
  }

  function cluster(){
    var step=zoom<1.05?11:zoom<1.55?5.5:2.6;
    var map={};
    for(var i=0;i<points.length;i++){
      var p=points[i];
      if(!isFinite(p.lat)||!isFinite(p.lng))continue;
      var k=Math.floor((p.lat+90)/step)+':'+Math.floor((p.lng+180)/step);
      var g=map[k];
      if(!g){g={lat:0,lng:0,count:0,first:p,selected:false};map[k]=g;}
      g.lat+=p.lat;g.lng+=p.lng;g.count++;
      if(p.id===selected){g.selected=true;g.first=p;}
    }
    var arr=[];
    for(var k in map){var g=map[k];g.lat/=g.count;g.lng/=g.count;arr.push(g);}
    return arr;
  }

  function drawFallbackGlobe(cx,cy,R){
    var halo=ov.createRadialGradient(cx,cy,R*0.88,cx,cy,R*1.22);
    halo.addColorStop(0,'rgba(72,182,246,0.34)');
    halo.addColorStop(0.55,'rgba(36,120,210,0.12)');
    halo.addColorStop(1,'rgba(4,10,20,0)');
    ov.fillStyle=halo;ov.beginPath();ov.arc(cx,cy,R*1.22,0,Math.PI*2);ov.fill();

    var ocean=ov.createRadialGradient(cx-R*0.32,cy-R*0.34,R*0.06,cx,cy,R);
    ocean.addColorStop(0,'#1b5c8c');ocean.addColorStop(0.45,'#0c335c');ocean.addColorStop(0.85,'#071e3a');ocean.addColorStop(1,'#041022');
    ov.save();
    ov.beginPath();ov.arc(cx,cy,R,0,Math.PI*2);ov.fillStyle=ocean;ov.fill();ov.clip();

    ov.fillStyle='#3f744c';ov.strokeStyle='rgba(92,202,226,0.38)';ov.lineWidth=1.1;
    for(var c=0;c<LAND.length;c++){
      var poly=LAND[c],vis=0;
      ov.beginPath();
      for(var i=0;i<poly.length;i++){
        var pt=proj(poly[i][0],poly[i][1],R,cx,cy);
        if(pt.z>-0.1)vis++;
        if(i===0)ov.moveTo(pt.x,pt.y);else ov.lineTo(pt.x,pt.y);
      }
      if(vis>=3){ov.closePath();ov.fill();ov.stroke();}
    }
    // Atmospheric limb shine
    var limb=ov.createRadialGradient(cx,cy,R*0.74,cx,cy,R);
    limb.addColorStop(0,'rgba(70,185,255,0)');
    limb.addColorStop(0.84,'rgba(70,185,255,0.14)');
    limb.addColorStop(1,'rgba(110,212,255,0.52)');
    ov.fillStyle=limb;ov.beginPath();ov.arc(cx,cy,R,0,Math.PI*2);ov.fill();
    ov.restore();
  }

  function draw(){
    var cx=W/2,cy=H*0.51,R=Math.min(W,H)*0.435*zoom;
    // Deep-space sky + twinkling starfield on background overlay
    ov.clearRect(0,0,W,H);
    if(!useGL){
      var sky=ov.createRadialGradient(cx,cy,R*0.2,cx,cy,Math.max(W,H)*0.75);
      sky.addColorStop(0,'#091a30');sky.addColorStop(1,'#030811');
      ov.fillStyle=sky;ov.fillRect(0,0,W,H);
    }
    for(var s=0;s<stars.length;s++){
      var st=stars[s],sx2=st.x*W,sy2=st.y*H;
      var dx=sx2-cx,dy=sy2-cy;
      if(dx*dx+dy*dy<(R+4)*(R+4))continue;
      var tw=st.a*(0.65+0.35*Math.sin(pulseT*1.6+st.p));
      ov.fillStyle='rgba(218,236,255,'+tw.toFixed(2)+')';
      ov.beginPath();ov.arc(sx2,sy2,st.r,0,Math.PI*2);ov.fill();
    }

    if(useGL&&gl){
      gl.clearColor(0.016,0.039,0.078,1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uLoc.res,W*dpr,H*dpr);
      gl.uniform2f(uLoc.center,cx*dpr,cy*dpr);
      gl.uniform1f(uLoc.radius,R*dpr);
      gl.uniform1f(uLoc.rotLng,rotLng*Math.PI/180);
      gl.uniform1f(uLoc.rotLat,rotLat*Math.PI/180);
      gl.uniform1f(uLoc.cloud,cloudShift);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }else{
      drawFallbackGlobe(cx,cy,R);
    }

    // Crisp glowing pulsing radio station beacons
    ov.save();
    ov.beginPath();ov.arc(cx,cy,R+2,0,Math.PI*2);ov.clip();
    screenPins=[];
    var clusters=cluster();
    var pulse=0.5+0.5*Math.sin(pulseT*3.2);
    for(var i=0;i<clusters.length;i++){
      var g=clusters[i],pt=proj(g.lat,g.lng,R,cx,cy);
      if(pt.z<=0.06)continue;
      var depthFade=Math.min(1,0.45+pt.z*0.75);
      var rad=g.selected?6.5:Math.min(7.2,2.8+Math.log2(g.count+1)*1.05);
      // Outer beacon ring
      ov.beginPath();ov.arc(pt.x,pt.y,rad+(g.selected?6.5+pulse*4.5:3.2),0,Math.PI*2);
      ov.fillStyle=g.selected
        ? 'rgba(255,196,112,'+(0.28+pulse*0.18).toFixed(2)+')'
        : 'rgba(92,235,212,'+(0.22*depthFade).toFixed(2)+')';
      ov.fill();
      // Core glowing dot
      ov.beginPath();ov.arc(pt.x,pt.y,rad,0,Math.PI*2);
      ov.fillStyle=g.selected?'#ffbe6b':'#5cf0d6';
      ov.fill();
      ov.beginPath();ov.arc(pt.x,pt.y,rad*0.42,0,Math.PI*2);
      ov.fillStyle='rgba(255,255,255,0.85)';
      ov.fill();
      if(g.selected&&g.first&&g.first.name){
        ov.font='600 11px -apple-system,BlinkMacSystemFont,sans-serif';
        var label=g.first.name.slice(0,18);
        var tw2=ov.measureText(label).width+12;
        var lx=Math.max(8,Math.min(W-tw2-8,pt.x-tw2/2));
        var ly=pt.y-rad-24;
        ov.fillStyle='rgba(5,16,28,0.84)';
        ov.strokeStyle='rgba(255,190,107,0.65)';
        ov.lineWidth=1;
        ov.beginPath();ov.roundRect?ov.roundRect(lx,ly,tw2,18,9):ov.rect(lx,ly,tw2,18);ov.fill();ov.stroke();
        ov.fillStyle='#fff6e6';ov.fillText(label,lx+6,ly+12.5);
      }
      screenPins.push({x:pt.x,y:pt.y,r:rad+12,g:g});
    }
    ov.restore();
  }

  function focus(lat,lng,z){
    var startLat=rotLat,startLng=rotLng,startZ=zoom,targetZ=z||zoom;
    var dl=((lng-startLng+540)%360)-180,t0=performance.now();
    vlng=0;vlat=0;
    if(anim)cancelAnimationFrame(anim);
    function step(now){
      var t=Math.min(1,(now-t0)/460),e=1-Math.pow(1-t,3);
      rotLat=startLat+(lat-startLat)*e;
      rotLng=startLng+dl*e;
      zoom=startZ+(targetZ-startZ)*e;
      draw();
      anim=t<1?requestAnimationFrame(step):null;
    }
    anim=requestAnimationFrame(step);
  }

  // Smooth inertial drift + living cloud animation loop
  var lastFrame=performance.now();
  function tick(now){
    var dt=Math.min(0.05,(now-lastFrame)/1000);
    lastFrame=now;
    pulseT+=dt;
    cloudShift=(cloudShift+dt*0.0022)%1;
    if(!dragging&&!anim){
      if(Math.abs(vlng)>0.01||Math.abs(vlat)>0.01){
        rotLng+=vlng;
        rotLat=Math.max(-78,Math.min(78,rotLat+vlat));
        vlng*=0.93;vlat*=0.93;
      }else{
        // Gentle orbital rotation when idle
        rotLng=(rotLng+dt*2.4+540)%360-180;
      }
    }
    draw();
    requestAnimationFrame(tick);
  }

  ovCanvas.addEventListener('pointerdown',function(e){
    if(anim){cancelAnimationFrame(anim);anim=null;}
    touches[e.pointerId]={x:e.clientX,y:e.clientY};
    var ids=Object.keys(touches);
    if(ids.length===2){
      var a=touches[ids[0]],b=touches[ids[1]];
      pinchDist=Math.hypot(a.x-b.x,a.y-b.y);pinchZoom=zoom;dragging=false;moved=true;
      return;
    }
    dragging=true;moved=false;vlng=0;vlat=0;
    sx=lastX=e.clientX;sy=lastY=e.clientY;slng=rotLng;slat=rotLat;lastT=performance.now();
  });
  ovCanvas.addEventListener('pointermove',function(e){
    if(touches[e.pointerId])touches[e.pointerId]={x:e.clientX,y:e.clientY};
    var ids=Object.keys(touches);
    if(ids.length===2&&pinchDist>10){
      var a=touches[ids[0]],b=touches[ids[1]];
      var dist=Math.hypot(a.x-b.x,a.y-b.y);
      zoom=Math.max(0.75,Math.min(2.6,pinchZoom*(dist/pinchDist)));
      return;
    }
    if(!dragging)return;
    var dx=e.clientX-sx,dy=e.clientY-sy;
    if(Math.hypot(dx,dy)>5)moved=true;
    var stepLng=-(e.clientX-lastX)*(0.36/zoom);
    var stepLat=(e.clientY-lastY)*(0.36/zoom);
    rotLng=((rotLng+stepLng+540)%360)-180;
    rotLat=Math.max(-78,Math.min(78,rotLat+stepLat));
    vlng=stepLng*0.85;vlat=stepLat*0.85;
    lastX=e.clientX;lastY=e.clientY;lastT=performance.now();
  });
  function endPointer(e){
    delete touches[e.pointerId];
    if(Object.keys(touches).length<2)pinchDist=0;
    if(!dragging)return;
    dragging=false;
    if(performance.now()-lastT>80){vlng=0;vlat=0;}
    if(!moved){
      var best=null,bestD=999;
      for(var i=0;i<screenPins.length;i++){
        var pin=screenPins[i],d=Math.hypot(e.clientX-pin.x,e.clientY-pin.y);
        if(d<=pin.r&&d<bestD){best=pin.g;bestD=d;}
      }
      if(best){
        if(best.count===1){
          selected=best.first.id;
          focus(best.lat,best.lng,Math.max(zoom,1.3));
          post({type:'station',uuid:best.first.id,lat:best.lat,lng:best.lng});
        }else{
          focus(best.lat,best.lng,Math.min(2.4,zoom*1.38));
          post({type:'area',lat:best.lat,lng:best.lng});
        }
      }
    }
  }
  ovCanvas.addEventListener('pointerup',endPointer);
  ovCanvas.addEventListener('pointercancel',endPointer);

  window.nexusGlobe={
    setData:function(payload){
      points=Array.isArray(payload.points)?payload.points:[];
      selected=payload.selected||'';
      draw();
    },
    command:function(cmd){
      if(!cmd||!cmd.type)return;
      if(cmd.type==='zoom'){zoom=Math.max(0.75,Math.min(2.6,zoom*(cmd.factor||1)));draw();}
      else if(cmd.type==='reset'){focus(25,108,1.0);}
      else if(cmd.type==='focus'&&isFinite(cmd.lat)&&isFinite(cmd.lng)){focus(cmd.lat,cmd.lng,cmd.zoom||Math.max(zoom,1.35));}
    }
  };
  window.addEventListener('resize',resize);
  resize();
  requestAnimationFrame(tick);
})();
</script>
</body>
</html>`;
