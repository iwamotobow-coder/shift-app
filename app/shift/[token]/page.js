'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const DAYS = ['日','月','火','水','木','金','土']

function formatDate(d) {
  const dt = new Date(d)
  return `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日（${DAYS[dt.getDay()]}）`
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr)
  return Math.round((target - today) / 86400000)
}

export default function StaffShiftPage({ params }) {
  const { token } = params
  const [staffInfo, setStaffInfo] = useState(null)
  const [shifts, setShifts] = useState([])
  const [reads, setReads] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: st } = await supabase.from('staff').select('*').eq('token', token).single()
      if (!st) { setLoading(false); return }
      setStaffInfo(st)
      const today = new Date().toISOString().slice(0, 10)
      const { data: sh } = await supabase.from('shifts').select('*')
        .eq('staff_id', st.id).gte('work_date', today).order('work_date')
      setShifts(sh || [])
      const { data: rd } = await supabase.from('shift_reads').select('*').eq('staff_id', st.id)
      setReads(rd || [])
      setLoading(false)
    }
    load()
  }, [token])

  async function confirm(shiftId) {
    setConfirming(shiftId)
    const { error } = await supabase.from('shift_reads').upsert(
      { shift_id: shiftId, staff_id: staffInfo.id },
      { onConflict: 'shift_id,staff_id' }
    )
    if (!error) {
      setReads(prev => [...prev.filter(r => r.shift_id !== shiftId), { shift_id: shiftId, staff_id: staffInfo.id, read_at: new Date().toISOString() }])
    }
    setConfirming(null)
  }

  function isRead(shiftId) {
    return reads.some(r => r.shift_id === shiftId)
  }

  if (loading) return <div style={styles.center}><p style={styles.muted}>読み込み中...</p></div>
  if (!staffInfo) return <div style={styles.center}><p style={styles.muted}>URLが無効です</p></div>

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.headerTitle}>訪問美容 シフト確認</div>
        <div style={styles.staffName}>{staffInfo.name} さん</div>
      </div>
      {shifts.length === 0 && <div style={styles.empty}><p>今後のシフトはありません</p></div>}
      {shifts.map(s => {
        const days = daysUntil(s.work_date)
        const read = isRead(s.id)
        const readInfo = reads.find(r => r.shift_id === s.id)
        return (
          <div key={s.id} style={{...styles.card, borderLeft: s.is_changed ? '3px solid #993C1D' : (days <= 1 && !read ? '3px solid #BA7517' : '3px solid #1D9E75')}}>
            <div style={styles.cardTop}>
              <span style={styles.dateText}>{formatDate(s.work_date)}</span>
              {days === 0 && <span style={styles.tagToday}>本日</span>}
              {days === 1 && <span style={styles.tagSoon}>明日</span>}
              {days >= 2 && days <= 5 && <span style={styles.tagAlert}>{days}日後</span>}
              {s.is_changed && <span style={styles.tagChanged}>変更あり</span>}
            </div>
            <div style={styles.timeRow}>
              <span style={styles.timeText}>{s.start_time?.slice(0,5)} 〜 {s.end_time?.slice(0,5)}</span>
            </div>
            {s.location && <div style={styles.locRow}><span style={styles.locLabel}>訪問先</span><span style={styles.locText}>{s.location}</span></div>}
            {s.note && <div style={styles.locRow}><span style={styles.locLabel}>備考</span><span style={styles.locText}>{s.note}</span></div>}
            {s.change_note && <div style={styles.changeNote}>変更内容: {s.change_note}</div>}
            <div style={styles.confirmRow}>
              {read ? (
                <div style={styles.readBadge}>確認済み {readInfo && new Date(readInfo.read_at).toLocaleString('ja-JP', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
              ) : (
                <button style={styles.confirmBtn} onClick={() => confirm(s.id)} disabled={confirming === s.id}>
                  {confirming === s.id ? '送信中...' : '確認しました ✓'}
                </button>
              )}
            </div>
          </div>
        )
      })}
      <p style={styles.footer}>シフトに変更があった場合はLINEでお知らせします</p>
    </div>
  )
}

const styles = {
  wrap: { maxWidth:480, margin:'0 auto', padding:'0 0 60px', fontFamily:'sans-serif' },
  center: { display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' },
  header: { background:'#185FA5', color:'#fff', padding:'20px 16px 16px' },
  headerTitle: { fontSize:13, opacity:0.8, marginBottom:4 },
  staffName: { fontSize:20, fontWeight:500 },
  empty: { textAlign:'center', padding:48, color:'#888' },
  muted: { color:'#888', fontSize:14 },
  card: { margin:'12px 16px', padding:16, background:'#fff', border:'0.5px solid #e0e0e0', borderRadius:10 },
  cardTop: { display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:10 },
  dateText: { fontSize:15, fontWeight:500 },
  tagToday: { fontSize:11, padding:'2px 8px', borderRadius:10, background:'#F09595', color:'#501313', fontWeight:500 },
  tagSoon: { fontSize:11, padding:'2px 8px', borderRadius:10, background:'#FAC775', color:'#633806' },
  tagAlert: { fontSize:11, padding:'2px 8px', borderRadius:10, background:'#FAEEDA', color:'#854F0B' },
  tagChanged: { fontSize:11, padding:'2px 8px', borderRadius:10, background:'#F5C4B3', color:'#712B13', fontWeight:500 },
  timeRow: { marginBottom:8 },
  timeText: { fontSize:22, fontWeight:500, color:'#185FA5' },
  locRow: { display:'flex', gap:8, alignItems:'flex-start', marginBottom:4 },
  locLabel: { fontSize:12, color:'#888', minWidth:44 },
  locText: { fontSize:13, color:'#333' },
  changeNote: { fontSize:12, color:'#993C1D', background:'#FAECE7', padding:'6px 10px', borderRadius:6, marginTop:8 },
  confirmRow: { marginTop:12 },
  confirmBtn: { width:'100%', padding:'12px', background:'#1D9E75', color:'#fff', border:'none', borderRadius:10, fontSize:15, fontWeight:500, cursor:'pointer' },
  readBadge: { padding:'10px', background:'#E1F5EE', color:'#085041', borderRadius:8, fontSize:13, textAlign:'center' },
  footer: { textAlign:'center', fontSize:12, color:'#aaa', margin:'32px 16px 0' },
}
