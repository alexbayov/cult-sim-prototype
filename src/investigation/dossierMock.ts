export type PersonRole =
  | 'leader'
  | 'admin'
  | 'participant'
  | 'ex-member'
  | 'donor'
  | 'relative'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type Person = {
  id: string
  name: string
  role: PersonRole
  roleLabel: string
  publicDescription: string
  privateNote: string
  riskLevel: RiskLevel
  influence: number
  credibility: number
}

export type SourceType =
  | 'landing'
  | 'chat'
  | 'testimony'
  | 'payment'
  | 'videoTranscript'
  | 'socialPost'
  | 'internalDoc'
  | 'diary'

export type ReliabilityLevel = 'unverified' | 'low' | 'medium' | 'high'

export type SourceFragment = {
  id: string
  text: string
  speaker?: string
  date?: string
  highlighted?: boolean
}

export type Source = {
  id: string
  type: SourceType
  typeLabel: string
  title: string
  origin: string
  date: string
  reliability: ReliabilityLevel
  fragments: SourceFragment[]
}

export type PatternStatus = 'unknown' | 'suspected' | 'supported' | 'confirmed'

export type Pattern = {
  id: string
  title: string
  status: PatternStatus
  shortDescription: string
  evidenceCount: number
  requiredEvidence: number
}

export type EvidenceMark = {
  id: string
  fragmentText: string
  sourceLabel: string
  linkedPersonName?: string
  linkedPatternTitle?: string
  reliability: ReliabilityLevel
  weight: 'low' | 'medium' | 'high'
}

export type TimelineEvent = {
  id: string
  date: string
  label: string
  note: string
  tone: 'neutral' | 'warning' | 'risk'
}

export type ProgressChip = {
  label: string
  value: string
}

export type Case = {
  id: string
  number: string
  title: string
  subtitle: string
  status: string
  publicLegend: string
  investigationQuestion: string
  riskStatement: string
  contentWarning: string
  progressChips: ProgressChip[]
  persons: Person[]
  sources: Source[]
  activeSourceId: string
  evidence: EvidenceMark[]
  patterns: Pattern[]
  timeline: TimelineEvent[]
}

export const dossierMock: Case = {
  id: 'im-2026-01',
  number: 'IM-2026/01',
  title: 'Марафон личной эффективности',
  subtitle: 'Бесплатный поток, обещание дисциплины и нового окружения',
  status: 'в работе',
  publicLegend:
    'Открытый марафон. Публично: поддержка, сильное окружение, выход из выгорания за 8 недель.',
  investigationQuestion:
    'Это токсичный инфобизнес или зарождающаяся система контроля?',
  riskStatement:
    'Активные участники: 6 опрошенных, 1 в высокой группе риска. Финансовое давление зафиксировано в чате недели 3.',
  contentWarning:
    'Материалы дела содержат описания психологического давления и финансового принуждения.',
  progressChips: [
    { label: 'источники', value: '6 / 12' },
    { label: 'улики', value: '4 / ≈40' },
    { label: 'паттерны', value: '2 подтв. / 6' },
    { label: 'участники', value: '6' },
  ],
  persons: [
    {
      id: 'maxim-r',
      name: 'Максим Р.',
      role: 'leader',
      roleLabel: 'лидер потока',
      publicDescription: 'Автор методики, ведущий эфиров, личный пример «нового человека».',
      privateNote:
        'История «преодоления» — главный аргумент методики. Любая критика обрабатывается как сопротивление.',
      riskLevel: 'high',
      influence: 92,
      credibility: 38,
    },
    {
      id: 'kira-s',
      name: 'Кира С.',
      role: 'admin',
      roleLabel: 'администратор',
      publicDescription: 'Курирует чаты, фиксирует «нарушения ритма», ведёт ритуалы признания.',
      privateNote:
        'Сама прошла поток годом раньше. Является primary исполнителем давления равных.',
      riskLevel: 'medium',
      influence: 64,
      credibility: 52,
    },
    {
      id: 'anya-k',
      name: 'Аня К.',
      role: 'participant',
      roleLabel: 'участница',
      publicDescription: 'Переехала недавно, в группе ищет «своих» после развода и выгорания.',
      privateNote: 'Уязвимость высокая, выходные связи ослаблены. Уже взяла рассрочку на курс.',
      riskLevel: 'critical',
      influence: 12,
      credibility: 68,
    },
    {
      id: 'sveta-d',
      name: 'Света Д.',
      role: 'ex-member',
      roleLabel: 'бывшая участница',
      publicDescription:
        'Прошла два потока, ушла после конфликта по деньгам. Дала анонимные показания.',
      privateNote:
        'Источник внутреннего лексикона и описаний ритуалов. Достоверность средняя — есть личная обида.',
      riskLevel: 'low',
      influence: 22,
      credibility: 74,
    },
    {
      id: 'ilya-p',
      name: 'Илья П.',
      role: 'donor',
      roleLabel: 'крупный донор',
      publicDescription:
        'Молодой предприниматель, оплатил «внутренний круг» сразу за полгода. В переписке защищает лидера.',
      privateNote: 'Финансовая привязка делает выход из потока публично дорогим.',
      riskLevel: 'medium',
      influence: 58,
      credibility: 42,
    },
    {
      id: 'galina-k',
      name: 'Галина К.',
      role: 'relative',
      roleLabel: 'сестра участницы',
      publicDescription: 'Сестра Ани. Заметила изменения, обратилась к расследованию.',
      privateNote:
        'Внешняя защитная связь. Поддерживает контакт, но описывает нарастающее «нам нельзя обсуждать поток с тобой».',
      riskLevel: 'low',
      influence: 8,
      credibility: 82,
    },
  ],
  sources: [
    {
      id: 'src-landing',
      type: 'landing',
      typeLabel: 'лендинг',
      title: 'Лендинг «Марафон личной эффективности»',
      origin: 'публичная страница, архив 12.03',
      date: '12 марта',
      reliability: 'medium',
      fragments: [
        {
          id: 'frag-landing-1',
          text:
            '«Бесплатные 8 недель. Сильное окружение. Доступ к лидеру. Ты выходишь другим человеком — или возвращаешь себе деньги.»',
          highlighted: true,
        },
        {
          id: 'frag-landing-2',
          text:
            '«Никаких "тренингов" — это не курс. Это сообщество, в которое тебя приглашают, только если ты готов работать.»',
        },
        {
          id: 'frag-landing-3',
          text:
            '«После основного потока открывается доступ к закрытому второму кругу. Условия обсуждаются индивидуально.»',
          highlighted: true,
        },
      ],
    },
    {
      id: 'src-chat-w3',
      type: 'chat',
      typeLabel: 'чат, неделя 3',
      title: 'Чат потока — неделя 3, разбор «нарушителей ритма»',
      origin: 'скриншоты, переданы Светой Д.',
      date: '02 апреля',
      reliability: 'high',
      fragments: [
        {
          id: 'frag-chat-1',
          text:
            'Максим Р.: «Если ты пропустил утренний эфир — ты выбрал не нас. Это не наказание, это просто факт.»',
          speaker: 'Максим Р.',
        },
        {
          id: 'frag-chat-2',
          text:
            'Кира С.: «Те, кто обсуждает поток с друзьями вне круга, выносят нашу боль наружу. Это не ок.»',
          speaker: 'Кира С.',
          highlighted: true,
        },
        {
          id: 'frag-chat-3',
          text:
            'Аня К.: «Я кажется не тяну. Может я просто не подхожу?» — *15 реакций «обнимаем»*',
          speaker: 'Аня К.',
        },
      ],
    },
    {
      id: 'src-payment',
      type: 'payment',
      typeLabel: 'платёж',
      title: 'Запись о платеже — «второй круг»',
      origin: 'выписка, передана Ильёй П.',
      date: '18 апреля',
      reliability: 'high',
      fragments: [
        {
          id: 'frag-payment-1',
          text:
            'Сумма: 184 000 ₽. Назначение: «Доступ к закрытому потоку. Возврат не предусмотрен.»',
        },
      ],
    },
    {
      id: 'src-testimony',
      type: 'testimony',
      typeLabel: 'показания',
      title: 'Показания: Света Д., бывшая участница',
      origin: 'интервью, аудио + расшифровка',
      date: '24 апреля',
      reliability: 'medium',
      fragments: [
        {
          id: 'frag-testimony-1',
          text:
            '«В первые две недели тебя обнимают и хвалят так, что ты подбегаешь к ним сама. К третьей — ты уже стыдишься, что тебя обняли зря.»',
          speaker: 'Света Д.',
          highlighted: true,
        },
        {
          id: 'frag-testimony-2',
          text:
            '«У них своя речь: "вне фокуса", "вынос боли наружу", "не наш человек". Я полгода говорила так в обычной жизни.»',
          speaker: 'Света Д.',
        },
      ],
    },
    {
      id: 'src-social',
      type: 'socialPost',
      typeLabel: 'соцсети',
      title: 'Пост Максима Р. — «о тех, кто уходит»',
      origin: 'публичный пост, 30 апреля',
      date: '30 апреля',
      reliability: 'medium',
      fragments: [
        {
          id: 'frag-social-1',
          text:
            '«Уход из потока — это не свобода, это страх. Свобода — остаться и доделать работу с собой. Остальное вы знаете.»',
          speaker: 'Максим Р.',
        },
      ],
    },
    {
      id: 'src-relative',
      type: 'testimony',
      typeLabel: 'показания родственника',
      title: 'Показания: Галина К., сестра Ани',
      origin: 'звонок, расшифровка',
      date: '03 мая',
      reliability: 'medium',
      fragments: [
        {
          id: 'frag-relative-1',
          text:
            '«Аня теперь говорит: "тебе не понять, ты не в фокусе". И ещё — что нам "не стоит обсуждать поток". Раньше так не было.»',
          speaker: 'Галина К.',
          highlighted: true,
        },
      ],
    },
  ],
  activeSourceId: 'src-chat-w3',
  evidence: [
    {
      id: 'ev-1',
      fragmentText:
        '«Те, кто обсуждает поток с друзьями вне круга, выносят нашу боль наружу.»',
      sourceLabel: 'чат потока, неделя 3',
      linkedPersonName: 'Кира С.',
      linkedPatternTitle: 'Изоляция',
      reliability: 'high',
      weight: 'high',
    },
    {
      id: 'ev-2',
      fragmentText: '«Доступ к закрытому потоку. Возврат не предусмотрен.» — 184 000 ₽.',
      sourceLabel: 'выписка, второй круг',
      linkedPersonName: 'Илья П.',
      linkedPatternTitle: 'Финансовое давление',
      reliability: 'high',
      weight: 'high',
    },
    {
      id: 'ev-3',
      fragmentText:
        '«В первые две недели тебя обнимают так, что ты подбегаешь к ним сама.»',
      sourceLabel: 'показания: Света Д.',
      linkedPatternTitle: 'Лав-бомбинг',
      reliability: 'medium',
      weight: 'medium',
    },
    {
      id: 'ev-4',
      fragmentText:
        '«У них своя речь: "вне фокуса", "вынос боли наружу", "не наш человек".»',
      sourceLabel: 'показания: Света Д.',
      linkedPatternTitle: 'Нагруженный язык',
      reliability: 'medium',
      weight: 'medium',
    },
  ],
  patterns: [
    {
      id: 'love-bombing',
      title: 'Лав-бомбинг',
      status: 'supported',
      shortDescription: 'Интенсивная поддержка и принятие на ранней стадии.',
      evidenceCount: 1,
      requiredEvidence: 2,
    },
    {
      id: 'isolation',
      title: 'Изоляция',
      status: 'confirmed',
      shortDescription: 'Сужение круга общения, внешние связи объявляются помехой.',
      evidenceCount: 2,
      requiredEvidence: 2,
    },
    {
      id: 'loaded-language',
      title: 'Нагруженный язык',
      status: 'supported',
      shortDescription: 'Внутренние термины подменяют обычные слова и закрывают сложные явления.',
      evidenceCount: 1,
      requiredEvidence: 2,
    },
    {
      id: 'financial-pressure',
      title: 'Финансовое давление',
      status: 'confirmed',
      shortDescription: 'Платежи без возврата, эскалация суммы внутри потока.',
      evidenceCount: 2,
      requiredEvidence: 2,
    },
    {
      id: 'coercive-control',
      title: 'Принудительный контроль',
      status: 'suspected',
      shortDescription: 'Управление поведением через страх потери группы и статуса.',
      evidenceCount: 1,
      requiredEvidence: 3,
    },
    {
      id: 'dependency-loop',
      title: 'Петля зависимости',
      status: 'unknown',
      shortDescription: 'Сначала проблема обостряется, затем группа предлагает себя как решение.',
      evidenceCount: 0,
      requiredEvidence: 3,
    },
  ],
  timeline: [
    {
      id: 'tl-launch',
      date: '12 марта',
      label: 'публичный запуск',
      note: 'Открытие приёма заявок, бесплатный формат, обещание «нового окружения».',
      tone: 'neutral',
    },
    {
      id: 'tl-closed',
      date: '26 марта',
      label: 'закрытый чат',
      note: 'Создан внутренний чат «второго круга». Доступ — по личному приглашению.',
      tone: 'warning',
    },
    {
      id: 'tl-payment',
      date: '18 апреля',
      label: 'просьба об оплате',
      note: 'Первые крупные платежи за «второй круг» без условий возврата.',
      tone: 'risk',
    },
    {
      id: 'tl-family',
      date: '03 мая',
      label: 'тревога семьи',
      note: 'Сестра Ани К. фиксирует изменения и обращается с обращением в расследование.',
      tone: 'warning',
    },
    {
      id: 'tl-testimony',
      date: '24 апреля',
      label: 'показания бывшей участницы',
      note: 'Света Д. передаёт скриншоты и описывает внутренний лексикон.',
      tone: 'neutral',
    },
  ],
}
