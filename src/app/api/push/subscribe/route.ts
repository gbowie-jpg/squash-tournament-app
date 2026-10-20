import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, limits } from '@/lib/rateLimit';
import { isAllowedPushEndpoint, isValidSubscriptionKey, parseApplicationServerKey } from '@/lib/vapid';

async function readJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, limits.pushSubscribe);
  if (limited) return limited;

  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const { endpoint, p256dh, auth, userAgent, applicationServerKey } = body;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Missing subscription fields' }, { status: 400 });
  }
  if (!isAllowedPushEndpoint(endpoint)) {
    return NextResponse.json({ error: 'Unsupported push endpoint' }, { status: 400 });
  }
  if (!isValidSubscriptionKey(p256dh, 128) || !isValidSubscriptionKey(auth, 64)) {
    return NextResponse.json({ error: 'Invalid subscription keys' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint,
      p256dh,
      auth,
      user_agent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : null,
      // Key the browser subscribed with. Old bundles don't send it → NULL, which
      // the sender skips until the client re-subscribes / re-syncs.
      vapid_public_key: parseApplicationServerKey(applicationServerKey),
    },
    { onConflict: 'endpoint' },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await readJson(req);
  const endpoint = body?.endpoint;

  if (!endpoint || typeof endpoint !== 'string') {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
