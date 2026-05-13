import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { CaseV2 } from '../game/investigation/types'
import ActionsPane from './ActionsPane'
import ContactsPane from './ContactsPane'
import DocumentsPane from './DocumentsPane'
import InterviewScreen from './InterviewScreen'
import MobileBottomSheet from './MobileBottomSheet'
import NotebookPane from './NotebookPane'
import { contactIsUnlocked } from './state'
import type { SaveState, WorkspaceHighlight } from './state'

type WorkspaceScreenProps = {
  content: CaseV2
  state: SaveState
  readOnly: boolean
  setState: (updater: (state: SaveState) => SaveState) => void
  onBackToCases: () => void
}

export default function WorkspaceScreen({
  content,
  state,
  readOnly,
  setState,
  onBackToCases,
}: WorkspaceScreenProps): ReactElement {
  const [activeDocumentId, setActiveDocumentId] = useState(
    state.visibleDocumentIds[0] ?? content.documents[0]?.id ?? '',
  )
  const [showActionsPulse, setShowActionsPulse] = useState(false)
  const spent = content.actionBudget - state.remainingBudget
  const resolvedActiveDocumentId = state.visibleDocumentIds.includes(activeDocumentId)
    ? activeDocumentId
    : state.visibleDocumentIds[0] ?? content.documents[0]?.id ?? ''

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return
      if (readOnly || state.highlights.length === 0) return
      event.preventDefault()
      setState((current) => ({
        ...current,
        highlights: current.highlights.slice(0, -1),
      }))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [readOnly, setState, state.highlights.length])

  const addHighlight = (highlight: WorkspaceHighlight) => {
    setState((current) => {
      const nextHighlights = [...current.highlights, highlight]
      const gatedContacts = content.contacts
        .filter((contact) =>
          contactIsUnlocked(content, { ...current, highlights: nextHighlights }, contact.id),
        )
        .map((contact) => contact.id)
      return {
        ...current,
        highlights: nextHighlights,
        unlockedContactIds: [...new Set([...current.unlockedContactIds, ...gatedContacts])],
      }
    })
  }

  const notebook = useMemo(
    () => (
      <NotebookPane
        content={content}
        highlights={state.highlights}
        readOnly={readOnly}
        onRemoveHighlight={(highlightId) =>
          setState((current) => ({
            ...current,
            highlights: current.highlights.filter((item) => item.id !== highlightId),
          }))
        }
        onSubmit={() => setState((current) => ({ ...current, screen: 'submit' }))}
      />
    ),
    [content, readOnly, setState, state.highlights],
  )

  const contacts = useMemo(
    () => (
      <ContactsPane
        content={content}
        state={state}
        readOnly={readOnly}
        onOpenInterview={(interviewId) =>
          setState((current) => ({
            ...current,
            screen: 'interview',
            activeInterviewId: interviewId,
            interviewChoiceHistory: {
              ...current.interviewChoiceHistory,
              [interviewId]:
                current.interviewChoiceHistory[interviewId] ??
                [
                  content.interviews.find((interview) => interview.id === interviewId)
                    ?.startNodeId ?? '',
                ].filter(Boolean),
            },
          }))
        }
      />
    ),
    [content, readOnly, setState, state],
  )

  const actions = useMemo(
    () => (
      <ActionsPane
        content={content}
        state={state}
        readOnly={readOnly}
        onRunAction={(actionId) => {
          const action = content.actions.find((item) => item.id === actionId)
          if (!action) return
          setState((current) => {
            if (
              current.performedActionIds.includes(action.id) ||
              action.cost > current.remainingBudget
            ) {
              return current
            }
            const visibleDocumentIds = new Set(current.visibleDocumentIds)
            const unlockedContactIds = new Set(current.unlockedContactIds)
            for (const effect of action.effects) {
              if (effect.kind === 'unlockDocument') visibleDocumentIds.add(effect.documentId)
              if (effect.kind === 'unlockContact') unlockedContactIds.add(effect.contactId)
            }
            return {
              ...current,
              visibleDocumentIds: [...visibleDocumentIds],
              unlockedContactIds: [...unlockedContactIds],
              performedActionIds: [...current.performedActionIds, action.id],
              remainingBudget: current.remainingBudget - action.cost,
            }
          })
        }}
      />
    ),
    [content, readOnly, setState, state],
  )

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <div>
          <strong>Дело: Прорыв</strong>
          <span>{content.protagonist.name}</span>
        </div>
        <div className="workspace-budget-pill">
          {spent} / {content.actionBudget} ⏳
        </div>
        <button type="button" className="workspace-secondary" onClick={onBackToCases}>
          Главное меню
        </button>
      </header>

      <div className="workspace-grid">
        <DocumentsPane
          content={content}
          activeDocumentId={resolvedActiveDocumentId}
          visibleDocumentIds={state.visibleDocumentIds}
          performedActionIds={state.performedActionIds}
          highlights={state.highlights}
          readOnly={readOnly}
          onSelectDocument={setActiveDocumentId}
          onAddHighlight={addHighlight}
          hintDismissed={state.dismissedHints.includes('highlight')}
          onHintDismissed={() =>
            setState((current) => ({
              ...current,
              dismissedHints: [...new Set([...current.dismissedHints, 'highlight'])],
            }))
          }
          onOpenActions={() => {
            setShowActionsPulse(true)
            window.setTimeout(() => setShowActionsPulse(false), 1000)
          }}
        />
        <div className="workspace-desktop-notebook">{notebook}</div>
        <aside className={showActionsPulse ? 'workspace-rail is-pulsed' : 'workspace-rail'}>
          {contacts}
          {actions}
        </aside>
      </div>

      <MobileBottomSheet notebook={notebook} contacts={contacts} actions={actions} />

      {state.screen === 'interview' && state.activeInterviewId ? (
        <InterviewScreen
          content={content}
          state={state}
          interviewId={state.activeInterviewId}
          readOnly={readOnly}
          onChoose={(nodeId) =>
            setState((current) => {
              const interviewId = current.activeInterviewId
              if (!interviewId) return current
              const history = current.interviewChoiceHistory[interviewId] ?? []
              return {
                ...current,
                interviewChoiceHistory: {
                  ...current.interviewChoiceHistory,
                  [interviewId]: [...history, nodeId],
                },
              }
            })
          }
          onClose={() =>
            setState((current) => {
              const completed = current.activeInterviewId
                ? [...new Set([...current.completedInterviews, current.activeInterviewId])]
                : current.completedInterviews
              return {
                ...current,
                screen: readOnly ? 'workspace-readonly' : 'workspace',
                activeInterviewId: undefined,
                completedInterviews: completed,
              }
            })
          }
        />
      ) : null}
    </main>
  )
}
