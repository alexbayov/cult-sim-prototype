import { cards, comboRules, initialGroup, participants } from './data'
import type {
  Card,
  ComboRule,
  Effect,
  Finale,
  GameState,
  GroupMetric,
  GroupState,
  LogEntry,
  Participant,
  ParticipantMetric,
} from './types'

const clamp = (value: number) => Math.max(0, Math.min(100, value))

const metricLabel: Record<GroupMetric, string> = {
  involvement: 'Вовлечённость',
  trust: 'Доверие',
  money: 'Деньги',
  legitimacy: 'Легитимность',
  harm: 'Вред',
  doubt: 'Сомнение',
  visibility: 'Видимость',
  leaderControl: 'Контроль лидера',
  radicalization: 'Радикализация',
  resistance: 'Сопротивление',
}

export const groupMetricLabels = metricLabel

export const participantMetricLabels: Record<ParticipantMetric, string> = {
  trust: 'доверие',
  autonomy: 'автономия',
  dependence: 'зависимость',
  doubt: 'сомнение',
  fatigue: 'истощение',
  shame: 'стыд',
  fear: 'страх',
  financialPressure: 'фин. давление',
  exitReadiness: 'готовность выйти',
  recruitReadiness: 'готовность звать',
}

const rotateDeck = (deck: Card[], count: number) => {
  const hand = deck.slice(0, count)
  const rest = deck.slice(count)
  return { hand, deck: [...rest, ...hand] }
}

export const createInitialState = (): GameState => {
  const orderedCards = [...cards]
  const { hand, deck } = rotateDeck(orderedCards, 5)

  return {
    turn: 1,
    group: { ...initialGroup },
    participants: participants.map((participant) => ({
      ...participant,
      metrics: { ...participant.metrics },
    })),
    deck,
    hand,
    played: [],
    logs: [
      {
        turn: 1,
        title: 'Дело открыто',
        body: 'Запущен бесплатный марафон личной эффективности. Пока это выглядит как обычный поток с мотивацией, заданиями и обещанием нового старта.',
        tone: 'neutral',
      },
    ],
    revealedRedFlags: [],
    debriefTags: [],
  }
}

const participantMatches = (
  participant: Participant,
  selector: Extract<Effect, { scope: 'participant' }>['selector'],
) => {
  if (selector === 'all') return true
  if (selector === 'vulnerable') return participant.vulnerabilityLevel >= 55
  if (selector === 'lowProtection') return participant.protectionLevel < 55
  if (selector === 'highDoubt') return participant.metrics.doubt >= 35
  if (selector === 'highTrust') return participant.metrics.trust >= 30
  return false
}

const applyEffect = (
  group: GroupState,
  participantList: Participant[],
  effect: Effect,
): { group: GroupState; participants: Participant[] } => {
  if (effect.scope === 'group') {
    return {
      group: {
        ...group,
        [effect.metric]: clamp(group[effect.metric] + effect.delta),
      },
      participants: participantList,
    }
  }

  return {
    group,
    participants: participantList.map((participant) => {
      if (!participantMatches(participant, effect.selector)) return participant

      return {
        ...participant,
        metrics: {
          ...participant.metrics,
          [effect.metric]: clamp(participant.metrics[effect.metric] + effect.delta),
        },
      }
    }),
  }
}

const applyEffects = (
  group: GroupState,
  participantList: Participant[],
  effects: Effect[],
) =>
  effects.reduce(
    (state, effect) => applyEffect(state.group, state.participants, effect),
    { group, participants: participantList },
  )

const recentTags = (played: Card[], windowTurns: number) =>
  new Set(played.slice(-windowTurns).flatMap((card) => card.tags))

const comboAlreadyLogged = (logs: LogEntry[], combo: ComboRule) =>
  logs.some((entry) => entry.title === combo.title && entry.tone === 'combo')

const findTriggeredCombos = (played: Card[], logs: LogEntry[]) =>
  comboRules.filter((combo) => {
    if (comboAlreadyLogged(logs, combo)) return false
    const tags = recentTags(played, combo.windowTurns)
    return combo.requiredTags.every((tag) => tags.has(tag))
  })

const unique = (items: string[]) => [...new Set(items)]

const drawNextHand = (deck: Card[], turn: number) => {
  const handSize = turn % 3 === 0 ? 6 : 5
  return rotateDeck(deck, handSize)
}

const effectSummary = (card: Card) => {
  const groupEffects = card.effects
    .filter((effect) => effect.scope === 'group')
    .map((effect) => `${metricLabel[effect.metric]} ${effect.delta > 0 ? '+' : ''}${effect.delta}`)

  return groupEffects.length > 0 ? groupEffects.join(' · ') : 'эффект зависит от состава группы'
}

export const playCard = (state: GameState, cardId: string): GameState => {
  if (state.finale) return state

  const card = state.hand.find((item) => item.id === cardId)
  if (!card) return state

  const afterCard = applyEffects(state.group, state.participants, card.effects)
  const played = [...state.played, card]
  const triggeredCombos = findTriggeredCombos(played, state.logs)

  const afterCombos = triggeredCombos.reduce(
    (current, combo) => applyEffects(current.group, current.participants, combo.effects),
    afterCard,
  )

  const nextTurn = state.turn + 1
  const { hand, deck } = drawNextHand(state.deck, nextTurn)
  const comboLogs: LogEntry[] = triggeredCombos.map((combo) => ({
    turn: state.turn,
    title: combo.title,
    body: combo.redFlag,
    tone: 'combo',
  }))
  const redFlags = unique([
    ...state.revealedRedFlags,
    ...card.redFlags,
    ...triggeredCombos.map((combo) => combo.redFlag),
  ])
  const debriefTags = unique([
    ...state.debriefTags,
    ...card.debriefTags,
    ...triggeredCombos.flatMap((combo) => combo.debriefTags),
  ])
  const finale = nextTurn > 10 ? calculateFinale(afterCombos.group, afterCombos.participants, redFlags) : undefined
  const cardLog: LogEntry = {
    turn: state.turn,
    title: card.title,
    body: `${card.surface} Последствия: ${effectSummary(card)}.`,
    tone: card.type === 'crisis' ? 'warning' : 'neutral',
  }
  const finaleLogs: LogEntry[] = finale
    ? [
        {
          turn: nextTurn,
          title: finale.title,
          body: finale.summary,
          tone: 'finale',
        },
      ]
    : []

  return {
    ...state,
    turn: nextTurn,
    group: afterCombos.group,
    participants: afterCombos.participants,
    hand,
    deck,
    played,
    revealedRedFlags: redFlags,
    debriefTags,
    finale,
    logs: [cardLog, ...comboLogs, ...finaleLogs, ...state.logs].slice(0, 12),
  }
}

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

const calculateFinale = (
  group: GroupState,
  participantList: Participant[],
  redFlags: string[],
): Finale => {
  const averageAutonomy = average(participantList.map((participant) => participant.metrics.autonomy))
  const averageDependence = average(participantList.map((participant) => participant.metrics.dependence))
  const averageFatigue = average(participantList.map((participant) => participant.metrics.fatigue))
  const systemPower = Math.round((group.money + group.trust + group.involvement + group.leaderControl) / 4)
  const humanCost = Math.round((group.harm + averageDependence + averageFatigue + (100 - averageAutonomy)) / 4)
  const visibilityRisk = Math.round((group.visibility + group.resistance + group.doubt) / 3)

  if (systemPower >= 55 && humanCost >= 45 && visibilityRisk < 48) {
    return {
      title: 'Финал: закрытый круг успеха',
      summary:
        'Марафон вырос в плотное платное сообщество. Внешне — дисциплина, деньги и сильное окружение; внутри — зависимость от ритма, статуса и доступа к лидеру.',
      score: systemPower - Math.round(humanCost / 3),
      notes: redFlags.slice(0, 5),
    }
  }

  if (visibilityRisk >= 55) {
    return {
      title: 'Финал: публичный разбор',
      summary:
        'Скриншоты, вопросы близких и усталость участников стали видимыми. Группа ещё может защищаться, но теперь её методы разбирают снаружи.',
      score: 100 - visibilityRisk,
      notes: redFlags.slice(0, 5),
    }
  }

  if (humanCost >= 55) {
    return {
      title: 'Финал: дорогой прорыв',
      summary:
        'Система показала результат по деньгам и вовлечению, но часть участников вышла из партии с долгами, истощением и ощущением личной неисправности.',
      score: systemPower - humanCost,
      notes: redFlags.slice(0, 5),
    }
  }

  if (group.radicalization >= 45) {
    return {
      title: 'Финал: свой язык, свой круг',
      summary:
        'Проект стал закрытым сообществом с собственной рамкой объяснений. Снаружи это всё ещё марафон, но внутри уже важнее лояльность и принадлежность.',
      score: systemPower - visibilityRisk,
      notes: redFlags.slice(0, 5),
    }
  }

  return {
    title: 'Финал: мягкий распад',
    summary:
      'Поток не стал устойчивой системой. Участники забрали часть пользы, часть обещаний рассыпалась, а красные флаги остались материалом для разбора.',
    score: Math.round((averageAutonomy + 100 - group.harm) / 2),
    notes: redFlags.slice(0, 5),
  }
}
