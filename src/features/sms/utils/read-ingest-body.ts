/**
 * Forwarder apps send SMS in many shapes. Find the text, sender and time
 * in JSON, form data, plain text or the query string.
 */
const TEXT_KEYS = ['text', 'body', 'message', 'msg', 'content', 'sms', 'smsbody', 'sms_body', 'messagebody'];
const FROM_KEYS = ['from', 'sender', 'address', 'phone', 'number', 'originatingaddress', 'source'];
const TIME_KEYS = ['received_at', 'receivedat', 'timestamp', 'time', 'date', 'receivedstamp', 'sentstamp', 'sent_at'];

export interface IngestPayload {
  text: string;
  sender: string | null;
  receivedAt: string | null;
}

function pick(obj: Record<string, unknown>, keys: string[], depth = 0): string | null {
  for (const [k, v] of Object.entries(obj)) {
    if (keys.includes(k.toLowerCase().replace(/[-\s]/g, '')) && (typeof v === 'string' || typeof v === 'number')) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  if (depth < 2) {
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const r = pick(v as Record<string, unknown>, keys, depth + 1);
        if (r) return r;
      }
    }
  }
  return null;
}

function toIso(v: string | null): string | null {
  if (!v) return null;
  const n = Number(v);
  const d = Number.isFinite(n) && n > 1e9 ? new Date(n > 1e12 ? n : n * 1000) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function payloadFromObject(obj: Record<string, unknown>): IngestPayload | null {
  const text = pick(obj, TEXT_KEYS);
  if (!text) return null;
  return { text: text.slice(0, 2000), sender: pick(obj, FROM_KEYS)?.slice(0, 64) ?? null, receivedAt: toIso(pick(obj, TIME_KEYS)) };
}

export async function readIngestBody(request: Request, query: URLSearchParams): Promise<IngestPayload | null> {
  const fromQuery = payloadFromObject(Object.fromEntries(query.entries()));
  if (request.method === 'GET') return fromQuery;
  const type = request.headers.get('content-type') ?? '';
  const raw = await request.text().catch(() => '');
  if (!raw.trim()) return fromQuery;
  if (type.includes('json') || /^\s*[{[]/.test(raw)) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      const obj = Array.isArray(parsed) ? (parsed[0] as Record<string, unknown>) : (parsed as Record<string, unknown>);
      if (obj && typeof obj === 'object') {
        const p = payloadFromObject(obj);
        if (p) return { ...p, sender: p.sender ?? fromQuery?.sender ?? null };
      }
    } catch {
      // not JSON: fall through to plain text
    }
  }
  if (type.includes('x-www-form-urlencoded')) {
    const p = payloadFromObject(Object.fromEntries(new URLSearchParams(raw).entries()));
    if (p) return p;
  }
  return { text: raw.trim().slice(0, 2000), sender: query.get('from') ?? query.get('sender'), receivedAt: null };
}
