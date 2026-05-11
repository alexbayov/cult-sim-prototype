import { useMemo, useState } from 'react'
import './dossier.css'
import {
  dossierMock,
  type EvidenceMark,
  type Pattern,
  type PatternStatus,
  type Person,
  type ReliabilityLevel,
  type RiskLevel,
  type Source,
  type SourceFragment,
  type TimelineEvent,
} from './dossierMock'

const reliabilityLabel: Record<ReliabilityLevel, string> = {
  unverified: 'не проверено',
  low: 'низкая',
  medium: 'средняя',
  high: 'высокая',
}

const riskLabel: Record<RiskLevel, string> = {
  low: 'низкий риск',
  medium: 'средний риск',
  high: 'высокий риск',
  critical: 'критический риск',
}

const statusLabel: Record<PatternStatus, string> = {
  unknown: 'не известно',
  suspected: 'подозрение',
  supported: 'подкреплено',
  confirmed: 'подтверждено',
}

const weightLabel: Record<EvidenceMark['weight'], string> = {
  low: 'слабый вес',
  medium: 'средний вес',
  high: 'высокий вес',
}

function DossierApp() {
  const caseFile = dossierMock
  const [activeSourceId, setActiveSourceId] = useState(caseFile.activeSourceId)
  const activeSource: Source = useMemo(
    () => caseFile.sources.find((s) => s.id === activeSourceId) ?? caseFile.sources[0],
    [activeSourceId, caseFile.sources],
  )

  return (
    <div className="dossier-shell">
      <div className="dossier-grain" aria-hidden="true" />

      <header className="dossier-case-header">
        <div className="dossier-case-tab">
          <span className="dossier-case-tab-label">МАТЕРИАЛЫ</span>
          <span className="dossier-case-tab-number">№ {caseFile.number}</span>
        </div>
        <div className="dossier-case-stamp" aria-hidden="true">
          в работе
        </div>
        <h1 className="dossier-case-title">{caseFile.title}</h1>
        <p className="dossier-case-subtitle">{caseFile.subtitle}</p>
        <dl className="dossier-case-meta">
          <div>
            <dt>статус</dt>
            <dd>{caseFile.status}</dd>
          </div>
          <div>
            <dt>главный вопрос</dt>
            <dd>{caseFile.investigationQuestion}</dd>
          </div>
          <div>
            <dt>публичная легенда</dt>
            <dd>{caseFile.publicLegend}</dd>
          </div>
        </dl>
        <ul className="dossier-progress-chips">
          {caseFile.progressChips.map((chip) => (
            <li key={chip.label}>
              <span className="dossier-progress-chips-label">{chip.label}</span>
              <span className="dossier-progress-chips-value">{chip.value}</span>
            </li>
          ))}
        </ul>
        <p className="dossier-content-warning">
          <span aria-hidden="true">⚠</span> {caseFile.contentWarning}
        </p>
      </header>

      <main className="dossier-grid">
        <div className="dossier-col dossier-col-left">
          <section className="dossier-card dossier-persons" aria-labelledby="persons-heading">
            <header className="dossier-card-head">
              <h2 id="persons-heading">люди</h2>
              <span className="dossier-card-counter">{caseFile.persons.length}</span>
            </header>
            <ul className="dossier-persons-list">
              {caseFile.persons.map((person: Person) => (
                <li key={person.id} className="dossier-person-card">
                  <div className="dossier-person-head">
                    <span className="dossier-person-initials" aria-hidden="true">
                      {getInitials(person.name)}
                    </span>
                    <div>
                      <p className="dossier-person-name">{person.name}</p>
                      <p className="dossier-person-role">{person.roleLabel}</p>
                    </div>
                    <span className={'dossier-badge is-risk-' + person.riskLevel}>
                      {riskLabel[person.riskLevel]}
                    </span>
                  </div>
                  <p className="dossier-person-public">{person.publicDescription}</p>
                  <p className="dossier-person-private">
                    <span className="dossier-person-private-label">внутренний комментарий</span>
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

          <section className="dossier-card dossier-patterns" aria-labelledby="patterns-heading">
            <header className="dossier-card-head">
              <h2 id="patterns-heading">наблюдения</h2>
              <span className="dossier-card-counter">
                {caseFile.patterns.filter((p) => p.status === 'confirmed').length} подтв.
              </span>
            </header>
            <ul className="dossier-patterns-list">
              {caseFile.patterns.map((pattern: Pattern) => (
                <li
                  key={pattern.id}
                  className={'dossier-pattern-card is-status-' + pattern.status}
                >
                  <header>
                    <h3>{pattern.title}</h3>
                    <span className={'dossier-pattern-status is-' + pattern.status}>
                      {statusLabel[pattern.status]}
                    </span>
                  </header>
                  <p>{pattern.shortDescription}</p>
                  <div className="dossier-pattern-progress">
                    <span>
                      связей: {pattern.evidenceCount} / {pattern.requiredEvidence}
                    </span>
                    <div className="dossier-pattern-progress-bar">
                      <div
                        className="dossier-pattern-progress-fill"
                        style={{
                          width:
                            Math.min(
                              100,
                              (pattern.evidenceCount / Math.max(1, pattern.requiredEvidence)) * 100,
                            ) + '%',
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="dossier-col dossier-col-center">
          <section className="dossier-card dossier-source" aria-labelledby="source-heading">
            <header className="dossier-card-head">
              <h2 id="source-heading">источник</h2>
              <div className="dossier-source-tabs" role="tablist" aria-label="источники">
                {caseFile.sources.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    role="tab"
                    aria-selected={source.id === activeSourceId}
                    className={
                      'dossier-source-tab' +
                      (source.id === activeSourceId ? ' is-active' : '')
                    }
                    onClick={() => setActiveSourceId(source.id)}
                  >
                    <span className="dossier-source-tab-type">{source.typeLabel}</span>
                    <span className="dossier-source-tab-date">{source.date}</span>
                  </button>
                ))}
              </div>
            </header>
            <div className="dossier-source-body">
              <div className="dossier-source-meta">
                <h3>{activeSource.title}</h3>
                <p className="dossier-source-origin">
                  <span>{activeSource.origin}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeSource.date}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      'dossier-source-reliability is-' + activeSource.reliability
                    }
                  >
                    достоверность: {reliabilityLabel[activeSource.reliability]}
                  </span>
                </p>
              </div>
              <ol className="dossier-source-fragments">
                {activeSource.fragments.map((fragment: SourceFragment) => (
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
                      <button type="button" className="dossier-fragment-mark" disabled>
                        сделать закладку
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="dossier-card dossier-timeline" aria-labelledby="timeline-heading">
            <header className="dossier-card-head">
              <h2 id="timeline-heading">хронология</h2>
              <span className="dossier-card-counter">{caseFile.timeline.length}</span>
            </header>
            <ol className="dossier-timeline-list">
              {caseFile.timeline.map((event: TimelineEvent) => (
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
          <section className="dossier-card dossier-evidence" aria-labelledby="evidence-heading">
            <header className="dossier-card-head">
              <h2 id="evidence-heading">закладки</h2>
              <span className="dossier-card-counter">
                {caseFile.evidence.length} собрано
              </span>
            </header>
            <ul className="dossier-evidence-list">
              {caseFile.evidence.map((evidence) => (
                <li key={evidence.id} className="dossier-evidence-item">
                  <p className="dossier-evidence-text">«{evidence.fragmentText}»</p>
                  <div className="dossier-evidence-meta">
                    <span className="dossier-evidence-source">
                      источник: {evidence.sourceLabel}
                    </span>
                    {evidence.linkedPersonName && (
                      <span className="dossier-evidence-person">
                        → {evidence.linkedPersonName}
                      </span>
                    )}
                    {evidence.linkedPatternTitle && (
                      <span className="dossier-evidence-pattern">
                        ⇣ {evidence.linkedPatternTitle}
                      </span>
                    )}
                  </div>
                  <div className="dossier-evidence-badges">
                    <span
                      className={
                        'dossier-badge is-reliability-' + evidence.reliability
                      }
                    >
                      {reliabilityLabel[evidence.reliability]}
                    </span>
                    <span className={'dossier-badge is-weight-' + evidence.weight}>
                      {weightLabel[evidence.weight]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <aside className="dossier-card dossier-report" aria-labelledby="report-heading">
            <header className="dossier-card-head">
              <h2 id="report-heading">черновик сводки</h2>
              <span className="dossier-card-counter">draft</span>
            </header>
            <p className="dossier-report-summary">{caseFile.riskStatement}</p>
            <ul className="dossier-report-list">
              <li>
                <strong>сильнейший фрагмент:</strong> «Доступ к закрытому потоку. Возврат не предусмотрен.»
              </li>
              <li>
                <strong>подтверждённые наблюдения:</strong> сужение внешних связей, денежное давление.
              </li>
              <li>
                <strong>люди в риске:</strong> Аня К. (критический), Илья П. (средний).
              </li>
              <li>
                <strong>не хватает:</strong> прямого подтверждения зависимости от группы.
              </li>
            </ul>
            <button type="button" className="dossier-report-submit" disabled>
              подать сводку (заблокировано: мало закладок)
            </button>
          </aside>
        </div>
      </main>

      <footer className="dossier-footer">
        <p>
          Демо-оболочка. Данные — вымысел. UI shell без полной логики работы с фрагментами.
        </p>
      </footer>
    </div>
  )
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default DossierApp
