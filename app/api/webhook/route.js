import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const body = await req.json()
    const events = body.events || []
    
    for (const event of events) {
      const lineUserId = event.source?.userId
      if (!lineUserId) continue
      
      console.log('LINE User ID:', lineUserId)
      console.log('Event type:', event.type)
    }

    return Response.json({ ok: true })
  } catch (e) {
    console.error(e)
    return Response.json({ ok: false }, { status: 200 })
  }
}
