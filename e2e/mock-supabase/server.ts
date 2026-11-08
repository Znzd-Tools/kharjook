/**
 * Mock Supabase for end-to-end tests. Implements the subset of GoTrue
 * (auth) and PostgREST (REST + RPC) that the app uses. In-memory, single
 * user. Not for production.
 *
 * Test helpers:
 *   POST /__reset          → restore the seed
 *   GET  /__db/:table      → raw rows (assert saved data, not only UI)
 *
 * Run: node e2e/mock-supabase/server.ts   (PORT env, default 54329)
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { buildSeed, TEST_USER } from './seed.ts';

type Row = Record<string, unknown>;
let db: Record<string, Row[]> = buildSeed();

const PORT = Number(process.env.PORT ?? 54329);

/* ----------------------------- auth ----------------------------- */

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function makeJwt() {
  const iat = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    sub: TEST_USER.id, email: TEST_USER.email, role: 'authenticated', aud: 'authenticated',
    iat, exp: iat + 60 * 60 * 24 * 7, session_id: 'mock-session',
  })}.mock`;
}
const user = {
  id: TEST_USER.id, aud: 'authenticated', role: 'authenticated', email: TEST_USER.email,
  email_confirmed_at: '2025-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {},
  created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z', identities: [],
};
function session() {
  const access_token = makeJwt();
  return {
    access_token, token_type: 'bearer', expires_in: 604800,
    expires_at: Math.floor(Date.now() / 1000) + 604800, refresh_token: 'mock-refresh', user,
  };
}
const SERVICE_KEY = 'mock-service-key';

function authed(req: IncomingMessage) {
  const h = req.headers.authorization ?? '';
  const token = h.replace(/^Bearer\s+/i, '');
  // Server code (Telegram bot, settle services) uses the service role key.
  if (token === SERVICE_KEY || req.headers.apikey === SERVICE_KEY) return true;
  if (!token || token.split('.').length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    return payload.sub === TEST_USER.id;
  } catch {
    return false;
  }
}

/* --------------------------- postgrest -------------------------- */

function parseValue(v: string): unknown {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}
function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const na = Number(a), nb = Number(b);
  if (typeof a === 'number' || (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '' && /^-?[\d.]+$/.test(String(a)) && /^-?[\d.]+$/.test(String(b)))) {
    return na - nb;
  }
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}
function likeToRegex(p: string, flags = '') {
  return new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*') + '$', flags);
}
function testOp(value: unknown, op: string, raw: string): boolean {
  switch (op) {
    case 'eq': return String(value) === raw || (value === null && raw === 'null');
    case 'neq': return String(value) !== raw;
    case 'gt': return value != null && cmp(value, raw) > 0;
    case 'gte': return value != null && cmp(value, raw) >= 0;
    case 'lt': return value != null && cmp(value, raw) < 0;
    case 'lte': return value != null && cmp(value, raw) <= 0;
    case 'like': return value != null && likeToRegex(raw).test(String(value));
    case 'ilike': return value != null && likeToRegex(raw, 'i').test(String(value));
    case 'is': return value === parseValue(raw) || (raw === 'null' && value === undefined);
    case 'in': {
      const list = raw.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''));
      return list.includes(String(value));
    }
    case 'cs': {
      const want = JSON.parse(raw.replace(/^\{/, '[').replace(/\}$/, ']'));
      return Array.isArray(value) && want.every((w: unknown) => (value as unknown[]).map(String).includes(String(w)));
    }
    default: return true;
  }
}
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
function applyFilters(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows;
  for (const [key, val] of params) {
    if (RESERVED.has(key)) continue;
    if (key === 'or' || key === 'and') {
      const inner = val.replace(/^\(|\)$/g, '').split(/,(?![^(]*\))/);
      out = out.filter((r) => {
        const results = inner.map((c) => {
          const [col, op, ...rest] = c.split('.');
          return testOp(r[col!], op!, rest.join('.'));
        });
        return key === 'or' ? results.some(Boolean) : results.every(Boolean);
      });
      continue;
    }
    let negate = false;
    let rest = val;
    if (rest.startsWith('not.')) {
      negate = true;
      rest = rest.slice(4);
    }
    const dot = rest.indexOf('.');
    const op = rest.slice(0, dot);
    const raw = rest.slice(dot + 1);
    out = out.filter((r) => testOp(r[key], op, raw) !== negate);
  }
  return out;
}
function applyOrder(rows: Row[], order: string | null): Row[] {
  if (!order) return rows;
  const keys = order.split(',').map((o) => {
    const [col, ...mods] = o.split('.');
    return { col: col!, desc: mods.includes('desc'), nullsFirst: mods.includes('nullsfirst') };
  });
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const av = a[k.col], bv = b[k.col];
      if (av == null || bv == null) {
        if (av == null && bv == null) continue;
        const nullCmp = av == null ? 1 : -1;
        return k.nullsFirst ? -nullCmp : nullCmp;
      }
      const c = cmp(av, bv);
      if (c !== 0) return k.desc ? -c : c;
    }
    return 0;
  });
}
function project(rows: Row[], select: string | null): Row[] {
  if (!select || select.trim() === '*') return rows;
  const cols = select.split(',').map((s) => s.trim()).filter(Boolean);
  return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
}
function defaults(table: string, row: Row): Row {
  const now = new Date().toISOString();
  const out: Row = { ...row };
  if (out.id === undefined && table !== 'notification_settings' && table !== 'price_source_settings') out.id = randomUUID();
  if (out.user_id === undefined) out.user_id = TEST_USER.id;
  if (out.created_at === undefined) out.created_at = now;
  if (out.updated_at === undefined && table !== 'transactions') out.updated_at = now;
  return out;
}

/* ------------------------------ rpc ----------------------------- */

const rpc: Record<string, (args: Row) => unknown> = {
  get_today_expense_total_toman: (a) =>
    (db.transactions ?? [])
      .filter((t) => t.type === 'EXPENSE' && t.date_string === a.p_date_string)
      .reduce((s, t) => s + (Number(t.amount_toman_at_time) || 0), 0),
  get_category_expense_toman_for_period: () => 0,
};

/* ----------------------------- http ----------------------------- */

function send(res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD',
    'Access-Control-Expose-Headers': 'Content-Range, Range',
    ...headers,
  });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}
async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
    const path = url.pathname;
    if (req.method === 'OPTIONS') return send(res, 200);

    // Test helpers
    if (path === '/__reset' && req.method === 'POST') {
      db = buildSeed();
      return send(res, 200, { ok: true });
    }
    if (path.startsWith('/__db/')) return send(res, 200, db[path.slice(6)] ?? []);
    if (path === '/__health') return send(res, 200, { ok: true });

    // Auth
    if (path === '/auth/v1/token') {
      const body = (await readBody(req)) as Row | undefined;
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password' && (body?.email !== TEST_USER.email || body?.password !== TEST_USER.password)) {
        return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      return send(res, 200, session());
    }
    if (path === '/auth/v1/signup') return send(res, 200, session());
    if (path === '/auth/v1/logout') return send(res, 204);
    if (path === '/auth/v1/user') {
      if (!authed(req)) return send(res, 401, { code: 401, msg: 'invalid JWT' });
      return send(res, 200, user);
    }
    if (path.startsWith('/auth/v1/')) return send(res, 200, {});

    // Storage: accept uploads, return a fake public path.
    if (path.startsWith('/storage/v1/')) return send(res, 200, { Key: path.replace('/storage/v1/object/', '') });

    // RPC
    if (path.startsWith('/rest/v1/rpc/')) {
      if (!authed(req)) return send(res, 401, { message: 'JWT required' });
      const fn = path.slice('/rest/v1/rpc/'.length);
      const args = ((await readBody(req)) as Row) ?? Object.fromEntries(url.searchParams);
      if (!rpc[fn]) return send(res, 404, { code: 'PGRST202', message: `function ${fn} not found` });
      return send(res, 200, rpc[fn](args));
    }

    // REST
    if (path.startsWith('/rest/v1/')) {
      if (!authed(req)) return send(res, 401, { message: 'JWT required' });
      const table = path.slice('/rest/v1/'.length);
      const rows = (db[table] ??= []);
      const params = url.searchParams;
      const prefer = String(req.headers.prefer ?? '');
      const wantsObject = String(req.headers.accept ?? '').includes('vnd.pgrst.object');
      const returnRep = prefer.includes('return=representation');

      const respond = (out: Row[], status = 200, total?: number) => {
        const projected = project(out, params.get('select'));
        if (wantsObject) {
          if (projected.length !== 1) {
            return send(res, 406, { code: 'PGRST116', details: `The result contains ${projected.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' });
          }
          return send(res, status, projected[0]);
        }
        const count = total ?? projected.length;
        return send(res, status, projected, {
          'Content-Range': `0-${Math.max(0, projected.length - 1)}/${prefer.includes('count=') ? count : '*'}`,
        });
      };

      if (req.method === 'GET' || req.method === 'HEAD') {
        let out = applyOrder(applyFilters(rows, params), params.get('order'));
        const total = out.length;
        let offset = Number(params.get('offset') ?? 0);
        let limit = params.has('limit') ? Number(params.get('limit')) : Infinity;
        const range = req.headers.range;
        if (range && /^\d+-\d+$/.test(String(range))) {
          const [from, to] = String(range).split('-').map(Number);
          offset = from!;
          limit = to! - from! + 1;
        }
        out = out.slice(offset, offset + limit);
        if (req.method === 'HEAD') return send(res, 200, undefined, { 'Content-Range': `0-0/${total}` });
        return respond(out, 200, total);
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const input = (Array.isArray(body) ? body : [body]) as Row[];
        const isUpsert = prefer.includes('resolution=');
        const conflict = (params.get('on_conflict') ?? 'id').split(',');
        const written: Row[] = [];
        for (const raw of input) {
          const existing = isUpsert
            ? rows.find((r) => conflict.every((c) => raw[c] !== undefined && String(r[c]) === String(raw[c])) && (conflict.length > 1 || raw[conflict[0]!] !== undefined))
            : undefined;
          if (existing) {
            if (!prefer.includes('ignore-duplicates')) Object.assign(existing, raw, { updated_at: new Date().toISOString() });
            written.push(existing);
          } else {
            const row = defaults(table, raw);
            rows.push(row);
            written.push(row);
          }
        }
        if (!returnRep) return send(res, 201);
        return respond(written, 201);
      }
      if (req.method === 'PATCH') {
        const patch = (await readBody(req)) as Row;
        const targets = applyFilters(rows, params);
        for (const r of targets) Object.assign(r, patch);
        if (!returnRep) return send(res, 204);
        return respond(targets);
      }
      if (req.method === 'DELETE') {
        const targets = applyFilters(rows, params);
        db[table] = rows.filter((r) => !targets.includes(r));
        if (!returnRep) return send(res, 204);
        return respond(targets);
      }
    }
    return send(res, 404, { message: 'not found' });
  } catch (err) {
    console.error(err);
    return send(res, 500, { message: String(err) });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`mock supabase on http://127.0.0.1:${PORT}`));
