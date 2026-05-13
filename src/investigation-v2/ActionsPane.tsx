import type { ReactElement } from 'react'
import type { CaseV2 } from '../game/investigation/types'
import type { SaveState } from './state'

type ActionsPaneProps = {
  content: CaseV2
  state: SaveState
  readOnly: boolean
  onRunAction: (actionId: string) => void
}

export default function ActionsPane({
  content,
  state,
  readOnly,
  onRunAction,
}: ActionsPaneProps): ReactElement {
  const spent = content.actionBudget - state.remainingBudget
  const percent =
    content.actionBudget === 0 ? 0 : Math.min(100, (spent / content.actionBudget) * 100)
  return (
    <section className="workspace-panel workspace-actions">
      <header className="workspace-panel-head">
        <p className="workspace-eyebrow">Действия</p>
        <strong>
          {spent} / {content.actionBudget} ⏳
        </strong>
        <span className="workspace-budget-track">
          <span style={{ width: `${percent}%` }} />
        </span>
      </header>
      <div className="workspace-action-list">
        {content.actions.map((action) => {
          const performed = state.performedActionIds.includes(action.id)
          const tooExpensive = action.cost > state.remainingBudget
          return (
            <button
              type="button"
              key={action.id}
              className={[
                'workspace-action-card',
                performed ? 'is-performed' : '',
              ].join(' ')}
              disabled={readOnly || performed || tooExpensive}
              title={tooExpensive ? 'не хватает бюджета' : action.description}
              onClick={() => onRunAction(action.id)}
            >
              <span>
                <strong>{action.label}</strong>
                <small>{action.description}</small>
              </span>
              <em>{performed ? 'выполнено' : `${action.cost} ⏳`}</em>
            </button>
          )
        })}
      </div>
    </section>
  )
}
