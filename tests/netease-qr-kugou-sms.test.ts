import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { encodeQrPngDataUri } from '../src/domain/qrPng.ts';
import { extractNeteaseSetCookies, NeteaseQrLoginClient, NeteaseQrLoginCoordinator } from '../src/providers/neteaseQrLogin.ts';
import { kugouAesDecrypt, kugouAesEncrypt, kugouRsaEncrypt } from '../src/providers/kugouCrypto.ts';
import { KugouLoginClient, KugouLoginError, validKugouQrImage } from '../src/providers/kugouLogin.ts';
import { KugouLoginCoordinator } from '../src/providers/kugouLoginCoordinator.ts';
import { MusicAccounts } from '../src/providers/musicAccounts.ts';
import { QQPlaylists } from '../src/providers/qqPlaylists.ts';
import { QQDailyAuthorization } from '../src/providers/qqDailyAuthorization.ts';
import { defaults, validatePreferences } from '../src/app/preferences.ts';

const md5 = async (v: string) => createHash('md5').update(v).digest('hex');
const sha256 = async (v: string) => createHash('sha256').update(v).digest('hex');

test('local QR PNG generator creates valid PNG passing image bounds', () => {
  const uri = encodeQrPngDataUri('https://music.163.com/login?codekey=481f41a1-9f91-4ff9-988f-561e735f2e83');
  assert.ok(uri.startsWith('data:image/png;base64,'));
  assert.equal(validKugouQrImage(uri), true);
});

test('NetEase QR login extracts Set-Cookie across comma-joined headers and saves verified account', async () => {
  const cookies = extractNeteaseSetCookies([
    'NMTID=nmt123; Expires=Mon, 24 Nov 2036 01:43:18 GMT; Path=/, MUSIC_U=token_abc_999; Expires=Tue, 01 Dec 2026 00:00:00 GMT; Path=/, __csrf=csrf_456; Path=/',
  ]);
  assert.equal(cookies.MUSIC_U, 'token_abc_999');
  assert.equal(cookies.__csrf, 'csrf_456');

  let pollStep = 0;
  const client = new NeteaseQrLoginClient({
    http: async url => {
      if (url.endsWith('/weapi/login/qrcode/unikey')) {
        return { body: { code: 200, unikey: '481f41a1-9f91-4ff9-988f-561e735f2e83' }, setCookies: [] };
      }
      pollStep++;
      if (pollStep === 1) return { body: { code: 802, nickname: 'Scanned User' }, setCookies: [] };
      return {
        body: { code: 803 },
        setCookies: ['MUSIC_U=qr_secret_token; Path=/; HttpOnly', '__csrf=qr_csrf; Path=/'],
      };
    },
  });

  const records = new Map<string, unknown>();
  const secrets = new Map<string, string>();
  const accounts = new MusicAccounts(
    { get: async <T>(k: string) => records.get(k) as T | undefined, put: async (k, v) => { records.set(k, v); } },
    { get: async k => secrets.get(k) ?? null, set: async (k, v) => { secrets.set(k, v); }, remove: async k => { secrets.delete(k); } },
    sha256,
  );
  const coord = new NeteaseQrLoginCoordinator({
    client,
    profile: { fetch: async () => ({ userId: '888999', nickname: 'QR Listener', avatar: 'https://p1.music.126.net/a.jpg' }) },
    accounts,
    pollMs: 5,
  });

  await coord.login();
  assert.equal(coord.getSnapshot().status, 'succeeded');
  assert.equal(accounts.getSnapshot().length, 1);
  assert.equal(accounts.getSnapshot()[0]?.displayName, 'QR Listener');
  const savedSession = await accounts.session(accounts.getSnapshot()[0]!.id);
  assert.equal((savedSession.cookies as Record<string, string>).MUSIC_U, 'qr_secret_token');
});

test('Kugou AES-256-CBC matches Node crypto and RSA produces 256-char uppercase hex', async () => {
  const tempKey = 'abcdefghijklmnop';
  const payload = { mobile: '13800138000', code: '123456' };
  const enc = await kugouAesEncrypt(payload, md5, tempKey);
  const derived = await md5(tempKey);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(derived, 'utf8'), Buffer.from(derived.slice(16), 'utf8'));
  const expectedHex = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]).toString('hex');
  assert.equal(enc.str, expectedHex);

  const decrypted = await kugouAesDecrypt(enc.str, tempKey, md5);
  assert.deepEqual(decrypted, payload);

  const dec = createDecipheriv('aes-256-cbc', Buffer.from(derived, 'utf8'), Buffer.from(derived.slice(16), 'utf8'));
  const nodePlain = Buffer.concat([dec.update(Buffer.from(enc.str, 'hex')), dec.final()]).toString('utf8');
  assert.equal(nodePlain, JSON.stringify(payload));

  const pk = kugouRsaEncrypt({ clienttime_ms: 1700000000000, key: tempKey });
  assert.match(pk, /^[0-9A-F]{256}$/);
});

test('Kugou phone SMS login sends code, handles captcha error cleanly, and decrypts secu_params token', async () => {
  const signal = new AbortController().signal;
  let step = 0;
  const client = new KugouLoginClient({
    md5,
    nonce: () => 'unit-nonce-1',
    now: () => 1700000000000,
    http: async (url, req) => {
      step++;
      if (url.includes('/v7/send_mobile_code')) {
        const body = JSON.parse(req.body ?? '{}');
        assert.equal(body.businessid, 5);
        assert.equal(body.mobile, '13800138000');
        return { status: 1, error_code: 0, data: {} };
      }
      if (url.includes('/v7/login_by_verifycode')) {
        const body = JSON.parse(req.body ?? '{}');
        assert.equal(body.mobile, '13*****0');
        assert.match(body.pk, /^[0-9A-F]{256}$/);
        return { status: 1, error_code: 0, data: { userid: 654321, token: 'kg-sms-token', nickname: 'Kugou SMS User' } };
      }
      throw new Error(`unexpected ${url}`);
    },
  });

  const sent = await client.sendPhoneCode('13800138000', signal);
  assert.match(sent.mid, /^[a-f0-9]{32}$/);

  const records = new Map<string, unknown>();
  const secrets = new Map<string, string>();
  const accounts = new MusicAccounts(
    { get: async <T>(k: string) => records.get(k) as T | undefined, put: async (k, v) => { records.set(k, v); } },
    { get: async k => secrets.get(k) ?? null, set: async (k, v) => { secrets.set(k, v); }, remove: async k => { secrets.delete(k); } },
    sha256,
  );
  const coord = new KugouLoginCoordinator({ client, accounts });
  await coord.loginWithPhone('13800138000', '123456', sent.mid, signal);
  assert.equal(step, 2);
  assert.equal(accounts.getSnapshot()[0]?.displayName, 'Kugou SMS User');
  assert.equal((await accounts.session(accounts.getSnapshot()[0]!.id)).token, 'kg-sms-token');

  // Captcha response should never attempt bypass and should raise clear captcha_required error
  const captchaClient = new KugouLoginClient({
    md5,
    nonce: () => 'unit-nonce-2',
    http: async () => ({ status: 0, error_code: 20028, data: '需要人机验证' }),
  });
  await assert.rejects(
    captchaClient.sendPhoneCode('13800138000', signal),
    (err: unknown) => err instanceof KugouLoginError && err.kind === 'captcha_required',
  );
});

test('QQ playlists succeed even when c6 returns 1306 (missing encryptedUin) and skips system dirs 202/205/206', async () => {
  const account = { id: 'c'.repeat(64), platform: 'tx' as const, username: 'qq:2:123', label: 'QQ', capabilities: [] as const, updatedAt: 1 };
  const session = { version: 1, platform: 'tx', accountId: account.id, userId: '123', cookies: { login_type: '1', uin: '123', qqmusic_key: 'unit-only' } };
  const reader = new QQPlaylists({
    profile: { fetch: async () => ({ userId: '123', nickname: 'Challenged User' }) },
    http: async (_url, req) => {
      const body = JSON.parse(req.body ?? '{}');
      if (body.created) {
        return {
          code: 0,
          created: {
            code: 0,
            data: {
              v_playlist: [
                { dirId: 201, tid: '55555', dirName: '我喜欢', songNum: 12 },
                { dirId: 205, dirName: '' },
                { tid: '77777', dirName: '我的收藏单', songNum: 8 },
              ],
              hasmore: 0,
            },
          },
        };
      }
      if (body.liked) return { code: 0, liked: { code: 0, data: { total_song_num: 12 } } };
      if (body.favorite) return { code: 0, favorite: { code: 0, data: { v_list: [{ tid: '88888', dirName: '收藏歌单', songNum: 4 }], hasmore: 0 } } };
      return { code: 0 };
    },
  });
  const lists = await reader.list(account, session, new AbortController().signal, () => {});
  assert.deepEqual(lists.map(l => [l.id, l.title, l.kind]), [
    ['55555', '我喜欢', 'created'],
    ['77777', '我的收藏单', 'created'],
    ['88888', '收藏歌单', 'favorite'],
  ]);
});

test('QQ manual Skills key validates against logged-in QQ account and persists daily capability', async () => {
  const records = new Map<string, unknown>();
  const secrets = new Map<string, string>();
  const accounts = new MusicAccounts(
    { get: async <T>(k: string) => records.get(k) as T | undefined, put: async (k, v) => { records.set(k, v); } },
    { get: async k => secrets.get(k) ?? null, set: async (k, v) => { secrets.set(k, v); }, remove: async k => { secrets.delete(k); } },
    sha256,
  );
  const existing = await accounts.save(
    { platform: 'tx', username: 'qq:2:123', label: 'QQ 音乐', displayName: 'Test QQ', capabilities: [] },
    { version: 1, platform: 'tx', userId: '123', cookies: { login_type: '1', uin: '123', qqmusic_key: 'k' } },
  );
  let validatedKey = '';
  const auth = new QQDailyAuthorization({
    native: { openQQDaily: async () => '', cancel: async () => {} },
    accounts,
    profile: { fetch: async () => ({ userId: '123', nickname: 'Test QQ' }) },
    daily: { validateKey: async (_a, _s, k) => { validatedKey = k; } },
    hash: sha256,
    uuid: () => 'id-1',
  });
  await auth.saveManualKey(existing, 'qmk-synthetic_manual_key_9999', new AbortController().signal);
  assert.equal(validatedKey, 'qmk-synthetic_manual_key_9999');
  assert.ok(accounts.getSnapshot()[0]?.capabilities.includes('daily'));
  assert.equal((await accounts.session(existing.id)).qqDailyKey, 'qmk-synthetic_manual_key_9999');
});

test('glassLevel preference defaults to 2 (清透) and validates bounds 1..5', () => {
  assert.equal(defaults.glassLevel, 2);
  for (const level of [1, 2, 3, 4, 5] as const) {
    assert.equal(validatePreferences({ ...defaults, glassLevel: level }).glassLevel, level);
  }
  assert.throws(() => validatePreferences({ ...defaults, glassLevel: 0 as never }));
  assert.throws(() => validatePreferences({ ...defaults, glassLevel: 6 as never }));
});
