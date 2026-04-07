'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const DAYS = ['日','月','火','水','木','金','土']

function formatDate(d) {
  const dt = new Date(d)
  return `${dt.getMonth()+1}/${dt.getDate()}（${DAYS[dt.getDay()]}）`
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [staff, setStaff] = useState([])
  const [shifts, setShifts] = useState([])
  const [reads, setReads] = useState([])
  const [tab, setTab] = useState('shifts')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [{ data: st }, { data: sh }, { data: rd }] = await Promise.all([
      supabase.from('staff').select('*').eq('is_active', true).order('name'),
      supabase.from('shifts').select('*').gte('work_date', new Date().toISOString().slice(0,10)).order('work_date'),
      supabase.from('shift_reads').select('*'),
    ])
    setStaff(st || [])
    setShifts(sh || [])
    setReads(rd || [])
  }, [])

  useEffect(() => { if (authed) load() }, [authed, load])

  function login() {
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD || password === 'siosio215') {
      setAuthed(true)
    } else {
      alert('パスワードが違います')
    }
  }

  function isRead(shiftId, staffId) {
    return reads.some(r => r.shift_id === shiftId && r.staff_id === staffId)
  }

  function openAdd() {
    setForm({ staff_id: staff[0]?.id || '', work_date: '', start_time: '09:00', end_time: '17:00', location: '', note: '', change_note: '' })
    setModal({ mode: 'add' })
  }

  function openEdit(shift) {
    setForm({ ...shift, change_note: '' })
    setModal({ mode: 'edit', shift })
  }

  async function saveShift() {
    setSaving(true)
    setMsg('')
    try {
      const payload = {
        staff_id: form.staff_id,
        work_date: form.work_date,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.location,
        note: form.note,
      }
      let shiftId
      if (modal.mode === 'add') {
        const { data, error } = await supabase.from('shifts').insert(payload).select().single()
        if (error) throw error
        shiftId = data.id
      } else {
        payload.is_changed = true
        payload.changed_at = new Date().toISOString()
        payload.change_note = form.change_note
        const { error } = await supabase.from('shifts').update(payload).eq('id', modal.shift.id)
        if (error) throw error
        shiftId = modal.shift.id
        await supabase.from('shift_reads').delete().eq('shift_id', shiftId)
      }
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId, type: modal.mode === 'add' ? 'add' : 'change' }),
      })
      const result = await res.json()
      setMsg(result.message || '保存しました')
      setModal(null)
      load()
    } catch (e) {
      setMsg('エラー: ' + e.message)
    }
    setSaving(false)
  }

  async function deleteShift(id) {
    if (!confirm('このシフトを削除しますか？')) return
    await supabase.from('shifts').delete().eq('id', id)
    load()
  }

  const unreadShifts = shifts.filter(s => !isRead(s.id, s.staff_id) && s.is_changed)
  const changedShifts = shifts.filter(s => s.is_changed)

  if (!authed) return (
    <div style={styles.loginWrap}>
      <div style={styles.loginBox}>
        <h2 style={styles.loginTitle}>管理者ログイン</h2>
        <input style={styles.input} type="password" placeholder="パスワード" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()} />
        <button style={styles.btnPrimary} onClick={login}>ログイン</button>
      </div>
    </div>
  )

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>訪問美容 シフト管理</span>
        <div style={styles.headerBadges}>
          {unreadShifts.length > 0 && <span style={styles.badgeDanger}>未読 {unreadShifts.length}件</span>}
        </div>
      </div>
      <div style={styles.tabs}>
        {[['shifts','シフト一覧'],['unread','変更・未読確認'],['staff','スタッフ']].map(([k,v]) => (
          <button key={k} style={tab===k ? styles.tabActive : styles.tab} onClick={() => setTab(k)}>{v}</button>
        ))}
      </div>
      {msg && <div style={styles.toast}>{msg}</div>}
      {tab === 'shifts' && (
        <div>
          <div style={styles.toolbar}>
            <span style={styles.sectionTitle}>今後のシフト</span>
            <button style={styles.btnPrimary} onClick={openAdd}>＋ シフト追加</button>
          </div>
          {shifts.length === 0 && <p style={styles.empty}>シフトはありません</p>}
          {shifts.map(s => {
            const st = staff.find(x => x.id === s.staff_id)
            const read = isRead(s.id, s.staff_id)
            return (
              <div key={s.id} style={{...styles.shiftCard, borderLeft: s.is_changed ? '3px solid #993C1D' : '3px solid transparent'}}>
                <div style={styles.shiftTop}>
                  <span style={styles.shiftDate}>{formatDate(s.work_date)}</span>
                  {s.is_changed && <span style={styles.badgeChange}>変更あり</span>}
                  <span style={read ? styles.badgeRead : styles.badgeUnread}>{read ? '既読' : '未読'}</span>
                </div>
                <div style={styles.shiftBody}>
                  <span style={styles.shiftStaff}>{st?.name || '—'}</span>
                  <span style={styles.shiftTime}>{s.start_time?.slice(0,5)}〜{s.end_time?.slice(0,5)}</span>
                  {s.location && <span style={styles.shiftLoc}>{s.location}</span>}
                </div>
                {s.change_note && <div style={styles.shiftNote}>変更内容: {s.change_note}</div>}
                <div style={styles.shiftActions}>
                  <button style={styles.btnSmall} onClick={() => openEdit(s)}>編集・変更通知</button>
                  <button style={{...styles.btnSmall, color:'#993C1D'}} onClick={() => deleteShift(s.id)}>削除</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {tab === 'unread' && (
        <div>
          <div style={styles.toolbar}>
            <span style={styles.sectionTitle}>変更後・未確認スタッフ</span>
          </div>
          {changedShifts.length === 0 && <p style={styles.empty}>変更シフトはありません</p>}
          {changedShifts.map(s => {
            const st = staff.find(x => x.id === s.staff_id)
            const read = isRead(s.id, s.staff_id)
            const readInfo = reads.find(r => r.shift_id === s.id && r.staff_id === s.staff_id)
            return (
              <div key={s.id} style={styles.shiftCard}>
                <div style={styles.shiftTop}>
                  <span style={styles.shiftDate}>{formatDate(s.work_date)}</span>
                  <span style={styles.shiftStaff}>{st?.name}</span>
                  <span style={read ? styles.badgeRead : styles.badgeUnread}>{read ? '既読' : '未読'}</span>
                </div>
                {read && readInfo && (
                  <div style={styles.readTime}>確認日時: {new Date(readInfo.read_at).toLocaleString('ja-JP')}</div>
                )}
                {!read && (
                  <button style={{...styles.btnSmall, marginTop:8}} onClick={async () => {
                    await fetch('/api/notify', {
                      method: 'POST',
                      headers: {'Content-Type':'application/json'},
                      body: JSON.stringify({ shiftId: s.id, type: 'reminder' })
                    })
                    setMsg(`${st?.name}に再通知しました`)
                    setTimeout(() => setMsg(''), 3000)
                  }}>再通知する</button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {tab === 'staff' && (
        <div>
          <div style={styles.toolbar}>
            <span style={styles.sectionTitle}>スタッフ一覧</span>
          </div>
          {staff.map(s => (
            <div key={s.id} style={styles.shiftCard}>
              <div style={styles.shiftTop}>
                <span style={styles.shiftStaff}>{s.name}</span>
                <span style={s.line_user_id ? styles.badgeRead : styles.badgeUnread}>
                  {s.line_user_id ? 'LINE連携済み' : 'LINE未連携'}
                </span>
              </div>
              <div style={styles.shiftNote}>
                シフト確認URL: {process.env.NEXT_PUBLIC_APP_URL}/shift/{s.token}
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && (
        <div style={styles.modalBg} onClick={() => setModal(null)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{modal.mode === 'add' ? 'シフト追加' : 'シフト変更・通知'}</h3>
            <label style={styles.label}>スタッフ</label>
            <select style={styles.input} value={form.staff_id} onChange={e => setForm({...form, staff_id: e.target.value})}>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label style={styles.label}>日付</label>
            <input style={styles.input} type="date" value={form.work_date} onChange={e => setForm({...form, work_date: e.target.value})} />
            <div style={{display:'flex', gap:8}}>
              <div style={{flex:1}}>
                <label style={styles.label}>開始時間</label>
                <input style={styles.input} type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} />
              </div>
              <div style={{flex:1}}>
                <label style={styles.label}>終了時間</label>
                <input style={styles.input} type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} />
              </div>
            </div>
            <label style={styles.label}>訪問先</label>
            <input style={styles.input} placeholder="施設名" value={form.location||''} onChange={e => setForm({...form, location: e.target.value})} />
            <label style={styles.label}>備考</label>
            <input style={styles.input} placeholder="メモ" value={form.note||''} onChange={e => setForm({...form, note: e.target.value})} />
            {modal.mode === 'edit' && (
              <>
                <label style={styles.label}>変更内容（LINEに表示されます）</label>
                <input style={styles.input} placeholder="例: 時間変更・訪問先変更など" value={form.change_note||''} onChange={e => setForm({...form, change_note: e.target.value})} />
              </>
            )}
            <div style={styles.modalActions}>
              <button style={styles.btnSmall} onClick={() => setModal(null)}>キャンセル</button>
              <button style={styles.btnPrimary} onClick={saveShift} disabled={saving}>
                {saving ? '送信中...' : '保存してLINE通知'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  loginWrap: { display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f5f5f3' },
  loginBox: { background:'#fff', border:'0.5px solid #ddd', borderRadius:12, padding:32, width:300, display:'flex', flexDirection:'column', gap:12 },
  loginTitle: { fontSize:18, fontWeight:500, margin:0 },
  wrap: { maxWidth:600, margin:'0 auto', padding:'0 0 80px' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 16px 0', marginBottom:12 },
  headerTitle: { fontSize:16, fontWeight:500 },
  headerBadges: { display:'flex', gap:8 },
  tabs: { display:'flex', borderBottom:'0.5px solid #ddd', marginBottom:16 },
  tab: { padding:'8px 14px', fontSize:13, border:'none', background:'none', cursor:'pointer', color:'#888' },
  tabActive: { padding:'8px 14px', fontSize:13, border:'none', background:'none', cursor:'pointer', color:'#185FA5', fontWeight:500, borderBottom:'2px solid #185FA5' },
  toolbar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:12 },
  sectionTitle: { fontSize:14, fontWeight:500 },
  shiftCard: { margin:'0 16px 10px', padding:14, background:'#fff', border:'0.5px solid #e0e0e0', borderRadius:10 },
  shiftTop: { display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' },
  shiftDate: { fontSize:14, fontWeight:500 },
  shiftBody: { display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' },
  shiftStaff: { fontSize:14, fontWeight:500 },
  shiftTime: { fontSize:13, color:'#555' },
  shiftLoc: { fontSize:12, color:'#888', background:'#f5f5f3', padding:'2px 8px', borderRadius:4 },
  shiftNote: { fontSize:12, color:'#885000', marginTop:6 },
  shiftActions: { display:'flex', gap:8, marginTop:8 },
  readTime: { fontSize:12, color:'#0F6E56', marginTop:4 },
  empty: { textAlign:'center', color:'#888', padding:32 },
  toast: { margin:'0 16px 12px', padding:'10px 14px', background:'#E1F5EE', color:'#085041', borderRadius:8, fontSize:13 },
  badgeChange: { fontSize:11, padding:'2px 8px', borderRadius:10, background:'#F5C4B3', color:'#712B13' },
  badgeRead: { fontSize:11, padding:'2px 8px', borderRadius:10, background:'#9FE1CB', color:'#085041' },
  badgeUnread: { fontSize:11, padding:'2px 8px', borderRadius:10, background:'#F5C4B3', color:'#712B13' },
  badgeDanger: { fontSize:11, padding:'2px 8px', borderRadius:10, background:'#F09595', color:'#501313' },
  input: { width:'100%', padding:'8px 10px', border:'0.5px solid #ccc', borderRadius:8, fontSize:14, marginBottom:2, boxSizing:'border-box' },
  label: { display:'block', fontSize:12, color:'#666', marginBottom:4, marginTop:10 },
  btnPrimary: { padding:'8px 18px', background:'#185FA5', color:'#B5D4F4', border:'none', borderRadius:8, fontSize:13, cursor:'pointer', fontWeight:500 },
  btnSmall: { padding:'5px 12px', background:'none', border:'0.5px solid #ccc', borderRadius:6, fontSize:12, cursor:'pointer', color:'#333' },
  modalBg: { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 },
  modalBox: { background:'#fff', borderRadius:14, padding:24, width:340, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto' },
  modalTitle: { fontSize:15, fontWeight:500, margin:'0 0 12px' },
  modalActions: { display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 },
}
