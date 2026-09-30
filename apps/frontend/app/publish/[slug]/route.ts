import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const backend = () => process.env.BACKEND_URL ?? 'http://localhost:3100';

// Dev convenience: fall back to the repo-root .env (the compose secrets file —
// `dev:backend` loads the same file, so one token covers both sides).
function exportToken(): string | undefined {
  if (process.env.EXPORT_TOKEN) return process.env.EXPORT_TOKEN;
  try {
    const envPath = path.join(process.cwd(), '..', '..', '.env');
    if (!existsSync(envPath)) return undefined;
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^EXPORT_TOKEN=(.+)$/);
      if (m?.[1]) return m[1].trim();
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Proxy PUT /api/publish/:slug → backend PUT /api/experiments/:slug with the
 *  researcher token injected server-side so it never reaches the browser. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const token = exportToken();
  if (!token)
    return NextResponse.json(
      {
        error:
          'EXPORT_TOKEN is not configured — set it in the repo .env and restart dev servers',
      },
      { status: 503 },
    );

  const body = await req.text();
  const res = await fetch(`${backend()}/api/experiments/${slug}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body,
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
