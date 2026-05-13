import { useState, type ReactElement } from 'react'
import type { CaseV2, Recommendation } from '../game/investigation/types'
import { computeRecommendationQuality } from './epilogueResolver'
import { countNotebookSlots } from './state'
import type { SaveState } from './state'

type SubmitScreenProps = {
  content: CaseV2
  state: SaveState
  onBack: () => void
  onConfirm: (recommendationId: string) => void
}

const preview = (body: string): string => body.split(/\n{2,}/)[0] ?? body

const gateLabel = (
  content: CaseV2,
  state: SaveState,
  recommendation: Recommendation,
): string => {
  if (recommendation.requiresHypotheses.length === 0) return 'без жёстких гипотез'
  const quality = computeRecommendationQuality(content, recommendation, state.highlights)
  if (quality === 'precise') return 'гипотезы удовлетворены'
  if (quality === 'imprecise') return 'частично удовлетворены'
  return 'не удовлетворены'
}

export default function SubmitScreen({
  content,
  state,
  onBack,
  onConfirm,
}: SubmitScreenProps): ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(
    state.selectedRecommendationId ?? null,
  )
  const counts = countNotebookSlots(content, state.highlights)
  const summary = content.hypotheses
    .map((hypothesis) => {
      const count = counts[hypothesis.id]
      return `${count.strong + count.weak} на ${hypothesis.label.toLowerCase()}`
    })
    .join(', ')

  return (
    <main className="workspace-submit-shell">
      <section className="workspace-submit-card">
        <header>
          <p className="workspace-eyebrow">итог</p>
          <h1>Рекомендация семье</h1>
          <p>у вас в блокноте: {summary}</p>
        </header>

        <div className="workspace-recommendation-list">
          {content.recommendations.map((recommendation) => (
            <label key={recommendation.id} className="workspace-recommendation-card">
              <input
                type="radio"
                name="recommendation"
                checked={selectedId === recommendation.id}
                onChange={() => setSelectedId(recommendation.id)}
              />
              <span>
                <strong>{recommendation.label}</strong>
                <small>{preview(recommendation.body)}</small>
                <em>{gateLabel(content, state, recommendation)}</em>
              </span>
            </label>
          ))}
        </div>

        <footer className="workspace-button-row">
          <button type="button" className="workspace-secondary" onClick={onBack}>
            Назад в кейс
          </button>
          <button
            type="button"
            className="workspace-primary"
            disabled={!selectedId}
            onClick={() => {
              if (selectedId) onConfirm(selectedId)
            }}
          >
            Подтвердить выбор
          </button>
        </footer>
      </section>
    </main>
  )
}
