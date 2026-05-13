import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import DossierApp from './investigation/DossierApp'
import CaseSelectScreenV2 from './investigation-v2/CaseSelectScreenV2'
import type { CaseListItem } from './investigation-v2/v2Picker'
import OnboardingGuide from './investigation/OnboardingGuide'
import { investigationContents, v2Cases } from './game/investigation/data'
import seasonManifest from './game/seasons/season-01.json'
import { initYandex } from './platform/yandex'

const GUIDE_SEEN_KEY = 'dossier-onboarding-seen-v1'
const WorkspaceApp = lazy(() => import('./investigation-v2/WorkspaceApp'))

function readGuideSeen(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return Boolean(window.localStorage.getItem(GUIDE_SEEN_KEY))
  } catch {
    return true
  }
}

// Resolve the active season's case order against the bundled investigation
// contents. The season JSON is the source of truth for picker ordering; any
// case it references that isn't bundled is skipped silently, and any bundled
// case not in the season list is appended so nothing gets dropped from the
// build during content iteration.
function orderCasesBySeason(
  caseIds: ReadonlyArray<string>,
  cases: ReadonlyArray<CaseListItem>,
): ReadonlyArray<CaseListItem> {
  const byId = new Map(cases.map((c) => [c.id, c]))
  const ordered: CaseListItem[] = []
  const seen = new Set<string>()
  for (const id of caseIds) {
    const content = byId.get(id)
    if (!content || seen.has(id)) continue
    ordered.push(content)
    seen.add(id)
  }
  for (const content of cases) {
    if (seen.has(content.id)) continue
    ordered.push(content)
    seen.add(content.id)
  }
  return ordered
}

function App() {
  const [activeContent, setActiveContent] = useState<CaseListItem | null>(null)
  // First-run: open the guide automatically the first time the start screen
  // is shown. Subsequent loads remember the dismissal in localStorage so the
  // overlay doesn't get in the way. The "как это работает" link on the start
  // screen is always available to re-open it.
  const [guideOpen, setGuideOpen] = useState<boolean>(() => !readGuideSeen())

  const seasonOrderedCases = useMemo(
    () =>
      orderCasesBySeason(seasonManifest.caseIds, [
        ...investigationContents.map((content) => ({
          kind: 'v1' as const,
          id: content.case.id,
          content,
        })),
        ...v2Cases.map((content) => ({
          kind: 'v2' as const,
          id: content.id,
          content,
        })),
      ]),
    [],
  )
  const season = useMemo(
    () => ({
      title: seasonManifest.title,
      subtitle: seasonManifest.subtitle,
    }),
    [],
  )

  // Initialise the Yandex Games SDK adapter once. The resolved instance is
  // held inside `src/platform/yandex.ts` and read via `getYandexSdk()` by
  // future consumers (Wave 3 — see docs/YANDEX_INTEGRATION.md).
  useEffect(() => {
    initYandex()
  }, [])

  const handleSelect = (content: CaseListItem) => {
    setActiveContent(content)
  }

  const handleBack = () => {
    setActiveContent(null)
  }

  const handleCloseGuide = () => {
    setGuideOpen(false)
    try {
      window.localStorage.setItem(GUIDE_SEEN_KEY, '1')
    } catch {
      // No-op if storage is blocked.
    }
  }

  const handleOpenGuide = () => {
    setGuideOpen(true)
  }

  return (
    <>
      {activeContent ? (
        activeContent.kind === 'v2' ? (
          <Suspense fallback={<div className="workspace-loading">Загрузка дела…</div>}>
            <WorkspaceApp content={activeContent.content} onBackToCases={handleBack} />
          </Suspense>
        ) : (
          <DossierApp content={activeContent.content} onBackToCases={handleBack} />
        )
      ) : (
        <CaseSelectScreenV2
          cases={seasonOrderedCases}
          season={season}
          onSelect={handleSelect}
          onOpenGuide={handleOpenGuide}
        />
      )}
      <OnboardingGuide open={guideOpen} onClose={handleCloseGuide} />
    </>
  )
}

export default App
