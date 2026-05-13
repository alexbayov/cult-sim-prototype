import type { ReactElement } from 'react'
import type { CaseV2, InterviewNode } from '../game/investigation/types'
import { countEntriesForHypothesis } from './state'
import type { SaveState } from './state'

type InterviewScreenProps = {
  content: CaseV2
  state: SaveState
  interviewId: string
  readOnly: boolean
  onChoose: (nodeId: string) => void
  onClose: () => void
}

const choiceLetter = (index: number): string => String.fromCharCode(1040 + index)

export default function InterviewScreen({
  content,
  state,
  interviewId,
  readOnly,
  onChoose,
  onClose,
}: InterviewScreenProps): ReactElement | null {
  const interview = content.interviews.find((item) => item.id === interviewId)
  if (!interview) return null
  const contact = content.contacts.find((item) => item.id === interview.contactId)
  const history = state.interviewChoiceHistory[interview.id] ?? [interview.startNodeId]
  const currentNodeId = history.at(-1) ?? interview.startNodeId
  const current = interview.nodes.find((node) => node.id === currentNodeId)
  const transcriptNodes = history
    .map((nodeId) => interview.nodes.find((node) => node.id === nodeId))
    .filter((node): node is InterviewNode => Boolean(node))
  if (!current) return null

  return (
    <div className="workspace-interview-backdrop" role="dialog" aria-modal="true">
      <section className="workspace-interview">
        <header>
          <div>
            <p className="workspace-eyebrow">интервью</p>
            <h2>{contact?.name ?? interview.id}</h2>
            <p>{contact?.role}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="закрыть">
            ×
          </button>
        </header>

        <div className="workspace-interview-body">
          {transcriptNodes.map((node) => (
            <article
              key={node.id}
              className={`workspace-bubble is-${node.speaker}`}
            >
              <strong>
                {node.speaker === 'expert' ? content.protagonist.name : contact?.name}
              </strong>
              <p>{node.text}</p>
            </article>
          ))}
        </div>

        <footer className="workspace-interview-actions">
          {current.choices?.map((choice, index) => {
            const enabled =
              !choice.requiresPhraseFromHypothesis ||
              countEntriesForHypothesis(
                content,
                state.highlights,
                choice.requiresPhraseFromHypothesis,
              ) > 0
            const hypothesis = content.hypotheses.find(
              (item) => item.id === choice.requiresPhraseFromHypothesis,
            )
            return (
              <button
                type="button"
                key={choice.id}
                disabled={readOnly || !enabled}
                title={
                  enabled
                    ? 'подкреплено фразой'
                    : `нужна фраза в гипотезе ${hypothesis?.label ?? ''}`
                }
                onClick={() => onChoose(choice.next)}
              >
                <span>Вариант {choiceLetter(index)}</span>
                {choice.label}
              </button>
            )
          })}
          {!current.choices && current.next ? (
            <button type="button" disabled={readOnly} onClick={() => onChoose(current.next!)}>
              Дальше →
            </button>
          ) : null}
          {!current.choices && !current.next ? (
            <button type="button" onClick={onClose}>
              Завершить
            </button>
          ) : null}
          {readOnly ? (
            <button type="button" onClick={onClose}>
              закрыть запись
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  )
}
