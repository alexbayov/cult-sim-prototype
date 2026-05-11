// Tiny "what now?" hint shown in the dossier header. Picks a single short
// line based on the current selection state. Intentionally not verbose:
// at most one sentence, no scaling icons, no animations.

import type { ReactElement } from 'react'

export type ProgressNudgeProps = {
  selectedCount: number
  unlockedMaterialCount: number
  initialMaterialCount: number
  confirmedPatternCount: number
  isReportSubmitted: boolean
}

type Nudge = {
  tone: 'idle' | 'progress' | 'unlock' | 'ready'
  text: string
}

function pickNudge({
  selectedCount,
  unlockedMaterialCount,
  initialMaterialCount,
  confirmedPatternCount,
  isReportSubmitted,
}: ProgressNudgeProps): Nudge | null {
  if (isReportSubmitted) return null

  if (selectedCount === 0) {
    return { tone: 'idle', text: 'Поставьте первую закладку в материале.' }
  }

  if (confirmedPatternCount >= 2) {
    return { tone: 'ready', text: 'Можно сформировать сводку.' }
  }

  if (unlockedMaterialCount > initialMaterialCount) {
    return { tone: 'unlock', text: 'Открылся новый материал.' }
  }

  return {
    tone: 'progress',
    text: 'Ищите повторяющийся сигнал в другом материале.',
  }
}

export default function ProgressNudge(props: ProgressNudgeProps): ReactElement | null {
  const nudge = pickNudge(props)
  if (!nudge) return null

  return (
    <p className={'dossier-progress-nudge is-tone-' + nudge.tone}>
      <span className="dossier-progress-nudge-icon" aria-hidden="true">
        →
      </span>
      <span className="dossier-progress-nudge-text">{nudge.text}</span>
    </p>
  )
}
