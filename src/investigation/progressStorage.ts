// Per-case session progress persisted in localStorage so the picker can show
// «начат» / «завершён» chips across reloads.
//
// Storage shape (key `cult-sim.case-progress.v1`):
//   { [caseId]: { started: boolean, submitted: boolean, lastVisitedAt: string | null } }
//
// Reads are defensive: any parse / quota failure falls back to defaults and
// never throws, so a broken / blocked localStorage cannot break the picker.

export type CaseProgress = {
  started: boolean
  submitted: boolean
  lastVisitedAt: string | null
}

const STORAGE_KEY = 'cult-sim.case-progress.v1'

const DEFAULT_PROGRESS: CaseProgress = {
  started: false,
  submitted: false,
  lastVisitedAt: null,
}

type ProgressMap = Record<string, CaseProgress>

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readMap(): ProgressMap {
  if (!hasStorage()) return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: ProgressMap = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const entry = value as Partial<CaseProgress>
      out[id] = {
        started: Boolean(entry.started),
        submitted: Boolean(entry.submitted),
        lastVisitedAt:
          typeof entry.lastVisitedAt === 'string' ? entry.lastVisitedAt : null,
      }
    }
    return out
  } catch {
    return {}
  }
}

function writeMap(map: ProgressMap): void {
  if (!hasStorage()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore quota / serialization failures: progress is non-critical.
  }
}

function update(caseId: string, patch: Partial<CaseProgress>): void {
  if (!caseId) return
  const map = readMap()
  const current = map[caseId] ?? { ...DEFAULT_PROGRESS }
  map[caseId] = { ...current, ...patch }
  writeMap(map)
}

export function readProgress(caseId: string): CaseProgress {
  if (!caseId) return { ...DEFAULT_PROGRESS }
  const map = readMap()
  return map[caseId] ?? { ...DEFAULT_PROGRESS }
}

export function markStarted(caseId: string): void {
  const current = readProgress(caseId)
  if (current.started) {
    // Refresh the timestamp on re-entry; leave the flag idempotent.
    update(caseId, { lastVisitedAt: new Date().toISOString() })
    return
  }
  update(caseId, { started: true, lastVisitedAt: new Date().toISOString() })
}

export function markSubmitted(caseId: string): void {
  update(caseId, {
    started: true,
    submitted: true,
    lastVisitedAt: new Date().toISOString(),
  })
}

export function clearProgress(caseId: string): void {
  if (!caseId) return
  if (!hasStorage()) return
  const map = readMap()
  if (!(caseId in map)) return
  delete map[caseId]
  writeMap(map)
}
