import type { ReactElement } from 'react'
import type { CaseV2 } from '../game/investigation/types'

type BriefScreenProps = {
  content: CaseV2
  hasSave: boolean
  onAccept: () => void
  onBackToCases: () => void
  onReset: () => void
}

export default function BriefScreen({
  content,
  hasSave,
  onAccept,
  onBackToCases,
  onReset,
}: BriefScreenProps): ReactElement {
  return (
    <main className="workspace-brief-shell">
      <section className="workspace-brief-card">
        <p className="workspace-eyebrow">новое дело</p>
        <h1>Дело: {content.title}</h1>
        <p className="workspace-brief-from">Обращение от: {content.brief.from}</p>
        <div className="workspace-prose">
          {content.brief.body
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
        </div>
        <footer className="workspace-brief-footer">
          <span>Бюджет действий: {content.actionBudget} ⏳</span>
          <div className="workspace-button-row">
            {hasSave ? (
              <button type="button" className="workspace-secondary" onClick={onReset}>
                Начать заново
              </button>
            ) : null}
            <button
              type="button"
              className="workspace-secondary"
              onClick={onBackToCases}
            >
              Назад к списку
            </button>
            <button type="button" className="workspace-primary" onClick={onAccept}>
              Принять дело
            </button>
          </div>
        </footer>
      </section>
    </main>
  )
}
