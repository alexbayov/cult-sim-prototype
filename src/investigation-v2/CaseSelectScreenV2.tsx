import type { ReactElement } from 'react'
import CaseSelectScreen, { type CaseSelectSeason } from '../investigation/CaseSelectScreen'
import {
  caseLegend,
  caseMeta,
  caseSubtitle,
  caseTitle,
  type CaseListItem,
} from './v2Picker'

type CaseSelectScreenV2Props = {
  cases: ReadonlyArray<CaseListItem>
  season: CaseSelectSeason
  onSelect: (content: CaseListItem) => void
  onOpenGuide: () => void
}

export default function CaseSelectScreenV2({
  cases,
  season,
  onSelect,
  onOpenGuide,
}: CaseSelectScreenV2Props): ReactElement {
  return (
    <div className="dossier-shell dossier-shell-select">
      <div className="dossier-grain" aria-hidden="true" />

      <header className="dossier-select-header">
        <p className="dossier-select-eyebrow">материалы расследования</p>
        <div className="dossier-select-season">
          <p className="dossier-select-season-title">{season.title}</p>
          <p className="dossier-select-season-subtitle">{season.subtitle}</p>
        </div>
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
        {cases.map((item) => {
          const meta = caseMeta(item)
          return (
            <article key={item.id} className="dossier-select-card">
              <header className="dossier-select-card-head">
                <span className="dossier-select-card-eyebrow">кейс</span>
                <h2 className="dossier-select-card-title">{caseTitle(item)}</h2>
                <p className="dossier-select-card-subtitle">{caseSubtitle(item)}</p>
              </header>

              <p className="dossier-select-card-legend">{caseLegend(item)}</p>

              <dl className="dossier-select-card-meta">
                <div>
                  <dt>материалов</dt>
                  <dd>{meta.materials}</dd>
                </div>
                <div>
                  <dt>людей</dt>
                  <dd>{meta.people}</dd>
                </div>
                <div>
                  <dt>фрагментов</dt>
                  <dd>{meta.fragments}</dd>
                </div>
                <div>
                  <dt>наблюдений</dt>
                  <dd>{meta.observations}</dd>
                </div>
                <div>
                  <dt>длительность</dt>
                  <dd>{meta.lengthHint}</dd>
                </div>
              </dl>

              <button
                type="button"
                className="dossier-select-card-cta"
                onClick={() => onSelect(item)}
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

export { CaseSelectScreen }
