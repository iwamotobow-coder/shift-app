import { createClient } from '@supabase/supabase-js'export async function POST(req) {
  try {
    const { shiftId, type } = await req.json()
    console.log('notify受信 shiftId:', shiftId, 'type:', type)

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'あり' : 'なし')
    console.log('SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'あり' : 'なし')
    console.log('LINE TOKEN:', process.env.LINE_CHANNEL_ACCESS_TOKEN ? 'あり' : 'なし')
    console.log('APP URL:', process.env.NEXT_PUBLIC_APP_URL)

    const { data: shift, error: shiftErr } = await db.from('shifts').select('*').eq('id', shiftId).single()
    console.log('shift取得:', shift ? 'OK' : 'NG', shiftErr?.message)
    if (!shift) return Response.json({ ok: false, message: 'シフトなし' }, { status: 404 })

    const { data: staff, error: staffErr } = await db.from('staff').select('*').eq('id', shift.staff_id).single()
    console.log('staff取得:', staff ? staff.name : 'NG', staffErr?.message)
    if (!staff) return Response.json({ ok: false, message: 'スタッフなし' }, { status: 404 })

    if (!staff.line_user_id) {
      console.log('LINE未連携:', staff.name)
      return Response.json({ ok: true, message: 'LINE未連携' })
    }

    const DAYS = ['日','月','火','水','木','金','土']
    const dt = new Date(shift.work_date)
    const dateStr = `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日（${DAYS[dt.getDay()]}）`
    const timeStr = `${shift.start_time.slice(0,5)}〜${shift.end_time.slice(0,5)}`
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/shift/${staff.token}`
    console.log('送信URL:', url)

    const messages = [{
      type: 'flex',
      altText: `[${type === 'change' ? '変更' : '追加'}] ${dateStr}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box', layout: 'vertical',
          backgroundColor: type === 'change' ? '#FF6B35' : '#4169E1',
          contents: [{ type: 'text', text: type === 'change' ? 'シフト変更のお知らせ' : 'シフト追加のお知らせ', color: '#ffffff', weight: 'bold', size: 'md' }]
        },
        body: {
          type: 'box', layout: 'vertical', spacing: 'md',
          contents: [
            { type: 'text', text: `${staff.name}さん`, weight: 'bold', size: 'lg' },
            { type: 'separator' },
            { type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: '日付', color: '#888888', size: 'sm', flex: 2 }, { type: 'text', text: dateStr, size: 'sm', flex: 4 }] },
            { type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: '時間', color: '#888888', size: 'sm', flex: 2 }, { type: 'text', text: timeStr, size: 'sm', flex: 4 }] },
            { type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: '訪問先', color: '#888888', size: 'sm', flex: 2 }, { type: 'text', text: shift.location || '—', size: 'sm', flex: 4 }] },
          ]
        },
        footer: {
          type: 'box', layout: 'vertical',
          contents: [{ type: 'button', style: 'primary', color: '#4169E1', action: { type: 'uri', label: '確認してタップ ✔', uri: url } }]
        }
      }
    }]

    console.log('LINE送信開始 to:', staff.line_user_id)
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: staff.line_user_id, messages }),
    })
    const resText = await res.text()
    console.log('LINE APIレスポンス:', res.status, resText)

    if (!res.ok) throw new Error(resText)
    return Response.json({ ok: true, message: `${staff.name}さんにLINE通知を送りました` })
  } catch (e) {
    console.error('notifyエラー:', e.message)
    return Response.json({ ok: false, message: e.message }, { status: 500 })
  }
}
