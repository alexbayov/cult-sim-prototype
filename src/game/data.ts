import scenario from './scenarios/info-business-marathon/scenario.json'
import participants from './scenarios/info-business-marathon/participants.json'
import cards from './scenarios/info-business-marathon/cards.json'
import combos from './scenarios/info-business-marathon/combos.json'
import finales from './scenarios/info-business-marathon/finales.json'
import debrief from './scenarios/info-business-marathon/debrief.json'
import type { ScenarioContent } from './contentSchema'

export const infoBusinessMarathonScenario = {
  ...scenario,
  participants,
  cards,
  comboRules: combos,
  finales,
  debriefTerms: debrief,
} as ScenarioContent
