// Lightweight first-run guide. Shows a small modal-style overlay with five
// short steps that describe the gameplay loop in neutral language:
// фрагмент / закладка / наблюдение / сводка. Dismissed via a button;
// dismissal is persisted in localStorage so first-time players only see
// it once, but it's still reachable from the case-select screen by an
// explicit "как это работает" link.

import { useEffect, type ReactElement } from 'react'

export type OnboardingGuideProps = {
  open: boolean
  onClose: () => void
}

type Step = {
  id: string
  text: string
}

const STEPS: ReadonlyArray<Step> = [
  { id: '1', text: 'Откройте материал и прочитайте фрагменты.' },
  { id: '2', text: 'Сделайте закладку на фразе, которая меняет контекст.' },
  { id: '3', text: 'Закладки могут открыть новые материалы.' },
  { id: '4', text: 'Наблюдения собираются из нескольких фрагментов.' },
  { id: '5', text: 'Когда будет достаточно — сформируйте сводку.' },
]

export default function OnboardingGuide({
  open,
  onClose,
}: OnboardingGuideProps): ReactElement | null {
  useEffect(() => {
    if (!open) return undefined
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="dossier-onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      onClick={onClose}
    >
      <div
        className="dossier-onboarding-card"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dossier-onboarding-head">
          <p className="dossier-onboarding-eyebrow">первое знакомство</p>
          <h2 id="onboarding-title">как работают материалы</h2>
        </header>
        <ol className="dossier-onboarding-steps">
          {STEPS.map((step) => (
            <li key={step.id} className="dossier-onboarding-step">
              <span
                className="dossier-onboarding-step-number"
                aria-hidden="true"
              >
                {step.id}
              </span>
              <p className="dossier-onboarding-step-text">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="dossier-onboarding-note">
          Язык работы намеренно нейтральный: «фрагмент», «закладка»,
          «наблюдение», «сводка». Это рабочая папка, не приговор.
        </p>
        <div className="dossier-onboarding-actions">
          <button
            type="button"
            className="dossier-onboarding-close"
            onClick={onClose}
          >
            понятно, начать
          </button>
        </div>
      </div>
    </div>
  )
}
