import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function sendLineMessage(lineUserId, messages) {
  console.log('LINE送信開始 to:', lineUserId)
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: lineUserId, messages }),
  })
  const resText = await res.text()
  console.log('LINE API レスポンス:', res.status, resText)
  if (!res.ok) throw new Error(resText)
}

function formatDate(dateStr) {
  const dt = new Date(dateStr)
  const DAYS = ['日','月','火','水','木','金','土']
  return `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日（${DAYS[dt.getDay()]}）`
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr)
  return Math.round((target - today) / 86400000)
}

export async function POST(req) {
  try {
    const { shiftId, type } = await req.json()
    const db = supabaseAdmin()

    console.log('notify受信 shiftId:', shiftId, 'type:', type)

    const { data: shift } = await db.from('shifts').select('*').eq('id', shiftId).single()
    if (!shift) {
      console.log('シフトが見つかりません:', shiftId)
      return Response.json({ ok: false, message: 'シフトが見つかりません' }, { status: 404 })
    }

    const { data: staff } = await db.from('staff').select('*').eq('id', shift.staff_id).single()
    if (!staff) {
      console.log('スタッフが見つかりません:', shift.staff_id)
      return Response.json({ ok: false, message: 'スタッフが見つかりません' }, { status: 404 })
    }

    console.log('スタッフ:', staff.name, 'line_user_id:', staff.line_user_id)

    if (!staff.line_user_id) {
      console.log('LINE未連携のためスキップ:', staff.name)
      return Response.json({ ok: true, message: 'LINE未連携のためスキップ' })
    }

    const dateStr = formatDate(shift.work_date)
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

    await sendLineMessage(staff.line_user_id, messages)
    console.log('LINE送信完了:', staff.name)
    return Response.json({ ok: true, message: `${staff.name}さんにLINE通知を送りました` })
  } catch (e) {
    console.error('notify エラー:', e.message)
    return Response.json({ ok: false, message: e.message }, { status: 500 })
  }
}
