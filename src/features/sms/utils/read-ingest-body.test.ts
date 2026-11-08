import { describe, expect, it } from 'vitest';
import { readIngestBody } from './read-ingest-body';

const req = (body: string, type: string) => new Request('http://x/api/sms/ingest', { method: 'POST', body, headers: { 'content-type': type } });

describe('readIngestBody', () => {
  it('reads common JSON shapes', async () => {
    expect(await readIngestBody(req(JSON.stringify({ from: 'Mellat', text: 'برداشت', timestamp: 1794138191047 }), 'application/json'), new URLSearchParams()))
      .toEqual({ text: 'برداشت', sender: 'Mellat', receivedAt: new Date(1794138191047).toISOString() });
    expect((await readIngestBody(req(JSON.stringify({ sms: { body: 'واریز', address: '+98' } }), 'application/json'), new URLSearchParams()))?.text).toBe('واریز');
  });
  it('reads form data and plain text', async () => {
    expect((await readIngestBody(req('message=abc&sender=Saman', 'application/x-www-form-urlencoded'), new URLSearchParams()))?.sender).toBe('Saman');
    expect(await readIngestBody(req('plain sms', 'text/plain'), new URLSearchParams('from=Melli'))).toEqual({ text: 'plain sms', sender: 'Melli', receivedAt: null });
  });
  it('reads GET query', async () => {
    const r = new Request('http://x/api/sms/ingest?text=hi&from=Tejarat');
    expect(await readIngestBody(r, new URL(r.url).searchParams)).toEqual({ text: 'hi', sender: 'Tejarat', receivedAt: null });
  });
});
