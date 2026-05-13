import type { ReactElement } from 'react'
import type { CaseV2 } from '../game/investigation/types'
import BriefScreen from './BriefScreen'
import EpilogueScreen from './EpilogueScreen'
import { resolveEpilogueId } from './epilogueResolver'
import SubmitScreen from './SubmitScreen'
import { useWorkspaceState } from './useWorkspaceState'
import WorkspaceScreen from './WorkspaceScreen'
import './workspace.css'

type WorkspaceAppProps = {
  content: CaseV2
  onBackToCases: () => void
}

export default function WorkspaceApp({
  content,
  onBackToCases,
}: WorkspaceAppProps): ReactElement {
  const { state, savedStateExists, setState, reset } = useWorkspaceState(content)

  if (state.screen === 'intro') {
    return (
      <BriefScreen
        content={content}
        hasSave={savedStateExists}
        onAccept={() => setState((current) => ({ ...current, screen: 'workspace' }))}
        onBackToCases={onBackToCases}
        onReset={reset}
      />
    )
  }

  if (state.screen === 'submit') {
    return (
      <SubmitScreen
        content={content}
        state={state}
        onBack={() => setState((current) => ({ ...current, screen: 'workspace' }))}
        onConfirm={(recommendationId) =>
          setState((current) => ({
            ...current,
            screen: 'epilogue',
            selectedRecommendationId: recommendationId,
            resolvedEpilogueId: resolveEpilogueId(
              content,
              recommendationId,
              current,
            ),
          }))
        }
      />
    )
  }

  if (state.screen === 'epilogue') {
    return (
      <EpilogueScreen
        content={content}
        state={state}
        onReturnToWorkspace={() =>
          setState((current) => ({ ...current, screen: 'workspace-readonly' }))
        }
        onBackToCases={onBackToCases}
        onReset={reset}
      />
    )
  }

  return (
    <WorkspaceScreen
      content={content}
      state={state}
      readOnly={state.screen === 'workspace-readonly'}
      setState={setState}
      onBackToCases={onBackToCases}
    />
  )
}
