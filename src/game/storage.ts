import type { GameState } from './types'

const saveKey = 'cult-sim-prototype:save:v1'
const saveVersion = 1

type SavedGame = {
  version: number
  savedAt: string
  state: GameState
}

export const loadSavedGame = () => {
  try {
    const rawSave = localStorage.getItem(saveKey)
    if (!rawSave) return undefined

    const savedGame = JSON.parse(rawSave) as SavedGame
    if (savedGame.version !== saveVersion) return undefined

    return savedGame.state
  } catch {
    return undefined
  }
}

export const saveGame = (state: GameState) => {
  const savedGame: SavedGame = {
    version: saveVersion,
    savedAt: new Date().toISOString(),
    state,
  }

  localStorage.setItem(saveKey, JSON.stringify(savedGame))
}

export const clearSavedGame = () => {
  localStorage.removeItem(saveKey)
}

export const getSaveVersion = () => saveVersion
