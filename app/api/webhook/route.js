import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const body = await req.json()
    const events = body.events || []
    
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    for (const event of events) {
      if (event.type === 'follow') {
        const lineUserId = event.source.userId
        console.log('New follower LINE User ID:', lineUserId)
        
        // ログに記録（Vercelのログで確認できます）
        await db.from('staff').update({ line_user_id: lineUserId })
          .is('line_user_id', null)
          .limit(1)
      }
    }

    return Response.json({ ok: true })
  } catch (e) {
    console.error(e)
    return Response.json({ ok: false }, { status: 200 })
  }
}
