import type { NextApiRequest, NextApiResponse } from 'next';

const MAX_BODY_CHARS = 16_000;

function sanitize(value: unknown): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 2_000);
  if (Array.isArray(value)) return value.slice(0, 50).map(sanitize);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([key, entry]) => [key.slice(0, 100), sanitize(entry)]),
    );
  }
  return String(value).slice(0, 2_000);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  try {
    const serialized = JSON.stringify(req.body ?? {});
    if (serialized.length > MAX_BODY_CHARS) return res.status(413).json({ ok: false });

    const payload = sanitize(req.body);
    console.log('[ImpactStream Download Diagnostic]', JSON.stringify({
      receivedAt: new Date().toISOString(),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
      payload,
    }));

    return res.status(204).end();
  } catch (error) {
    console.error('[ImpactStream Download Diagnostic] Failed to record diagnostic', error);
    return res.status(400).json({ ok: false });
  }
}
