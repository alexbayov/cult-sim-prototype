import scenario from './scenarios/info-business-marathon/scenario.json'
import participants from './scenarios/info-business-marathon/participants.json'
import cards from './scenarios/info-business-marathon/cards.json'
import combos from './scenarios/info-business-marathon/combos.json'
import type { ScenarioContent } from './contentSchema'

export const infoBusinessMarathonScenario = {
  ...scenario,
  participants,
  cards,
  comboRules: combos,
} as ScenarioContent
