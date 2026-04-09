import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:president@seattlesquash.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { title, body, url, urgent } = await req.json();
  if (!title || !body) return NextResponse.json({ error: 'title and body required' }, { status: 400 });

  const supabase = createAdminClient();
  const { data: subscriptions } = await supabase.from('push_subscriptions').select('*');

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No subscribers' });
  }

  const payload = JSON.stringify({ title, body, url: url || '/', urgent: urgent || false });

  let sent = 0;
  let failed = 0;
  const stale: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          stale.push(sub.endpoint); // Subscription expired
        }
        failed++;
      }
    })
  );

  // Clean up expired subscriptions
  if (stale.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', stale);
  }

  return NextResponse.json({ sent, failed, stale: stale.length });
}
