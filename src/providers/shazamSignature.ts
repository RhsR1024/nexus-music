// Pure TypeScript Shazam acoustic fingerprint generator & recognition client.
// Clean-room implementation following the MIT-licensed ShazamIO / shazamio-core
// specification (shazamio/shazamio-core@0cc5697 & shazamio/ShazamIO@ff2d6ea, MIT).
// Takes standard 16-bit PCM WAV (fast-path at 16 kHz mono, matching NativeAudioMatch)
// and queries Shazam's public zh-CN discovery endpoint with zero API key required.

const SAMPLE_RATE_HZ = 16000;
const FRAME_LENGTH = 2048;
const HOP_LENGTH = 128;
const BIN_COUNT = FRAME_LENGTH / 2 + 1;
const HISTORY_LENGTH = 256;
const PEAK_LAG = 45;
const REFERENCE_LAG = 48;
const FREQ_NEIGHBOURS = [2, 3, 6, 9] as const;
const TIME_NEIGHBOURS = [4, 7, 14, 21, 28, 35, 42] as const;
const SPREAD_BACK_LAGS = [1, 3, 6] as const;
const FIRST_PEAK_BIN = 10;
const LAST_PEAK_BIN = 1014;
const MIN_PEAK_POWER = 1 / 64;
const MAX_SEGMENT_SECONDS = 12;

const DATA_URI_PREFIX = 'data:audio/vnd.shazam.sig;base64,';
const HEADER_MAGIC = 0xcafe2580;
const HEADER_SECOND_MAGIC = 0x94119c00;
const HEADER_FIXED_VALUE = 0x007c0000;
const SAMPLE_RATE_ID_16K = 3;
const BODY_MAGIC = 0x40000000;
const BAND_MARKER_BASE = 0x60030040;
const FRAME_ESCAPE = 0xff;

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const hasB = i + 1 < bytes.length;
    const hasC = i + 2 < bytes.length;
    const b = hasB ? bytes[i + 1]! : 0;
    const c = hasC ? bytes[i + 2]! : 0;
    const t = (a << 16) | (b << 8) | c;
    out += B64_CHARS[(t >>> 18) & 63];
    out += B64_CHARS[(t >>> 12) & 63];
    out += hasB ? B64_CHARS[(t >>> 6) & 63] : '=';
    out += hasC ? B64_CHARS[t & 63] : '=';
  }
  return out;
}

// Precomputed Hann window (`sin(pi * k / (N + 1))^2` for k = 1..N)
const HANN_WINDOW = (() => {
  const w = new Float32Array(FRAME_LENGTH);
  const period = FRAME_LENGTH + 1;
  for (let i = 0; i < FRAME_LENGTH; i++) {
    const s = Math.sin((Math.PI * (i + 1)) / period);
    w[i] = s * s;
  }
  return w;
})();

// Precomputed radix-2 FFT bit-reversal and twiddle tables for N = 2048
const FFT_BITS = 11;
const BIT_REV = (() => {
  const table = new Uint16Array(FRAME_LENGTH);
  for (let i = 0; i < FRAME_LENGTH; i++) {
    let x = i;
    let r = 0;
    for (let b = 0; b < FFT_BITS; b++) {
      r = (r << 1) | (x & 1);
      x >>>= 1;
    }
    table[i] = r;
  }
  return table;
})();

const TWIDDLE_COS = (() => {
  const half = FRAME_LENGTH >>> 1;
  const out = new Float64Array(half);
  for (let i = 0; i < half; i++) {
    out[i] = Math.cos((-2 * Math.PI * i) / FRAME_LENGTH);
  }
  return out;
})();

const TWIDDLE_SIN = (() => {
  const half = FRAME_LENGTH >>> 1;
  const out = new Float64Array(half);
  for (let i = 0; i < half; i++) {
    out[i] = Math.sin((-2 * Math.PI * i) / FRAME_LENGTH);
  }
  return out;
})();

// Standard IEEE 802.3 CRC32 table
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array, start = 0): number {
  let crc = 0xffffffff;
  for (let i = start; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function fft2048Power(windowed: Float64Array, re: Float64Array, im: Float64Array, power: Float32Array): void {
  for (let i = 0; i < FRAME_LENGTH; i++) {
    const rev = BIT_REV[i]!;
    re[rev] = windowed[i]!;
    im[rev] = 0;
  }

  for (let size = 2; size <= FRAME_LENGTH; size <<= 1) {
    const half = size >>> 1;
    const step = FRAME_LENGTH / size;
    for (let start = 0; start < FRAME_LENGTH; start += size) {
      for (let k = 0; k < half; k++) {
        const twIdx = k * step;
        const wr = TWIDDLE_COS[twIdx]!;
        const wi = TWIDDLE_SIN[twIdx]!;
        const i1 = start + k;
        const i2 = i1 + half;
        const tr = wr * re[i2]! - wi * im[i2]!;
        const ti = wr * im[i2]! + wi * re[i2]!;
        re[i2] = re[i1]! - tr;
        im[i2] = im[i1]! - ti;
        re[i1] = re[i1]! + tr;
        im[i1] = im[i1]! + ti;
      }
    }
  }

  for (let bin = 0; bin < BIN_COUNT; bin++) {
    const r = re[bin]!;
    const q = im[bin]!;
    const p = (r * r + q * q) / 131072.0;
    power[bin] = p > 1e-10 ? p : 1e-10;
  }
}

interface Peak {
  readonly frame: number;
  readonly magnitude: number;
  readonly refinedBin: number;
}

function bandForHz(hz: number): number {
  if (hz >= 250 && hz <= 519) return 0;
  if (hz >= 520 && hz <= 1449) return 1;
  if (hz >= 1450 && hz <= 3499) return 2;
  if (hz >= 3500 && hz <= 5500) return 3;
  return -1;
}

function logMagnitude(power: number): number {
  const ln = Math.log(power);
  return (ln > MIN_PEAK_POWER ? ln : MIN_PEAK_POWER) * 1477.3 + 6144.0;
}

/**
 * Extracts mono 16 kHz Int16 PCM samples from a standard RIFF/WAVE buffer.
 * Fast-paths 16 kHz mono 16-bit PCM (as produced by NativeAudioMatch);
 * downmixes stereo and linearly resamples other PCM sample rates to 16 kHz.
 */
export function decodeWavToPcm16k(wavBytes: Uint8Array): Int16Array {
  if (wavBytes.length < 44) {
    throw new Error('WAV 音频数据过短');
  }
  const dv = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  const tag = (off: number) =>
    String.fromCharCode(wavBytes[off]!, wavBytes[off + 1]!, wavBytes[off + 2]!, wavBytes[off + 3]!);

  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
    throw new Error('音频格式不是标准 WAV（请通过麦克风直接录制识曲）');
  }

  let audioFormat = 1;
  let channels = 1;
  let sampleRate = SAMPLE_RATE_HZ;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  let offset = 12;
  while (offset + 8 <= wavBytes.length) {
    const id = tag(offset);
    const size = dv.getUint32(offset + 4, true);
    const payloadStart = offset + 8;
    if (id === 'fmt ' && size >= 16 && payloadStart + 16 <= wavBytes.length) {
      audioFormat = dv.getUint16(payloadStart, true);
      channels = dv.getUint16(payloadStart + 2, true);
      sampleRate = dv.getUint32(payloadStart + 4, true);
      bitsPerSample = dv.getUint16(payloadStart + 14, true);
    } else if (id === 'data') {
      dataOffset = payloadStart;
      dataSize = Math.min(size, Math.max(0, wavBytes.length - payloadStart));
      break;
    }
    offset = payloadStart + size + (size & 1);
  }

  if (dataOffset < 0 || dataSize < 2) {
    throw new Error('WAV 缺少有效 PCM 音频数据');
  }
  if (audioFormat !== 1 || bitsPerSample !== 16 || channels < 1 || sampleRate < 4000) {
    throw new Error(`暂不支持的 WAV PCM 参数（格式 ${audioFormat}, ${bitsPerSample}bit, ${channels}ch, ${sampleRate}Hz）`);
  }

  const frameSize = channels * 2;
  const frameCount = Math.floor(dataSize / frameSize);
  const mono = new Int16Array(frameCount);

  if (channels === 1) {
    for (let i = 0; i < frameCount; i++) {
      mono[i] = dv.getInt16(dataOffset + i * 2, true);
    }
  } else {
    for (let i = 0; i < frameCount; i++) {
      let sum = 0;
      const base = dataOffset + i * frameSize;
      for (let c = 0; c < channels; c++) {
        sum += dv.getInt16(base + c * 2, true);
      }
      mono[i] = Math.round(sum / channels);
    }
  }

  if (sampleRate === SAMPLE_RATE_HZ) {
    return mono;
  }

  const targetCount = Math.max(1, Math.floor((mono.length * SAMPLE_RATE_HZ) / sampleRate));
  const resampled = new Int16Array(targetCount);
  const ratio = sampleRate / SAMPLE_RATE_HZ;
  for (let i = 0; i < targetCount; i++) {
    const src = i * ratio;
    const idx = Math.floor(src);
    const frac = src - idx;
    const s0 = mono[Math.min(idx, mono.length - 1)]!;
    const s1 = mono[Math.min(idx + 1, mono.length - 1)]!;
    resampled[i] = Math.round(s0 + (s1 - s0) * frac);
  }
  return resampled;
}

export interface ShazamSignaturePayload {
  readonly uri: string;
  readonly samplems: number;
  readonly peakCount: number;
  readonly bytes: Uint8Array;
}

function encodeBandPeaks(peaks: readonly Peak[]): Uint8Array {
  const out: number[] = [];
  let prevFrame = 0;
  for (const peak of peaks) {
    let delta = peak.frame - prevFrame;
    if (delta < 0) delta = 0;
    if (delta >= FRAME_ESCAPE) {
      out.push(
        FRAME_ESCAPE,
        peak.frame & 0xff,
        (peak.frame >>> 8) & 0xff,
        (peak.frame >>> 16) & 0xff,
        (peak.frame >>> 24) & 0xff,
      );
      delta = 0;
    }
    out.push(
      delta & 0xff,
      peak.magnitude & 0xff,
      (peak.magnitude >>> 8) & 0xff,
      peak.refinedBin & 0xff,
      (peak.refinedBin >>> 8) & 0xff,
    );
    prevFrame = peak.frame;
  }
  return Uint8Array.from(out);
}

/**
 * Generates a Shazam binary signature URI from mono 16 kHz Int16 PCM samples.
 */
export function buildShazamSignatureFromPcm16k(allSamples: Int16Array): ShazamSignaturePayload {
  const maxSamples = MAX_SEGMENT_SECONDS * SAMPLE_RATE_HZ;
  const samples =
    allSamples.length <= maxSamples
      ? allSamples
      : allSamples.subarray(
          Math.floor((allSamples.length - maxSamples) / 2),
          Math.floor((allSamples.length + maxSamples) / 2),
        );

  const historyPower: Float32Array[] = Array.from({ length: HISTORY_LENGTH }, () => new Float32Array(BIN_COUNT));
  const historySpread: Float32Array[] = Array.from({ length: HISTORY_LENGTH }, () => new Float32Array(BIN_COUNT));
  let historyCount = 0;

  const ringSamples = new Int16Array(FRAME_LENGTH);
  const windowed = new Float64Array(FRAME_LENGTH);
  const re = new Float64Array(FRAME_LENGTH);
  const im = new Float64Array(FRAME_LENGTH);

  const peaksByBand: [Peak[], Peak[], Peak[], Peak[]] = [[], [], [], []];

  const slotAt = (lag: number) => (historyCount + HISTORY_LENGTH - 1 - lag) % HISTORY_LENGTH;

  const totalHops = Math.floor(samples.length / HOP_LENGTH);
  for (let hop = 0; hop < totalHops; hop++) {
    ringSamples.copyWithin(0, HOP_LENGTH);
    const hopOffset = hop * HOP_LENGTH;
    ringSamples.set(samples.subarray(hopOffset, hopOffset + HOP_LENGTH), FRAME_LENGTH - HOP_LENGTH);

    for (let i = 0; i < FRAME_LENGTH; i++) {
      windowed[i] = ringSamples[i]! * HANN_WINDOW[i]!;
    }

    historyCount += 1;
    const currSlot = slotAt(0);
    const power = historyPower[currSlot]!;
    const spread = historySpread[currSlot]!;

    fft2048Power(windowed, re, im, power);

    for (let bin = 0; bin < BIN_COUNT - 2; bin++) {
      const a = power[bin]!;
      const b = power[bin + 1]!;
      const c = power[bin + 2]!;
      spread[bin] = a >= b ? (a >= c ? a : c) : (b >= c ? b : c);
    }
    spread[BIN_COUNT - 2] = power[BIN_COUNT - 2]!;
    spread[BIN_COUNT - 1] = power[BIN_COUNT - 1]!;

    for (const lag of SPREAD_BACK_LAGS) {
      const earlier = historySpread[slotAt(lag)]!;
      for (let bin = 0; bin < BIN_COUNT; bin++) {
        if (spread[bin]! > earlier[bin]!) earlier[bin] = spread[bin]!;
      }
    }

    if (historyCount > PEAK_LAG) {
      const frameIndex = historyCount - 1 - PEAK_LAG;
      const candidate = historyPower[slotAt(PEAK_LAG)]!;
      const reference = historySpread[slotAt(REFERENCE_LAG)]!;

      for (let bin = FIRST_PEAK_BIN; bin <= LAST_PEAK_BIN; bin++) {
        const p = candidate[bin]!;
        const below = bin - 1;
        if (p < MIN_PEAK_POWER || p < reference[below]!) continue;

        let isPeak = true;
        for (let i = 0; i < FREQ_NEIGHBOURS.length; i++) {
          const d = FREQ_NEIGHBOURS[i]!;
          if (!(p > reference[below - d]! && p > reference[below + d]!)) {
            isPeak = false;
            break;
          }
        }
        if (!isPeak) continue;

        for (let i = 0; i < TIME_NEIGHBOURS.length; i++) {
          const d = TIME_NEIGHBOURS[i]!;
          if (!(p > historySpread[slotAt(REFERENCE_LAG - d)]![below]! && p > historySpread[slotAt(REFERENCE_LAG + d)]![below]!)) {
            isPeak = false;
            break;
          }
        }
        if (!isPeak) continue;

        const mag = logMagnitude(p);
        const magBelow = logMagnitude(candidate[bin - 1]!);
        const magAbove = logMagnitude(candidate[bin + 1]!);
        const curvature = mag * 2 - magBelow - magAbove;
        if (curvature === 0) continue;
        const vertexOffset = Math.trunc(((magAbove - magBelow) * 32.0) / curvature);
        const refinedBin = (bin * 64 + vertexOffset) & 0xffff;
        const hz = Math.floor((refinedBin * 125) / 1024);
        const band = bandForHz(hz);
        if (band < 0) continue;

        peaksByBand[band]!.push({
          frame: frameIndex,
          magnitude: Math.trunc(mag) & 0xffff,
          refinedBin,
        });
      }
    }
  }

  // Assemble band TLV chunks
  const bodyChunks: Uint8Array[] = [];
  let bodyByteLen = 0;
  let peakCount = 0;

  for (let band = 0; band < 4; band++) {
    const peaks = peaksByBand[band]!;
    if (!peaks.length) continue;
    peakCount += peaks.length;
    const encoded = encodeBandPeaks(peaks);
    const pad = (4 - (encoded.length % 4)) % 4;
    const chunk = new Uint8Array(8 + encoded.length + pad);
    const dv = new DataView(chunk.buffer);
    dv.setUint32(0, (BAND_MARKER_BASE + band) >>> 0, true);
    dv.setUint32(4, encoded.length >>> 0, true);
    chunk.set(encoded, 8);
    bodyChunks.push(chunk);
    bodyByteLen += chunk.length;
  }

  const bodyLength = (bodyByteLen + 8) >>> 0;
  const paddedSampleCount = (samples.length + Math.floor((SAMPLE_RATE_HZ * 24) / 100)) >>> 0;

  const totalBytes = 48 + bodyLength;
  const signature = new Uint8Array(totalBytes);
  const headerDv = new DataView(signature.buffer);

  const words = [
    HEADER_MAGIC,
    0,
    bodyLength,
    HEADER_SECOND_MAGIC,
    0,
    0,
    0,
    (SAMPLE_RATE_ID_16K << 27) >>> 0,
    0,
    0,
    paddedSampleCount,
    HEADER_FIXED_VALUE,
    BODY_MAGIC,
    bodyLength,
  ];
  for (let i = 0; i < words.length; i++) {
    headerDv.setUint32(i * 4, words[i]! >>> 0, true);
  }

  let cursor = 56;
  for (const chunk of bodyChunks) {
    signature.set(chunk, cursor);
    cursor += chunk.length;
  }

  headerDv.setUint32(4, crc32(signature, 8), true);

  const samplems = Math.floor((samples.length / SAMPLE_RATE_HZ) * 1000);
  return {
    uri: DATA_URI_PREFIX + encodeBase64(signature),
    samplems,
    peakCount,
    bytes: signature,
  };
}

export function buildShazamSignatureFromWav(wavBytes: Uint8Array): ShazamSignaturePayload {
  return buildShazamSignatureFromPcm16k(decodeWavToPcm16k(wavBytes));
}

function randomUuidUpper(): string {
  const hex = '0123456789ABCDEF';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.floor(Math.random() * 4) + 8)];
    else out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

export interface ShazamTrackMatch {
  readonly title: string;
  readonly artist: string;
  readonly album?: string;
  readonly releaseDate?: string;
}

export async function recognizeWithShazam(
  wavBytes: Uint8Array,
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ShazamTrackMatch | null> {
  const sig = buildShazamSignatureFromWav(wavBytes);
  if (sig.peakCount < 5) {
    return null;
  }
  const uuid1 = randomUuidUpper();
  const uuid2 = randomUuidUpper();
  const url =
    `https://amp.shazam.com/discovery/v5/zh-CN/CN/iphone/-/tag/${uuid1}/${uuid2}` +
    '?sync=true&webv3=true&sampling=true&connected=&shazamapiversion=v3&sharehub=true&hubv5minorversion=v5.1&hidelb=true&video=v3';

  const body = JSON.stringify({
    timezone: 'Asia/Shanghai',
    signature: {
      uri: sig.uri,
      samplems: sig.samplems,
    },
    timestamp: Date.now(),
    context: {},
    geolocation: {},
  });

  const resp = await fetchFn(url, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      'X-Shazam-Platform': 'IPHONE',
      'X-Shazam-AppVersion': '14.1.0',
      Accept: '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'User-Agent': 'Shazam/14.1.0 (iPhone; iOS 17.5; Scale/3.00)',
    },
    body,
    signal,
  });
  if (!resp.ok) {
    throw new Error(`Shazam 识曲服务返回 HTTP ${resp.status}，请稍后重试`);
  }

  const json = (await resp.json()) as {
    track?: {
      title?: string;
      subtitle?: string;
      sections?: Array<{
        type?: string;
        metadata?: Array<{ title?: string; text?: string }>;
      }>;
    };
  };

  const track = json?.track;
  if (!track?.title) return null;

  let album: string | undefined;
  let releaseDate: string | undefined;
  for (const section of track.sections ?? []) {
    if (!Array.isArray(section.metadata)) continue;
    for (const meta of section.metadata) {
      const k = (meta.title ?? '').trim().toLowerCase();
      const v = (meta.text ?? '').trim();
      if (!v) continue;
      if (!album && (k === 'album' || k === '专辑' || k === '專輯')) album = v;
      if (!releaseDate && (k === 'released' || k === '发行' || k === '发行日期' || k === '發行')) releaseDate = v;
    }
  }

  return {
    title: track.title.trim(),
    artist: (track.subtitle || '未知歌手').trim(),
    ...(album ? { album } : {}),
    ...(releaseDate ? { releaseDate } : {}),
  };
}
