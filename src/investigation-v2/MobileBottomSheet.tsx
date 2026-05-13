import { useState, type ReactElement, type ReactNode } from 'react'

type MobileBottomSheetProps = {
  notebook: ReactNode
  contacts: ReactNode
  actions: ReactNode
}

type TabId = 'notebook' | 'contacts' | 'actions'

export default function MobileBottomSheet({
  notebook,
  contacts,
  actions,
}: MobileBottomSheetProps): ReactElement {
  const [active, setActive] = useState<TabId>('notebook')
  const [expanded, setExpanded] = useState(false)
  const body = active === 'notebook' ? notebook : active === 'contacts' ? contacts : actions
  return (
    <aside className={`workspace-mobile-sheet ${expanded ? 'is-expanded' : ''}`}>
      <nav>
        {[
          ['notebook', 'Блокнот'],
          ['contacts', 'Контакты'],
          ['actions', 'Действия'],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={active === id ? 'is-active' : ''}
            onClick={() => {
              setActive(id as TabId)
              setExpanded(active !== id || !expanded)
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="workspace-mobile-sheet-body">{body}</div>
    </aside>
  )
}
