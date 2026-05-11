// Start screen: lets the analyst pick an investigation case before entering
// the dossier flow. Reads from `investigationContents`, derives a tiny
// "длительность" hint from fragment count, and renders one card per case.
//
// No routing dependencies, no shared state. Selection just calls onSelect
// with the picked InvestigationContent and the parent decides what to do.

import type { ReactElement } from 'react'
import type { InvestigationContent } from '../game/investigation/types'

export type CaseSelectScreenProps = {
  cases: ReadonlyArray<InvestigationContent>
  onSelect: (content: InvestigationContent) => void
  onOpenGuide: () => void
}

function deriveLengthHint(content: InvestigationContent): string {
  const fragments = content.evidence.length
  const sources = content.sources.length
  if (fragments >= 40 || sources >= 12) return 'плотный · ~30 минут'
  if (fragments >= 28) return 'камерный · ~20 минут'
  return 'короткий · ~15 минут'
}

export default function CaseSelectScreen({
  cases,
  onSelect,
  onOpenGuide,
}: CaseSelectScreenProps): ReactElement {
  return (
    <div className="dossier-shell dossier-shell-select">
      <div className="dossier-grain" aria-hidden="true" />

      <header className="dossier-select-header">
        <p className="dossier-select-eyebrow">материалы расследования</p>
        <h1 className="dossier-select-title">выберите кейс для работы</h1>
        <p className="dossier-select-lead">
          Это демо-оболочка работы с материалами. Все кейсы вымышленные. В каждом
          наборе есть открытые источники, скрытые материалы и набор наблюдений,
          которые становятся видимыми по мере работы.
        </p>
        <button
          type="button"
          className="dossier-select-guide-link"
          onClick={onOpenGuide}
        >
          как это работает
        </button>
      </header>

      <main className="dossier-select-grid">
        {cases.map((content) => {
          const c = content.case
          const lengthHint = deriveLengthHint(content)
          return (
            <article key={c.id} className="dossier-select-card">
              <header className="dossier-select-card-head">
                <span className="dossier-select-card-eyebrow">кейс</span>
                <h2 className="dossier-select-card-title">{c.title}</h2>
                <p className="dossier-select-card-subtitle">{c.subtitle}</p>
              </header>

              <p className="dossier-select-card-legend">{c.publicLegend}</p>

              <dl className="dossier-select-card-meta">
                <div>
                  <dt>материалов</dt>
                  <dd>{content.sources.length}</dd>
                </div>
                <div>
                  <dt>людей</dt>
                  <dd>{content.persons.length}</dd>
                </div>
                <div>
                  <dt>фрагментов</dt>
                  <dd>{content.evidence.length}</dd>
                </div>
                <div>
                  <dt>наблюдений</dt>
                  <dd>{content.patterns.length}</dd>
                </div>
                <div>
                  <dt>длительность</dt>
                  <dd>{lengthHint}</dd>
                </div>
              </dl>

              <button
                type="button"
                className="dossier-select-card-cta"
                onClick={() => onSelect(content)}
              >
                открыть материалы
              </button>
            </article>
          )
        })}
      </main>

      <footer className="dossier-select-footer">
        <p>
          Кейсы — вымышленные. Имена и организации не относятся к реальным
          людям. Цель — показать ход работы с материалами, а не вынести оценку.
        </p>
      </footer>
    </div>
  )
}
