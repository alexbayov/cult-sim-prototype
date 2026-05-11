import { useState } from 'react'
import DossierApp from './investigation/DossierApp'
import CaseSelectScreen from './investigation/CaseSelectScreen'
import OnboardingGuide from './investigation/OnboardingGuide'
import { investigationContents } from './game/investigation/data'
import type { InvestigationContent } from './game/investigation/types'

const GUIDE_SEEN_KEY = 'dossier-onboarding-seen-v1'

function readGuideSeen(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return Boolean(window.localStorage.getItem(GUIDE_SEEN_KEY))
  } catch {
    return true
  }
}

function App() {
  const [activeContent, setActiveContent] =
    useState<InvestigationContent | null>(null)
  // First-run: open the guide automatically the first time the start screen
  // is shown. Subsequent loads remember the dismissal in localStorage so the
  // overlay doesn't get in the way. The "как это работает" link on the start
  // screen is always available to re-open it.
  const [guideOpen, setGuideOpen] = useState<boolean>(() => !readGuideSeen())

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
          cases={investigationContents}
          onSelect={handleSelect}
          onOpenGuide={handleOpenGuide}
        />
      )}
      <OnboardingGuide open={guideOpen} onClose={handleCloseGuide} />
    </>
  )
}

export default App
