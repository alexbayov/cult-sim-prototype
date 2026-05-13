import type { ReactElement } from 'react'
import type { CaseV2 } from '../game/investigation/types'
import { deriveProvenance, highlightText } from './highlight'
import { intersectingEffects } from './state'
import type { WorkspaceHighlight } from './state'

type NotebookPaneProps = {
  content: CaseV2
  highlights: ReadonlyArray<WorkspaceHighlight>
  readOnly: boolean
  onRemoveHighlight: (highlightId: string) => void
  onSubmit: () => void
}

export default function NotebookPane({
  content,
  highlights,
  readOnly,
  onRemoveHighlight,
  onSubmit,
}: NotebookPaneProps): ReactElement {
  const entriesByHypothesis = new Map<string, WorkspaceHighlight[]>()
  const looseEntries: WorkspaceHighlight[] = []

  for (const highlight of highlights) {
    const effects = intersectingEffects(content, highlight)
    if (effects.length === 0) {
      looseEntries.push(highlight)
      continue
    }
    for (const effect of effects) {
      const list = entriesByHypothesis.get(effect.hypothesisId) ?? []
      list.push(highlight)
      entriesByHypothesis.set(effect.hypothesisId, list)
    }
  }

  const hasSlotEntries = content.hypotheses.some(
    (hypothesis) => (entriesByHypothesis.get(hypothesis.id)?.length ?? 0) > 0,
  )

  const renderEntry = (highlight: WorkspaceHighlight) => {
    const document = content.documents.find((item) => item.id === highlight.documentId)
    if (!document) return null
    return (
      <li key={highlight.id} className="workspace-notebook-entry">
        <blockquote>{highlightText(document, highlight)}</blockquote>
        <p>{deriveProvenance(document, highlight.range)}</p>
        {!readOnly ? (
          <button
            type="button"
            aria-label="убрать фрагмент"
            onClick={() => onRemoveHighlight(highlight.id)}
          >
            ×
          </button>
        ) : null}
      </li>
    )
  }

  return (
    <section className="workspace-panel workspace-notebook">
      <header className="workspace-panel-head">
        <p className="workspace-eyebrow">Блокнот эксперта</p>
        <h2>Гипотезы</h2>
      </header>

      <div className="workspace-hypothesis-list">
        {content.hypotheses.map((hypothesis) => {
          const entries = entriesByHypothesis.get(hypothesis.id) ?? []
          return (
            <section key={hypothesis.id} className="workspace-hypothesis-card">
              <header>
                <h3>{hypothesis.label}</h3>
                <span>{entries.length} фразы</span>
              </header>
              <p>{hypothesis.description}</p>
              {entries.length > 0 ? (
                <ul>{entries.map(renderEntry)}</ul>
              ) : (
                <div className="workspace-empty-slot">перетащи или кликни «добавить»</div>
              )}
            </section>
          )
        })}
      </div>

      {looseEntries.length > 0 ? (
        <section className="workspace-hypothesis-card workspace-loose-card">
          <header>
            <h3>Свободные фрагменты</h3>
            <span>{looseEntries.length}</span>
          </header>
          <ul>{looseEntries.map(renderEntry)}</ul>
        </section>
      ) : null}

      {!readOnly ? (
        <button
          type="button"
          className="workspace-submit-button"
          disabled={!hasSlotEntries}
          onClick={onSubmit}
        >
          <strong>Передать рекомендацию</strong>
          <span>
            {hasSlotEntries
              ? 'можно переходить к выбору'
              : 'нужно как минимум одна гипотеза с фразой'}
          </span>
        </button>
      ) : null}
    </section>
  )
}
