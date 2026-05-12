// Per-case earned achievements persisted in localStorage so the player keeps
// their «профиль работы» across reloads. Today `Resolution.achievements[]` is
// recomputed every time on submit and lost on reload; this module is the
// storage half of PRODUCT_DECISIONS §3.
//
// Storage shape (key `cult-sim.case-achievements.v1`):
//   { [caseId]: ["a_no_rush", "a_methodical_reader", ...] }
//
// Reads are defensive: any parse / quota / shape failure falls back to
// defaults and never throws, so a corrupted localStorage cannot break the
// picker or the dossier.
//
// Writes are **union-add**: existing entries are never demoted. If a previous
// run earned `a_no_rush` and the current run does not, the stored array still
// contains `a_no_rush`. This is intentional — achievements are a profile, not
// a session score.
//
// Key suffix is `v1`. If the shape ever changes, the migration is the key
// bump (no in-place migration logic here).

export type EarnedAchievementsMap = Record<string, string[]>

const STORAGE_KEY = 'cult-sim.case-achievements.v1'

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function readMap(): EarnedAchievementsMap {
  if (!hasStorage()) return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: EarnedAchievementsMap = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isStringArray(value)) continue
      // Drop duplicates defensively — a previous write could have skipped the
      // Set step if it was written by an older code path.
      out[id] = Array.from(new Set(value))
    }
    return out
  } catch {
    return {}
  }
}

function writeMap(map: EarnedAchievementsMap): void {
  if (!hasStorage()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore quota / serialisation failures: achievements are non-critical.
  }
}

export function readEarnedAchievements(caseId: string): readonly string[] {
  if (!caseId) return []
  const map = readMap()
  const entry = map[caseId]
  return entry ? [...entry] : []
}

export function readAllEarned(): EarnedAchievementsMap {
  return readMap()
}

export function recordEarnedAchievements(
  caseId: string,
  ids: readonly string[],
): void {
  if (!caseId) return
  const map = readMap()
  const existing = map[caseId] ?? []
  const union = Array.from(new Set([...existing, ...ids]))
  // Skip the write if nothing actually changed — cheap, and avoids burning
  // a quota slot on no-op submits.
  if (union.length === existing.length && existing.every((id) => union.includes(id))) {
    return
  }
  map[caseId] = union
  writeMap(map)
}

export function clearAchievementsForCase(caseId: string): void {
  if (!caseId) return
  if (!hasStorage()) return
  const map = readMap()
  if (!(caseId in map)) return
  delete map[caseId]
  writeMap(map)
}
