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
import {
  buildResolution,
  type Resolution,
} from './resolutionModel'
import { createInteractionState } from './interactionModel'

export type InvestigationState = {
  view: DossierView
  activeMaterialId: string
  openedMaterialIds: ReadonlySet<string>
  selectedCount: number
  isReportSubmitted: boolean
  canSubmitReport: boolean
  resolution: Resolution | null
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
  // Sources the analyst has actually focused during the session. The very
  // first material the view will land on is the case's first initial source,
  // so seed the set with that so «opened» count starts at 1 on first render.
  const initialOpenedMaterialIds = useMemo(
    () =>
      new Set<string>(
        content.case.initialSourceIds[0]
          ? [content.case.initialSourceIds[0]]
          : [],
      ),
    [content],
  )
  const [openedMaterialIds, setOpenedMaterialIds] = useState<Set<string>>(
    () => new Set(initialOpenedMaterialIds),
  )

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
    setOpenedMaterialIds((prev) => {
      if (prev.has(sourceId)) return prev
      const next = new Set(prev)
      next.add(sourceId)
      return next
    })
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
    setOpenedMaterialIds(new Set(initialOpenedMaterialIds))
  }, [initialOpenedMaterialIds])

  const selectedCount = selectedFragmentIds.size
  const canSubmitReport = selectedCount > 0

  const resolution = useMemo<Resolution | null>(() => {
    if (!reportSubmitted) return null
    return buildResolution(content, {
      selection: createInteractionState(selectedFragmentIds),
      openedMaterialIds,
    })
  }, [content, reportSubmitted, selectedFragmentIds, openedMaterialIds])

  return {
    view,
    activeMaterialId,
    openedMaterialIds,
    selectedCount,
    isReportSubmitted: reportSubmitted,
    canSubmitReport,
    resolution,
    selectMaterial,
    toggleFragment,
    submitReport,
    resetInvestigation,
  }
}
