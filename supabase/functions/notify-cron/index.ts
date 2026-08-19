// 가계부 알림 크론: 매시 정각에 실행되도록 스케줄 등록.
// - 사용자가 설정한 시각(KST)이 되면, 오늘 기록 여부와 상관없이 매일 리마인드 푸시를 보낸다.
//
// 필요한 환경변수(Supabase 대시보드 → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  (index.html의 VAPID_PUBLIC_KEY와 반드시 같은 값)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 주입해준다.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;

webpush.setVapidDetails('mailto:urgan93@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function kstNow(): Date {
  // 서버는 UTC로 도니까, KST(UTC+9) 기준 "벽시계 시각"으로 계산하기 위해 9시간을 더한 뒤
  // UTC getter들로 읽는다 (타임존 문자열 파싱에 기대지 않는 방식).
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}
function kstHour(d: Date) { return d.getUTCHours(); }

async function sendPushToUser(userId: string, title: string, body: string, url = './') {
  const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', userId);
  for (const sub of subs || []) {
    const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } };
    try {
      await webpush.sendNotification(pushSub, JSON.stringify({ title, body, url }));
    } catch (err: any) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        // 브라우저에서 이미 구독 해지된 경우: 정리
        await sb.from('push_subscriptions').delete().eq('id', sub.id);
      } else {
        console.error('push send error for', userId, err);
      }
    }
  }
}

async function runDailyReminders(now: Date) {
  const hour = kstHour(now);

  // 오늘 기록 여부와 상관없이 매일 정해진 시각에 무조건 보낸다 (하루 마무리 리마인드).
  const { data: users, error } = await sb
    .from('notification_settings')
    .select('user_id')
    .eq('daily_reminder_enabled', true)
    .eq('daily_reminder_hour', hour);
  if (error) { console.error('reminder query error', error); return; }

  for (const u of users || []) {
    await sendPushToUser(u.user_id, '가계부', '오늘 하루를 기록으로 마무리해보세요.');
  }
}

Deno.serve(async (_req) => {
  const now = kstNow();
  try {
    await runDailyReminders(now);
    return new Response(JSON.stringify({ ok: true, kst: now.toISOString() }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('notify-cron failed', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
