import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase/require-role';
import { sendPushToAll } from '@/lib/push';

export async function POST(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth.error) return auth.error;

  const { title, body, url, urgent } = await req.json();
  if (!title || !body) return NextResponse.json({ error: 'title and body required' }, { status: 400 });

  const result = await sendPushToAll({ title, body, url, urgent });
  // Misconfigured VAPID keys or a DB failure: report it instead of "sent to 0".
  return NextResponse.json(result, { status: result.error ? 503 : 200 });
}
