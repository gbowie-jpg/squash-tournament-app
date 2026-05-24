import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase/require-role';
import { sendSmsToAll } from '@/lib/sms';

export async function POST(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth.error) return auth.error;

  const { body } = await req.json();
  if (!body || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 });
  }

  const result = await sendSmsToAll(body.trim());
  return NextResponse.json(result);
}
