import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { infoBusinessMarathonScenario } from './game/data'
import { createInitialState, groupMetricLabels, participantMetricLabels, playCard } from './game/engine'
import { clearSavedGame, getSaveVersion, loadSavedGame, saveGame } from './game/storage'
import type { Card, DebriefTerm, GroupMetric, Participant, ParticipantMetric } from './game/types'

const debriefIndex: Map<string, DebriefTerm> = new Map(
  infoBusinessMarathonScenario.debriefTerms.map((term) => [term.tag, term]),
)

function App() {
  const [game, setGame] = useState(() => loadSavedGame() ?? createInitialState())
  const [selectedParticipantId, setSelectedParticipantId] = useState(game.participants[0].id)
  const selectedParticipant = useMemo(
    () =>
      game.participants.find((participant) => participant.id === selectedParticipantId) ??
      game.participants[0],
    [game.participants, selectedParticipantId],
  )

  const handleCardPlay = (cardId: string) => {
    setGame((state) => playCard(state, cardId))
  }

  const resetGame = () => {
    const nextGame = createInitialState()
    clearSavedGame()
    setGame(nextGame)
    setSelectedParticipantId(nextGame.participants[0].id)
  }

  useEffect(() => {
    saveGame(game)
  }, [game])

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">Дело №0 · прототип</p>
          <h1>Марафон личной эффективности</h1>
          <p className="subtitle">
            Карточная доска группы: внешне нейтральные практики, внутри — изменения доверия,
            автономии, зависимости и видимости.
          </p>
        </div>
        <div className="turn-card">
          <span>неделя</span>
          <strong>{Math.min(game.turn, 10)} / 10</strong>
          <small>save v{getSaveVersion()} · auto</small>
          <button type="button" onClick={resetGame}>
            новая партия
          </button>
        </div>
      </header>

      <section className="layout">
        <aside className="panel metrics-panel">
          <PanelTitle kicker="система" title="Шкалы группы" />
          <div className="metric-list">
            {(Object.keys(game.group) as GroupMetric[]).map((metric) => (
              <MetricBar
                key={metric}
                label={groupMetricLabels[metric]}
                value={game.group[metric]}
                danger={['harm', 'visibility', 'radicalization', 'resistance'].includes(metric)}
              />
            ))}
          </div>
        </aside>

        <section className="board">
          <div className="panel">
            <PanelTitle kicker="люди" title="Участники потока" />
            <div className="participants-grid">
              {game.participants.map((participant) => (
                <ParticipantCard
                  key={participant.id}
                  participant={participant}
                  active={participant.id === selectedParticipant.id}
                  onSelect={() => setSelectedParticipantId(participant.id)}
                />
              ))}
            </div>
          </div>

          <div className="panel selected-panel">
            <PanelTitle kicker="карточка человека" title={selectedParticipant.name} />
            <p className="participant-summary">
              {selectedParticipant.archetype}. Нужда: {selectedParticipant.need}. Уязвимость:{' '}
              {selectedParticipant.vulnerability}. Защита: {selectedParticipant.protection}.
            </p>
            <div className="participant-metrics">
              {(Object.keys(selectedParticipant.metrics) as ParticipantMetric[]).map((metric) => (
                <MetricBar
                  key={metric}
                  label={participantMetricLabels[metric]}
                  value={selectedParticipant.metrics[metric]}
                  compact
                  danger={['dependence', 'fatigue', 'shame', 'fear', 'financialPressure'].includes(
                    metric,
                  )}
                />
              ))}
            </div>
          </div>

          <div className="panel hand-panel">
            <PanelTitle kicker="ход" title="Карты недели" />
            <div className="card-hand">
              {game.hand.map((card) => (
                <GameCard
                  key={card.id}
                  card={card}
                  disabled={Boolean(game.finale)}
                  onPlay={handleCardPlay}
                />
              ))}
            </div>
          </div>
        </section>

        <aside className="side-stack">
          <section className="panel log-panel">
            <PanelTitle kicker="дело" title="Журнал" />
            <div className="log-list">
              {game.logs.map((entry, index) => (
                <article className={`log-entry ${entry.tone}`} key={`${entry.turn}-${entry.title}-${index}`}>
                  <span>Неделя {entry.turn}</span>
                  <strong>{entry.title}</strong>
                  <p>{entry.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel flags-panel">
            <PanelTitle kicker="скрытый слой" title="Красные флаги" />
            {game.revealedRedFlags.length === 0 ? (
              <p className="empty">Пока видна обычная упаковка марафона.</p>
            ) : (
              <ul>
                {game.revealedRedFlags.slice(-6).map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </section>

      {game.finale && (
        <section className="finale panel">
          <PanelTitle kicker="финальный разбор" title={game.finale.title} />
          <p>{game.finale.summary}</p>
          <div className="debrief-grid">
            <div>
              <h3>Индекс исхода</h3>
              <strong className="score">{game.finale.score}</strong>
            </div>
            <div>
              <h3>Теги разбора</h3>
              <ul className="debrief-terms">
                {game.debriefTags.slice(0, 10).map((tag) => {
                  const term = debriefIndex.get(tag)
                  return (
                    <li key={tag}>
                      <strong>{term?.title ?? tag}</strong>
                      {term ? <p>{term.description}</p> : null}
                    </li>
                  )
                })}
              </ul>
            </div>
            <div>
              <h3>Что попало в дело</h3>
              <ul>
                {game.finale.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

const PanelTitle = ({ kicker, title }: { kicker: string; title: string }) => (
  <div className="panel-title">
    <span>{kicker}</span>
    <h2>{title}</h2>
  </div>
)

const MetricBar = ({
  label,
  value,
  compact = false,
  danger = false,
}: {
  label: string
  value: number
  compact?: boolean
  danger?: boolean
}) => (
  <div className={`metric ${compact ? 'compact' : ''}`}>
    <div className="metric-top">
      <span>{label}</span>
      <strong>{Math.round(value)}</strong>
    </div>
    <div className="bar-track">
      <div className={`bar-fill ${danger ? 'danger' : ''}`} style={{ width: `${value}%` }} />
    </div>
  </div>
)

const ParticipantCard = ({
  participant,
  active,
  onSelect,
}: {
  participant: Participant
  active: boolean
  onSelect: () => void
}) => {
  const risk = Math.round(
    (participant.metrics.dependence +
      participant.metrics.fatigue +
      participant.metrics.shame +
      participant.metrics.financialPressure +
      (100 - participant.metrics.autonomy)) /
      5,
  )

  return (
    <button type="button" className={`participant-card ${active ? 'active' : ''}`} onClick={onSelect}>
      <div className="avatar">{participant.name.slice(0, 1)}</div>
      <div>
        <strong>{participant.name}</strong>
        <span>{participant.need}</span>
      </div>
      <small>риск {risk}</small>
    </button>
  )
}

const GameCard = ({
  card,
  disabled,
  onPlay,
}: {
  card: Card
  disabled: boolean
  onPlay: (cardId: string) => void
}) => (
  <article className={`game-card ${card.type}`}>
    <div className="card-head">
      <span>{card.type === 'practice' ? 'практика' : card.type === 'crisis' ? 'кризис' : 'защита'}</span>
      <small>ур. {card.tier}</small>
    </div>
    <h3>{card.title}</h3>
    <p>{card.surface}</p>
    <details>
      <summary>скрытая логика прототипа</summary>
      <p>{card.intent}</p>
      <div className="tags">
        {card.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </details>
    <button type="button" disabled={disabled} onClick={() => onPlay(card.id)}>
      выбрать
    </button>
  </article>
)

export default App
