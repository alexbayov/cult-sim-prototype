import type { ReactElement } from 'react'
import type { CaseV2 } from '../game/investigation/types'
import type { SaveState } from './state'

type EpilogueScreenProps = {
  content: CaseV2
  state: SaveState
  onReturnToWorkspace: () => void
  onBackToCases: () => void
  onReset: () => void
}

export default function EpilogueScreen({
  content,
  state,
  onReturnToWorkspace,
  onBackToCases,
  onReset,
}: EpilogueScreenProps): ReactElement {
  const epilogue = content.epilogues.find(
    (item) => item.id === state.resolvedEpilogueId,
  )
  return (
    <main className="workspace-epilogue-shell">
      <section className="workspace-epilogue-card">
        <header>
          <p className="workspace-eyebrow">эпилог</p>
          <h1>Через {epilogue?.monthsAhead ?? 'несколько'} месяцев</h1>
        </header>
        <div className="workspace-prose">
          {(epilogue?.body ?? 'Эпилог не найден.')
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
        </div>
        <footer className="workspace-button-row">
          <button
            type="button"
            className="workspace-secondary"
            onClick={onReturnToWorkspace}
          >
            Вернуться в кейс
          </button>
          <button type="button" className="workspace-secondary" onClick={onReset}>
            Сыграть заново
          </button>
          <button type="button" className="workspace-primary" onClick={onBackToCases}>
            Главное меню
          </button>
        </footer>
      </section>
    </main>
  )
}
