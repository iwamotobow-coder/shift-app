import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function sendLineMessage(lineUserId, messages) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: lineUserId, messages }),
  })
  if (!res.ok) throw new Error(await res.text())
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const days = ['日','月','火','水','木','金','土']
  return `${d.getMonth()+1}月${d.getDate()}日（${days[d.getDay()]}）`
}

export async function POST(req) {
  try {
    const { shiftId, type } = await req.json()
    const db = supabaseAdmin()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    const { data: shift } = await db.from('shifts').select('*').eq('id', shiftId).single()
    if (!shift) return Response.json({ ok: false, message: 'シフトが見つかりません' }, { status: 404 })

    const { data: staff } = await db.from('staff').select('*').eq('id', shift.staff_id).single()
    if (!staff) return Response.json({ ok: false, message: 'スタッフが見つかりません' }, { status: 404 })

    if (!staff.line_user_id) {
      return Response.json({ ok: true, message: `保存しました（${staff.name}はLINE未連携のため通知スキップ）` })
    }

    const dateStr = formatDate(shift.work_date)
    const timeStr = `${shift.start_time?.slice(0,5)}〜${shift.end_time?.slice(0,5)}`
    const url = `${appUrl}/shift/${staff.token}`

    const messages = [{
      type: 'flex',
      altText: `【シフト${type === 'change' ? '変更' : '追加'}】${dateStr}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box', layout: 'vertical',
          backgroundColor: type === 'change' ? '#993C1D' : '#185FA5',
          contents: [{ type: 'text', text: type === 'change' ? 'シフト変更のお知らせ' : 'シフト追加のお知らせ', color: '#ffffff', weight: 'bold', size: 'md' }]
        },
        body: {
          type: 'box', layout: 'vertical', spacing: 'md',
          contents: [
            { type: 'text', text: `${staff.name} さん`, weight: 'bold', size: 'lg' },
            { type: 'separator' },
            { type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: '日付', color: '#888780', size: 'sm', flex: 2 }, { type: 'text', text: dateStr, size: 'sm', flex: 4 }] },
            { type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: '時間', color: '#888780', size: 'sm', flex: 2 }, { type: 'text', text: timeStr, size: 'sm', flex: 4 }] },
            { type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: '訪問先', color: '#888780', size: 'sm', flex: 2 }, { type: 'text', text: shift.location || '—', size: 'sm', flex: 4 }] },
          ]
        },
        footer: {
          type: 'box', layout: 'vertical',
          contents: [{ type: 'button', style: 'primary', color: '#185FA5', action: { type: 'uri', label: '確認してタップ ✓', uri: url } }]
        }
      }
    }]

    await sendLineMessage(staff.line_user_id, messages)
    return Response.json({ ok: true, message: `${staff.name}にLINE通知を送りました` })
  } catch (e) {
    return Response.json({ ok: false, message: e.message }, { status: 500 })
  }
}
