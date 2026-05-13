import type { CaseDocument } from '../game/investigation/types'
import type { HighlightRange, WorkspaceHighlight } from './state'

export type CapturedRange = {
  range: HighlightRange
  text: string
  clamped: boolean
}

export const makeHighlightId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `hl-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const closestMsgBody = (
  root: HTMLElement,
  node: Node | null,
): HTMLElement | null => {
  let current = node
  while (current && current !== root) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      (current as HTMLElement).classList.contains('workspace-doc-paragraph')
    ) {
      return current as HTMLElement
    }
    current = current.parentNode
  }
  return null
}

export const offsetWithinBody = (
  body: HTMLElement,
  container: Node,
  offsetInContainer: number,
): number => {
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
  let offset = 0
  let node = walker.nextNode()
  while (node) {
    if (node === container) {
      return offset + offsetInContainer
    }
    offset += node.textContent?.length ?? 0
    node = walker.nextNode()
  }
  return offset
}

export const captureSelectionRange = (
  root: HTMLElement,
  documentBody: string,
  range: Range,
): CapturedRange | null => {
  const startBody = closestMsgBody(root, range.startContainer)
  const endBody = closestMsgBody(root, range.endContainer)
  if (!startBody) return null
  const paragraphStart = Number(startBody.dataset.start ?? 0)
  const paragraphEnd = Number(startBody.dataset.end ?? paragraphStart)
  const start =
    paragraphStart + offsetWithinBody(startBody, range.startContainer, range.startOffset)
  const rawEnd =
    endBody === startBody
      ? paragraphStart +
        offsetWithinBody(startBody, range.endContainer, range.endOffset)
      : paragraphEnd
  const lo = Math.max(paragraphStart, Math.min(start, rawEnd))
  const hi = Math.min(paragraphEnd, Math.max(start, rawEnd))
  if (lo >= hi) return null
  return {
    range: [lo, hi],
    text: documentBody.slice(lo, hi).trim(),
    clamped: endBody !== startBody,
  }
}

export const rangesOverlap = (
  [start, end]: HighlightRange,
  [otherStart, otherEnd]: HighlightRange,
): boolean => start < otherEnd && end > otherStart

export const highlightText = (
  document: CaseDocument,
  highlight: WorkspaceHighlight,
): string => document.body.slice(highlight.range[0], highlight.range[1]).trim()

export const splitDocumentParagraphs = (
  body: string,
): Array<{ start: number; end: number; text: string }> => {
  const paragraphs: Array<{ start: number; end: number; text: string }> = []
  const matches = body.matchAll(/\S[\s\S]*?(?=\n{2,}|$)/g)
  for (const match of matches) {
    const text = match[0]
    const start = match.index ?? 0
    paragraphs.push({ start, end: start + text.length, text })
  }
  return paragraphs
}

export const deriveProvenance = (document: CaseDocument, range: HighlightRange): string => {
  const before = document.body.slice(0, range[0])
  const dateMatch = [...before.matchAll(/\[([^\]]+)\]\s*([^:\n]+):/g)].at(-1)
  if (dateMatch) {
    return `из ${document.title} / ${dateMatch[2].trim()} / ${dateMatch[1].trim()}`
  }
  const bylineMatch = document.source.match(/автор\s*[—-]\s*([^.,]+)/i)
  if (bylineMatch) return `из ${document.title} / ${bylineMatch[1].trim()}`
  return `из ${document.title}${document.date ? ` / ${document.date}` : ''}`
}
