import { supabaseAdmin } from '../../../lib/supabase'
import { sendLineMessage, makeChangeMessage, makeReminderMessage } from '../../../lib/line'

export async function POST(req) {
  try {
    const { shiftId, type } = await req.json()
    const db = supabaseAdmin()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    // シフト情報とスタッフ情報を取得
    const { data: shift } = await db.from('shifts').select('*').eq('id', shiftId).single()
    if (!shift) return Response.json({ ok: false, message: 'シフトが見つかりません' }, { status: 404 })

    const { data: staff } = await db.from('staff').select('*').eq('id', shift.staff_id).single()
    if (!staff) return Response.json({ ok: false, message: 'スタッフが見つかりません' }, { status: 404 })

    // LINE未連携の場合はスキップ
    if (!staff.line_user_id) {
      return Response.json({ ok: true, message: `保存しました（${staff.name}はLINE未連携のため通知スキップ）` })
    }

    // tokenをshiftオブジェクトに付与（URLに使用）
    const shiftWithToken = { ...shift, staff_token: staff.token }

    let messages
    if (type === 'change' || type === 'add') {
      messages = makeChangeMessage(staff.name, shiftWithToken, appUrl)
    } else {
      messages = makeReminderMessage(staff.name, shiftWithToken, 0, appUrl)
    }

    await sendLineMessage(staff.line_user_id, messages)

    return Response.json({ ok: true, message: `${staff.name}にLINE通知を送りました` })
  } catch (e) {
    console.error(e)
    return Response.json({ ok: false, message: e.message }, { status: 500 })
  }
}
