// Runtime state for the dossier interaction loop.
//
// This hook owns three pieces of session state:
//   - `activeMaterialId`: which source tab is open
//   - `selectedFragmentIds`: which fragments the analyst has marked as закладки
//   - `reportSubmitted`: whether the сводка has been issued
//
// All derived data (locked materials, connection statuses, selected
// observations, draft summary) is produced by `buildDossierView` in the
// view-model layer so that the React component stays a thin renderer.

import { useCallback, useMemo, useState } from 'react'

import type { InvestigationContent } from '../game/investigation/types'
import {
  buildDossierView,
  type DossierView,
  type Selection,
} from './investigationViewModel'

export type InvestigationState = {
  view: DossierView
  activeMaterialId: string
  selectedCount: number
  isReportSubmitted: boolean
  canSubmitReport: boolean
  selectMaterial: (sourceId: string) => void
  toggleFragment: (fragmentId: string) => void
  submitReport: () => void
  resetInvestigation: () => void
}

export function useInvestigationState(
  content: InvestigationContent,
): InvestigationState {
  const [selectedFragmentIds, setSelectedFragmentIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [reportSubmitted, setReportSubmitted] = useState<boolean>(false)
  const [pickedMaterialId, setPickedMaterialId] = useState<string | null>(null)

  const selection: Selection = useMemo(
    () => ({ selectedFragmentIds, reportSubmitted }),
    [selectedFragmentIds, reportSubmitted],
  )

  const view = useMemo(
    () => buildDossierView(content, selection),
    [content, selection],
  )

  // The active material is whatever the user last clicked, as long as it
  // is still unlocked. If they clicked a locked one (shouldn't happen via
  // the UI) or their previous pick was unlocked-then-relocked (also can't
  // happen with the current state machine but kept defensive), fall back
  // to the view's default active material or the first unlocked one. This
  // keeps the source pane non-blank when new materials unlock without
  // requiring a setState-in-effect dance.
  const activeMaterialId = useMemo(() => {
    if (pickedMaterialId) {
      const picked = view.materials.find((m) => m.id === pickedMaterialId)
      if (picked && !picked.locked) return picked.id
    }
    const defaultMaterial = view.materials.find(
      (m) => m.id === view.activeMaterialId && !m.locked,
    )
    if (defaultMaterial) return defaultMaterial.id
    const firstUnlocked = view.materials.find((m) => !m.locked)
    return firstUnlocked?.id ?? view.materials[0]?.id ?? ''
  }, [pickedMaterialId, view.materials, view.activeMaterialId])

  const selectMaterial = useCallback((sourceId: string) => {
    setPickedMaterialId(sourceId)
  }, [])

  const toggleFragment = useCallback((fragmentId: string) => {
    setSelectedFragmentIds((prev) => {
      const next = new Set(prev)
      if (next.has(fragmentId)) {
        next.delete(fragmentId)
      } else {
        next.add(fragmentId)
      }
      return next
    })
    // Editing the selection invalidates a previously-issued summary so the
    // user has to re-submit explicitly.
    setReportSubmitted(false)
  }, [])

  const submitReport = useCallback(() => {
    setReportSubmitted(true)
  }, [])

  const resetInvestigation = useCallback(() => {
    setSelectedFragmentIds(new Set())
    setReportSubmitted(false)
    setPickedMaterialId(null)
  }, [])

  const selectedCount = selectedFragmentIds.size
  const canSubmitReport = selectedCount > 0

  return {
    view,
    activeMaterialId,
    selectedCount,
    isReportSubmitted: reportSubmitted,
    canSubmitReport,
    selectMaterial,
    toggleFragment,
    submitReport,
    resetInvestigation,
  }
}
