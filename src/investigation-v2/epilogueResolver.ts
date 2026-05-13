import type {
  CaseV2,
  EpilogueQuality,
  Recommendation,
} from '../game/investigation/types'
import { countNotebookSlots } from './state'
import type { SaveState, WorkspaceHighlight } from './state'

const requirementMet = (
  counts: ReturnType<typeof countNotebookSlots>,
  recommendation: Recommendation,
): { all: boolean; some: boolean } => {
  if (recommendation.requiresHypotheses.length === 0) {
    return { all: true, some: true }
  }
  const results = recommendation.requiresHypotheses.map((requirement) => {
    const slot = counts[requirement.hypothesisId]
    if (!slot) return false
    const available =
      requirement.minWeight === 'strong' ? slot.strong : slot.strong + slot.weak
    return available >= requirement.minSupportingPhrases
  })
  return { all: results.every(Boolean), some: results.some(Boolean) }
}

export const computeRecommendationQuality = (
  content: CaseV2,
  recommendation: Recommendation,
  highlights: ReadonlyArray<WorkspaceHighlight>,
): EpilogueQuality => {
  if (recommendation.id === 'rec-respect-choice') {
    if (highlights.length < 3) return 'precise'
    if (highlights.length <= 6) return 'imprecise'
    return 'incorrect'
  }

  const gates = requirementMet(countNotebookSlots(content, highlights), recommendation)
  if (gates.all) return 'precise'
  if (gates.some) return 'imprecise'
  return 'incorrect'
}

export const resolveEpilogueId = (
  content: CaseV2,
  recommendationId: string,
  save: SaveState,
): string => {
  const recommendation = content.recommendations.find(
    (item) => item.id === recommendationId,
  )
  if (!recommendation) {
    throw new Error(`Unknown recommendation: ${recommendationId}`)
  }
  const quality = computeRecommendationQuality(
    content,
    recommendation,
    save.highlights,
  )
  const epilogue = content.epilogues.find(
    (item) =>
      item.recommendationId === recommendationId && item.quality === quality,
  )
  if (!epilogue) {
    throw new Error(`No epilogue for ${recommendationId} / ${quality}`)
  }
  return epilogue.id
}
