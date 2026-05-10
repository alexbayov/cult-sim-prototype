import type { Card, ComboRule, GroupState, Participant } from './types'

export type ScenarioContent = {
  id: string
  title: string
  premise: string
  initialGroup: GroupState
  participants: Participant[]
  cards: Card[]
  comboRules: ComboRule[]
}

export const validateScenarioContent = (scenario: ScenarioContent) => {
  const errors: string[] = []
  const cardIds = new Set<string>()
  const participantIds = new Set<string>()

  for (const card of scenario.cards) {
    if (cardIds.has(card.id)) errors.push(`Duplicate card id: ${card.id}`)
    cardIds.add(card.id)
    if (card.tags.length === 0) errors.push(`Card has no tags: ${card.id}`)
    if (card.effects.length === 0) errors.push(`Card has no effects: ${card.id}`)
    if (card.redFlags.length === 0) errors.push(`Card has no red flags: ${card.id}`)
    if (card.debriefTags.length === 0) errors.push(`Card has no debrief tags: ${card.id}`)
  }

  for (const participant of scenario.participants) {
    if (participantIds.has(participant.id)) errors.push(`Duplicate participant id: ${participant.id}`)
    participantIds.add(participant.id)
  }

  for (const comboRule of scenario.comboRules) {
    if (comboRule.requiredTags.length < 2) {
      errors.push(`Combo requires fewer than two tags: ${comboRule.id}`)
    }
  }

  return errors
}
