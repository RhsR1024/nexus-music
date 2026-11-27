import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDidlLiteMetadata,
  buildSoapEnvelope,
  DlnaCastController,
  formatUpnpTime,
  parseUpnpDeviceDescription,
  parseUpnpTime,
} from '../src/providers/dlna.ts';
import { assessAcousticSignal, AudioMatchCoordinator } from '../src/providers/audioMatch.ts';
import { formatBluetoothLyric } from '../src/lyrics/bluetoothLyrics.ts';
import { defaults, PreferenceStore, validatePreferences } from '../src/app/preferences.ts';
import type { Track } from '../src/domain/track.ts';

const sampleTrack: Track = {
  origin: { kind: 'online', platform: 'wy', id: '186016' },
  title: '晴天 & <Live>',
  artist: '周杰伦',
  album: '叶惠美',
  durationMs: 269000,
  artwork: 'https://p2.music.126.net/cover.jpg',
  metadata: {},
  qualities: [{ id: 'flac' }],
};

test('DLNA parses UPnP MediaRenderer XML, builds escaped DIDL-Lite/SOAP, casts via relay and controls playback', async () => {
  const xml = `<?xml version="1.0"?>
  <root><device>
    <UDN>uuid:living-room-tv</UDN>
    <friendlyName>客厅电视 &amp; 音响</friendlyName>
    <manufacturer>Sony</manufacturer>
    <modelName>BRAVIA-X90</modelName>
    <serviceList>
      <service>
        <serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>
        <controlURL>/upnp/control/avtransport</controlURL>
      </service>
      <service>
        <serviceType>urn:schemas-upnp-org:service:RenderingControl:1</serviceType>
        <controlURL>/upnp/control/rendering</controlURL>
      </service>
    </serviceList>
  </device></root>`;

  const device = parseUpnpDeviceDescription('http://192.168.1.25:49152/desc.xml', xml, 1000);
  assert.ok(device);
  assert.equal(device.friendlyName, '客厅电视 & 音响');
  assert.equal(device.avTransportControlUrl, 'http://192.168.1.25:49152/upnp/control/avtransport');
  assert.equal(device.renderingControlUrl, 'http://192.168.1.25:49152/upnp/control/rendering');

  const didl = buildDidlLiteMetadata('http://192.168.1.10:5555/tok', sampleTrack);
  assert.ok(didl.includes('晴天 &amp; &lt;Live&gt;'));
  assert.equal(formatUpnpTime(3723), '01:02:03');
  assert.equal(parseUpnpTime('01:02:03'), 3723);
  assert.ok(buildSoapEnvelope('urn:test', 'Play', '<InstanceID>0</InstanceID>').includes('u:Play'));

  const soapActions: string[] = [];
  let relayStarted = false;
  let relayStopped = false;
  let keepAlive: boolean | null = null;
  const db = new Map<string, unknown>();

  const controller = new DlnaCastController({
    native: {
      dlnaDiscover: async () => [{ location: 'http://192.168.1.25:49152/desc.xml', usn: 'uuid:living-room-tv' }],
      dlnaStartRelay: async () => {
        relayStarted = true;
        return { url: 'http://192.168.1.10:50123/abc', host: '192.168.1.10', port: '50123' };
      },
      dlnaStopRelay: async () => { relayStopped = true; },
      dlnaSetKeepAlive: async enabled => { keepAlive = enabled; },
    },
    repository: {
      get: async <T>(k: string) => db.get(k) as T | undefined,
      put: async (k, v) => { db.set(k, v); },
    },
    http: async (url, init) => {
      if (init?.method === 'GET') {
        return { ok: true, status: 200, text: async () => xml };
      }
      const action = init?.headers?.SOAPACTION ?? '';
      soapActions.push(action);
      if (action.includes('GetPositionInfo')) {
        return { ok: true, status: 200, text: async () => '<RelTime>00:00:42</RelTime><TrackDuration>00:04:29</TrackDuration>' };
      }
      if (action.includes('GetTransportInfo')) {
        return { ok: true, status: 200, text: async () => '<CurrentTransportState>PLAYING</CurrentTransportState>' };
      }
      if (action.includes('GetVolume')) {
        return { ok: true, status: 200, text: async () => '<CurrentVolume>64</CurrentVolume>' };
      }
      return { ok: true, status: 200, text: async () => '<ok/>' };
    },
  });

  const found = await controller.discover(2000);
  assert.equal(found.length, 1);

  await controller.castTrack(found[0]!, 'file:///var/mobile/song.flac', sampleTrack);
  assert.equal(relayStarted, true);
  assert.equal(keepAlive, true);
  assert.ok(soapActions.some(a => a.includes('#SetAVTransportURI')));
  assert.ok(soapActions.some(a => a.includes('#Play')));

  await controller.setVolume(75);
  assert.equal(controller.getSnapshot().volume, 75);
  await controller.seek(90);
  assert.equal(controller.getSnapshot().positionSec, 90);
  await controller.pause();
  assert.equal(controller.getSnapshot().transportState, 'PAUSED_PLAYBACK');
  await controller.disconnect();
  assert.equal(relayStopped, true);
  assert.equal(keepAlive, false);
  assert.equal(controller.getSnapshot().activeDevice, null);
  assert.equal(controller.getSnapshot().recent.length, 1);
});

test('AudioMatchCoordinator assesses acoustic signal, searches phrases across platforms, and persists history', async () => {
  const quiet = assessAcousticSignal({
    durationMs: 6000,
    sampleRate: 16000,
    avgLevel: 0.001,
    peakLevel: 0.005,
    zeroCrossings: 120,
    energySignature: '000000000000000000000000',
    cancelled: false,
  });
  assert.equal(quiet.quality, 'too-quiet');

  const db = new Map<string, unknown>();
  const coord = new AudioMatchCoordinator({
    native: {
      audioMatchPermission: async () => 'granted',
      audioMatchRequestPermission: async () => true,
      audioMatchStart: async () => ({
        durationMs: 4000,
        sampleRate: 16000,
        avgLevel: 0.12,
        peakLevel: 0.45,
        zeroCrossings: 4200,
        energySignature: '3456789abcdef123456789ab',
        cancelled: false,
      }),
      audioMatchStop: async () => {},
    },
    repository: {
      get: async <T>(k: string) => db.get(k) as T | undefined,
      put: async (k, v) => { db.set(k, v); },
    },
    search: async platform => ({
      items: [
        {
          origin: { kind: 'online', platform, id: '555' },
          title: '七里香',
          artist: '周杰伦',
          metadata: {},
          qualities: [],
        },
      ],
    }),
  });

  const cap = await coord.startListening(4000);
  assert.ok(cap);
  assert.equal(cap.energySignature, '3456789abcdef123456789ab');

  const found = await coord.searchByLyricOrPhrase('窗外的麻雀在电线杆上多嘴');
  assert.equal(found.length, 1);
  await coord.recordMatch(found[0]!);
  assert.equal(coord.getSnapshot().history.length, 1);
});

test('Bluetooth lyrics formatting and floating/car lyric preferences validate and persist', async () => {
  assert.equal(formatBluetoothLyric('故事的小黄花', sampleTrack, 'artist', 'lyric-first'), '故事的小黄花');
  assert.equal(formatBluetoothLyric('故事的小黄花', sampleTrack, 'artist', 'artist-first'), '周杰伦 · 故事的小黄花');
  assert.equal(formatBluetoothLyric('故事的小黄花', sampleTrack, 'title', 'artist-first'), '晴天 & <Live> · 故事的小黄花');
  assert.equal(formatBluetoothLyric('   ', sampleTrack, 'artist', 'artist-first'), null);

  const valid = validatePreferences({
    ...defaults,
    bluetoothLyricsOrder: 'artist-first',
    bluetoothLyricsRestoreOnPause: false,
    floatingLyricsEnabled: true,
    floatingLyricsLocked: true,
  });
  assert.equal(valid.bluetoothLyricsOrder, 'artist-first');
  assert.equal(valid.floatingLyricsLocked, true);

  const db = new Map<string, unknown>();
  const store = new PreferenceStore({
    get: async <T>(k: string) => db.get(k) as T | undefined,
    put: async (k, v) => { db.set(k, v); },
  });
  await store.update({ bluetoothLyricsOrder: 'artist-first', floatingLyricsEnabled: true });
  assert.equal(store.getSnapshot().bluetoothLyricsOrder, 'artist-first');
  assert.equal(store.getSnapshot().floatingLyricsEnabled, true);
});
