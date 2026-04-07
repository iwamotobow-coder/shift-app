// Vercel Cron Job - 毎朝8時に実行
// vercel.json で設定: { "crons": [{ "path": "/api/cron/alerts", "schedule": "0 23 * * *" }] }
// ※ Vercel CronはUTC時間。日本時間8:00 = UTC 23:00（前日）

import { supabaseAdmin } from '../../../lib/supabase'
import { sendLineMessage, makeReminderMessage } from '../../../lib/line'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  // Vercel Cronからのリクエストか確認
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const results = []

  // 今日〜5日後のシフトを取得
  for (let daysAhead = 0; daysAhead <= 5; daysAhead++) {
    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() + daysAhead)
    const dateStr = targetDate.toISOString().slice(0, 10)

    // アラートタイプを決定
    const alertType = daysAhead === 0 ? 'reminder_0d'
      : daysAhead === 1 ? 'reminder_1d'
      : daysAhead === 3 ? 'reminder_3d'
      : daysAhead === 5 ? 'reminder_5d'
      : null

    // 3日前・5日前・前日・当日のみ通知（2日前と4日前はスキップ）
    if (!alertType) continue

    const { data: shifts } = await db.from('shifts').select('*').eq('work_date', dateStr)
    if (!shifts || shifts.length === 0) continue

    for (const shift of shifts) {
      const { data: staff } = await db.from('staff').select('*').eq('id', shift.staff_id).single()
      if (!staff?.line_user_id) continue

      // 既に送信済みか確認
      const { data: existing } = await db.from('alert_logs')
        .select('id').eq('shift_id', shift.id).eq('staff_id', staff.id).eq('alert_type', alertType).single()
      if (existing) continue

      try {
        const shiftWithToken = { ...shift, staff_token: staff.token }
        const messages = makeReminderMessage(staff.name, shiftWithToken, daysAhead, appUrl)
        await sendLineMessage(staff.line_user_id, messages)

        // 送信ログを記録
        await db.from('alert_logs').insert({ shift_id: shift.id, staff_id: staff.id, alert_type: alertType })
        results.push({ staff: staff.name, date: dateStr, type: alertType, ok: true })
      } catch (e) {
        results.push({ staff: staff.name, date: dateStr, type: alertType, ok: false, error: e.message })
      }
    }
  }

  return Response.json({ ok: true, sent: results.length, results })
}
