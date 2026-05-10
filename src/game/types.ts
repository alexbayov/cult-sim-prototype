export type GroupMetric =
  | 'involvement'
  | 'trust'
  | 'money'
  | 'legitimacy'
  | 'harm'
  | 'doubt'
  | 'visibility'
  | 'leaderControl'
  | 'radicalization'
  | 'resistance'

export type ParticipantMetric =
  | 'trust'
  | 'autonomy'
  | 'dependence'
  | 'doubt'
  | 'fatigue'
  | 'shame'
  | 'fear'
  | 'financialPressure'
  | 'exitReadiness'
  | 'recruitReadiness'

export type CardType = 'practice' | 'crisis' | 'counter'

export type Effect =
  | {
      scope: 'group'
      metric: GroupMetric
      delta: number
    }
  | {
      scope: 'participant'
      metric: ParticipantMetric
      delta: number
      selector: 'all' | 'vulnerable' | 'lowProtection' | 'highDoubt' | 'highTrust'
    }

export type Card = {
  id: string
  title: string
  type: CardType
  tier: 1 | 2 | 3
  surface: string
  intent: string
  tags: string[]
  effects: Effect[]
  redFlags: string[]
  debriefTags: string[]
}

export type ComboRule = {
  id: string
  title: string
  requiredTags: string[]
  windowTurns: number
  effects: Effect[]
  redFlag: string
  debriefTags: string[]
}

export type Participant = {
  id: string
  name: string
  archetype: string
  need: string
  vulnerability: string
  protection: string
  protectionLevel: number
  vulnerabilityLevel: number
  metrics: Record<ParticipantMetric, number>
}

export type GroupState = Record<GroupMetric, number>

export type LogEntry = {
  turn: number
  title: string
  body: string
  tone: 'neutral' | 'warning' | 'combo' | 'finale'
}

export type GameState = {
  turn: number
  group: GroupState
  participants: Participant[]
  deck: Card[]
  hand: Card[]
  played: Card[]
  logs: LogEntry[]
  revealedRedFlags: string[]
  debriefTags: string[]
  finale?: Finale
}

export type Finale = {
  title: string
  summary: string
  score: number
  notes: string[]
}
