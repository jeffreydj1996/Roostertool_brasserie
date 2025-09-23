import React, {useMemo, useState} from 'react'

const brand = { primary:'#1F2937', accent:'#C5A15E', bg:'#F8F7F4' }
const roles = ['FOH','Host','Bar','Runner','Allround']

const days = [
  { key:'ma', label:'Ma' },
  { key:'di', label:'Di' },
  { key:'wo', label:'Wo' },
  { key:'do', label:'Do' },
  { key:'vr', label:'Vr' },
  { key:'za', label:'Za' },
  { key:'zo', label:'Zo' },
]

const defaultNeeds = {
  ma:{ standby:[{role:'Standby',count:1,starts:['13:00']}], lunch:[{role:'Allround',count:1,starts:['10:00']}], diner:[{role:'Allround',count:1,starts:['17:00']}] },
  di:{ standby:[{role:'Standby',count:1,starts:['13:00']}], lunch:[{role:'Allround',count:1,starts:['10:00']}], diner:[{role:'Allround',count:1,starts:['17:00']}] },
  wo:{ standby:[{role:'Standby',count:1,starts:['13:00']}], lunch:[{role:'Allround',count:1,starts:['10:00']}], diner:[{role:'Allround',count:1,starts:['17:00']}] },
  do:{ standby:[{role:'Standby',count:1,starts:['13:00']}], lunch:[{role:'Allround',count:1,starts:['10:00']}], diner:[{role:'Allround',count:1,starts:['17:00']}] },
  vr:{ standby:[{role:'Standby',count:1,starts:['12:00']}], lunch:[{role:'Allround',count:1,starts:['10:00']}], diner:[{role:'FOH',count:2,starts:['17:00','18:00']},{role:'Runner',count:1,starts:['17:00']},{role:'Bar',count:1,starts:['17:00']}] },
  za:{ lunch:[{role:'FOH',count:1,starts:['10:00']},{role:'Bar',count:1,starts:['12:00']}], diner:[{role:'FOH',count:2,starts:['17:00','18:00']},{role:'Runner',count:1,starts:['17:00']},{role:'Bar',count:1,starts:['17:00']}] },
  zo:{ lunch:[{role:'FOH',count:2,starts:['10:00','14:00']},{role:'Bar',count:1,starts:['12:00']}], diner:[{role:'FOH',count:1,starts:['17:00']},{role:'Bar',count:1,starts:['17:00']}] }
}

const demoEmployees = [
  { id:'e1', name:'Sanne', wage:18.5, skills:{FOH:5,Host:4,Bar:4,Runner:3,Allround:5}, canOpen:true, canClose:true, prefs:['sluit'], allowedStandby:true },
  { id:'e2', name:'Ahmed', wage:15.0, skills:{FOH:4,Host:3,Bar:2,Runner:4,Allround:4}, canOpen:true, canClose:false, prefs:['open'], allowedStandby:true },
  { id:'e3', name:'Lena', wage:22.0, skills:{FOH:5,Host:5,Bar:3,Runner:3,Allround:4}, canOpen:true, canClose:true, prefs:['tussen'], allowedStandby:false },
]

const pad2 = (n)=> (n<10?`0${n}`:String(n))
const timeToMin = (str)=>{ const [h,m]=String(str).split(':').map(Number); return h*60+(m||0) }
const minToTime = (min)=> `${pad2(Math.floor(min/60))}:${pad2(min%60)}`
const isOpenTime = (t)=> timeToMin(t)<=600 // <=10:00
const isCloseTime = (t)=> timeToMin(t)>=1020 // >=17:00

const useP75 = (emps)=> useMemo(()=>{
  const arr = [...emps.map(e=>e.wage)].sort((a,b)=>a-b)
  if(!arr.length) return 0
  const idx = Math.floor(0.75*(arr.length-1))
  return arr[idx]
},[emps])

export default function App(){
  const [tab,setTab]=useState('rooster')
  const [employees,setEmployees]=useState(demoEmployees)
  const [needs,setNeeds]=useState(defaultNeeds)
  const [assignments,setAssignments]=useState({}) // key: day:shift:role:time -> [{employeeId,standby}]
  const [picker,setPicker]=useState(null) // {dayKey,shiftKey,role,time}
  const [timeEdit,setTimeEdit]=useState(null) // {dayKey,shiftKey,entryIndex,startIndex,current}
  const [addService,setAddService]=useState(null) // {dayKey,shiftKey}
  const [editEmp,setEditEmp]=useState(null)

  const p75 = useP75(employees)

  const weekCost = useMemo(()=>{
    const byEmp = {}
    Object.values(assignments).forEach(list=>{
      // cost only for non-standby
      const non = list.filter(a=>!a.standby)
      if(non.length){
        non.forEach(a=>{ byEmp[a.employeeId]=(byEmp[a.employeeId]||0)+1 })
      }
    })
    return Object.entries(byEmp).reduce((sum,[id,count])=>{
      const emp = employees.find(e=>e.id===id)
      return sum + (emp ? emp.wage*7 : 0)
    },0)
  },[assignments,employees])

  const addAssignment = (dayKey, shiftKey, role, time, employeeId)=>{
    setAssignments(prev=>{
      // constraints: 1 dienst per dag & niet én standby én dienst
      const hasAnyToday = Object.entries(prev).some(([k,list])=>{
        const [d] = k.split(':'); if(d!==dayKey) return false
        return list.some(a=>a.employeeId===employeeId)
      })
      const hasStandbyToday = Object.entries(prev).some(([k,list])=>{
        const [d,,r] = k.split(':'); if(d!==dayKey) return false
        return r==='Standby' && list.some(a=>a.employeeId===employeeId)
      })
      if(role==='Standby' && hasAnyToday) return prev
      if(role!=='Standby' && hasStandbyToday) return prev

      const key = `${dayKey}:${shiftKey}:${role}:${time}`
      const list = prev[key]||[]
      if(list.some(a=>a.employeeId===employeeId)) return prev
      const next = { ...prev, [key]: [...list, {employeeId, standby:role==='Standby'}]}
      return next
    })
  }

  const removeAssignment = (dayKey, shiftKey, role, time, employeeId)=>{
    setAssignments(prev=>{
      const key = `${dayKey}:${shiftKey}:${role}:${time}`
      const list = prev[key]||[]
      return { ...prev, [key]: list.filter(a=>a.employeeId!==employeeId) }
    })
  }

  const openGroupsStatus = (dayKey, time)=>{
    // at least one opener and one closer for time groups that require it
    const hasOpenNeed = isOpenTime(time)
    const hasCloseNeed = isCloseTime(time)
    let hasOpener=false, hasCloser=false
    Object.entries(assignments).forEach(([k,list])=>{
      const [d,,role,t]=k.split(':')
      if(d===dayKey && t===time && role!=='Standby'){
        list.forEach(a=>{
          const emp = employees.find(e=>e.id===a.employeeId)
          if(emp){ if(emp.canOpen) hasOpener=true; if(emp.canClose) hasCloser=true }
        })
      }
    })
    return { hasOpenNeed, hasCloseNeed, hasOpener, hasCloser }
  }

  const autofill = ()=>{
    // greedy fill by need, pref, skill, wage; ensure group opener/closer coverage
    const next = {}
    const byDay = {} // ensure 1 dienst per dag
    const byDayStandby = {}
    const limitFor = (dayKey,shiftKey)=> ( (dayKey==='vr'&&shiftKey==='diner') || (dayKey==='za'&&shiftKey==='diner') ) ? 2 : 1
    const p75v = p75

    days.forEach(d=>{
      const needDay = needs[d.key]
      Object.entries(needDay).forEach(([shiftKey, entries])=>{
        entries.forEach(entry=>{
          entry.starts.forEach(time=>{
            const key = `${d.key}:${shiftKey}:${entry.role}:${time}`
            let dure=0, limit=limitFor(d.key,shiftKey)
            const cands = employees.filter(e=>{
              if(entry.role==='Standby') return !!e.allowedStandby
              return (e.skills[entry.role]??0) >= 3
            }).sort((a,b)=>{
              const prefType = prefFromTime(time)
              const ap = (a.prefs||[]).includes(prefType)
              const bp = (b.prefs||[]).includes(prefType)
              if(ap!==bp) return ap?-1:1
              const sa = a.skills[entry.role]??0
              const sb = b.skills[entry.role]??0
              if(sa!==sb) return sb-sa
              return a.wage-b.wage
            })
            const list=[]
            const need = entry.count
            const groupNeedsOpen = isOpenTime(time)
            const groupNeedsClose = isCloseTime(time)
            let placedOpen=false, placedClose=false

            for(const c of cands){
              if(list.length>=need) break
              // availability is not modeled here (MVP) — could be added
              const hasToday = (byDay[d.key]||new Set()).has(c.id)
              const hasStand = (byDayStandby[d.key]||new Set()).has(c.id)
              if(entry.role==='Standby'){ if(hasToday) continue } else { if(hasStand) continue }
              if(entry.role!=='Standby' && c.wage>=p75v && dure>=limit) continue

              // prefer to satisfy opener/closer first
              if(groupNeedsOpen && !placedOpen && c.canOpen){ list.push({employeeId:c.id, standby:false}); placedOpen=true; if(c.wage>=p75v)dure++; (byDay[d.key]=byDay[d.key]||new Set()).add(c.id); continue }
              if(groupNeedsClose && !placedClose && c.canClose){ list.push({employeeId:c.id, standby:false}); placedClose=true; if(c.wage>=p75v)dure++; (byDay[d.key]=byDay[d.key]||new Set()).add(c.id); continue }

              // regular
              list.push({employeeId:c.id, standby: entry.role==='Standby'})
              if(entry.role==='Standby'){ (byDayStandby[d.key]=byDayStandby[d.key]||new Set()).add(c.id) }
              else { (byDay[d.key]=byDay[d.key]||new Set()).add(c.id); if(c.wage>=p75v) dure++ }
            }
            next[key]=list
          })
        })
      })
    })
    setAssignments(next)
  }

  const addServiceAt = (dayKey, shiftKey, role, time)=>{
    setNeeds(prev=>{
      const copy = {...prev}
      copy[dayKey] = {...copy[dayKey]}
      copy[dayKey][shiftKey] = [...(copy[dayKey][shiftKey]||[])]
      // if same role exists, append time
      const idx = copy[dayKey][shiftKey].findIndex(e=>e.role===role)
      if(idx>=0){
        const entry = {...copy[dayKey][shiftKey][idx]}
        entry.starts = [...entry.starts]
        if(!entry.starts.includes(time)) entry.starts.push(time)
        copy[dayKey][shiftKey][idx] = entry
      }else{
        copy[dayKey][shiftKey].push({ role, count:1, starts:[time] })
      }
      return copy
    })
  }

  const updateStartTime = (dayKey, shiftKey, entryIndex, startIndex, newTime)=>{
    setNeeds(prev=>{
      const copy = {...prev}
      const entry = {...copy[dayKey][shiftKey][entryIndex]}
      const starts = [...entry.starts]
      const oldTime = starts[startIndex]
      starts[startIndex] = newTime
      entry.starts = starts
      copy[dayKey][shiftKey] = [...copy[dayKey][shiftKey]]
      copy[dayKey][shiftKey][entryIndex] = entry

      // move assignments to new key
      const oldKey = `${dayKey}:${shiftKey}:${entry.role}:${oldTime}`
      const newKey = `${dayKey}:${shiftKey}:${entry.role}:${newTime}`
      setAssignments(prevA=>{
        const list = prevA[oldKey]||[]
        const next = {...prevA}
        delete next[oldKey]
        if(list.length){ next[newKey] = (next[newKey]||[]).concat(list) }
        return next
      })
      return copy
    })
  }

  const prefFromTime = (time)=>{
    const m = timeToMin(time)
    if(m<=600) return 'open'
    if(m>=720 && m<=840) return 'tussen'
    if(m>=1020) return 'sluit'
    return null
  }

  return (
    <div>
      <div className="container">
        <div className="toolbar">
          <div className="row">
            <h1>Roostertool Brasserie <span className="tag">MVP</span></h1>
            <button className="btn" onClick={()=>setTab('dashboard')}>Dashboard</button>
            <button className="btn pri" onClick={()=>setTab('rooster')}>Rooster</button>
            <button className="btn" onClick={()=>setTab('beschikbaarheid')}>Beschikbaarheid</button>
            <button className="btn" onClick={()=>setTab('medewerkers')}>Medewerkers</button>
          </div>
          <div className="row">
            <button className="btn" onClick={autofill}>Autofill</button>
            <div className="pill"><span>P75</span><b>€{p75.toFixed(2)}</b></div>
            <div className="pill"><span>Weekkosten</span><b>€{weekCost.toFixed(2)}</b></div>
          </div>
        </div>

        {tab==='rooster' && (
          <div className="grid" style={{gap:16}}>
            {days.map(d=>(
              <div key={d.key} className="card">
                <div className="card-h">
                  <b>{d.label}</b>
                </div>
                <div className="card-b grid grid-2">
                  {Object.entries(needs[d.key]).map(([shiftKey, entries])=>(
                    <div key={shiftKey} className="card" style={{borderColor:'#f1f1f1'}}>
                      <div className="card-h">
                        <div><b>{shiftKey==='standby'?'Standby (dag)':shiftKey}</b></div>
                        <button className="btn" onClick={()=>setAddService({dayKey:d.key, shiftKey})}>+ Dienst toevoegen</button>
                      </div>
                      <div className="card-b grid" style={{gap:8}}>
                        {entries.map((entry, ei)=>(
                          <div key={ei} className="grid" style={{gap:6}}>
                            <div className="row">
                              <span className="badge">{entry.role}</span>
                              <span className="k">{entry.count}×</span>
                            </div>
                            <div className="row">
                              {entry.starts.map((t, si)=>(
                                <button key={si} className="pill" onClick={()=>setTimeEdit({dayKey:d.key, shiftKey, entryIndex:ei, startIndex:si, current:t})}>
                                  <span>{t}</span><span className="k">wijzig</span>
                                </button>
                              ))}
                            </div>
                            <div className="grid">
                              {entry.starts.map((t, si)=>{
                                const key = `${d.key}:${shiftKey}:${entry.role}:${t}`
                                const list = assignments[key]||[]
                                const status = entry.role==='Standby' ? null : openGroupsStatus(d.key,t)
                                return (
                                  <div key={si} className="grid" style={{gap:6}}>
                                    {status && (
                                      <div className="row">
                                        {status.hasOpenNeed && <span className={status.hasOpener?'ok':'warn'}>{status.hasOpener?'Open OK':'Open ontbreekt'}</span>}
                                        {status.hasCloseNeed && <span className={status.hasCloser?'ok':'warn'}>{status.hasCloser?'Sluit OK':'Sluit ontbreekt'}</span>}
                                      </div>
                                    )}
                                    <div className="row">
                                      {list.map((a,idx)=>{
                                        const emp = employees.find(e=>e.id===a.employeeId)
                                        return (
                                          <span className="pill" key={idx}>
                                            <b>{emp?emp.name:a.employeeId}</b>
                                            {!a.standby && emp && emp.wage>=p75 && <span className="tag">Duur</span>}
                                            <button title="Verwijder" onClick={()=>removeAssignment(d.key,shiftKey,entry.role,t, a.employeeId)}>×</button>
                                          </span>
                                        )
                                      })}
                                      {list.length < entry.count && (
                                        <button className="btn" onClick={()=>setPicker({dayKey:d.key, shiftKey, role:entry.role, time:t})}>+ Voeg toe</button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==='medewerkers' && (
          <div className="grid grid-2">
            <div className="card">
              <div className="card-h"><b>Medewerkers</b></div>
              <div className="card-b grid" style={{gap:8}}>
                {employees.map(e=>(
                  <div key={e.id} className="row" style={{justifyContent:'space-between'}}>
                    <div className="grid" style={{gap:4}}>
                      <b>{e.name}</b>
                      <div className="small">€{e.wage.toFixed(2)}/u · Pref: {(e.prefs&&e.prefs.length)?e.prefs.join(', '):'geen'}</div>
                      <div className="small">FOH {e.skills.FOH??0} · Host {e.skills.Host??0} · Bar {e.skills.Bar??0} · Runner {e.skills.Runner??0} · AR {e.skills.Allround??0}</div>
                      <div className="small">Standby: {e.allowedStandby?'ja':'nee'} · Open: {e.canOpen?'ja':'nee'} · Sluit: {e.canClose?'ja':'nee'}</div>
                    </div>
                    <div className="row">
                      <button className="btn" onClick={()=>setEditEmp(e)}>Bewerk</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-h"><b>Nieuwe medewerker</b></div>
              <div className="card-b"><NewEmployee onAdd={(emp)=>setEmployees(prev=>[...prev, emp])} /></div>
            </div>
          </div>
        )}

      </div>

      {picker && <AssignModal ctx={picker} onClose={()=>setPicker(null)} employees={employees} assignments={assignments} addAssignment={addAssignment} p75={p75} />}
      {timeEdit && <TimePicker current={timeEdit.current} onSelect={(t)=>{ updateStartTime(timeEdit.dayKey,timeEdit.shiftKey,timeEdit.entryIndex,timeEdit.startIndex,t); setTimeEdit(null) }} onClose={()=>setTimeEdit(null)} />}
      {addService && <AddServiceModal ctx={addService} onClose={()=>setAddService(null)} onAdd={({role,time})=>{ addServiceAt(addService.dayKey, addService.shiftKey, role, time); setAddService(null) }} />}
      {editEmp && <EditEmployeeModal emp={editEmp} onClose={()=>setEditEmp(null)} onSave={(e)=>{ setEmployees(prev=>prev.map(x=>x.id===e.id?e:x)); setEditEmp(null) }} />}
    </div>
  )
}

function AssignModal({ctx, onClose, employees, assignments, addAssignment, p75}){
  const {dayKey, shiftKey, role, time} = ctx
  const [q,setQ]=useState('')
  const candidates = employees.map(e=>{
    let eligible=true, reason=''
    if(role!=='Standby' && (e.skills[role]??0)<3){ eligible=false; reason='Skill < 3' }
    if(role==='Standby' && !e.allowedStandby){ eligible=false; reason='Mag geen Standby' }

    // one per day constraint
    const hasAnyToday = Object.entries(assignments).some(([k,list])=>{
      const [d] = k.split(':'); if(d!==dayKey) return false
      return list.some(a=>a.employeeId===e.id)
    })
    const hasStandbyToday = Object.entries(assignments).some(([k,list])=>{
      const [d,,r] = k.split(':'); if(d!==dayKey) return false
      return r==='Standby' && list.some(a=>a.employeeId===e.id)
    })
    if(role==='Standby' && hasAnyToday){ eligible=false; reason='Heeft al dienst' }
    if(role!=='Standby' && hasStandbyToday){ eligible=false; reason='Staat al Standby' }

    if(q && !e.name.toLowerCase().includes(q.toLowerCase())) eligible=false
    return {e, eligible, reason}
  }).filter(row=>row.eligible).sort((a,b)=>{
    const pref = (t)=>{
      const m = timeToMin(t)
      if(m<=600) return 'open'
      if(m>=720 && m<=840) return 'tussen'
      if(m>=1020) return 'sluit'
      return null
    }
    const ap = (a.e.prefs||[]).includes(pref(time))
    const bp = (b.e.prefs||[]).includes(pref(time))
    if(ap!==bp) return ap?-1:1
    if(role!=='Standby'){
      const sa = a.e.skills[role]??0, sb = b.e.skills[role]??0
      if(sa!==sb) return sb-sa
    }
    return a.e.wage - b.e.wage
  })
  return (
    <div className="modal" onClick={onClose}>
      <div className="box" onClick={e=>e.stopPropagation()}>
        <div className="hd">
          <b>Kies medewerker — {dayKey.toUpperCase()} · {shiftKey==='standby'?'Standby':shiftKey} · {role} · {time}</b>
          <button className="btn" onClick={onClose}>Sluit</button>
        </div>
        <div className="bd grid" style={{gap:8}}>
          <input placeholder="Zoek op naam" value={q} onChange={e=>setQ(e.target.value)} />
          {candidates.length===0 && <div className="k">Geen kandidaten</div>}
          {candidates.map(({e})=>{
            const isDuur = e.wage>=p75
            return (
              <div key={e.id} className="row" style={{justifyContent:'space-between'}}>
                <div className="grid" style={{gap:4}}>
                  <b>{e.name}</b>
                  <div className="small">€{e.wage.toFixed(2)}/u {isDuur && <span className="tag">Duur</span>}</div>
                </div>
                <button className="btn" onClick={()=>{ addAssignment(dayKey,shiftKey,role,time,e.id); onClose(); }}>Kies</button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TimePicker({current, onSelect, onClose}){
  const items=[]; for(let m=9*60;m<=25*60-30;m+=30) items.push(minToTime(m))
  return (
    <div className="modal" onClick={onClose}>
      <div className="box" onClick={e=>e.stopPropagation()}>
        <div className="hd"><b>Kies tijd</b><button className="btn" onClick={onClose}>Sluit</button></div>
        <div className="bd" style={{maxHeight:380, overflow:'auto'}}>
          <div className="grid grid-3">
            {items.map(t=>(
              <button key={t} className="btn" onClick={()=>onSelect(t)}>{t}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function AddServiceModal({ctx,onClose,onAdd}){
  const {dayKey,shiftKey}=ctx
  const [role,setRole]=useState(shiftKey==='standby'?'Standby':'FOH')
  const [time,setTime]=useState(shiftKey==='standby'?'13:00':'17:00')
  const [showPicker,setShowPicker]=useState(false)
  return (
    <div className="modal" onClick={onClose}>
      <div className="box" onClick={e=>e.stopPropagation()}>
        <div className="hd"><b>Nieuwe dienst — {shiftKey==='standby'?'Standby (dag)':shiftKey}</b><button className="btn" onClick={onClose}>Sluit</button></div>
        <div className="bd grid" style={{gap:8}}>
          {shiftKey!=='standby' && (
            <label className="grid" style={{gap:6}}>
              <span className="small">Rol</span>
              <select value={role} onChange={e=>setRole(e.target.value)}>
                {roles.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          )}
          <label className="grid" style={{gap:6}}>
            <span className="small">Tijd</span>
            <div className="row">
              <input value={time} onChange={e=>setTime(e.target.value)} style={{width:100}} />
              <button className="btn" onClick={()=>setShowPicker(true)}>Kies</button>
            </div>
          </label>
          <div className="row" style={{justifyContent:'flex-end'}}>
            <button className="btn" onClick={onClose}>Annuleer</button>
            <button className="btn pri" onClick={()=>{ onAdd({role,time}); }}>Toevoegen</button>
          </div>
        </div>
      </div>
      {showPicker && <TimePicker current={time} onSelect={(t)=>{ setTime(t); setShowPicker(false) }} onClose={()=>setShowPicker(false)} />}
    </div>
  )
}

function NewEmployee({onAdd}){
  const [name,setName]=useState('')
  const [wage,setWage]=useState(15)
  const [prefs,setPrefs]=useState([])
  const [skills,setSkills]=useState({FOH:3,Host:3,Bar:3,Runner:3,Allround:3})
  const [canOpen,setCanOpen]=useState(false)
  const [canClose,setCanClose]=useState(false)
  const [allowedStandby,setAllowedStandby]=useState(true)
  const togglePref=(v)=> setPrefs(prev=> prev.includes(v)? prev.filter(x=>x!==v) : [...prev,v])
  return (
    <div className="grid" style={{gap:8}}>
      <label className="grid" style={{gap:6}}><span className="small">Naam</span><input value={name} onChange={e=>setName(e.target.value)} /></label>
      <label className="grid" style={{gap:6}}><span className="small">Uurloon (€)</span><input type="number" value={wage} onChange={e=>setWage(parseFloat(e.target.value||'0'))} /></label>
      <div className="row small">
        {['open','tussen','sluit'].map(p=>(
          <label key={p}><input type="checkbox" checked={prefs.includes(p)} onChange={()=>togglePref(p)} /> {p}</label>
        ))}
        <label><input type="checkbox" checked={prefs.length===0} onChange={()=>setPrefs([])} /> geen voorkeur</label>
      </div>
      <div className="row small">
        <label><input type="checkbox" checked={canOpen} onChange={e=>setCanOpen(e.target.checked)} /> kan openen</label>
        <label><input type="checkbox" checked={canClose} onChange={e=>setCanClose(e.target.checked)} /> kan sluiten</label>
        <label><input type="checkbox" checked={allowedStandby} onChange={e=>setAllowedStandby(e.target.checked)} /> mag standby</label>
      </div>
      <button className="btn pri" onClick={()=>{ if(!name) return; const id='e'+Math.random().toString(36).slice(2,7); onAdd({id,name,wage,skills,prefs,canOpen,canClose,allowedStandby}); setName(''); setPrefs([]); }}>Toevoegen</button>
    </div>
  )
}

function EditEmployeeModal({emp,onClose,onSave}){
  const [name,setName]=useState(emp.name)
  const [wage,setWage]=useState(emp.wage)
  const [prefs,setPrefs]=useState(emp.prefs||[])
  const [skills,setSkills]=useState({...emp.skills})
  const [canOpen,setCanOpen]=useState(!!emp.canOpen)
  const [canClose,setCanClose]=useState(!!emp.canClose)
  const [allowedStandby,setAllowedStandby]=useState(!!emp.allowedStandby)
  const togglePref=(v)=> setPrefs(prev=> prev.includes(v)? prev.filter(x=>x!==v) : [...prev,v])
  return (
    <div className="modal" onClick={onClose}>
      <div className="box" onClick={e=>e.stopPropagation()}>
        <div className="hd"><b>Bewerk medewerker</b><button className="btn" onClick={onClose}>Sluit</button></div>
        <div className="bd grid" style={{gap:10}}>
          <label className="grid" style={{gap:6}}><span className="small">Naam</span><input value={name} onChange={e=>setName(e.target.value)} /></label>
          <label className="grid" style={{gap:6}}><span className="small">Uurloon (€)</span><input type="number" value={wage} onChange={e=>setWage(parseFloat(e.target.value||'0'))} /></label>
          <div>
            <div><b>Voorkeursdiensten</b></div>
            <div className="row small" style={{marginTop:6}}>
              {['open','tussen','sluit'].map(p=>(
                <label key={p}><input type="checkbox" checked={prefs.includes(p)} onChange={()=>togglePref(p)} /> {p}</label>
              ))}
              <label><input type="checkbox" checked={prefs.length===0} onChange={()=>setPrefs([])} /> geen voorkeur</label>
            </div>
          </div>
          <div>
            <div><b>Competenties</b></div>
            <div className="row small" style={{marginTop:6}}>
              <label><input type="checkbox" checked={canOpen} onChange={e=>setCanOpen(e.target.checked)} /> kan openen</label>
              <label><input type="checkbox" checked={canClose} onChange={e=>setCanClose(e.target.checked)} /> kan sluiten</label>
              <label><input type="checkbox" checked={allowedStandby} onChange={e=>setAllowedStandby(e.target.checked)} /> mag standby</label>
            </div>
          </div>
          <div className="row" style={{justifyContent:'flex-end'}}>
            <button className="btn" onClick={onClose}>Annuleer</button>
            <button className="btn pri" onClick={()=>onSave({...emp,name,wage,prefs,skills,canOpen,canClose,allowedStandby})}>Opslaan</button>
          </div>
        </div>
      </div>
    </div>
  )
}
