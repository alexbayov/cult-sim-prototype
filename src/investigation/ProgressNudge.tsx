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
  // Titles of materials that opened up beyond the case's initial set,
  // so the nudge can name what just appeared instead of just saying
  // "open new material". May be empty.
  unlockedSinceStartTitles?: ReadonlyArray<string>
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
  unlockedSinceStartTitles,
}: ProgressNudgeProps): Nudge | null {
  if (isReportSubmitted) return null

  if (selectedCount === 0) {
    return { tone: 'idle', text: 'Поставьте первую закладку в материале.' }
  }

  if (confirmedPatternCount >= 4) {
    return {
      tone: 'ready',
      text: 'Достаточно связей для сильной сводки.',
    }
  }

  if (confirmedPatternCount >= 2) {
    const remaining = 4 - confirmedPatternCount
    return {
      tone: 'ready',
      text:
        'Уже можно собрать раннюю сводку. Для сильной нужно ещё ' +
        remaining +
        ' ' +
        (remaining === 1 ? 'связь' : 'связи') +
        '.',
    }
  }

  if (unlockedMaterialCount > initialMaterialCount) {
    const titles = unlockedSinceStartTitles ?? []
    if (titles.length === 1) {
      return {
        tone: 'unlock',
        text: `Открылся новый материал: «${titles[0]}».`,
      }
    }
    if (titles.length >= 2) {
      return {
        tone: 'unlock',
        text: `Открылись новые материалы (${titles.length}). Например, «${titles[0]}».`,
      }
    }
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
