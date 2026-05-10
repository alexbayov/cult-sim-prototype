#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const scenariosDir = join(repoRoot, 'src/game/scenarios')

const GROUP_METRICS = [
  'involvement',
  'trust',
  'money',
  'legitimacy',
  'harm',
  'doubt',
  'visibility',
  'leaderControl',
  'radicalization',
  'resistance',
]

const PARTICIPANT_METRICS = [
  'trust',
  'autonomy',
  'dependence',
  'doubt',
  'fatigue',
  'shame',
  'fear',
  'financialPressure',
  'exitReadiness',
  'recruitReadiness',
]

const CARD_TYPES = ['practice', 'crisis', 'counter']
const CARD_TIERS = [1, 2, 3]
const PARTICIPANT_SELECTORS = ['all', 'vulnerable', 'lowProtection', 'highDoubt', 'highTrust']

const REQUIRED_FILES = ['scenario.json', 'participants.json', 'cards.json', 'combos.json']
const OPTIONAL_FILES = ['finales.json', 'debrief.json']

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0
const isNumberInRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
const isPositiveInteger = (v) => typeof v === 'number' && Number.isInteger(v) && v > 0

const loadJson = (filePath, errors) => {
  let raw
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (e) {
    errors.push(`${filePath}: cannot read file (${e.message})`)
    return null
  }
  try {
    return JSON.parse(raw)
  } catch (e) {
    errors.push(`${filePath}: invalid JSON (${e.message})`)
    return null
  }
}

const validateEffect = (effect, label, errors) => {
  if (!effect || typeof effect !== 'object' || Array.isArray(effect)) {
    errors.push(`${label} must be an object`)
    return
  }
  if (typeof effect.delta !== 'number' || !Number.isFinite(effect.delta)) {
    errors.push(`${label}.delta must be a finite number`)
  }
  if (effect.scope === 'group') {
    if (!GROUP_METRICS.includes(effect.metric)) {
      errors.push(
        `${label}.metric must be a group metric (got ${JSON.stringify(effect.metric)})`,
      )
    }
  } else if (effect.scope === 'participant') {
    if (!PARTICIPANT_METRICS.includes(effect.metric)) {
      errors.push(
        `${label}.metric must be a participant metric (got ${JSON.stringify(effect.metric)})`,
      )
    }
    if (!PARTICIPANT_SELECTORS.includes(effect.selector)) {
      errors.push(
        `${label}.selector must be one of ${PARTICIPANT_SELECTORS.join(', ')} (got ${JSON.stringify(effect.selector)})`,
      )
    }
  } else {
    errors.push(`${label}.scope must be "group" or "participant" (got ${JSON.stringify(effect.scope)})`)
  }
}

const validateEffectsArray = (effects, label, errors) => {
  if (!Array.isArray(effects) || effects.length === 0) {
    errors.push(`${label} must be a non-empty array`)
    return
  }
  effects.forEach((effect, i) => validateEffect(effect, `${label}[${i}]`, errors))
}

const validateScenario = (scenario, errors) => {
  if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) {
    errors.push('scenario.json must be an object')
    return null
  }
  if (!isNonEmptyString(scenario.id)) errors.push('scenario.id must be a non-empty string')
  if (!isNonEmptyString(scenario.title)) errors.push('scenario.title must be a non-empty string')
  if (!isNonEmptyString(scenario.premise)) errors.push('scenario.premise must be a non-empty string')

  const initialGroup = scenario.initialGroup
  if (!initialGroup || typeof initialGroup !== 'object' || Array.isArray(initialGroup)) {
    errors.push('scenario.initialGroup must be an object')
  } else {
    for (const metric of GROUP_METRICS) {
      if (!(metric in initialGroup)) {
        errors.push(`scenario.initialGroup.${metric} is missing`)
      } else if (!isNumberInRange(initialGroup[metric], 0, 100)) {
        errors.push(`scenario.initialGroup.${metric} must be a number 0..100`)
      }
    }
    for (const key of Object.keys(initialGroup)) {
      if (!GROUP_METRICS.includes(key)) {
        errors.push(`scenario.initialGroup has unknown metric: ${key}`)
      }
    }
  }
  return scenario
}

const validateParticipants = (participants, errors) => {
  if (!Array.isArray(participants)) {
    errors.push('participants.json must be an array')
    return []
  }
  const seenIds = new Set()
  participants.forEach((p, i) => {
    const label = `participants[${i}]`
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      errors.push(`${label} must be an object`)
      return
    }
    if (!isNonEmptyString(p.id)) {
      errors.push(`${label}.id must be a non-empty string`)
    } else if (seenIds.has(p.id)) {
      errors.push(`${label}.id is duplicate: ${p.id}`)
    } else {
      seenIds.add(p.id)
    }
    for (const field of ['name', 'archetype', 'need', 'vulnerability', 'protection']) {
      if (!isNonEmptyString(p[field])) errors.push(`${label}.${field} must be a non-empty string`)
    }
    for (const field of ['protectionLevel', 'vulnerabilityLevel']) {
      if (!isNumberInRange(p[field], 0, 100)) errors.push(`${label}.${field} must be a number 0..100`)
    }
    if (!p.metrics || typeof p.metrics !== 'object' || Array.isArray(p.metrics)) {
      errors.push(`${label}.metrics must be an object`)
    } else {
      for (const metric of PARTICIPANT_METRICS) {
        if (!(metric in p.metrics)) {
          errors.push(`${label}.metrics.${metric} is missing`)
        } else if (!isNumberInRange(p.metrics[metric], 0, 100)) {
          errors.push(`${label}.metrics.${metric} must be 0..100`)
        }
      }
      for (const key of Object.keys(p.metrics)) {
        if (!PARTICIPANT_METRICS.includes(key)) {
          errors.push(`${label}.metrics has unknown metric: ${key}`)
        }
      }
    }
  })
  return participants
}

const validateStringArray = (value, label, errors, { minLength = 1 } = {}) => {
  if (!Array.isArray(value) || value.length < minLength) {
    errors.push(
      `${label} must be a non-empty array of strings${minLength > 1 ? ` (at least ${minLength})` : ''}`,
    )
    return false
  }
  let ok = true
  value.forEach((entry, i) => {
    if (!isNonEmptyString(entry)) {
      errors.push(`${label}[${i}] must be a non-empty string`)
      ok = false
    }
  })
  return ok
}

const validateCards = (cards, errors) => {
  if (!Array.isArray(cards)) {
    errors.push('cards.json must be an array')
    return []
  }
  const seenIds = new Set()
  cards.forEach((card, i) => {
    const label = `cards[${i}]`
    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      errors.push(`${label} must be an object`)
      return
    }
    if (!isNonEmptyString(card.id)) {
      errors.push(`${label}.id must be a non-empty string`)
    } else if (seenIds.has(card.id)) {
      errors.push(`${label}.id is duplicate: ${card.id}`)
    } else {
      seenIds.add(card.id)
    }
    for (const field of ['title', 'surface', 'intent']) {
      if (!isNonEmptyString(card[field])) errors.push(`${label}.${field} must be a non-empty string`)
    }
    if (!CARD_TYPES.includes(card.type)) {
      errors.push(`${label}.type must be one of ${CARD_TYPES.join(', ')} (got ${JSON.stringify(card.type)})`)
    }
    if (!CARD_TIERS.includes(card.tier)) {
      errors.push(`${label}.tier must be 1, 2, or 3 (got ${JSON.stringify(card.tier)})`)
    }
    validateStringArray(card.tags, `${label}.tags`, errors)
    validateEffectsArray(card.effects, `${label}.effects`, errors)
    validateStringArray(card.redFlags, `${label}.redFlags`, errors)
    validateStringArray(card.debriefTags, `${label}.debriefTags`, errors)
  })
  return cards
}

const validateCombos = (combos, knownTags, errors) => {
  if (!Array.isArray(combos)) {
    errors.push('combos.json must be an array')
    return []
  }
  const seenIds = new Set()
  combos.forEach((combo, i) => {
    const label = `combos[${i}]`
    if (!combo || typeof combo !== 'object' || Array.isArray(combo)) {
      errors.push(`${label} must be an object`)
      return
    }
    if (!isNonEmptyString(combo.id)) {
      errors.push(`${label}.id must be a non-empty string`)
    } else if (seenIds.has(combo.id)) {
      errors.push(`${label}.id is duplicate: ${combo.id}`)
    } else {
      seenIds.add(combo.id)
    }
    for (const field of ['title', 'redFlag']) {
      if (!isNonEmptyString(combo[field])) errors.push(`${label}.${field} must be a non-empty string`)
    }
    if (validateStringArray(combo.requiredTags, `${label}.requiredTags`, errors, { minLength: 2 })) {
      combo.requiredTags.forEach((tag, j) => {
        if (!knownTags.has(tag)) {
          errors.push(`${label}.requiredTags[${j}] does not exist in cards tags: ${tag}`)
        }
      })
    }
    if (!isPositiveInteger(combo.windowTurns)) {
      errors.push(`${label}.windowTurns must be a positive integer (got ${JSON.stringify(combo.windowTurns)})`)
    }
    validateEffectsArray(combo.effects, `${label}.effects`, errors)
    validateStringArray(combo.debriefTags, `${label}.debriefTags`, errors)
  })
  return combos
}

const validateFinales = (finales, errors) => {
  if (!Array.isArray(finales)) {
    errors.push('finales.json must be an array')
    return []
  }
  const seenIds = new Set()
  finales.forEach((finale, i) => {
    const label = `finales[${i}]`
    if (!finale || typeof finale !== 'object' || Array.isArray(finale)) {
      errors.push(`${label} must be an object`)
      return
    }
    if (!isNonEmptyString(finale.id)) {
      errors.push(`${label}.id must be a non-empty string`)
    } else if (seenIds.has(finale.id)) {
      errors.push(`${label}.id is duplicate: ${finale.id}`)
    } else {
      seenIds.add(finale.id)
    }
    for (const field of ['title', 'summary']) {
      if (!isNonEmptyString(finale[field])) errors.push(`${label}.${field} must be a non-empty string`)
    }
  })
  return finales
}

const validateDebrief = (entries, errors) => {
  if (!Array.isArray(entries)) {
    errors.push('debrief.json must be an array')
    return []
  }
  const seenTags = new Set()
  entries.forEach((entry, i) => {
    const label = `debrief[${i}]`
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${label} must be an object`)
      return
    }
    if (!isNonEmptyString(entry.tag)) {
      errors.push(`${label}.tag must be a non-empty string`)
    } else if (seenTags.has(entry.tag)) {
      errors.push(`${label}.tag is duplicate: ${entry.tag}`)
    } else {
      seenTags.add(entry.tag)
    }
    for (const field of ['title', 'description']) {
      if (!isNonEmptyString(entry[field])) errors.push(`${label}.${field} must be a non-empty string`)
    }
  })
  return entries
}

const collectKnownTags = (cards) => {
  const tags = new Set()
  if (!Array.isArray(cards)) return tags
  for (const card of cards) {
    if (card && Array.isArray(card.tags)) {
      for (const tag of card.tags) {
        if (typeof tag === 'string' && tag.length > 0) tags.add(tag)
      }
    }
  }
  return tags
}

const collectDebriefTagsFromCards = (cards) => {
  const tags = new Set()
  if (!Array.isArray(cards)) return tags
  for (const card of cards) {
    if (card && Array.isArray(card.debriefTags)) {
      for (const tag of card.debriefTags) {
        if (typeof tag === 'string' && tag.length > 0) tags.add(tag)
      }
    }
  }
  return tags
}

const collectDebriefTagsFromCombos = (combos) => {
  const tags = new Set()
  if (!Array.isArray(combos)) return tags
  for (const combo of combos) {
    if (combo && Array.isArray(combo.debriefTags)) {
      for (const tag of combo.debriefTags) {
        if (typeof tag === 'string' && tag.length > 0) tags.add(tag)
      }
    }
  }
  return tags
}

const validateScenarioDir = (scenarioDir) => {
  const errors = []
  const warnings = []
  const summary = []

  for (const required of REQUIRED_FILES) {
    if (!existsSync(join(scenarioDir, required))) {
      errors.push(`${scenarioDir}/${required} is missing`)
    }
  }

  const scenarioPath = join(scenarioDir, 'scenario.json')
  const participantsPath = join(scenarioDir, 'participants.json')
  const cardsPath = join(scenarioDir, 'cards.json')
  const combosPath = join(scenarioDir, 'combos.json')

  const scenarioRaw = existsSync(scenarioPath) ? loadJson(scenarioPath, errors) : null
  const participantsRaw = existsSync(participantsPath) ? loadJson(participantsPath, errors) : null
  const cardsRaw = existsSync(cardsPath) ? loadJson(cardsPath, errors) : null
  const combosRaw = existsSync(combosPath) ? loadJson(combosPath, errors) : null

  const scenario = scenarioRaw ? validateScenario(scenarioRaw, errors) : null
  const participants = participantsRaw ? validateParticipants(participantsRaw, errors) : []
  const cards = cardsRaw ? validateCards(cardsRaw, errors) : []
  const knownTags = collectKnownTags(cards)
  const combos = combosRaw ? validateCombos(combosRaw, knownTags, errors) : []

  const finalesPath = join(scenarioDir, 'finales.json')
  const debriefPath = join(scenarioDir, 'debrief.json')
  const finalesRaw = existsSync(finalesPath) ? loadJson(finalesPath, errors) : null
  const debriefRaw = existsSync(debriefPath) ? loadJson(debriefPath, errors) : null
  const finales = finalesRaw ? validateFinales(finalesRaw, errors) : null
  const debrief = debriefRaw ? validateDebrief(debriefRaw, errors) : null

  if (debrief) {
    const dictTags = new Set(debrief.map((entry) => entry?.tag).filter(isNonEmptyString))
    const seenWarnings = new Set()
    const cardDebriefTags = collectDebriefTagsFromCards(cards)
    for (const tag of cardDebriefTags) {
      if (!dictTags.has(tag) && !seenWarnings.has(tag)) {
        warnings.push(`debrief tag without dictionary entry: ${tag}`)
        seenWarnings.add(tag)
      }
    }
    const comboDebriefTags = collectDebriefTagsFromCombos(combos)
    for (const tag of comboDebriefTags) {
      if (!dictTags.has(tag) && !seenWarnings.has(tag)) {
        warnings.push(`debrief tag without dictionary entry: ${tag}`)
        seenWarnings.add(tag)
      }
    }
  }

  for (const optional of OPTIONAL_FILES) {
    if (!existsSync(join(scenarioDir, optional))) {
      warnings.push(`${optional} not present (skipped)`)
    }
  }

  if (scenario && isNonEmptyString(scenario.id)) {
    summary.push(`scenario: ${scenario.id}`)
  }
  if (Array.isArray(participants)) summary.push(`participants: ${participants.length}`)
  if (Array.isArray(cards)) summary.push(`cards: ${cards.length}`)
  if (Array.isArray(combos)) summary.push(`combos: ${combos.length}`)
  if (Array.isArray(debrief)) summary.push(`debrief terms: ${debrief.length}`)
  if (Array.isArray(finales)) summary.push(`finales: ${finales.length}`)

  return { errors, warnings, summary }
}

const findScenarioDirs = () => {
  if (!existsSync(scenariosDir)) return []
  return readdirSync(scenariosDir)
    .map((entry) => join(scenariosDir, entry))
    .filter((path) => statSync(path).isDirectory())
    .sort()
}

const main = () => {
  const scenarioDirs = findScenarioDirs()
  if (scenarioDirs.length === 0) {
    console.error(`Content validation failed: no scenarios found in ${scenariosDir}`)
    process.exit(1)
  }

  const allErrors = []
  const allWarnings = []
  const allSummary = []

  for (const dir of scenarioDirs) {
    const { errors, warnings, summary } = validateScenarioDir(dir)
    allErrors.push(...errors)
    allWarnings.push(...warnings)
    allSummary.push(...summary)
  }

  if (allErrors.length > 0) {
    console.error(`Content validation failed with ${allErrors.length} error(s):`)
    for (const err of allErrors) console.error(`- ${err}`)
    if (allWarnings.length > 0) {
      console.error(`Warnings:`)
      for (const w of allWarnings) console.error(`- ${w}`)
    }
    process.exit(1)
  }

  console.log('Content validation passed.')
  if (allSummary.length > 0) {
    console.log('Checked:')
    for (const line of allSummary) console.log(`- ${line}`)
  }
  if (allWarnings.length > 0) {
    console.log('Warnings:')
    for (const w of allWarnings) console.log(`- ${w}`)
  }
}

main()
