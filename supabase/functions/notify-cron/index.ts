// 가계부 알림 크론: 매시 정각에 실행되도록 스케줄 등록.
// - 사용자가 설정한 시각(KST)이 되면, 오늘 아직 기록이 없는 사용자에게 리마인드 푸시
// - 이번 달 생활 카테고리 예산이 임계값(%) 넘으면 (카테고리당 그 달 최초 1회) 푸시
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
function pad2(n: number) { return String(n).padStart(2, '0'); }
function kstDateStr(d: Date) { return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; }
function kstMonthStr(d: Date) { return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`; }
function kstHour(d: Date) { return d.getUTCHours(); }
function nextMonthStart(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${pad2(nm)}-01`;
}

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
  const today = kstDateStr(now);

  const { data: users, error } = await sb
    .from('notification_settings')
    .select('user_id')
    .eq('daily_reminder_enabled', true)
    .eq('daily_reminder_hour', hour);
  if (error) { console.error('reminder query error', error); return; }

  for (const u of users || []) {
    const { count } = await sb
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', u.user_id)
      .eq('date', today);
    if (!count) {
      await sendPushToUser(u.user_id, '가계부', '오늘 지출/수입 기록 아직 안 하셨네요. 잊기 전에 남겨보세요!');
    }
  }
}

async function runBudgetAlerts(now: Date) {
  const month = kstMonthStr(now);
  const monthStart = `${month}-01`;
  const monthEnd = nextMonthStart(month);

  const { data: users, error } = await sb
    .from('notification_settings')
    .select('user_id, budget_alert_threshold')
    .eq('budget_alert_enabled', true);
  if (error) { console.error('alert query error', error); return; }

  for (const u of users || []) {
    const { data: memberRows } = await sb.from('household_members').select('household_id').eq('user_id', u.user_id);
    const householdIds = (memberRows || []).map((m: any) => m.household_id);
    if (!householdIds.length) continue;

    const { data: cats } = await sb.from('living_categories').select('*').in('household_id', householdIds);
    for (const cat of cats || []) {
      const { data: budgetRows } = await sb
        .from('monthly_budgets')
        .select('amount')
        .eq('category_id', cat.id)
        .eq('year_month', month)
        .limit(1);
      const budget = (budgetRows && budgetRows[0]) ? budgetRows[0].amount : (cat.default_amount ?? cat.limit_amount);
      if (!budget) continue;

      const { data: txRows } = await sb
        .from('transactions')
        .select('amount')
        .eq('category_id', cat.id)
        .eq('type', 'living')
        .gte('date', monthStart)
        .lt('date', monthEnd);
      const spent = (txRows || []).reduce((s: number, t: any) => s + t.amount, 0);

      const { data: settleRows } = await sb
        .from('transactions')
        .select('amount')
        .eq('category_id', cat.id)
        .eq('type', 'settlement')
        .gte('date', monthStart)
        .lt('date', monthEnd);
      const settled = (settleRows || []).reduce((s: number, t: any) => s + t.amount, 0);

      const effective = spent - settled;
      const pct = Math.round((effective / budget) * 100);
      if (pct < u.budget_alert_threshold) continue;

      // budget_alert_log에 이번 달 처음 insert되는 경우에만(=unique 제약 통과) 발송.
      // 이미 이번 달 알림을 보냈으면 insert가 충돌 에러로 실패해서 자연스럽게 중복 발송을 막는다.
      const { error: logErr } = await sb.from('budget_alert_log').insert({
        id: `alert_${cat.id}_${month}_${u.user_id}`,
        user_id: u.user_id,
        category_id: cat.id,
        year_month: month
      });
      if (!logErr) {
        await sendPushToUser(u.user_id, '예산 임박', `${cat.name} 예산의 ${pct}%를 사용했어요 (실질 지출 기준)`);
      }
    }
  }
}

Deno.serve(async (_req) => {
  const now = kstNow();
  try {
    await runDailyReminders(now);
    await runBudgetAlerts(now);
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
