import type { SaveState } from './state'

export const workspaceStorageKey = (caseId: string): string =>
  `workspace-v2:${caseId}`

export const loadWorkspaceSave = (caseId: string): SaveState | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(workspaceStorageKey(caseId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as SaveState
    if (parsed.schemaVersion !== 1) return null
    return parsed
  } catch {
    return null
  }
}

export const saveWorkspaceState = (caseId: string, state: SaveState): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(workspaceStorageKey(caseId), JSON.stringify(state))
  } catch {
    // Storage may be disabled in embedded environments.
  }
}

export const clearWorkspaceSave = (caseId: string): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(workspaceStorageKey(caseId))
  } catch {
    // Storage may be disabled in embedded environments.
  }
}
