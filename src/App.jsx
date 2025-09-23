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

const roles = ["FOH", "Host", "Bar", "Runner", "Allround"];

const defaultNeeds = {
  ma: {
    standby: [{ role: "Standby", count: 1, starts: ["13:00"] }],
    lunch: [{ role: "Allround", count: 1, starts: ["10:00"] }],
    diner: [{ role: "Allround", count: 1, starts: ["17:00"] }],
  },
  di: {
    standby: [{ role: "Standby", count: 1, starts: ["13:00"] }],
    lunch: [{ role: "Allround", count: 1, starts: ["10:00"] }],
    diner: [{ role: "Allround", count: 1, starts: ["17:00"] }],
  },
  wo: {
    standby: [{ role: "Standby", count: 1, starts: ["13:00"] }],
    lunch: [{ role: "Allround", count: 1, starts: ["10:00"] }],
    diner: [{ role: "Allround", count: 1, starts: ["17:00"] }],
  },
  do: {
    standby: [{ role: "Standby", count: 1, starts: ["13:00"] }],
    lunch: [{ role: "Allround", count: 1, starts: ["10:00"] }],
    diner: [{ role: "Allround", count: 1, starts: ["17:00"] }],
  },
  vr: {
    standby: [{ role: "Standby", count: 1, starts: ["12:00"] }],
    lunch: [{ role: "Allround", count: 1, starts: ["10:00"] }],
    diner: [
      { role: "FOH", count: 2, starts: ["17:00", "18:00"] },
      { role: "Runner", count: 1, starts: ["17:00"] },
      { role: "Bar", count: 1, starts: ["17:00"] },
    ],
  },
  za: {
    lunch: [
      { role: "FOH", count: 1, starts: ["10:00"] },
      { role: "Bar", count: 1, starts: ["12:00"] },
    ],
    diner: [
      { role: "FOH", count: 2, starts: ["17:00", "18:00"] },
      { role: "Runner", count: 1, starts: ["17:00"] },
      { role: "Bar", count: 1, starts: ["17:00"] },
    ],
  },
  zo: {
    lunch: [
      { role: "FOH", count: 2, starts: ["10:00", "14:00"] },
      { role: "Bar", count: 1, starts: ["12:00"] },
    ],
    diner: [
      { role: "FOH", count: 1, starts: ["17:00"] },
      { role: "Bar", count: 1, starts: ["17:00"] },
    ],
  },
};

const demoEmployees = [
  { id: "e1", name: "Sanne", wage: 18.5, skills: { FOH: 5, Host: 4, Bar: 4, Runner: 3, Allround: 5 }, canOpen: true, canClose: true, prefs: ["sluit"], allowedStandby: true, isMentor: true, isRookie: false, preferWith: [], avoidWith: [] },
  { id: "e2", name: "Ahmed", wage: 15.0, skills: { FOH: 4, Host: 3, Bar: 2, Runner: 4, Allround: 4 }, canOpen: true, canClose: false, prefs: ["open"], allowedStandby: true, isMentor: false, isRookie: true, preferWith: ["e1"], avoidWith: [] },
  { id: "e3", name: "Lena", wage: 22.0, skills: { FOH: 5, Host: 5, Bar: 3, Runner: 3, Allround: 4 }, canOpen: true, canClose: true, prefs: ["tussen"], allowedStandby: false, isMentor: true, isRookie: false, preferWith: [], avoidWith: [] },
];

function pad2(n) { return n < 10 ? `0${n}` : String(n) }
function timeToMin(str) { const [h, m] = String(str).split(":").map(Number); return (h || 0) * 60 + (m || 0) }
function minToTime(min) { const h = Math.floor(min / 60), m = min % 60; return `${pad2(h)}:${pad2(m)}` }

function prefFrom(shiftKey, start) {
  if (shiftKey === "standby") return null;
  const m = timeToMin(start);
  if (m <= 600) return "open";
  if (m >= 720 && m <= 840) return "tussen";
  if (m >= 1020) return "sluit";
  return null;
}
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
  const needs = needsByWeek[weekKey] || deepClone(defaultNeeds)
  const assignments = assignmentsByWeek[weekKey] || {}
  const availability = availabilityByWeek[weekKey] || {}
  const [picker, setPicker] = useState(null)
  const [editEmp, setEditEmp] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const p75 = useP75Wage(employees)
  const [selfTest, setSelfTest] = useState({ passed: 0, failed: [] })

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
            const groupNeedsOpen = requiresOpen(start)
            const groupNeedsClose = requiresClose(start)
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
                if (requiresOpen(start) && !c.canOpen) continue
                if (requiresClose(start) && !c.canClose) continue
                if (c.wage >= p75 && dureCount >= limitDure) continue
              }

              if (groupNeedsOpen && !placedOpen && c.canOpen) {
                placed.push({ employeeId: c.id, standby: false }); byDay[d.key].add(c.id)
                if (c.wage >= p75) dureCount++; placedOpen = true
                if (c.isMentor) placedMentor = true; if (c.isRookie) placedRookie = true
                continue
              }
              if (groupNeedsClose && !placedClose && c.canClose) {
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
                    const isOpenReq = groupNeedsOpen && emp.canOpen
                    const isCloseReq = groupNeedsClose && emp.canClose
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
      const [d, s] = k.split(':'); if (d !== dayKey || s !== shiftKey) return
      (assignments[k] || []).forEach(a => { if (!a.standby) { byEmp[a.employeeId] = true } })
    })
    return Object.keys(byEmp).reduce((sum, id) => {
      const emp = employees.find(e => e.id === id); return sum + (emp ? emp.wage * 7 : 0)
    }, 0)
  }

  function dayCost(dayKey) {
    return Object.keys(needs[dayKey] || {}).reduce((sum, s) => sum + shiftCost(dayKey, s), 0)
  }

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
          const [day, shift, role, start] = k.split(':')
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
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen" style={{ background: brand.bg, color: '#111' }}>
        <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl" style={{ background: brand.accent }} />
              <div className="font-semibold">Roostertool Brasserie</div>
              <span className="text-xs px-2 py-0.5 rounded-full border">MVP</span>
            </div>
            <nav className="flex flex-wrap items-center gap-1">
              <Tab label="Dashboard" active={tab === 'dashboard'} onClick={() => setTab('dashboard')} />
              <Tab label="Rooster" active={tab === 'rooster'} onClick={() => setTab('rooster')} />
              <Tab label="Beschikbaarheid" active={tab === 'beschikbaarheid'} onClick={() => setTab('beschikbaarheid')} />
              <Tab label="Medewerkers" active={tab === 'medewerkers'} onClick={() => setTab('medewerkers')} />
              <Tab label="Instellingen" active={tab === 'instellingen'} onClick={() => setTab('instellingen')} />
              <Tab label="Export" active={tab === 'export'} onClick={() => setTab('export')} />
            </nav>
            <div className="flex items-center gap-2">
              <input type="week" className="px-2 py-1 rounded border" value={weekKey} onChange={e => setWeekKey(e.target.value)} />
              <button className="px-3 py-1.5 rounded-lg border" onClick={() => setDark(v => !v)}>{dark ? "Light" : "Dark"}</button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
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

        <footer className="py-8 text-center text-xs text-gray-500">© Roostertool Brasserie — MVP Prototype</footer>
      </div>

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

      <div className="mt-4 max-w-7xl mx-auto px-4">
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
      (state[k] || []).forEach(a => {
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
          (state[k] || []).forEach(a => { const emp = employees.find(e => e.id === a.employeeId); if (emp && emp.wage >= p75) set.add(a.employeeId) })
        }
      })
      return set.size
    }
    if (countDure('vr', 'diner') > 2) fails.push('T4: Dure-limiet vr-diner overschreden')
    if (countDure('za', 'diner') > 2) fails.push('T4: Dure-limiet za-diner overschreden')
    Object.keys(state).forEach(k => {
      const [, , role] = k.split(':')
      if (role === 'Standby') return
      ; (state[k] || []).forEach(a => { const emp = employees.find(e => e.id === a.employeeId); if (emp && ((emp.skills[role] ?? 0) < 3)) fails.push('T5: skill <3 ingepland') })
    })
    const needSB = (dayKey) => (needs[dayKey]?.standby?.[0]?.count) || 0
    days.forEach(d => { const assigned = Object.keys(state).filter(k => k.startsWith(`${d.key}:standby:Standby:`)).reduce((n, k) => n + ((state[k] || []).length), 0); if (assigned > needSB(d.key)) fails.push(`T6: Te veel standby op ${d.key}`) })

    return { passed: 8, failed: fails }
  }
}

function Dashboard({ selectedDate, changeDay, employees, dayAssignments, weekCost, rosterMatrix }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3 space-y-4">
          <Panel title="Vandaag">
            <div className="flex items-center justify-between mb-3">
              <button className="px-2 py-1 rounded border" onClick={() => changeDay(-1)}>◀︎</button>
              <div className="text-lg font-semibold">{selectedDate.toLocaleDateString('nl-NL', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
              <button className="px-2 py-1 rounded border" onClick={() => changeDay(1)}>▶︎</button>
            </div>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr><th className="text-left px-3 py-2">Start</th><th className="text-left px-3 py-2">Rol</th><th className="text-left px-3 py-2">Medewerker</th></tr></thead>
                <tbody>
                  {dayAssignments(days[selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1].key).map((r, i) => {
                    const emp = employees.find(e => e.id === r.employeeId)
                    return (<tr key={i} className="border-t"><td className="px-3 py-2">{r.role === 'Standby' ? '—' : r.start}</td><td className="px-3 py-2">{r.role}</td><td className="px-3 py-2">{emp?.name || r.employeeId}</td></tr>)
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Dekking & Skills"><div className="text-sm text-gray-600">Visuals voor dekking (per rol) en teamscore.</div></Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Weekkosten"><div className="text-3xl font-semibold">€{weekCost.toFixed(2)}</div><div className="text-xs text-gray-500">Som (excl. Standby). 7u/dienst.</div></Panel>
          <Panel title="Beschikbaarheid (week)"><div className="text-sm">Overzicht in tab "Beschikbaarheid"</div></Panel>
        </div>
      </div>
      <Panel title="Weekrooster (CSV-formaat)">
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">{rosterMatrix().headers.map((h, i) => (<th key={i} className="text-left px-3 py-2">{h}</th>))}</tr></thead>
            <tbody>{rosterMatrix().rows.map((row, r) => (<tr key={r} className="border-t">{row.map((cell, c) => (<td key={c} className="px-3 py-2">{cell}</td>))}</tr>))}</tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

function Rooster({ needs, days, employees, assignments, warningsFor, shiftCost, dayCost, weekCost, p75, setPicker, addAssignment, removeAssignment, onNeedsChange, onChangeStart, autofill }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
      <div className="xl:col-span-3 space-y-4">
        <div className="rounded-2xl border bg-white/70 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-lg border" onClick={autofill}>Autofill (week)</button>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">P75: €{p75.toFixed(2)}</span>
          </div>
          <div className="text-sm">Weekkosten: <b>€{weekCost.toFixed(2)}</b></div>
        </div>
        {days.map(d => (
          <div key={d.key} className="rounded-2xl border bg-white/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2" style={{ background: brand.bg }}>
              <div className="font-semibold">{d.label}</div>
              <div className="text-xs text-gray-500">Kosten: €{dayCost(d.key).toFixed(2)}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-3 p-3">
              {Object.entries(needs[d.key]).map(([shiftKey, entries]) => (
                <div key={shiftKey} className="rounded-xl border">
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                    <div className="text-sm font-medium capitalize">{shiftKey === 'standby' ? 'Standby (dag)' : shiftKey}</div>
                    <ShiftWarningsBadge info={warningsFor(d.key, shiftKey)} />
                    <div className="text-xs text-gray-500">Kosten: €{shiftCost(d.key, shiftKey).toFixed(2)}</div>
                  </div>
                  <div className="grid lg:grid-cols-2 gap-2 p-2">
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
      <div className="space-y-4">
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
    <div className="grid gap-4">
      <Panel title="Beschikbaarheid per week">
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50"><th className="text-left px-3 py-2">Medewerker</th>{days.map(d => (<th key={d.key} className="text-left px-3 py-2">{d.label}</th>))}</tr></thead>
            <tbody>
              {employees.map(e => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{e.name}</td>
                  {days.map(d => (
                    <td key={d.key} className="px-3 py-2">
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel title="Medewerkers">
        <div className="space-y-2">
          {employees.map(e => (
            <div key={e.id} className="border rounded-xl p-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{e.name}</div>
                <div className="text-xs text-gray-500">€{e.wage.toFixed(2)}/u · Pref: {e.prefs && e.prefs.length ? e.prefs.join(', ') : 'geen'}</div>
                <div className="text-[11px] text-gray-500">FOH {e.skills.FOH ?? 0} · Host {e.skills.Host ?? 0} · Bar {e.skills.Bar ?? 0} · Runner {e.skills.Runner ?? 0} · AR {e.skills.Allround ?? 0}</div>
                <div className="text-[11px] text-gray-500">Standby: {e.allowedStandby ? 'ja' : 'nee'} · Open: {e.canOpen ? 'ja' : 'nee'} · Sluit: {e.canClose ? 'ja' : 'nee'}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-[11px] px-2 py-1 rounded-md border" onClick={() => setEditEmp(e)}>Bewerk</button>
                <button className="text-[11px] px-2 py-1 rounded-md border" onClick={() => setEmployees(prev => prev.filter(x => x.id !== e.id))}>Verwijder</button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Nieuwe medewerker"><NewEmployeeForm onAdd={(emp) => setEmployees(prev => [...prev, emp])} /></Panel>
      <Panel title="Import (later)"><div className="text-sm text-gray-500">CSV/Excel import volgt.</div></Panel>
    </div>
  )
}

function Settings() {
  return (
    <div className="grid gap-4">
      <Panel title="Kleuren & Branding"><div className="text-sm text-gray-600">Kleuren gematcht aan brasserie1434.nl. Dark mode beschikbaar.</div></Panel>
      <Panel title="Grenzen (weergave)"><div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm"><LabeledInput label="Max opeenvolgende dagen" placeholder="5" /><LabeledInput label="Min. rust (uur)" placeholder="11" /><LabeledInput label="Max sluit→open per week" placeholder="1" /><LabeledInput label="Max diensten/week" placeholder="5" /></div></Panel>
    </div>
  )
}

function ExportView() {
  return (
    <div className="grid gap-4">
      <Panel title="WhatsApp (Business)"><div className="text-sm text-gray-600">Automatisch versturen via WhatsApp Business.</div><button className="mt-2 px-3 py-1.5 rounded-lg border">Genereer & Verstuur</button></Panel>
      <Panel title="Kalender (ICS)"><div className="text-sm text-gray-600">Per medewerker een .ics.</div><button className="mt-2 px-3 py-1.5 rounded-lg border">Exporteer ICS</button></Panel>
      <Panel title="PDF voor prikbord"><button className="px-3 py-1.5 rounded-lg border">Download PDF</button></Panel>
    </div>
  )
}

function SelfTest({ selfTest }) {
  return selfTest.failed.length === 0 ? (
    <span className="ml-1 text-xs text-green-700">Alle {selfTest.passed} tests geslaagd.</span>
  ) : (
    <span className="ml-1 text-xs text-red-700">{selfTest.failed.length} fout(en): {selfTest.failed.join(', ')}</span>
  )
}

function Cell({ dayKey, shiftKey, entryIndex, entry, openPicker, employees, assignments, p75, addAssignment, removeAssignment, onChangeStart }) {
  const role = entry.role
  const [editKey, setEditKey] = React.useState(null)
  const allHalfHours = React.useMemo(() => {
    const times = []; const add = (h, m) => times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    for (let h = 6; h <= 24; h++) { add(h % 24, 0); add(h % 24, 30) }
    add(1, 0); add(1, 30)
    return times
  }, [])
  return (
    <div className="border rounded-xl p-2 bg-white/70">
      <div className="text-xs font-medium mb-1 flex items-center gap-2"><span className="px-2 py-0.5 rounded-full bg-gray-100">{role}</span><span className="text-gray-500">{entry.count}×</span></div>
      <div className="space-y-1">
        {entry.starts.map((start, i) => {
          const key = `${dayKey}:${shiftKey}:${role}:${start}`
          const list = assignments[key] || []
          const filled = list.length, spots = entry.count
          const needOpen = requiresOpen(start)
          const needClose = requiresClose(start)
          const hasOpener = list.some(a => { const emp = employees.find(e => e.id === a.employeeId); return !!emp?.canOpen })
          const hasCloser = list.some(a => { const emp = employees.find(e => e.id === a.employeeId); return !!emp?.canClose })
          return (
            <div key={i} className="rounded-lg border p-1">
              <div className="text-[11px] text-gray-600 mb-1 flex items-center gap-2">
                <span>Start {start} · {filled}/{spots}</span>
                {needOpen && <span className={`text-[10px] px-1.5 py-0.5 rounded ${hasOpener ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{hasOpener ? 'Open OK' : 'Open ontbreekt'}</span>}
                {needClose && <span className={`text-[10px] px-1.5 py-0.5 rounded ${hasCloser ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{hasCloser ? 'Sluit OK' : 'Sluit ontbreekt'}</span>}
                <button className="ml-auto text-[10px] px-1.5 py-0.5 rounded border" onClick={() => setEditKey(editKey === key ? null : key)}>🕒 Tijd</button>
                {editKey === key && (
                  <select className="text-[11px] px-2 py-1 rounded border" value={start} onChange={(e) => { const newStart = e.target.value; setEditKey(null); onChangeStart(dayKey, shiftKey, entryIndex, role, start, newStart) }}>
                    {allHalfHours.map(t => (<option key={t} value={t}>{t}</option>))}
                  </select>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {list.map((a, idx) => {
                  const emp = employees.find(e => e.id === a.employeeId)
                  return <BadgeAssignment key={idx} assignment={a} employee={emp} p75={p75} onRemove={() => removeAssignment(dayKey, shiftKey, role, start, a.employeeId)} />
                })}
                {Array.from({ length: Math.max(spots - filled, 0) }).map((_, j) => (
                  <button key={j} className="text-[11px] px-2 py-1 rounded-md border border-dashed hover:border-solid hover:bg-gray-50" onClick={() => openPicker({ dayKey, shiftKey, role, start })}>+ Voeg toe</button>
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
    <div className="sticky top-4">
      <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Beschikbaar</div>
      <div className="space-y-2">
        {employees.slice().sort((a, b) => a.wage - b.wage).map(e => (
          <div key={e.id} className="rounded-xl border bg-white/70 p-2 flex items-center justify-between">
            <div>
              <div className="font-medium">{e.name}</div>
              <div className="text-xs text-gray-500">€{e.wage.toFixed(2)}/u · Pref: {e.prefs && e.prefs.length ? e.prefs.join(', ') : 'geen'}</div>
              <div className="text-[11px] text-gray-500">FOH {e.skills.FOH ?? 0} · Host {e.skills.Host ?? 0} · Bar {e.skills.Bar ?? 0} · Runner {e.skills.Runner ?? 0} · AR {e.skills.Allround ?? 0}</div>
            </div>
            <div className="flex items-center gap-1">{e.wage >= p75 && !e.standby && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600">Duur</span>}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BadgeAssignment({ assignment, employee, p75, onRemove }) {
  if (!employee) return null
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white shadow-sm border">
      <span className="text-[11px] font-medium">{employee.name}</span>
      {assignment.standby && <span className="text-[10px] px-1 rounded bg-gray-200">Standby</span>}
      {employee.wage >= p75 && !assignment.standby && <span className="text-[10px] px-1 rounded bg-red-100 text-red-600">Duur</span>}
      <span className="text-[10px] text-gray-500">€{employee.wage.toFixed(2)}/u</span>
      <button className="ml-1 text-[10px] px-1.5 py-0.5 rounded border hover:bg-gray-50" onClick={onRemove}>X</button>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border bg-white/70">
      <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: "#eee" }}>
        <div className="font-medium">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Tab({ label, active, onClick }) {
  return <button onClick={onClick} className={`px-3 py-1.5 rounded-lg border ${active ? 'bg-[var(--accent)] text-white' : 'hover:bg-gray-50'}`}>{label}</button>
}

function LabeledInput({ label, placeholder }) {
  return (<label className="grid gap-1"><span className="text-sm text-gray-700">{label}</span><input className="px-3 py-2 rounded-lg border bg-white/70" placeholder={placeholder} /></label>)
}

function ShiftWarningsBadge({ info }) {
  if (!info) return null
  const cls = info.hasOver ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
  return <span className={`text-xs px-2 py-0.5 rounded ${cls}`}>{info.dure}/{info.limit}</span>
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
    let eligible = true, reason = ''
    if (!isAvail(e.id)) { eligible = false; reason = 'Niet beschikbaar' }
    if (hasAnyAssignmentInDay(e.id)) { eligible = false; reason = 'Heeft al een dienst vandaag' }
    if (isStandby && !e.allowedStandby) { eligible = false; reason = 'Niet bevoegd voor Standby' }
    if (!isStandby) {
      if ((e.skills[role] ?? 0) < 3) { eligible = false; reason = 'Skill < 3' }
      if (requiresOpen(start) && !e.canOpen) { eligible = false; reason = 'Kan niet openen' }
      if (requiresClose(start) && !e.canClose) { eligible = false; reason = 'Kan niet sluiten' }
      const avoid = new Set(e.avoidWith || [])
      for (const gid of groupIds) { if (avoid.has(gid)) { eligible = false; reason = 'Liever niet samen'; break } }
    }
    if (q && !e.name.toLowerCase().includes(q.toLowerCase())) eligible = false
    const p = prefFrom(shiftKey, start)
    const prefers = !!(p && (e.prefs || []).includes(p))
    const prefer = new Set(e.preferWith || [])
    let preferScore = 0; groupIds.forEach(id => { if (prefer.has(id)) preferScore++ })
    return { e, eligible, reason, prefers, preferScore }
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-2 border-b flex items-center justify-between"><b>Kies medewerker — {dayKey.toUpperCase()} · {shiftKey === 'standby' ? 'Standby' : shiftKey} · {role} · {start}</b><button className="px-2 py-1 rounded border" onClick={onClose}>Sluit</button></div>
        <div className="p-4 space-y-2">
          <input className="w-full px-3 py-2 rounded border" placeholder="Zoek op naam" value={q} onChange={e => setQ(e.target.value)} />
          {candidates.length === 0 && <div className="text-sm text-gray-500">Geen kandidaten</div>}
          {candidates.map(({ e }) => {
            const isDuur = e.wage >= p75
            return (
              <div key={e.id} className="flex items-center justify-between border rounded-lg p-2">
                <div>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-xs text-gray-500">€{e.wage.toFixed(2)}/u {isDuur && <span className="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-600">Duur</span>}</div>
                </div>
                <button className="text-[11px] px-2 py-1 rounded-md border" onClick={() => onChoose(e.id)}>Kies</button>
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
  const toggleId = (arrSetter, arr, id) => arrSetter(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-2 border-b flex items-center justify-between"><b>Bewerk medewerker</b><button className="px-2 py-1 rounded border" onClick={onClose}>Sluit</button></div>
        <div className="p-4 grid gap-3">
          <label className="grid gap-1"><span className="text-sm">Naam</span><input className="px-3 py-2 rounded border" value={name} onChange={e => setName(e.target.value)} /></label>
          <label className="grid gap-1"><span className="text-sm">Uurloon (€)</span><input className="px-3 py-2 rounded border" type="number" value={wage} onChange={e => setWage(parseFloat(e.target.value || '0'))} /></label>
          <div>
            <div className="font-medium mb-1">Voorkeursdiensten</div>
            <div className="flex items-center gap-3 text-sm">
              {['open', 'tussen', 'sluit'].map(p => (<label key={p}><input type="checkbox" checked={prefs.includes(p)} onChange={() => togglePref(p)} /> {p}</label>))}
              <label><input type="checkbox" checked={prefs.length === 0} onChange={() => setPrefs([])} /> geen voorkeur</label>
            </div>
          </div>
          <div>
            <div className="font-medium mb-1">Competenties</div>
            <div className="flex items-center gap-3 text-sm">
              <label><input type="checkbox" checked={canOpen} onChange={e => setCanOpen(e.target.checked)} /> kan openen</label>
              <label><input type="checkbox" checked={canClose} onChange={e => setCanClose(e.target.checked)} /> kan sluiten</label>
              <label><input type="checkbox" checked={allowedStandby} onChange={e => setAllowedStandby(e.target.checked)} /> mag standby</label>
            </div>
          </div>
          <div>
            <div className="font-medium mb-1">Koppelregels</div>
            <div className="flex items-center gap-3 text-sm">
              <label><input type="checkbox" checked={isMentor} onChange={e => setIsMentor(e.target.checked)} /> mentor</label>
              <label><input type="checkbox" checked={isRookie} onChange={e => setIsRookie(e.target.checked)} /> nieuweling</label>
            </div>
            <div className="grid" style={{ gap: 6, marginTop: 6 }}>
              <div className="text-sm">Juist wel samen:</div>
              <div className="flex flex-wrap gap-3 text-sm">
                {employees.filter(x => x.id !== employee.id).map(x => (<label key={x.id}><input type="checkbox" checked={(preferWith || []).includes(x.id)} onChange={() => toggleId(setPreferWith, preferWith || [], x.id)} /> {x.name}</label>))}
              </div>
              <div className="text-sm">Liever niet samen:</div>
              <div className="flex flex-wrap gap-3 text-sm">
                {employees.filter(x => x.id !== employee.id).map(x => (<label key={x.id}><input type="checkbox" checked={(avoidWith || []).includes(x.id)} onChange={() => toggleId(setAvoidWith, avoidWith || [], x.id)} /> {x.name}</label>))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button className="px-3 py-1.5 rounded-lg border" onClick={onClose}>Annuleer</button>
            <button className="px-3 py-1.5 rounded-lg border" onClick={() => onSave({ ...employee, name, wage, prefs, skills, canOpen, canClose, allowedStandby, isMentor, isRookie, preferWith, avoidWith })}>Opslaan</button>
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
  const [skills, setSkills] = useState({ FOH: 3, Host: 3, Bar: 3, Runner: 3, Allround: 3 })
  const [canOpen, setCanOpen] = useState(false)
  const [canClose, setCanClose] = useState(false)
  const [allowedStandby, setAllowedStandby] = useState(true)
  const togglePref = (v) => setPrefs(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])

  return (
    <div className="grid gap-2">
      <label className="grid gap-1"><span className="text-sm">Naam</span><input className="px-3 py-2 rounded border" value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="grid gap-1"><span className="text-sm">Uurloon (€)</span><input className="px-3 py-2 rounded border" type="number" value={wage} onChange={e => setWage(parseFloat(e.target.value || '0'))} /></label>
      <div className="flex items-center gap-3 text-sm">
        {['open', 'tussen', 'sluit'].map(p => (<label key={p}><input type="checkbox" checked={prefs.includes(p)} onChange={() => togglePref(p)} /> {p}</label>))}
        <label><input type="checkbox" checked={prefs.length === 0} onChange={() => setPrefs([])} /> geen voorkeur</label>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <label><input type="checkbox" checked={canOpen} onChange={e => setCanOpen(e.target.checked)} /> kan openen</label>
        <label><input type="checkbox" checked={canClose} onChange={e => setCanClose(e.target.checked)} /> kan sluiten</label>
        <label><input type="checkbox" checked={allowedStandby} onChange={e => setAllowedStandby(e.target.checked)} /> mag standby</label>
      </div>
      <button className="px-3 py-1.5 rounded-lg border" onClick={() => { if (!name) return; const id = 'e' + Math.random().toString(36).slice(2, 7); onAdd({ id, name, wage, prefs, skills, canOpen, canClose, allowedStandby }); setName(''); setPrefs([]); setCanOpen(false); setCanClose(false); setAllowedStandby(true) }}>Toevoegen</button>
    </div>
  )
}

function AvailabilityPicker({ value, onChange }) {
  const type = value?.type || 'all'
  return (
    <div className="flex items-center gap-2 text-sm">
      <select className="px-2 py-1 rounded border" value={type} onChange={e => onChange(e.target.value === 'all' ? { type: 'all' } : e.target.value === 'none' ? { type: 'none' } : { type: 'range', from: '10:00', to: '22:00' })}>
        <option value="all">Hele dag</option>
        <option value="none">Niet</option>
        <option value="range">Tijdvak</option>
      </select>
      {type === 'range' && (
        <>
          <input className="px-2 py-1 rounded border w-24" value={value?.from || '10:00'} onChange={e => onChange({ ...(value || { type: 'range' }), type: 'range', from: e.target.value })} />
          <span>–</span>
          <input className="px-2 py-1 rounded border w-24" value={value?.to || '22:00'} onChange={e => onChange({ ...(value || { type: 'range' }), type: 'range', to: e.target.value })} />
        </>
      )}
    </div>
  )
}

function NeedsEditor({ needs, onChange }) {
  return (
    <div className="grid gap-2 text-sm">
      {Object.entries(needs).map(([dayKey, shifts]) => (
        <div key={dayKey} className="border rounded-xl">
          <div className="px-3 py-2 bg-gray-50 font-medium">{dayKey.toUpperCase()}</div>
          <div className="p-2 grid md:grid-cols-2 gap-2">
            {Object.entries(shifts).map(([shiftKey, entries]) => (
              <div key={shiftKey} className="border rounded-lg p-2">
                <div className="font-medium mb-1 capitalize">{shiftKey}</div>
                {entries.map((e, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded bg-gray-100">{e.role}</span>
                    <span>{e.count}×</span>
                    <div className="flex items-center gap-1">{e.starts.map((s, i) => (<span key={i} className="px-2 py-0.5 rounded border">{s}</span>))}</div>
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
