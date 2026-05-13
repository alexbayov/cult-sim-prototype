import type { CaseV2, InvestigationContent } from '../game/investigation/types'

export type CaseListItem =
  | { kind: 'v1'; id: string; content: InvestigationContent }
  | { kind: 'v2'; id: string; content: CaseV2 }

export const caseTitle = (item: CaseListItem): string =>
  item.kind === 'v2' ? item.content.title : item.content.case.title

export const caseSubtitle = (item: CaseListItem): string =>
  item.kind === 'v2'
    ? item.content.protagonist.tagline ?? item.content.protagonist.name
    : item.content.case.subtitle

export const caseLegend = (item: CaseListItem): string => {
  if (item.kind === 'v1') return item.content.case.publicLegend
  const firstParagraph = item.content.brief.body.split(/\n{2,}/)[1] ?? item.content.brief.body
  return `${item.content.protagonist.name}. ${firstParagraph}`
}

export const caseMeta = (
  item: CaseListItem,
): {
  materials: number
  people: number
  fragments: number
  observations: number
  lengthHint: string
} => {
  if (item.kind === 'v1') {
    const fragments = item.content.evidence.length
    const sources = item.content.sources.length
    return {
      materials: sources,
      people: item.content.persons.length,
      fragments,
      observations: item.content.patterns.length,
      lengthHint:
        fragments >= 40 || sources >= 12
          ? 'плотный · ~30 минут'
          : fragments >= 28
            ? 'камерный · ~20 минут'
            : 'короткий · ~15 минут',
    }
  }
  return {
    materials: item.content.documents.length,
    people: item.content.contacts.length,
    fragments: item.content.documents.reduce(
      (sum, document) => sum + document.keyPhrases.length,
      0,
    ),
    observations: item.content.hypotheses.length,
    lengthHint:
      item.content.documents.length >= 6 ? 'сюжетный · ~35 минут' : 'короткий · ~20 минут',
  }
}
