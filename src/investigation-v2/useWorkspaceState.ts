import { useEffect, useMemo, useState } from 'react'
import type { CaseV2 } from '../game/investigation/types'
import {
  clearWorkspaceSave,
  loadWorkspaceSave,
  saveWorkspaceState,
} from './persist'
import { createInitialState } from './state'
import type { SaveState } from './state'

export type WorkspaceStateApi = {
  state: SaveState
  savedStateExists: boolean
  setState: (updater: SaveState | ((state: SaveState) => SaveState)) => void
  reset: () => void
}

export const useWorkspaceState = (content: CaseV2): WorkspaceStateApi => {
  const existingSave = useMemo(() => loadWorkspaceSave(content.id), [content.id])
  const [savedStateExists, setSavedStateExists] = useState(Boolean(existingSave))
  const [state, setStateValue] = useState<SaveState>(
    () => existingSave ?? createInitialState(content),
  )

  const setState: WorkspaceStateApi['setState'] = (updater) => {
    setStateValue((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      saveWorkspaceState(content.id, next)
      setSavedStateExists(true)
      return next
    })
  }

  const reset = () => {
    clearWorkspaceSave(content.id)
    const fresh = createInitialState(content)
    setStateValue(fresh)
    setSavedStateExists(false)
  }

  useEffect(() => {
    if (state.screen !== 'intro' || savedStateExists) {
      saveWorkspaceState(content.id, state)
    }
  }, [content.id, savedStateExists, state])

  return { state, savedStateExists, setState, reset }
}
