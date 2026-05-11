import { useMemo, useState } from 'react'
import './dossier.css'
import { infoBusinessMarathonInvestigation } from '../game/investigation/data'
import {
  buildDossierView,
  type DossierViewMaterial,
  type DossierViewObservation,
  type DossierViewPattern,
  type DossierViewPerson,
  type DossierViewTimelineEvent,
  type ReliabilityLevel,
  type RiskBucket,
  type SignalLevel,
} from './investigationViewModel'

const reliabilityLabel: Record<ReliabilityLevel, string> = {
  low: 'низкая',
  medium: 'средняя',
  high: 'высокая',
}

const riskLabel: Record<RiskBucket, string> = {
  low: 'низкий уровень риска',
  medium: 'средний уровень риска',
  high: 'высокий уровень риска',
  critical: 'критический уровень риска',
}

const signalLabel: Record<SignalLevel, string> = {
  low: 'слабый сигнал',
  medium: 'средний сигнал',
  high: 'сильный сигнал',
}

function DossierApp() {
  const view = useMemo(
    () => buildDossierView(infoBusinessMarathonInvestigation),
    [],
  )
  const [activeMaterialId, setActiveMaterialId] = useState(
    view.activeMaterialId,
  )
  const activeMaterial: DossierViewMaterial = useMemo(
    () =>
      view.materials.find((m) => m.id === activeMaterialId) ??
      view.materials[0],
    [activeMaterialId, view.materials],
  )
  const activeFragments = view.fragmentsBySource[activeMaterial?.id] ?? []

  return (
    <div className="dossier-shell">
      <div className="dossier-grain" aria-hidden="true" />

      <header className="dossier-case-header">
        <div className="dossier-case-tab">
          <span className="dossier-case-tab-label">МАТЕРИАЛЫ</span>
          <span className="dossier-case-tab-number">№ {view.number}</span>
        </div>
        <div className="dossier-case-stamp" aria-hidden="true">
          {view.status}
        </div>
        <h1 className="dossier-case-title">{view.title}</h1>
        <p className="dossier-case-subtitle">{view.subtitle}</p>
        <dl className="dossier-case-meta">
          <div>
            <dt>статус</dt>
            <dd>{view.status}</dd>
          </div>
          <div>
            <dt>главный вопрос</dt>
            <dd>{view.investigationQuestion}</dd>
          </div>
          <div>
            <dt>публичная легенда</dt>
            <dd>{view.publicLegend}</dd>
          </div>
        </dl>
        <ul className="dossier-progress-chips">
          {view.progressChips.map((chip) => (
            <li key={chip.label}>
              <span className="dossier-progress-chips-label">{chip.label}</span>
              <span className="dossier-progress-chips-value">{chip.value}</span>
            </li>
          ))}
        </ul>
        <p className="dossier-content-warning">
          <span aria-hidden="true">⚠</span> {view.contentWarning}
        </p>
      </header>

      <main className="dossier-grid">
        <div className="dossier-col dossier-col-left">
          <section
            className="dossier-card dossier-persons"
            aria-labelledby="persons-heading"
          >
            <header className="dossier-card-head">
              <h2 id="persons-heading">люди</h2>
              <span className="dossier-card-counter">{view.persons.length}</span>
            </header>
            <ul className="dossier-persons-list">
              {view.persons.map((person: DossierViewPerson) => (
                <li key={person.id} className="dossier-person-card">
                  <div className="dossier-person-head">
                    <span
                      className="dossier-person-initials"
                      aria-hidden="true"
                    >
                      {person.initials}
                    </span>
                    <div>
                      <p className="dossier-person-name">{person.name}</p>
                      <p className="dossier-person-role">{person.roleLabel}</p>
                    </div>
                    <span
                      className={'dossier-badge is-risk-' + person.riskLevel}
                    >
                      {riskLabel[person.riskLevel]}
                    </span>
                  </div>
                  <p className="dossier-person-public">
                    {person.publicDescription}
                  </p>
                  <p className="dossier-person-private">
                    <span className="dossier-person-private-label">
                      внутренний комментарий
                    </span>
                    {person.privateNote}
                  </p>
                  <dl className="dossier-person-metrics">
                    <div>
                      <dt>влияние</dt>
                      <dd>{person.influence}</dd>
                    </div>
                    <div>
                      <dt>достоверность</dt>
                      <dd>{person.credibility}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="dossier-card dossier-patterns"
            aria-labelledby="patterns-heading"
          >
            <header className="dossier-card-head">
              <h2 id="patterns-heading">повторяющиеся сигналы</h2>
              <span className="dossier-card-counter">
                {view.patterns.length}
              </span>
            </header>
            <ul className="dossier-patterns-list">
              {view.patterns.map((pattern: DossierViewPattern) => (
                <li
                  key={pattern.id}
                  className={
                    'dossier-pattern-card is-signal-' + pattern.signalLevel
                  }
                >
                  <header>
                    <h3>{pattern.title}</h3>
                    <span
                      className={
                        'dossier-pattern-signal is-' + pattern.signalLevel
                      }
                    >
                      {signalLabel[pattern.signalLevel]}
                    </span>
                  </header>
                  <p>{pattern.shortDescription}</p>
                  <dl className="dossier-pattern-counts">
                    <div>
                      <dt>сильных сигналов</dt>
                      <dd>{pattern.strongSignals}</dd>
                    </div>
                    <div>
                      <dt>слабых сигналов</dt>
                      <dd>{pattern.weakSignals}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="dossier-col dossier-col-center">
          <section
            className="dossier-card dossier-source"
            aria-labelledby="source-heading"
          >
            <header className="dossier-card-head">
              <h2 id="source-heading">материал</h2>
              <div
                className="dossier-source-tabs"
                role="tablist"
                aria-label="материалы"
              >
                {view.materials.map((material) => (
                  <button
                    key={material.id}
                    type="button"
                    role="tab"
                    aria-selected={material.id === activeMaterialId}
                    className={
                      'dossier-source-tab' +
                      (material.id === activeMaterialId ? ' is-active' : '')
                    }
                    onClick={() => setActiveMaterialId(material.id)}
                  >
                    <span className="dossier-source-tab-type">
                      {material.typeLabel}
                    </span>
                    <span className="dossier-source-tab-date">
                      {material.date}
                    </span>
                  </button>
                ))}
              </div>
            </header>
            {activeMaterial && (
              <div className="dossier-source-body">
                <div className="dossier-source-meta">
                  <h3>{activeMaterial.title}</h3>
                  <p className="dossier-source-origin">
                    <span>{activeMaterial.origin}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeMaterial.date}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        'dossier-source-reliability is-' +
                        activeMaterial.reliability
                      }
                    >
                      достоверность: {reliabilityLabel[activeMaterial.reliability]}
                    </span>
                  </p>
                </div>
                {activeFragments.length === 0 ? (
                  <p className="dossier-source-empty">
                    Видимых фрагментов в этом материале пока нет. Откройте
                    другие материалы или дождитесь дополнительных данных.
                  </p>
                ) : (
                  <ol className="dossier-source-fragments">
                    {activeFragments.map((fragment) => (
                      <li
                        key={fragment.id}
                        className={
                          'dossier-fragment' +
                          (fragment.highlighted ? ' is-highlighted' : '')
                        }
                      >
                        {fragment.speaker && (
                          <span className="dossier-fragment-speaker">
                            {fragment.speaker}
                          </span>
                        )}
                        <p className="dossier-fragment-text">{fragment.text}</p>
                        <div className="dossier-fragment-actions">
                          <button
                            type="button"
                            className="dossier-fragment-mark"
                            disabled
                          >
                            сделать закладку
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </section>

          <section
            className="dossier-card dossier-timeline"
            aria-labelledby="timeline-heading"
          >
            <header className="dossier-card-head">
              <h2 id="timeline-heading">хронология</h2>
              <span className="dossier-card-counter">
                {view.timeline.length}
              </span>
            </header>
            <ol className="dossier-timeline-list">
              {view.timeline.map((event: DossierViewTimelineEvent) => (
                <li
                  key={event.id}
                  className={'dossier-timeline-item is-tone-' + event.tone}
                >
                  <span className="dossier-timeline-date">{event.date}</span>
                  <div className="dossier-timeline-body">
                    <p className="dossier-timeline-label">{event.label}</p>
                    <p className="dossier-timeline-note">{event.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="dossier-col dossier-col-right">
          <section
            className="dossier-card dossier-evidence"
            aria-labelledby="observations-heading"
          >
            <header className="dossier-card-head">
              <h2 id="observations-heading">ключевые наблюдения</h2>
              <span className="dossier-card-counter">
                {view.observations.length} в подборке
              </span>
            </header>
            <ul className="dossier-evidence-list">
              {view.observations.map((observation: DossierViewObservation) => (
                <li key={observation.id} className="dossier-evidence-item">
                  <p className="dossier-evidence-text">«{observation.text}»</p>
                  <div className="dossier-evidence-meta">
                    <span className="dossier-evidence-source">
                      материал: {observation.sourceLabel}
                    </span>
                    {observation.linkedPersonName && (
                      <span className="dossier-evidence-person">
                        → {observation.linkedPersonName}
                      </span>
                    )}
                    {observation.linkedPatternTitle && (
                      <span className="dossier-evidence-pattern">
                        ⇣ {observation.linkedPatternTitle}
                      </span>
                    )}
                  </div>
                  <div className="dossier-evidence-badges">
                    <span
                      className={
                        'dossier-badge is-reliability-' + observation.reliability
                      }
                    >
                      {reliabilityLabel[observation.reliability]}
                    </span>
                    <span
                      className={'dossier-badge is-weight-' + observation.weight}
                    >
                      {signalLabel[observation.weight]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <aside
            className="dossier-card dossier-report"
            aria-labelledby="report-heading"
          >
            <header className="dossier-card-head">
              <h2 id="report-heading">сводка</h2>
              <span className="dossier-card-counter">черновик</span>
            </header>
            <p className="dossier-report-summary">{view.riskStatement}</p>
            <h3 className="dossier-report-subheading">возможные исходы</h3>
            <ul className="dossier-report-list">
              {view.outcomes.map((outcome) => (
                <li key={outcome.id}>
                  <strong>{outcome.title}.</strong> {outcome.summary}
                </li>
              ))}
            </ul>
            {view.debrief.length > 0 && (
              <>
                <h3 className="dossier-report-subheading">справочник</h3>
                <ul className="dossier-report-debrief">
                  {view.debrief.map((term) => (
                    <li key={term.id}>
                      <strong>{term.term}.</strong> {term.shortExplanation}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button type="button" className="dossier-report-submit" disabled>
              подать сводку (разбор фрагментов появится позже)
            </button>
          </aside>
        </div>
      </main>

      <footer className="dossier-footer">
        <p>
          Демо-оболочка расследования. Данные дела — вымышленные, маркировка
          фрагментов и подача сводки появятся в следующем PR.
        </p>
      </footer>
    </div>
  )
}

export default DossierApp
