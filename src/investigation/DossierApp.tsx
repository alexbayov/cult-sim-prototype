import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './dossier.css'
import type { InvestigationContent } from '../game/investigation/types'
import { useInvestigationState } from './useInvestigationState'
import ProgressNudge from './ProgressNudge'
import type {
  ConnectionStatus,
  DossierViewMaterial,
  DossierViewObservation,
  DossierViewPattern,
  DossierViewPerson,
  DossierViewTimelineEvent,
  ReliabilityLevel,
  RiskBucket,
  SignalLevel,
} from './investigationViewModel'

export type DossierAppProps = {
  content: InvestigationContent
  onBackToCases?: () => void
}

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

const connectionLabel: Record<ConnectionStatus, string> = {
  unmarked: 'нет закладок',
  weak: 'слабая связь',
  partial: 'промежуточная связь',
  strong: 'связь подтверждена',
  contradicted: 'противоречие',
}

function DossierApp({ content, onBackToCases }: DossierAppProps) {
  const {
    view,
    activeMaterialId,
    selectedCount,
    isReportSubmitted,
    canSubmitReport,
    resolution,
    selectMaterial,
    toggleFragment,
    submitReport,
    resetInvestigation,
  } = useInvestigationState(content)

  const initialMaterialCount = content.case.initialSourceIds.length

  const activeMaterial: DossierViewMaterial | undefined = useMemo(
    () =>
      view.materials.find((m) => m.id === activeMaterialId) ??
      view.materials.find((m) => !m.locked) ??
      view.materials[0],
    [activeMaterialId, view.materials],
  )
  const activeFragments = activeMaterial
    ? view.fragmentsBySource[activeMaterial.id] ?? []
    : []

  const observationsHeading = selectedCount > 0 ? 'закладки' : 'ключевые наблюдения'
  const observationsList: DossierViewObservation[] =
    selectedCount > 0 ? view.selectedObservations : view.observations
  const observationsCounter =
    selectedCount > 0
      ? `${selectedCount} в закладках`
      : `${observationsList.length} наблюдений`
  // Hint line under the right-panel heading. Spells out *what the panel
  // is currently showing* so the heading swap between «ключевые
  // наблюдения» and «закладки» on first bookmark is obvious rather than
  // silent. See docs/PLAYTEST_UX_REPORT.md §5 #3.
  const observationsStateHint: string =
    selectedCount > 0
      ? `Ваши закладки. Подтверждено связей: ${view.selectionSummary.confirmedPatternCount} / ${view.selectionSummary.totalPatternCount}.`
      : 'Пока ни одной закладки. Здесь показаны ключевые наблюдения дела. Когда вы сделаете первую закладку, этот блок переключится на вашу подборку.'

  // Pre-submit status hint that aligns with ProgressNudge thresholds
  // (early summary at 2 confirmed connections, strong at 4). Lives here
  // because the report aside also needs to read the same numbers.
  const confirmedPatternCount = view.selectionSummary.confirmedPatternCount
  const reportStatusHint: string = (() => {
    if (selectedCount === 0) {
      return 'Откройте материал и поставьте закладку, чтобы собрать сводку.'
    }
    if (confirmedPatternCount >= 4) {
      return 'Связей достаточно для сильной сводки.'
    }
    if (confirmedPatternCount >= 2) {
      const remaining = 4 - confirmedPatternCount
      const wordForm = remaining === 1 ? 'связь' : 'связи'
      return `Раннюю сводку уже можно подать. Для сильной нужно ещё ${remaining} ${wordForm}.`
    }
    return 'Ни одна связь пока не подтверждена. Сводку можно сформировать как раннюю фиксацию.'
  })()

  // Inline confirmation for the destructive reset button: first click
  // arms it, second click runs `resetInvestigation`. No modal.
  const [resetArmed, setResetArmed] = useState(false)

  // Transient «что изменилось» line under the progress chips. Lights up
  // for ~4 s after a bookmark toggle, summarising the local deltas in
  // selected fragments and unlocked materials. Pure local state; the
  // view-model already produces the absolute counts we diff against.
  const unlockedMaterialCount = view.selectionSummary.unlockedMaterialCount
  const [whatChangedLine, setWhatChangedLine] = useState<string | null>(null)
  const prevSelectedCount = useRef<number>(selectedCount)
  const prevUnlockedMaterialCount = useRef<number>(unlockedMaterialCount)
  useEffect(() => {
    const selectedDelta = selectedCount - prevSelectedCount.current
    const unlockedDelta =
      unlockedMaterialCount - prevUnlockedMaterialCount.current
    prevSelectedCount.current = selectedCount
    prevUnlockedMaterialCount.current = unlockedMaterialCount
    if (selectedDelta === 0 && unlockedDelta === 0) return
    const parts: string[] = []
    if (selectedDelta > 0) parts.push('добавлена закладка')
    else if (selectedDelta < 0) parts.push('снята закладка')
    parts.push('обновились наблюдения')
    if (unlockedDelta > 0) {
      const wordForm = unlockedDelta === 1 ? 'материал' : 'материала'
      parts.push(`открыто ${unlockedDelta} ${wordForm}`)
    } else if (unlockedDelta < 0) {
      const n = -unlockedDelta
      const wordForm = n === 1 ? 'материал' : 'материала'
      parts.push(`закрыто ${n} ${wordForm}`)
    }
    setWhatChangedLine(parts.join(' · '))
    const t = window.setTimeout(() => setWhatChangedLine(null), 4000)
    return () => window.clearTimeout(t)
  }, [selectedCount, unlockedMaterialCount])
  const handleResetClick = useCallback(() => {
    if (!resetArmed) {
      setResetArmed(true)
      return
    }
    setResetArmed(false)
    resetInvestigation()
  }, [resetArmed, resetInvestigation])
  const handleResetCancel = useCallback(() => {
    setResetArmed(false)
  }, [])

  return (
    <div className="dossier-shell">
      <div className="dossier-grain" aria-hidden="true" />

      {onBackToCases && (
        <button
          type="button"
          className="dossier-case-back"
          onClick={onBackToCases}
        >
          ← к выбору материалов
        </button>
      )}

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
        <p
          className={
            'dossier-what-changed' + (whatChangedLine ? ' is-visible' : '')
          }
          aria-live="polite"
          role="status"
        >
          {whatChangedLine ?? '\u00a0'}
        </p>
        <ProgressNudge
          selectedCount={selectedCount}
          unlockedMaterialCount={view.selectionSummary.unlockedMaterialCount}
          initialMaterialCount={initialMaterialCount}
          confirmedPatternCount={view.selectionSummary.confirmedPatternCount}
          isReportSubmitted={isReportSubmitted}
          unlockedSinceStartTitles={
            view.selectionSummary.unlockedSinceStartTitles
          }
        />
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
                    'dossier-pattern-card is-signal-' +
                    pattern.signalLevel +
                    ' is-connection-' +
                    pattern.connectionStatus
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
                  <p
                    className={
                      'dossier-pattern-connection is-' + pattern.connectionStatus
                    }
                  >
                    {connectionLabel[pattern.connectionStatus]}
                    {pattern.targetCount > 0 && (
                      <span className="dossier-pattern-connection-count">
                        отмечено фрагментов: {pattern.markedCount} /{' '}
                        {pattern.targetCount}
                      </span>
                    )}
                  </p>
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
                      (material.id === activeMaterialId ? ' is-active' : '') +
                      (material.locked ? ' is-locked' : '')
                    }
                    onClick={() => selectMaterial(material.id)}
                    disabled={material.locked}
                    title={material.lockedHint ?? undefined}
                  >
                    <span className="dossier-source-tab-type">
                      {material.typeLabel}
                      {material.locked ? ' · закрыт' : ''}
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
                  {activeMaterial.unlockedByFragment && (
                    <p className="dossier-source-unlocked-by">
                      <span className="dossier-source-unlocked-by-label">
                        открыт закладкой:
                      </span>{' '}
                      «{activeMaterial.unlockedByFragment.fragmentText}»
                    </p>
                  )}
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
                          (fragment.highlighted ? ' is-highlighted' : '') +
                          (fragment.selected ? ' is-selected' : '')
                        }
                      >
                        {fragment.speaker && (
                          <span className="dossier-fragment-speaker">
                            {fragment.speaker}
                          </span>
                        )}
                        <p className="dossier-fragment-text">{fragment.text}</p>
                        {fragment.linkedPatternTitle && (
                          <p className="dossier-fragment-link">
                            <span className="dossier-fragment-link-label">
                              связано с:
                            </span>{' '}
                            {fragment.linkedPatternTitle}
                            {fragment.linkedPatternExtraCount > 0 && (
                              <span className="dossier-fragment-link-extra">
                                {' '}
                                +{fragment.linkedPatternExtraCount}
                              </span>
                            )}
                          </p>
                        )}
                        {fragment.unlocksHint && (
                          <p className="dossier-fragment-hint">
                            {fragment.unlocksHint}
                          </p>
                        )}
                        <div className="dossier-fragment-actions">
                          <button
                            type="button"
                            className={
                              'dossier-fragment-mark' +
                              (fragment.selected ? ' is-selected' : '')
                            }
                            onClick={() => toggleFragment(fragment.id)}
                          >
                            {fragment.selected ? 'снять закладку' : 'сделать закладку'}
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
              <h2 id="observations-heading">{observationsHeading}</h2>
              <span className="dossier-card-counter">{observationsCounter}</span>
            </header>
            <p
              className={
                'dossier-evidence-state-hint' +
                (selectedCount > 0 ? ' is-state-bookmarks' : ' is-state-preview')
              }
            >
              {observationsStateHint}
            </p>
            {observationsList.length === 0 ? (
              <p className="dossier-source-empty">
                Пока ни одного фрагмента не отмечено. Откройте материал и
                поставьте закладку, чтобы он попал сюда.
              </p>
            ) : (
              <ul className="dossier-evidence-list">
                {observationsList.map((observation: DossierViewObservation) => (
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
                        className={
                          'dossier-badge is-weight-' + observation.weight
                        }
                      >
                        {signalLabel[observation.weight]}
                      </span>
                    </div>
                    {selectedCount > 0 && (
                      <button
                        type="button"
                        className="dossier-evidence-remove"
                        onClick={() => toggleFragment(observation.id)}
                      >
                        снять закладку
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside
            className="dossier-card dossier-report"
            aria-labelledby="report-heading"
          >
            <header className="dossier-card-head">
              <h2 id="report-heading">сводка</h2>
              <span className="dossier-card-counter">
                {isReportSubmitted && view.report ? 'подана' : 'черновик'}
              </span>
            </header>

            {isReportSubmitted && view.report ? (
              <>
                <h3 className="dossier-report-outcome-title">
                  {view.report.title}
                </h3>
                <p className="dossier-report-summary">{view.report.summary}</p>
                <p className="dossier-report-framing">
                  <span className="dossier-report-framing-label">
                    рекомендуемая подача
                  </span>
                  {view.report.recommendedFraming}
                </p>
                <ul className="dossier-report-list">
                  {view.report.confirmedPatternTitles.length > 0 && (
                    <li>
                      <strong>подтверждённые связи</strong>
                      {view.report.confirmedPatternTitles.join(', ')}
                    </li>
                  )}
                  {view.report.supportedPatternTitles.length > 0 && (
                    <li>
                      <strong>промежуточные связи</strong>
                      {view.report.supportedPatternTitles.join(', ')}
                    </li>
                  )}
                  {view.report.suspectedPatternTitles.length > 0 && (
                    <li>
                      <strong>слабые связи</strong>
                      {view.report.suspectedPatternTitles.join(', ')}
                    </li>
                  )}
                  {view.report.contradictedPatternTitles.length > 0 && (
                    <li>
                      <strong>с противоречиями</strong>
                      {view.report.contradictedPatternTitles.join(', ')}
                    </li>
                  )}
                  {view.report.strongestFragmentTexts.length > 0 && (
                    <li>
                      <strong>опорные фрагменты</strong>
                      <ul className="dossier-report-fragments">
                        {view.report.strongestFragmentTexts.map((text) => (
                          <li key={text}>«{text}»</li>
                        ))}
                      </ul>
                    </li>
                  )}
                  {view.report.gapPatternTitles.length > 0 && (
                    <li>
                      <strong>пробелы</strong>
                      {view.report.gapPatternTitles.join(', ')}
                    </li>
                  )}
                </ul>
                {view.report.notes.length > 0 && (
                  <ul className="dossier-report-notes">
                    {view.report.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                )}
                <p className="dossier-report-meta">
                  материалы: «{view.title}» · сводка: «{view.report.title}»
                </p>
                <div className="dossier-report-actions">
                  <button
                    type="button"
                    className="dossier-report-submit"
                    onClick={submitReport}
                    disabled={!canSubmitReport}
                  >
                    обновить сводку
                  </button>
                  {resetArmed ? (
                    <div
                      className="dossier-report-reset-confirm"
                      role="alertdialog"
                      aria-label="подтверждение сброса"
                    >
                      <p>
                        Снять все закладки и начать материалы заново? Сводка и
                        разбор будут сброшены.
                      </p>
                      <div className="dossier-report-reset-confirm-actions">
                        <button
                          type="button"
                          className="dossier-report-reset is-confirm"
                          onClick={handleResetClick}
                        >
                          да, начать заново
                        </button>
                        <button
                          type="button"
                          className="dossier-report-reset-cancel"
                          onClick={handleResetCancel}
                        >
                          отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="dossier-report-reset"
                      onClick={handleResetClick}
                    >
                      начать материалы заново
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="dossier-report-summary">{view.riskStatement}</p>
                <p className="dossier-report-status">
                  отмечено фрагментов:{' '}
                  <strong>{view.selectionSummary.selectedCount}</strong>{' '}
                  · подтверждённых связей:{' '}
                  <strong>
                    {view.selectionSummary.confirmedPatternCount}
                  </strong>
                </p>
                <p className="dossier-report-status-hint">{reportStatusHint}</p>
                <details className="dossier-report-outcomes">
                  <summary>возможные рамки сводки</summary>
                  <ul className="dossier-report-list">
                    {view.outcomes.map((outcome) => (
                      <li key={outcome.id}>
                        <strong>{outcome.title}.</strong> {outcome.summary}
                      </li>
                    ))}
                  </ul>
                </details>
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
                <div className="dossier-report-actions">
                  <button
                    type="button"
                    className="dossier-report-submit"
                    onClick={submitReport}
                    disabled={!canSubmitReport}
                  >
                    сформировать сводку
                  </button>
                  {resetArmed ? (
                    <div
                      className="dossier-report-reset-confirm"
                      role="alertdialog"
                      aria-label="подтверждение сброса"
                    >
                      <p>Снять все закладки?</p>
                      <div className="dossier-report-reset-confirm-actions">
                        <button
                          type="button"
                          className="dossier-report-reset is-confirm"
                          onClick={handleResetClick}
                        >
                          да, снять
                        </button>
                        <button
                          type="button"
                          className="dossier-report-reset-cancel"
                          onClick={handleResetCancel}
                        >
                          отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="dossier-report-reset"
                      onClick={handleResetClick}
                      disabled={selectedCount === 0}
                    >
                      снять все закладки
                    </button>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </main>

      {isReportSubmitted && resolution && (
        <section
          className="dossier-resolution"
          aria-labelledby="resolution-heading"
        >
          <header className="dossier-resolution-head">
            <h2 id="resolution-heading">разбор</h2>
            <p className="dossier-resolution-sub">
              {resolution.outcomeTitle
                ? `рамка сводки: ${resolution.outcomeTitle}`
                : 'сводка собрана на основе текущих закладок'}
            </p>
            {resolution.outcomeRationale && (
              <p className="dossier-resolution-rationale">
                эта сводка выбрана потому что{' '}
                {resolution.outcomeRationale}.
              </p>
            )}
          </header>

          <div className="dossier-resolution-metrics">
            {resolution.metrics.map((m) => (
              <article
                key={m.key}
                className={'dossier-metric is-' + m.key}
                title={m.description}
              >
                <header>
                  <span className="dossier-metric-label">{m.label}</span>
                  <span className="dossier-metric-value">{m.value}</span>
                </header>
                <div
                  className="dossier-metric-bar"
                  role="img"
                  aria-label={`${m.label}: ${m.value} из 100`}
                >
                  <div
                    className="dossier-metric-bar-fill"
                    style={{ width: `${m.value}%` }}
                  />
                </div>
                <p className="dossier-metric-desc">{m.description}</p>
              </article>
            ))}
          </div>

          <div className="dossier-resolution-stats">
            <div>
              <dt>открытых материалов</dt>
              <dd>
                {resolution.openedSourceCount} из{' '}
                {resolution.totalSourceCount}
              </dd>
            </div>
            <div>
              <dt>фрагментов в закладках</dt>
              <dd>{resolution.selectedFragmentCount}</dd>
            </div>
            <div>
              <dt>видимых материалов</dt>
              <dd>
                {resolution.visibleSourceCount} из{' '}
                {resolution.totalSourceCount}
              </dd>
            </div>
          </div>

          <div className="dossier-resolution-grid">
            <article className="dossier-resolution-card is-visible">
              <h3>что уже видно</h3>
              {resolution.strongObservations.length === 0 &&
              resolution.supportedObservations.length === 0 ? (
                <p className="dossier-resolution-empty">
                  По текущим закладкам связи пока не подкреплены.
                </p>
              ) : (
                <ul className="dossier-resolution-list">
                  {resolution.strongObservations.map((o) => (
                    <li key={o.id}>
                      <span className="dossier-resolution-tag is-strong">
                        подкреплено
                      </span>
                      {o.title}
                    </li>
                  ))}
                  {resolution.supportedObservations.map((o) => (
                    <li key={o.id}>
                      <span className="dossier-resolution-tag is-supported">
                        промежуточно
                      </span>
                      {o.title}
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="dossier-resolution-card is-weak">
              <h3>что пока слабо</h3>
              {resolution.weakObservations.length === 0 ? (
                <p className="dossier-resolution-empty">
                  Слабых связей в подборке нет.
                </p>
              ) : (
                <ul className="dossier-resolution-list">
                  {resolution.weakObservations.map((o) => (
                    <li key={o.id}>
                      <span className="dossier-resolution-tag is-weak">
                        слабый сигнал
                      </span>
                      {o.title}
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="dossier-resolution-card is-contradicted">
              <h3>что противоречит версии</h3>
              {resolution.contradictedObservations.length === 0 ? (
                <p className="dossier-resolution-empty">
                  Прямых противоречий в закладках нет.
                </p>
              ) : (
                <ul className="dossier-resolution-list">
                  {resolution.contradictedObservations.map((o) => (
                    <li key={o.id}>
                      <span className="dossier-resolution-tag is-contradicted">
                        противоречие
                      </span>
                      {o.title}
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="dossier-resolution-card is-noise">
              <h3>что было шумом</h3>
              {resolution.noiseFragments.length === 0 ? (
                <p className="dossier-resolution-empty">
                  Шумных фрагментов в закладках не найдено.
                </p>
              ) : (
                <ul className="dossier-resolution-list">
                  {resolution.noiseFragments.map((f) => (
                    <li key={f.id}>
                      <span className="dossier-resolution-tag is-noise">
                        шум
                      </span>
                      <p className="dossier-resolution-fragment-text">
                        «{f.text}»
                      </p>
                      <p className="dossier-resolution-fragment-meta">
                        {f.sourceLabel}
                        {f.speaker ? ` · ${f.speaker}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="dossier-resolution-card is-todo">
              <h3>что можно было ещё проверить</h3>
              {resolution.missedStrongTopics.length === 0 ? (
                <p className="dossier-resolution-empty">
                  Опорные фрагменты по основным связям взяты в работу.
                </p>
              ) : (
                <ul className="dossier-resolution-list">
                  {resolution.missedStrongTopics.map((o) => (
                    <li key={o.id}>
                      <span className="dossier-resolution-tag is-todo">
                        тема
                      </span>
                      {o.title}
                    </li>
                  ))}
                </ul>
              )}
            </article>

            {resolution.protectiveObservations.length > 0 && (
              <article className="dossier-resolution-card is-protective">
                <h3>внешние опоры</h3>
                <ul className="dossier-resolution-list">
                  {resolution.protectiveObservations.map((o) => (
                    <li key={o.id}>
                      <span className="dossier-resolution-tag is-protective">
                        замечено
                      </span>
                      {o.title}
                    </li>
                  ))}
                </ul>
              </article>
            )}
          </div>

          {resolution.nextChecks.length > 0 && (
            <section
              className="dossier-resolution-next"
              aria-labelledby="next-checks-heading"
            >
              <h3 id="next-checks-heading">что проверить дальше</h3>
              <ul>
                {resolution.nextChecks.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </section>
          )}

          <section
            className="dossier-resolution-achievements"
            aria-labelledby="achievements-heading"
          >
            <header>
              <h3 id="achievements-heading">заметки профиля</h3>
              <span className="dossier-resolution-achievements-counter">
                отмечено{' '}
                {resolution.achievements.filter((a) => a.earned).length}{' '}
                из {resolution.achievements.length}
              </span>
            </header>
            <ul>
              {resolution.achievements.map((a) => (
                <li
                  key={a.id}
                  className={
                    'dossier-achievement' +
                    (a.earned ? ' is-earned' : ' is-locked')
                  }
                >
                  <div className="dossier-achievement-title">
                    <span aria-hidden="true">
                      {a.earned ? '●' : '○'}
                    </span>
                    {a.title}
                  </div>
                  <p className="dossier-achievement-desc">{a.description}</p>
                </li>
              ))}
            </ul>
          </section>

          {resolution.glossary.length > 0 && (
            <section
              className="dossier-resolution-glossary"
              aria-labelledby="glossary-heading"
            >
              <h3 id="glossary-heading">справочник по связям</h3>
              <ul>
                {resolution.glossary.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.term}.</strong> {entry.shortExplanation}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      )}

      <footer className="dossier-footer">
        <p>
          Демо-оболочка работы с материалами. Данные дела вымышленные;
          сводка и разбор собираются из закладок, поставленных в материалах.
        </p>
      </footer>
    </div>
  )
}

export default DossierApp
