import type { CaseV2, KeyPhraseEffect } from '../game/investigation/types'

export type ScreenId =
  | 'intro'
  | 'workspace'
  | 'interview'
  | 'submit'
  | 'epilogue'
  | 'workspace-readonly'

export type HighlightRange = [number, number]

export type WorkspaceHighlight = {
  id: string
  documentId: string
  range: HighlightRange
}

export type SaveState = {
  schemaVersion: 1
  screen: ScreenId
  activeInterviewId?: string
  interviewChoiceHistory: Record<string, string[]>
  completedInterviews: string[]
  visibleDocumentIds: string[]
  unlockedContactIds: string[]
  performedActionIds: string[]
  remainingBudget: number
  highlights: WorkspaceHighlight[]
  selectedRecommendationId?: string
  resolvedEpilogueId?: string
  dismissedHints: string[]
}

export type HypothesisCounts = Record<
  string,
  { weak: number; strong: number; counter: number }
>

export const createInitialState = (content: CaseV2): SaveState => ({
  schemaVersion: 1,
  screen: 'intro',
  interviewChoiceHistory: {},
  completedInterviews: [],
  visibleDocumentIds: content.documents
    .filter((document) => document.defaultVisible)
    .map((document) => document.id),
  unlockedContactIds: content.contacts
    .filter((contact) => contact.initialState === 'public')
    .map((contact) => contact.id),
  performedActionIds: [],
  remainingBudget: content.actionBudget,
  highlights: [],
  dismissedHints: [],
})

export const strengthRank = (weight: KeyPhraseEffect['weight']): number => {
  if (weight === 'strong') return 3
  if (weight === 'weak') return 2
  return 1
}

export const intersectingEffects = (
  content: CaseV2,
  highlight: WorkspaceHighlight,
): KeyPhraseEffect[] => {
  const document = content.documents.find((item) => item.id === highlight.documentId)
  if (!document) return []
  const [start, end] = highlight.range
  const byHypothesis = new Map<string, KeyPhraseEffect>()
  for (const phrase of document.keyPhrases) {
    const [phraseStart, phraseEnd] = phrase.range
    if (start >= phraseEnd || end <= phraseStart) continue
    for (const effect of phrase.effects) {
      const previous = byHypothesis.get(effect.hypothesisId)
      if (!previous || strengthRank(effect.weight) > strengthRank(previous.weight)) {
        byHypothesis.set(effect.hypothesisId, effect)
      }
    }
  }
  return [...byHypothesis.values()]
}

export const countNotebookSlots = (
  content: CaseV2,
  highlights: ReadonlyArray<WorkspaceHighlight>,
): HypothesisCounts => {
  const counts = Object.fromEntries(
    content.hypotheses.map((hypothesis) => [
      hypothesis.id,
      { weak: 0, strong: 0, counter: 0 },
    ]),
  ) as HypothesisCounts
  for (const highlight of highlights) {
    for (const effect of intersectingEffects(content, highlight)) {
      counts[effect.hypothesisId][effect.weight] += 1
    }
  }
  return counts
}

export const countEntriesForHypothesis = (
  content: CaseV2,
  highlights: ReadonlyArray<WorkspaceHighlight>,
  hypothesisId: string,
  minWeight: 'weak' | 'strong' = 'weak',
): number => {
  const counts = countNotebookSlots(content, highlights)[hypothesisId]
  if (!counts) return 0
  if (minWeight === 'strong') return counts.strong
  return counts.weak + counts.strong
}

export const hasNotebookEntries = (content: CaseV2, state: SaveState): boolean =>
  content.hypotheses.some(
    (hypothesis) =>
      countEntriesForHypothesis(content, state.highlights, hypothesis.id) > 0,
  )

export const isReadOnlyState = (screen: ScreenId): boolean =>
  screen === 'workspace-readonly'

export const contactIsUnlocked = (
  content: CaseV2,
  state: SaveState,
  contactId: string,
): boolean => {
  const contact = content.contacts.find((item) => item.id === contactId)
  if (!contact) return false
  if (state.unlockedContactIds.includes(contact.id)) return true
  if (contact.initialState === 'public') return true
  const gate = contact.gateRequirement
  if (!gate) return false
  const hypothesisOk = gate.requiredHypothesis
    ? countEntriesForHypothesis(
        content,
        state.highlights,
        gate.requiredHypothesis,
        gate.minWeight ?? 'weak',
      ) >= (gate.minSupportingPhrases ?? 1)
    : true
  const documentOk = gate.requiredDocumentId
    ? state.visibleDocumentIds.includes(gate.requiredDocumentId)
    : true
  return hypothesisOk && documentOk
}
