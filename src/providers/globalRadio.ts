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

/** Self-contained offline 3D interactive orthographic Earth HTML (zero external CDN or WebGL crashes). */
export const RADIO_GLOBE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#07121e;touch-action:none;user-select:none;-webkit-user-select:none;}
  canvas{display:block;width:100%;height:100%;}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
(function(){
  var canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
  var dpr=Math.min(window.devicePixelRatio||1,2),W=300,H=300;
  var rotLng=105,rotLat=26,zoom=1.0,points=[],selected='';
  var dragging=false,moved=false,sx=0,sy=0,slng=0,slat=0,vx=0,vy=0,anim=null;
  var land=[
    [[35,-10],[37,10],[30,32],[12,44],[-10,40],[-34,20],[-34,18],[-15,12],[5,-8],[15,-17],[35,-10]],
    [[36,-9],[43,-9],[51,2],[59,10],[70,25],[68,60],[60,100],[66,140],[65,170],[50,140],[40,124],[22,114],[10,105],[20,92],[8,77],[25,65],[30,48],[41,29],[36,-9]],
    [[70,-165],[60,-140],[50,-125],[32,-117],[15,-92],[8,-78],[20,-87],[25,-80],[45,-65],[60,-65],[70,-95],[70,-165]],
    [[12,-72],[5,-52],[-5,-35],[-23,-43],[-54,-68],[-40,-73],[-18,-71],[0,-80],[12,-72]],
    [[-12,130],[-14,142],[-28,153],[-38,145],[-34,115],[-22,114],[-12,130]],
    [[72,-45],[80,-20],[70,-22],[60,-44],[72,-45]]
  ];
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
    W=window.innerWidth||300;H=window.innerHeight||300;
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
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
    var step=zoom<1.1?12:zoom<1.7?6:3;
    var map={};
    for(var i=0;i<points.length;i++){
      var p=points[i];
      if(!isFinite(p.lat)||!isFinite(p.lng))continue;
      var k=Math.floor((p.lat+90)/step)+':'+Math.floor((p.lng+180)/step);
      var g=map[k];
      if(!g){g={lat:0,lng:0,count:0,first:p,selected:false};map[k]=g;}
      g.lat+=p.lat;g.lng+=p.lng;g.count++;
      if(p.id===selected)g.selected=true;
    }
    var arr=[];
    for(var k in map){var g=map[k];g.lat/=g.count;g.lng/=g.count;arr.push(g);}
    return arr;
  }
  var screenPins=[];
  function draw(){
    ctx.clearRect(0,0,W,H);
    var cx=W/2,cy=H*0.52,R=Math.min(W,H)*0.43*zoom;
    var halo=ctx.createRadialGradient(cx,cy,R*0.85,cx,cy,R*1.25);
    halo.addColorStop(0,'rgba(86,185,209,0.22)');
    halo.addColorStop(1,'rgba(7,18,30,0)');
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,R*1.25,0,Math.PI*2);ctx.fill();

    var ocean=ctx.createRadialGradient(cx-R*0.32,cy-R*0.32,R*0.08,cx,cy,R);
    ocean.addColorStop(0,'#174469');ocean.addColorStop(0.55,'#0d2a45');ocean.addColorStop(1,'#061321');
    ctx.save();
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.fillStyle=ocean;ctx.fill();ctx.clip();

    ctx.strokeStyle='rgba(120,190,220,0.12)';ctx.lineWidth=0.7;
    for(var lat=-60;lat<=60;lat+=30){
      ctx.beginPath();var started=false;
      for(var lng=-180;lng<=180;lng+=6){
        var pt=proj(lat,lng,R,cx,cy);
        if(pt.z>=0){if(!started){ctx.moveTo(pt.x,pt.y);started=true;}else ctx.lineTo(pt.x,pt.y);}else started=false;
      }
      ctx.stroke();
    }
    for(var lng=-180;lng<180;lng+=30){
      ctx.beginPath();var started=false;
      for(var lat=-84;lat<=84;lat+=6){
        var pt=proj(lat,lng,R,cx,cy);
        if(pt.z>=0){if(!started){ctx.moveTo(pt.x,pt.y);started=true;}else ctx.lineTo(pt.x,pt.y);}else started=false;
      }
      ctx.stroke();
    }

    ctx.fillStyle='#2a5a4e';ctx.strokeStyle='rgba(140,210,185,0.35)';ctx.lineWidth=1;
    for(var c=0;c<land.length;c++){
      var poly=land[c],vis=0;
      ctx.beginPath();
      for(var i=0;i<poly.length;i++){
        var pt=proj(poly[i][0],poly[i][1],R,cx,cy);
        if(pt.z>-0.15)vis++;
        if(i===0)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y);
      }
      if(vis>=3){ctx.closePath();ctx.fill();ctx.stroke();}
    }

    screenPins=[];
    var clusters=cluster();
    for(var i=0;i<clusters.length;i++){
      var g=clusters[i],pt=proj(g.lat,g.lng,R,cx,cy);
      if(pt.z<=0.04)continue;
      var rad=g.selected?7:Math.min(8,3.2+Math.log2(g.count+1)*1.1);
      ctx.beginPath();ctx.arc(pt.x,pt.y,rad+3,0,Math.PI*2);
      ctx.fillStyle=g.selected?'rgba(255,190,121,0.32)':'rgba(92,229,207,0.22)';ctx.fill();
      ctx.beginPath();ctx.arc(pt.x,pt.y,rad,0,Math.PI*2);
      ctx.fillStyle=g.selected?'#ffbe79':'#5ce5cf';ctx.fill();
      screenPins.push({x:pt.x,y:pt.y,r:rad+10,g:g});
    }
    ctx.restore();
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.strokeStyle='rgba(92,229,207,0.38)';ctx.lineWidth=1.2;ctx.stroke();
  }
  function focus(lat,lng,z){
    var startLat=rotLat,startLng=rotLng,startZ=zoom,targetZ=z||zoom;
    var dl=((lng-startLng+540)%360)-180,t0=performance.now();
    if(anim)cancelAnimationFrame(anim);
    function step(now){
      var t=Math.min(1,(now-t0)/420),e=1-Math.pow(1-t,3);
      rotLat=startLat+(lat-startLat)*e;
      rotLng=startLng+dl*e;
      zoom=startZ+(targetZ-startZ)*e;
      draw();
      anim=t<1?requestAnimationFrame(step):null;
    }
    anim=requestAnimationFrame(step);
  }
  canvas.addEventListener('pointerdown',function(e){
    if(anim){cancelAnimationFrame(anim);anim=null;}
    dragging=true;moved=false;sx=e.clientX;sy=e.clientY;slng=rotLng;slat=rotLat;
  });
  canvas.addEventListener('pointermove',function(e){
    if(!dragging)return;
    var dx=e.clientX-sx,dy=e.clientY-sy;
    if(Math.hypot(dx,dy)>5)moved=true;
    rotLng=slng-dx*(0.38/zoom);
    rotLat=Math.max(-78,Math.min(78,slat+dy*(0.38/zoom)));
    draw();
  });
  canvas.addEventListener('pointerup',function(e){
    dragging=false;
    if(!moved){
      var best=null,bestD=999;
      for(var i=0;i<screenPins.length;i++){
        var pin=screenPins[i],d=Math.hypot(e.clientX-pin.x,e.clientY-pin.y);
        if(d<=pin.r&&d<bestD){best=pin.g;bestD=d;}
      }
      if(best){
        if(best.count===1){
          selected=best.first.id;
          focus(best.lat,best.lng,Math.max(zoom,1.25));
          post({type:'station',uuid:best.first.id,lat:best.lat,lng:best.lng});
        }else{
          focus(best.lat,best.lng,Math.min(2.4,zoom*1.35));
          post({type:'area',lat:best.lat,lng:best.lng});
        }
      }
    }
  });
  window.nexusGlobe={
    setData:function(payload){
      points=Array.isArray(payload.points)?payload.points:[];
      selected=payload.selected||'';
      draw();
    },
    command:function(cmd){
      if(!cmd||!cmd.type)return;
      if(cmd.type==='zoom'){zoom=Math.max(0.75,Math.min(2.6,zoom*(cmd.factor||1)));draw();}
      else if(cmd.type==='reset'){focus(26,105,1.0);}
      else if(cmd.type==='focus'&&isFinite(cmd.lat)&&isFinite(cmd.lng)){focus(cmd.lat,cmd.lng,cmd.zoom||Math.max(zoom,1.3));}
    }
  };
  window.addEventListener('resize',resize);
  resize();
})();
</script>
</body>
</html>`;
