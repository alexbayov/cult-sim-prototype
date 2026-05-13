import type { ReactElement } from 'react'
import type { CaseV2, Contact } from '../game/investigation/types'
import { contactIsUnlocked } from './state'
import type { SaveState } from './state'

type ContactsPaneProps = {
  content: CaseV2
  state: SaveState
  readOnly: boolean
  onOpenInterview: (interviewId: string) => void
}

const gateText = (content: CaseV2, contact: Contact): string => {
  const gate = contact.gateRequirement
  if (!gate) return 'закрыто'
  const parts: string[] = []
  if (gate.requiredHypothesis) {
    const hypothesis = content.hypotheses.find(
      (item) => item.id === gate.requiredHypothesis,
    )
    parts.push(
      `${gate.minSupportingPhrases ?? 1} фразы на гипотезе ${
        hypothesis?.label ?? gate.requiredHypothesis
      }`,
    )
  }
  if (gate.requiredDocumentId) {
    const document = content.documents.find((item) => item.id === gate.requiredDocumentId)
    const action = content.actions.find((item) =>
      item.effects.some(
        (effect) =>
          effect.kind === 'unlockDocument' &&
          effect.documentId === gate.requiredDocumentId,
      ),
    )
    parts.push(
      action
        ? `действие «${action.label}»`
        : `документ «${document?.title ?? gate.requiredDocumentId}»`,
    )
  }
  return `нужно: ${parts.join(' + ')}`
}

export default function ContactsPane({
  content,
  state,
  readOnly,
  onOpenInterview,
}: ContactsPaneProps): ReactElement {
  return (
    <section className="workspace-panel workspace-contacts">
      <header className="workspace-panel-head">
        <p className="workspace-eyebrow">Контакты по делу</p>
      </header>
      <div className="workspace-contact-list">
        {content.contacts.map((contact) => {
          const unlocked = contactIsUnlocked(content, state, contact.id)
          return (
            <button
              type="button"
              key={contact.id}
              className={[
                'workspace-contact-card',
                unlocked ? 'is-unlocked' : 'is-locked',
                contact.initialState === 'public' ? 'is-public' : '',
              ].join(' ')}
              disabled={!unlocked}
              title={unlocked ? 'открыть интервью' : gateText(content, contact)}
              onClick={() => {
                if (unlocked) onOpenInterview(contact.interviewId)
              }}
            >
              <span className="workspace-contact-dot" />
              <strong>{contact.name}</strong>
              <small>{contact.role}</small>
              {!unlocked ? <span aria-hidden="true">🔒</span> : null}
              {readOnly && state.completedInterviews.includes(contact.interviewId) ? (
                <em>запись</em>
              ) : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}
