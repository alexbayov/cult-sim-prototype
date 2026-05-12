import { useMemo, useState } from 'react'
import DossierApp from './investigation/DossierApp'
import CaseSelectScreen from './investigation/CaseSelectScreen'
import OnboardingGuide from './investigation/OnboardingGuide'
import { investigationContents } from './game/investigation/data'
import type { InvestigationContent } from './game/investigation/types'
import seasonManifest from './game/seasons/season-01.json'

const GUIDE_SEEN_KEY = 'dossier-onboarding-seen-v1'

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
  cases: ReadonlyArray<InvestigationContent>,
): ReadonlyArray<InvestigationContent> {
  const byId = new Map(cases.map((c) => [c.case.id, c]))
  const ordered: InvestigationContent[] = []
  const seen = new Set<string>()
  for (const id of caseIds) {
    const content = byId.get(id)
    if (!content || seen.has(id)) continue
    ordered.push(content)
    seen.add(id)
  }
  for (const content of cases) {
    if (seen.has(content.case.id)) continue
    ordered.push(content)
    seen.add(content.case.id)
  }
  return ordered
}

function App() {
  const [activeContent, setActiveContent] =
    useState<InvestigationContent | null>(null)
  // First-run: open the guide automatically the first time the start screen
  // is shown. Subsequent loads remember the dismissal in localStorage so the
  // overlay doesn't get in the way. The "как это работает" link on the start
  // screen is always available to re-open it.
  const [guideOpen, setGuideOpen] = useState<boolean>(() => !readGuideSeen())

  const seasonOrderedCases = useMemo(
    () => orderCasesBySeason(seasonManifest.caseIds, investigationContents),
    [],
  )
  const season = useMemo(
    () => ({
      title: seasonManifest.title,
      subtitle: seasonManifest.subtitle,
    }),
    [],
  )

  const handleSelect = (content: InvestigationContent) => {
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
        <DossierApp content={activeContent} onBackToCases={handleBack} />
      ) : (
        <CaseSelectScreen
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
