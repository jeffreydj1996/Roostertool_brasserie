import React, { useMemo, useState, useEffect } from "react";

const brand = { primary: "#1F2937", accent: "#C5A15E", bg: "#F8F7F4" };

const days = [
  { key: "ma", label: "Ma" },
  { key: "di", label: "Di" },
  { key: "wo", label: "Wo" },
  { key: "do", label: "Do" },
  { key: "vr", label: "Vr" },
  { key: "za", label: "Za" },
  { key: "zo", label: "Zo" },
];

const defaultNeeds = {
  ma: { standby: [{ role: "Standby", count: 1, starts: ["13:00"] }], lunch: [{ role: "Allround", count: 1, starts: ["10:00"] }], diner: [{ role: "Allround", count: 1, starts: ["17:00"] }] },
  di: { standby: [{ role: "Standby", count: 1, starts: ["13:00"] }], lunch: [{ role: "Allround", count: 1, starts: ["10:00"] }], diner: [{ role: "Allround", count: 1, starts: ["17:00"] }] },
  wo: { standby: [{ role: "Standby", count: 1, starts: ["13:00"] }], lunch: [{ role: "Allround", count: 1, starts: ["10:00"] }], diner: [{ role: "Allround", count: 1, starts: ["17:00"] }] },
  do: { standby: [{ role: "Standby", count: 1, starts: ["13:00"] }], lunch: [{ role: "Allround", count: 1, starts: ["10:00"] }], diner: [{ role: "Allround", count: 1, starts: ["17:00"] }] },
  vr: { standby: [{ role: "Standby", count: 1, starts: ["12:00"] }], lunch: [{ role: "Allround", count: 1, starts: ["10:00"] }], diner: [{ role: "FOH", count: 2, starts: ["17:00", "18:00"] }, { role: "Runner", count: 1, starts: ["17:00"] }, { role: "Bar", count: 1, starts: ["17:00"] }] },
  za: { lunch: [{ role: "FOH", count: 1, starts: ["10:00"] }, { role: "Bar", count: 1, starts: ["12:00"] }], diner: [{ role: "FOH", count: 2, starts: ["17:00", "18:00"] }, { role: "Runner", count: 1, starts: ["17:00"] }, { role: "Bar", count: 1, starts: ["17:00"] }] },
  zo: { lunch: [{ role: "FOH", count: 2, starts: ["10:00", "14:00"] }, { role: "Bar", count: 1, starts: ["12:00"] }], diner: [{ role: "FOH", count: 1, starts: ["17:00"] }, { role: "Bar", count: 1, starts: ["17:00"] }] },
};

const demoEmployees = [
  { id: "e1", name: "Sanne", wage: 18.5, skills: { FOH: 5, Host: 4, Bar: 4, Runner: 3, Allround: 5 }, canOpen: true, canClose: true, prefs: ["sluit"], allowedStandby: true, isMentor: true, isRookie: false, preferWith: [], avoidWith: [] },
  { id: "e2", name: "Ahmed", wage: 15.0, skills: { FOH: 4, Host: 3, Bar: 2, Runner: 4, Allround: 4 }, canOpen: true, canClose: false, prefs: ["open"], allowedStandby: true, isMentor: false, isRookie: true, preferWith: ["e1"], avoidWith: [] },
  { id: "e3", name: "Lena", wage: 22.0, skills: { FOH: 5, Host: 5, Bar: 3, Runner: 3, Allround: 4 }, canOpen: true, canClose: true, prefs: ["tussen"], allowedStandby: false, isMentor: true, isRookie: false, preferWith: [], avoidWith: [] },
];

function pad2(n) { return n < 10 ? `0${n}` : String(n) }
function timeToMin(str) { const [h, m] = String(str).split(":").map(Number); return (h || 0) * 60 + (m || 0) }
function prefFrom(shiftKey, start) { if (shiftKey === "standby") return null; const m = timeToMin(start); if (m <= 600) return "open"; if (m >= 720 && m <= 840) return "tussen"; if (m >= 1020) return "sluit"; return null }
function requiresOpen(start) { return timeToMin(start) <= 600 }
function requiresClose(start) { return timeToMin(start) >= 1020 }
function deepClone(o) { return JSON.parse(JSON.stringify(o)) }

function useP75Wage(employees) {
  return useMemo(() => {
    const wages = employees.map(e => e.wage).sort((a, b) => a - b)
    if (!wages.length) return 0
    const idx = Math.floor(0.75 * (wages.length - 1))
    return wages[idx]
  }, [employees])
}

export default function App() {
  const [dark, setDark] = useState(false)
  const [tab, setTab] = useState("dashboard")
  const [employees, setEmployees] = useState(demoEmployees)
  const [needsByWeek, setNeedsByWeek] = useState({ [currentWeekKey()]: deepClone(defaultNeeds) })
  const [assignmentsByWeek, setAssignmentsByWeek] = useState({})
  const [availabilityByWeek, setAvailabilityByWeek] = useState({})
  const [weekKey, setWeekKey] = useState(currentWeekKey())
  const [picker, setPicker] = useState(null)
  const [editEmp, setEditEmp] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selfTest, setSelfTest] = useState({ passed: 0, failed: [] })

  const needs = needsByWeek[weekKey] || deepClone(defaultNeeds)
  const assignments = assignmentsByWeek[weekKey] || {}
  const availability = availabilityByWeek[weekKey] || {}
  const p75 = useP75Wage(employees)

  useEffect(() => { setSelfTest(runTests()) }, [])

  function slotKey(dayKey, shiftKey, role, start) { return `${dayKey}:${shiftKey}:${role}:${start}` }

  function isAvailable(empId, dayKey, start) {
    const rec = availability[empId]?.[dayKey]
    if (!rec) return true
    if (rec.type === 'none') return false
    if (rec.type === 'all') return true
    const startMin = timeToMin(start), endMin = startMin + 7 * 60
    const [fh, fm] = (rec.from || '00:00').split(':').map(Number)
    const [th, tm] = (rec.to || '23:59').split(':').map(Number)
    const a = fh * 60 + fm, b = th * 60 + tm
    return startMin < b && a < endMin
  }

  function addAssignment(dayKey, shiftKey, role, start, employeeId) {
    setAssignmentsByWeek(prev => {
      const prevWeek = prev[weekKey] || {}
      const conflict = Object.keys(prevWeek).some(k => {
        const [d] = k.split(':')
        if (d !== dayKey) return false
        return (prevWeek[k] || []).some(a => a.employeeId === employeeId)
      })
      if (conflict) return prev
      if (!isAvailable(employeeId, dayKey, start)) return prev
      const emp = employees.find(e => e.id === employeeId); if (!emp) return prev
      if (role === 'Standby' && !emp.allowedStandby) return prev
      if (role !== 'Standby') {
        if ((emp.skills[role] ?? 0) < 3) return prev
        if (requiresOpen(start) && !emp.canOpen) return prev
        if (requiresClose(start) && !emp.canClose) return prev
      }
      const key = slotKey(dayKey, shiftKey, role, start)
      const list = prevWeek[key] || []
      if (list.some(a => a.employeeId === employeeId)) return prev
      const nextWeek = { ...prevWeek, [key]: [...list, { employeeId, standby: role === 'Standby' }] }
      return { ...prev, [weekKey]: nextWeek }
    })
  }

  function removeAssignment(dayKey, shiftKey, role, start, employeeId) {
    setAssignmentsByWeek(prev => {
      const prevWeek = prev[weekKey] || {}
      const key = slotKey(dayKey, shiftKey, role, start)
      const list = prevWeek[key] || []
      const nextWeek = { ...prevWeek, [key]: list.filter(a => a.employeeId !== employeeId) }
      return { ...prev, [weekKey]: nextWeek }
    })
  }

  function candidateSort(role, shiftKey, start) {
    return (a, b) => {
      const p = prefFrom(shiftKey, start)
      const ap = !!(p && (a.prefs || []).includes(p))
      const bp = !!(p && (b.prefs || []).includes(p))
      if (ap !== bp) return ap ? -1 : 1
      if (role !== 'Standby') {
        const sa = a.skills[role] ?? 0, sb = b.skills[role] ?? 0
        if (sa !== sb) return sb - sa
      }
      return a.wage - b.wage
    }
  }

  function buildAutofillAssignments() {
    const next = {}
    const byDay = {}
    const byDayStandby = {}
    days.forEach(d => { byDay[d.key] = new Set(); byDayStandby[d.key] = new Set() })

    days.forEach(d => {
      const dayNeeds = needs[d.key] || {}
      Object.entries(dayNeeds).forEach(([shiftKey, entries]) => {
        entries.forEach(entry => {
          entry.starts.forEach(start => {
            const key = slotKey(d.key, shiftKey, entry.role, start)
            const candidates = employees.filter(e => {
              if (entry.role === 'Standby') return !!e.allowedStandby
              return (e.skills[entry.role] ?? 0) >= 3
            }).sort(candidateSort(entry.role, shiftKey, start))

            let placed = []
            let dureCount = 0
            const limitDure = ((d.key === 'vr' || d.key === 'za') && shiftKey === 'diner') ? 2 : 1
            let placedMentor = false
            let placedRookie = false
            const needOpen = requiresOpen(start)
            const needClose = requiresClose(start)
            let placedOpen = false
            let placedClose = false

            for (const c of candidates) {
              if (placed.length >= entry.count) break
              const hasShift = byDay[d.key].has(c.id)
              const hasSB = byDayStandby[d.key].has(c.id)

              if (entry.role === 'Standby') {
                if (hasShift) continue
              } else {
                if (hasShift) continue
                if (hasSB) continue
                if (needOpen && !c.canOpen) continue
                if (needClose && !c.canClose) continue
                if (c.wage >= p75 && dureCount >= limitDure) continue
              }

              if (needOpen && !placedOpen && c.canOpen) {
                placed.push({ employeeId: c.id, standby: false }); byDay[d.key].add(c.id)
                if (c.wage >= p75) dureCount++; placedOpen = true
                if (c.isMentor) placedMentor = true; if (c.isRookie) placedRookie = true
                continue
              }
              if (needClose && !placedClose && c.canClose) {
                placed.push({ employeeId: c.id, standby: false }); byDay[d.key].add(c.id)
                if (c.wage >= p75) dureCount++; placedClose = true
                if (c.isMentor) placedMentor = true; if (c.isRookie) placedRookie = true
                continue
              }

              placed.push({ employeeId: c.id, standby: entry.role === 'Standby' })
              if (entry.role === 'Standby') byDayStandby[d.key].add(c.id)
              else { byDay[d.key].add(c.id); if (c.wage >= p75) dureCount++; if (c.isMentor) placedMentor = true; if (c.isRookie) placedRookie = true }
            }

            if (entry.role !== 'Standby' && placedRookie && !placedMentor) {
              const currentIds = new Set(placed.map(x => x.employeeId))
              const mentor = candidates.find(c => !currentIds.has(c.id) && c.isMentor && !byDay[d.key].has(c.id))
              if (mentor) {
                if (placed.length < entry.count) {
                  placed.push({ employeeId: mentor.id, standby: false })
                } else {
                  let idxToSwap = -1, worst = -1
                  placed.forEach((a, idx) => {
                    const emp = employees.find(e => e.id === a.employeeId); if (!emp) return
                    const isOpenReq = needOpen && emp.canOpen
                    const isCloseReq = needClose && emp.canClose
                    if (isOpenReq || isCloseReq) return
                    if (emp.wage > worst) { worst = emp.wage; idxToSwap = idx }
                  })
                  if (idxToSwap >= 0) placed[idxToSwap] = { employeeId: mentor.id, standby: false }
                }
              }
            }

            next[key] = placed
          })
        })
      })
    })
    return next
  }

  function autofill() {
    const next = buildAutofillAssignments()
    setAssignmentsByWeek(prev => ({ ...prev, [weekKey]: next }))
    setSelfTest(runTests(next))
  }

  function shiftCost(dayKey, shiftKey) {
    const byEmp = {}
    Object.keys(assignments).forEach(k => {
      const [d, s, r] = k.split(':'); if (d !== dayKey || s !== shiftKey || r === "Standby") return
      (assignments[k] || []).forEach(a => { byEmp[a.employeeId] = true })
    })
    return Object.keys(byEmp).reduce((sum, id) => {
      const emp = employees.find(e => e.id === id); return sum + (emp ? emp.wage * 7 : 0)
    }, 0)
  }
  function dayCost(dayKey) { return Object.keys(needs[dayKey] || {}).reduce((sum, s) => sum + shiftCost(dayKey, s), 0) }
  const weekCost = useMemo(() => days.reduce((acc, d) => acc + dayCost(d.key), 0), [assignments, needs])

  function warningsFor(dayKey, shiftKey) {
    const limit = ((dayKey === 'vr' || dayKey === 'za') && shiftKey === 'diner') ? 2 : 1
    const dure = new Set()
    Object.keys(assignments).forEach(k => {
      const [d, s, role] = k.split(':')
      if (d === dayKey && s === shiftKey && role !== "Standby") {
        (assignments[k] || []).forEach(a => {
          const emp = employees.find(e => e.id === a.employeeId)
          if (emp && emp.wage >= p75) dure.add(a.employeeId)
        })
      }
    })
    return { hasOver: dure.size > limit, dure: dure.size, limit }
  }

  function dayAssignments(dayKey) {
    const rows = []
    Object.keys(assignments).forEach(k => {
      const [d, s, role, start] = k.split(':')
      if (d !== dayKey) return
      (assignments[k] || []).forEach(a => rows.push({ role, start, employeeId: a.employeeId }))
    })
    return rows.sort((a, b) => timeToMin(a.start) - timeToMin(b.start))
  }

  function rosterMatrix() {
    const headers = ["Naam", ...days.map(d => d.label)]
    const rows = employees.map(e => {
      const cols = days.map(d => {
        let standby = false, earliest = null
        Object.keys(assignments).forEach(k => {
          const [day, , role, start] = k.split(':')
          if (day !== d.key) return
          (assignments[k] || []).forEach(a => {
            if (a.employeeId !== e.id) return
            if (role === 'Standby') standby = true
            else earliest = earliest == null ? start : (timeToMin(start) < timeToMin(earliest) ? start : earliest)
          })
        })
        if (standby) return 'SB'
        return earliest ? earliest : 'x'
      })
      return [e.name, ...cols]
    })
    return { headers, rows }
  }

  function changeDay(delta) { const d = new Date(selectedDate); d.setDate(d.getDate() + delta); setSelectedDate(d) }

  return (
    <div style={{ background: brand.bg, minHeight: "100vh", color: "#111" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid #e5e7eb", background: "rgba(255,255,255,0.8)", backdropFilter: "blur(6px)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 12, background: brand.accent }} />
            <div style={{ fontWeight: 600 }}>Roostertool Brasserie</div>
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, border: "1px solid #e5e7eb" }}>MVP</span>
          </div>
          <nav style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <Tab label="Dashboard" active={tab === 'dashboard'} onClick={() => setTab('dashboard')} />
            <Tab label="Rooster" active={tab === 'rooster'} onClick={() => setTab('rooster')} />
            <Tab label="Beschikbaarheid" active={tab === 'beschikbaarheid'} onClick={() => setTab('beschikbaarheid')} />
            <Tab label="Medewerkers" active={tab === 'medewerkers'} onClick={() => setTab('medewerkers')} />
            <Tab label="Instellingen" active={tab === 'instellingen'} onClick={() => setTab('instellingen')} />
            <Tab label="Export" active={tab === 'export'} onClick={() => setTab('export')} />
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="week" value={weekKey} onChange={e => setWeekKey(e.target.value)} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }} />
            <button onClick={() => setDark(v => !v)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}>{dark ? "Light" : "Dark"}</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 16px" }}>
        {tab === 'dashboard' && <Dashboard selectedDate={selectedDate} changeDay={changeDay} employees={employees} dayAssignments={dayAssignments} weekCost={weekCost} rosterMatrix={rosterMatrix} />}
        {tab === 'rooster' && <Rooster needs={needs} days={days} employees={employees} assignments={assignments} warningsFor={warningsFor} shiftCost={shiftCost} dayCost={dayCost} weekCost={weekCost} p75={p75} setPicker={setPicker} addAssignment={addAssignment} removeAssignment={removeAssignment} onNeedsChange={(next) => setNeedsByWeek(prev => ({ ...prev, [weekKey]: next }))} onChangeStart={(dayKey, shiftKey, entryIndex, role, oldStart, newStart) => {
          setNeedsByWeek(prev => {
            const wk = { ...(prev[weekKey] || deepClone(defaultNeeds)) }
            const list = (wk[dayKey]?.[shiftKey] || []).slice()
            const entry = { ...list[entryIndex] }
            entry.starts = entry.starts.map(s => s === oldStart ? newStart : s)
            list[entryIndex] = entry
            wk[dayKey] = { ...(wk[dayKey] || {}), [shiftKey]: list }
            return { ...prev, [weekKey]: wk }
          })
          setAssignmentsByWeek(prev => {
            const wk = { ...(prev[weekKey] || {}) }
            const oldKey = `${dayKey}:${shiftKey}:${role}:${oldStart}`
            const newKey = `${dayKey}:${shiftKey}:${role}:${newStart}`
            if (wk[oldKey]) {
              const moved = wk[oldKey]
              const rest = { ...wk }
              delete rest[oldKey]
              rest[newKey] = moved
              return { ...prev, [weekKey]: rest }
            }
            return prev
          })
        }} autofill={autofill} />}
        {tab === 'beschikbaarheid' && <Availability employees={employees} days={days} availability={availability} setAvailabilityByWeek={setAvailabilityByWeek} weekKey={weekKey} />}
        {tab === 'medewerkers' && <Employees employees={employees} setEmployees={setEmployees} p75={p75} setEditEmp={setEditEmp} />}
        {tab === 'instellingen' && <Settings />}
        {tab === 'export' && <ExportView />}
      </main>

      <footer style={{ padding: "24px 0", textAlign: "center", fontSize: 12, color: "#6b7280" }}>© Roostertool Brasserie — MVP Prototype</footer>

      {picker && (
        <AssignModal
          onClose={() => setPicker(null)}
          onChoose={(empId) => { addAssignment(picker.dayKey, picker.shiftKey, picker.role, picker.start, empId); setPicker(null) }}
          employees={employees}
          assignments={assignments}
          dayKey={picker.dayKey}
          shiftKey={picker.shiftKey}
          role={picker.role}
          start={picker.start}
          p75={p75}
          availability={availability}
        />
      )}

      {editEmp && (
        <EditEmployeeModal
          employee={editEmp}
          onClose={() => setEditEmp(null)}
          onSave={(updated) => { setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e)); setEditEmp(null) }}
          employees={employees}
        />
      )}

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "8px 16px" }}>
        <SelfTest selfTest={selfTest} />
      </div>
    </div>
  )

  function runTests(override) {
    const state = override || buildAutofillAssignments()
    const fails = []
    if (!Object.keys(state).every(k => Array.isArray(state[k]))) fails.push('T1: Slot niet als array')
    const anySB = Object.keys(state).find(k => k.includes(':Standby:'))
    if (anySB && state[anySB][0]) {
      const a = state[anySB][0]
      const emp = employees.find(e => e.id === a.employeeId)
      const cost = a.standby ? 0 : (emp ? emp.wage * 7 : 0)
      if (cost !== 0) fails.push('T2: Standby rekent kosten')
    }
    const byDayEmp = {}
    Object.keys(state).forEach(k => {
      const [d, s, r, start] = k.split(':')
      ;(state[k] || []).forEach(a => {
        byDayEmp[d] = byDayEmp[d] || {}
        byDayEmp[d][a.employeeId] = byDayEmp[d][a.employeeId] || { standby: false, shifts: new Set(), open: false, close: false }
        if (r === 'Standby') byDayEmp[d][a.employeeId].standby = true
        byDayEmp[d][a.employeeId].shifts.add(s)
        if (r !== 'Standby') {
          if (requiresOpen(start)) byDayEmp[d][a.employeeId].open = true
          if (requiresClose(start)) byDayEmp[d][a.employeeId].close = true
        }
      })
    })
    Object.entries(byDayEmp).forEach(([day, empMap]) => {
      Object.entries(empMap).forEach(([empId, info]) => {
        if (info.shifts.size > 1) fails.push('T3: meerdere shifts op 1 dag')
        if (info.standby && (info.shifts.size > 1 || !info.shifts.has('standby'))) fails.push('T3: standby gecombineerd met andere shift')
        const emp = employees.find(e => e.id === empId)
        if (emp) { if (info.open && !emp.canOpen) fails.push('T7: open zonder bevoegdheid'); if (info.close && !emp.canClose) fails.push('T8: sluit zonder bevoegdheid') }
      })
    })
    const countDure = (dayKey, shiftKey) => {
      const set = new Set()
      Object.keys(state).forEach(k => {
        const [d, s, r] = k.split(':')
        if (d === dayKey && s === shiftKey && r !== 'Standby') {
          ;(state[k] || []).forEach(a => { const emp = employees.find(e => e.id === a.employeeId); if (emp && emp.wage >= p75) set.add(a.employeeId) })
        }
      })
      return set.size
    }
    if (countDure('vr', 'diner') > 2) fails.push('T4: Dure-limiet vr-diner overschreden')
    if (countDure('za', 'diner') > 2) fails.push('T4: Dure-limiet za-diner overschreden')
    Object.keys(state).forEach(k => {
      const [, , role] = k.split(':')
      if (role === 'Standby') return
      ;(state[k] || []).forEach(a => { const emp = employees.find(e => e.id === a.employeeId); if (emp && ((emp.skills[role] ?? 0) < 3)) fails.push('T5: skill <3 ingepland') })
    })
    const needSB = (dayKey) => (needs[dayKey]?.standby?.[0]?.count) || 0
    days.forEach(d => { const assigned = Object.keys(state).filter(k => k.startsWith(`${d.key}:standby:Standby:`)).reduce((n, k) => n + ((state[k] || []).length), 0); if (assigned > needSB(d.key)) fails.push(`T6: Te veel standby op ${d.key}`) })
    return { passed: 8, failed: fails }
  }
}

function Dashboard({ selectedDate, changeDay, employees, dayAssignments, weekCost, rosterMatrix }) {
  const dayIndex = selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1
  const rows = dayAssignments(days[dayIndex].key)
  const m = rosterMatrix()
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <Panel title="Vandaag">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button style={btn()} onClick={() => changeDay(-1)}>◀︎</button>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{selectedDate.toLocaleDateString('nl-NL', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
            <button style={btn()} onClick={() => changeDay(1)}>▶︎</button>
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: 14 }}>
              <thead style={{ background: "#f9fafb" }}><tr><th style={th()}>Start</th><th style={th()}>Rol</th><th style={th()}>Medewerker</th></tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const emp = employees.find(e => e.id === r.employeeId)
                  return (<tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}><td style={td()}>{r.role === 'Standby' ? '—' : r.start}</td><td style={td()}>{r.role}</td><td style={td()}>{emp?.name || r.employeeId}</td></tr>)
                })}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Weekkosten">
          <div style={{ fontSize: 24, fontWeight: 700 }}>€{weekCost.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Som (excl. Standby). 7u/dienst.</div>
        </Panel>
        <Panel title="Weekrooster (CSV-formaat)">
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 14 }}>
              <thead><tr style={{ background: "#f9fafb" }}>{m.headers.map((h, i) => (<th key={i} style={th()}>{h}</th>))}</tr></thead>
              <tbody>{m.rows.map((row, r) => (<tr key={r} style={{ borderTop: "1px solid #e5e7eb" }}>{row.map((cell, c) => (<td key={c} style={td()}>{cell}</td>))}</tr>))}</tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Rooster({ needs, days, employees, assignments, warningsFor, shiftCost, dayCost, weekCost, p75, setPicker, addAssignment, removeAssignment, onNeedsChange, onChangeStart, autofill }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 12, background: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button style={btn()} onClick={autofill}>Autofill (week)</button>
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#FEF3C7", color: "#92400E" }}>P75: €{p75.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: 14 }}>Weekkosten: <b>€{weekCost.toFixed(2)}</b></div>
        </div>

        {days.map(d => (
          <div key={d.key} style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "white", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: brand.bg }}>
              <div style={{ fontWeight: 600 }}>{d.label}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Kosten: €{dayCost(d.key).toFixed(2)}</div>
            </div>

            <div style={{ display: "grid", gap: 12, padding: 12 }}>
              {Object.entries(needs[d.key]).map(([shiftKey, entries]) => (
                <div key={shiftKey} style={{ border: "1px solid #e5e7eb", borderRadius: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f9fafb" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{shiftKey === 'standby' ? 'Standby (dag)' : shiftKey}</div>
                    <ShiftWarningsBadge info={warningsFor(d.key, shiftKey)} />
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Kosten: €{shiftCost(d.key, shiftKey).toFixed(2)}</div>
                  </div>

                  <div style={{ display: "grid", gap: 8, padding: 8 }}>
                    {entries.map((entry, idx) => (
                      <Cell
                        key={idx}
                        dayKey={d.key}
                        shiftKey={shiftKey}
                        entryIndex={idx}
                        entry={entry}
                        openPicker={setPicker}
                        employees={employees}
                        assignments={assignments}
                        p75={p75}
                        addAssignment={addAssignment}
                        removeAssignment={removeAssignment}
                        onChangeStart={onChangeStart}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 16, position: "sticky", top: 16, height: "fit-content" }}>
        <Bench employees={employees} p75={p75} />
        <Panel title="Bezetting & Standby (week)">
          <NeedsEditor needs={needs} onChange={onNeedsChange} />
        </Panel>
      </div>
    </div>
  )
}

function Availability({ employees, days, availability, setAvailabilityByWeek, weekKey }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="Beschikbaarheid per week">
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 14 }}>
            <thead><tr style={{ background: "#f9fafb" }}><th style={th()}>Medewerker</th>{days.map(d => (<th key={d.key} style={th()}>{d.label}</th>))}</tr></thead>
            <tbody>
              {employees.map(e => (
                <tr key={e.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={td(true)}>{e.name}</td>
                  {days.map(d => (
                    <td key={d.key} style={td()}>
                      <AvailabilityPicker value={availability[e.id]?.[d.key]} onChange={(val) => {
                        setAvailabilityByWeek(prev => { const copy = { ...prev }; const wk = { ...(copy[weekKey] || {}) }; const perEmp = { ...(wk[e.id] || {}) }; perEmp[d.key] = val; wk[e.id] = perEmp; copy[weekKey] = wk; return copy })
                      }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

function Employees({ employees, setEmployees, p75, setEditEmp }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
      <Panel title="Medewerkers">
        <div style={{ display: "grid", gap: 8 }}>
          {employees.map(e => (
            <div key={e.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{e.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>€{e.wage.toFixed(2)}/u · Pref: {e.prefs && e.prefs.length ? e.prefs.join(', ') : 'geen'}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>FOH {e.skills.FOH ?? 0} · Host {e.skills.Host ?? 0} · Bar {e.skills.Bar ?? 0} · Runner {e.skills.Runner ?? 0} · AR {e.skills.Allround ?? 0}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Standby: {e.allowedStandby ? 'ja' : 'nee'} · Open: {e.canOpen ? 'ja' : 'nee'} · Sluit: {e.canClose ? 'ja' : 'nee'}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={btnSm()} onClick={() => setEditEmp(e)}>Bewerk</button>
                <button style={btnSm()} onClick={() => setEmployees(prev => prev.filter(x => x.id !== e.id))}>Verwijder</button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Nieuwe medewerker"><NewEmployeeForm onAdd={(emp) => setEmployees(prev => [...prev, emp])} /></Panel>
      <Panel title="Import (later)"><div style={{ fontSize: 14, color: "#6b7280" }}>CSV/Excel import volgt.</div></Panel>
    </div>
  )
}

function Settings() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="Kleuren & Branding"><div style={{ fontSize: 14, color: "#6b7280" }}>Kleuren gematcht aan brasserie1434.nl. Dark mode beschikbaar.</div></Panel>
      <Panel title="Grenzen (weergave)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14 }}>
          <LabeledInput label="Max opeenvolgende dagen" placeholder="5" />
          <LabeledInput label="Min. rust (uur)" placeholder="11" />
          <LabeledInput label="Max sluit→open per week" placeholder="1" />
          <LabeledInput label="Max diensten/week" placeholder="5" />
        </div>
      </Panel>
    </div>
  )
}

function ExportView() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="WhatsApp (Business)"><div style={{ fontSize: 14, color: "#6b7280" }}>Automatisch versturen via WhatsApp Business.</div><button style={btn()} className="mt-2">Genereer & Verstuur</button></Panel>
      <Panel title="Kalender (ICS)"><div style={{ fontSize: 14, color: "#6b7280" }}>Per medewerker een .ics.</div><button style={btn()}>Exporteer ICS</button></Panel>
      <Panel title="PDF voor prikbord"><button style={btn()}>Download PDF</button></Panel>
    </div>
  )
}

function SelfTest({ selfTest }) {
  return selfTest.failed.length === 0 ? (
    <span style={{ marginLeft: 4, fontSize: 12, color: "#047857" }}>Alle {selfTest.passed} tests geslaagd.</span>
  ) : (
    <span style={{ marginLeft: 4, fontSize: 12, color: "#b91c1c" }}>{selfTest.failed.length} fout(en): {selfTest.failed.join(', ')}</span>
  )
}

function Cell({ dayKey, shiftKey, entryIndex, entry, openPicker, employees, assignments, p75, addAssignment, removeAssignment, onChangeStart }) {
  const role = entry.role
  const [editKey, setEditKey] = useState(null)
  const allHalfHours = useMemo(() => {
    const times = []; const add = (h, m) => times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    for (let h = 6; h <= 24; h++) { add(h % 24, 0); add(h % 24, 30) }
    add(1, 0); add(1, 30)
    return times
  }, [])
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 8, background: "white" }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ padding: "2px 8px", borderRadius: 999, background: "#f3f4f6" }}>{role}</span>
        <span style={{ color: "#6b7280" }}>{entry.count}×</span>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {entry.starts.map((start, i) => {
          const k = `${dayKey}:${shiftKey}:${role}:${start}`
          const list = assignments[k] || []
          const filled = list.length, spots = entry.count
          const needOpen = requiresOpen(start)
          const needClose = requiresClose(start)
          const hasOpener = list.some(a => { const emp = employees.find(e => e.id === a.employeeId); return !!emp?.canOpen })
          const hasCloser = list.some(a => { const emp = employees.find(e => e.id === a.employeeId); return !!emp?.canClose })
          return (
            <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 8 }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <span>Start {start} · {filled}/{spots}</span>
                {needOpen && <span style={pill(hasOpener)}>{hasOpener ? 'Open OK' : 'Open ontbreekt'}</span>}
                {needClose && <span style={pill(hasCloser)}>{hasCloser ? 'Sluit OK' : 'Sluit ontbreekt'}</span>}
                <button style={{ marginLeft: "auto", ...btnSm() }} onClick={() => setEditKey(editKey === k ? null : k)}>🕒 Tijd</button>
                {editKey === k && (
                  <select value={start} onChange={(e) => { const ns = e.target.value; setEditKey(null); onChangeStart(dayKey, shiftKey, entryIndex, role, start, ns) }} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                    {allHalfHours.map(t => (<option key={t} value={t}>{t}</option>))}
                  </select>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {list.map((a, idx) => {
                  const emp = employees.find(e => e.id === a.employeeId)
                  if (!emp) return null
                  return (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 8, background: "white", border: "1px solid #e5e7eb", boxShadow: "0 1px 1px rgba(0,0,0,0.04)" }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{emp.name}</span>
                      {a.standby && <span style={tinyTag("#e5e7eb", "#374151")}>Standby</span>}
                      {emp.wage >= p75 && !a.standby && <span style={tinyTag("#fee2e2", "#b91c1c")}>Duur</span>}
                      <span style={{ fontSize: 10, color: "#6b7280" }}>€{emp.wage.toFixed(2)}/u</span>
                      <button style={btnTiny()} onClick={() => removeAssignment(dayKey, shiftKey, role, start, a.employeeId)}>X</button>
                    </div>
                  )
                })}
                {Array.from({ length: Math.max(spots - filled, 0) }).map((_, j) => (
                  <button key={j} style={btnDashed()} onClick={() => openPicker({ dayKey, shiftKey, role, start })}>+ Voeg toe</button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Bench({ employees, p75 }) {
  return (
    <div>
      <div style={{ marginBottom: 6, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#6b7280" }}>Beschikbaar</div>
      <div style={{ display: "grid", gap: 8 }}>
        {employees.slice().sort((a, b) => a.wage - b.wage).map(e => (
          <div key={e.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", padding: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{e.name}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>€{e.wage.toFixed(2)}/u · Pref: {e.prefs && e.prefs.length ? e.prefs.join(', ') : 'geen'}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>FOH {e.skills.FOH ?? 0} · Host {e.skills.Host ?? 0} · Bar {e.skills.Bar ?? 0} · Runner {e.skills.Runner ?? 0} · AR {e.skills.Allround ?? 0}</div>
            </div>
            <div>{e.wage >= p75 && <span style={tinyTag("#fee2e2", "#b91c1c")}>Duur</span>}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "rgba(255,255,255,0.7)" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  )
}

function Tab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: "6px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: active ? brand.accent : "transparent", color: active ? "white" : "inherit" }}>
      {label}
    </button>
  )
}

function LabeledInput({ label, placeholder }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 14, color: "#374151" }}>{label}</span>
      <input placeholder={placeholder} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "rgba(255,255,255,0.7)" }} />
    </label>
  )
}

function ShiftWarningsBadge({ info }) {
  if (!info) return null
  const style = { fontSize: 12, padding: "2px 8px", borderRadius: 999, background: info.hasOver ? "#fee2e2" : "#dcfce7", color: info.hasOver ? "#b91c1c" : "#166534" }
  return <span style={style}>{info.dure}/{info.limit}</span>
}

function AssignModal({ onClose, onChoose, employees, assignments, dayKey, shiftKey, role, start, p75, availability }) {
  const [q, setQ] = useState('')
  const isStandby = role === 'Standby'

  function isAvail(empId) {
    const rec = availability[empId]?.[dayKey]
    if (!rec || rec.type === 'all') return true
    if (rec.type === 'none') return false
    const startMin = timeToMin(start), endMin = startMin + 7 * 60
    const [fh, fm] = (rec.from || '00:00').split(':').map(Number)
    const [th, tm] = (rec.to || '23:59').split(':').map(Number)
    const a = fh * 60 + fm, b = th * 60 + tm
    return startMin < b && a < endMin
  }

  function hasAnyAssignmentInDay(empId) {
    return Object.keys(assignments).some(k => {
      const [d] = k.split(':'); if (d !== dayKey) return false
      return (assignments[k] || []).some(a => a.employeeId === empId)
    })
  }

  const groupIds = new Set(Object.entries(assignments).flatMap(([k, list]) => {
    const [d, , r, t] = k.split(':'); if (d !== dayKey || t !== start || r === 'Standby') return []
    return list.map(a => a.employeeId)
  }))

  const candidates = employees.map(e => {
    let eligible = true
    if (!isAvail(e.id)) eligible = false
    if (hasAnyAssignmentInDay(e.id)) eligible = false
    if (isStandby && !e.allowedStandby) eligible = false
    if (!isStandby) {
      if ((e.skills[role] ?? 0) < 3) eligible = false
      if (requiresOpen(start) && !e.canOpen) eligible = false
      if (requiresClose(start) && !e.canClose) eligible = false
      const avoid = new Set(e.avoidWith || [])
      for (const gid of groupIds) { if (avoid.has(gid)) { eligible = false; break } }
    }
    if (q && !e.name.toLowerCase().includes(q.toLowerCase())) eligible = false
    const p = prefFrom(shiftKey, start)
    const prefers = !!(p && (e.prefs || []).includes(p))
    const prefer = new Set(e.preferWith || [])
    let preferScore = 0; groupIds.forEach(id => { if (prefer.has(id)) preferScore++ })
    return { e, eligible, prefers, preferScore }
  }).filter(r => r.eligible).sort((a, b) => {
    if (a.prefers !== b.prefers) return a.prefers ? -1 : 1
    if (a.preferScore !== b.preferScore) return b.preferScore - a.preferScore
    if (role !== 'Standby') {
      const sa = a.e.skills[role] ?? 0, sb = b.e.skills[role] ?? 0
      if (sa !== sb) return sb - sa
    }
    return a.e.wage - b.e.wage
  })

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", width: "100%", maxWidth: 640 }}>
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <b>Kies medewerker — {dayKey.toUpperCase()} · {shiftKey === 'standby' ? 'Standby' : shiftKey} · {role} · {start}</b>
          <button style={btnSm()} onClick={onClose}>Sluit</button>
        </div>
        <div style={{ padding: 16, display: "grid", gap: 8 }}>
          <input placeholder="Zoek op naam" value={q} onChange={e => setQ(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
          {candidates.length === 0 && <div style={{ fontSize: 14, color: "#6b7280" }}>Geen kandidaten</div>}
          {candidates.map(({ e }) => {
            const isDuur = e.wage >= p75
            return (
              <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #e5e7eb", borderRadius: 10, padding: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{e.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>€{e.wage.toFixed(2)}/u {isDuur && <span style={tinyTag("#fee2e2", "#b91c1c")}>Duur</span>}</div>
                </div>
                <button style={btnSm()} onClick={() => onChoose(e.id)}>Kies</button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EditEmployeeModal({ employee, onClose, onSave, employees }) {
  const [name, setName] = useState(employee.name)
  const [wage, setWage] = useState(employee.wage)
  const [prefs, setPrefs] = useState(employee.prefs || [])
  const [skills, setSkills] = useState({ ...employee.skills })
  const [canOpen, setCanOpen] = useState(!!employee.canOpen)
  const [canClose, setCanClose] = useState(!!employee.canClose)
  const [allowedStandby, setAllowedStandby] = useState(!!employee.allowedStandby)
  const [isMentor, setIsMentor] = useState(!!employee.isMentor)
  const [isRookie, setIsRookie] = useState(!!employee.isRookie)
  const [preferWith, setPreferWith] = useState(employee.preferWith || [])
  const [avoidWith, setAvoidWith] = useState(employee.avoidWith || [])
  const togglePref = (v) => setPrefs(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  const toggleId = (setArr, arr, id) => setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id])

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", width: "100%", maxWidth: 640 }}>
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <b>Bewerk medewerker</b>
          <button style={btnSm()} onClick={onClose}>Sluit</button>
        </div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 14 }}>Naam</span><input value={name} onChange={e => setName(e.target.value)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} /></label>
          <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 14 }}>Uurloon (€)</span><input type="number" value={wage} onChange={e => setWage(parseFloat(e.target.value || '0'))} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} /></label>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Voorkeursdiensten</div>
            <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
              {['open', 'tussen', 'sluit'].map(p => (<label key={p}><input type="checkbox" checked={prefs.includes(p)} onChange={() => togglePref(p)} /> {p}</label>))}
              <label><input type="checkbox" checked={prefs.length === 0} onChange={() => setPrefs([])} /> geen voorkeur</label>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Competenties</div>
            <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
              <label><input type="checkbox" checked={canOpen} onChange={e => setCanOpen(e.target.checked)} /> kan openen</label>
              <label><input type="checkbox" checked={canClose} onChange={e => setCanClose(e.target.checked)} /> kan sluiten</label>
              <label><input type="checkbox" checked={allowedStandby} onChange={e => setAllowedStandby(e.target.checked)} /> mag standby</label>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Koppelregels</div>
            <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
              <label><input type="checkbox" checked={isMentor} onChange={e => setIsMentor(e.target.checked)} /> mentor</label>
              <label><input type="checkbox" checked={isRookie} onChange={e => setIsRookie(e.target.checked)} /> nieuweling</label>
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
              <div style={{ fontSize: 14 }}>Juist wel samen:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 14 }}>
                {employees.filter(x => x.id !== employee.id).map(x => (<label key={x.id}><input type="checkbox" checked={(preferWith || []).includes(x.id)} onChange={() => toggleId(setPreferWith, preferWith || [], x.id)} /> {x.name}</label>))}
              </div>
              <div style={{ fontSize: 14 }}>Liever niet samen:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 14 }}>
                {employees.filter(x => x.id !== employee.id).map(x => (<label key={x.id}><input type="checkbox" checked={(avoidWith || []).includes(x.id)} onChange={() => toggleId(setAvoidWith, avoidWith || [], x.id)} /> {x.name}</label>))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button style={btn()} onClick={onClose}>Annuleer</button>
            <button style={btn()} onClick={() => onSave({ ...employee, name, wage, prefs, skills, canOpen, canClose, allowedStandby, isMentor, isRookie, preferWith, avoidWith })}>Opslaan</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NewEmployeeForm({ onAdd }) {
  const [name, setName] = useState('')
  const [wage, setWage] = useState(15)
  const [prefs, setPrefs] = useState([])
  const [skills] = useState({ FOH: 3, Host: 3, Bar: 3, Runner: 3, Allround: 3 })
  const [canOpen, setCanOpen] = useState(false)
  const [canClose, setCanClose] = useState(false)
  const [allowedStandby, setAllowedStandby] = useState(true)
  const togglePref = (v) => setPrefs(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 14 }}>Naam</span><input value={name} onChange={e => setName(e.target.value)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} /></label>
      <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 14 }}>Uurloon (€)</span><input type="number" value={wage} onChange={e => setWage(parseFloat(e.target.value || '0'))} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} /></label>
      <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
        {['open', 'tussen', 'sluit'].map(p => (<label key={p}><input type="checkbox" checked={prefs.includes(p)} onChange={() => togglePref(p)} /> {p}</label>))}
        <label><input type="checkbox" checked={prefs.length === 0} onChange={() => setPrefs([])} /> geen voorkeur</label>
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
        <label><input type="checkbox" checked={canOpen} onChange={e => setCanOpen(e.target.checked)} /> kan openen</label>
        <label><input type="checkbox" checked={canClose} onChange={e => setCanClose(e.target.checked)} /> kan sluiten</label>
        <label><input type="checkbox" checked={allowedStandby} onChange={e => setAllowedStandby(e.target.checked)} /> mag standby</label>
      </div>
      <button style={btn()} onClick={() => { if (!name) return; const id = 'e' + Math.random().toString(36).slice(2, 7); onAdd({ id, name, wage, prefs, skills, canOpen, canClose, allowedStandby }); setName(''); setPrefs([]); setCanOpen(false); setCanClose(false); setAllowedStandby(true) }}>Toevoegen</button>
    </div>
  )
}

function AvailabilityPicker({ value, onChange }) {
  const type = value?.type || 'all'
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
      <select value={type} onChange={e => onChange(e.target.value === 'all' ? { type: 'all' } : e.target.value === 'none' ? { type: 'none' } : { type: 'range', from: '10:00', to: '22:00' })} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <option value="all">Hele dag</option>
        <option value="none">Niet</option>
        <option value="range">Tijdvak</option>
      </select>
      {type === 'range' && (
        <>
          <input style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb", width: 80 }} value={value?.from || '10:00'} onChange={e => onChange({ ...(value || { type: 'range' }), type: 'range', from: e.target.value })} />
          <span>–</span>
          <input style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb", width: 80 }} value={value?.to || '22:00'} onChange={e => onChange({ ...(value || { type: 'range' }), type: 'range', to: e.target.value })} />
        </>
      )}
    </div>
  )
}

function NeedsEditor({ needs, onChange }) {
  return (
    <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
      {Object.entries(needs).map(([dayKey, shifts]) => (
        <div key={dayKey} style={{ border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <div style={{ padding: "8px 12px", background: "#f9fafb", fontWeight: 600 }}>{dayKey.toUpperCase()}</div>
          <div style={{ display: "grid", gap: 8, padding: 8 }}>
            {Object.entries(shifts).map(([shiftKey, entries]) => (
              <div key={shiftKey} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 6, textTransform: "capitalize" }}>{shiftKey}</div>
                {entries.map((e, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: "#f3f4f6" }}>{e.role}</span>
                    <span>{e.count}×</span>
                    <div style={{ display: "flex", gap: 6 }}>{e.starts.map((s, i) => (<span key={i} style={{ padding: "2px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }}>{s}</span>))}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function currentWeekKey() {
  const d = new Date()
  const iso = isoWeek(d)
  return `${iso.year}-W${pad2(iso.week)}`
}
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return { year: d.getUTCFullYear(), week: weekNo }
}

/* ---------- kleine UI helpers ---------- */
function btn() { return { padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white" } }
function btnSm() { return { padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", fontSize: 12 } }
function btnTiny() { return { padding: "2px 6px", borderRadius: 6, border: "1px solid #e5e7eb", background: "white", fontSize: 10 } }
function btnDashed() { return { padding: "6px 10px", borderRadius: 8, border: "1px dashed #9ca3af", background: "transparent", fontSize: 12 } }
function th() { return { textAlign: "left", padding: "8px 12px" } }
function td(bold) { return { padding: "8px 12px", fontWeight: bold ? 600 : 400 } }
function tinyTag(bg, fg) { return { fontSize: 10, padding: "0 6px", borderRadius: 6, background: bg, color: fg } }
function pill(ok) { return { fontSize: 10, padding: "2px 6px", borderRadius: 999, background: ok ? "#dcfce7" : "#fee2e2", color: ok ? "#166534" : "#b91c1c" } }
