import { useMemo, useRef, useState, type ReactElement } from 'react'
import type { CaseDocument, CaseV2 } from '../game/investigation/types'
import {
  captureSelectionRange,
  makeHighlightId,
  rangesOverlap,
  splitDocumentParagraphs,
} from './highlight'
import type { WorkspaceHighlight } from './state'

type DocumentsPaneProps = {
  content: CaseV2
  activeDocumentId: string
  visibleDocumentIds: ReadonlyArray<string>
  performedActionIds: ReadonlyArray<string>
  highlights: ReadonlyArray<WorkspaceHighlight>
  readOnly: boolean
  onSelectDocument: (documentId: string) => void
  onAddHighlight: (highlight: WorkspaceHighlight) => void
  onHintDismissed: () => void
  hintDismissed: boolean
  onOpenActions: () => void
}

const renderDocumentSlice = (
  document: CaseDocument,
  start: number,
  end: number,
  highlights: ReadonlyArray<WorkspaceHighlight>,
): ReactElement[] => {
  const parts: ReactElement[] = []
  let cursor = start
  const ranges = highlights
    .filter((highlight) => highlight.documentId === document.id)
    .filter((highlight) => rangesOverlap(highlight.range, [start, end]))
    .map((highlight) => ({
      ...highlight,
      range: [
        Math.max(highlight.range[0], start),
        Math.min(highlight.range[1], end),
      ] as [number, number],
    }))
    .sort((a, b) => a.range[0] - b.range[0])

  for (const highlight of ranges) {
    if (highlight.range[0] > cursor) {
      parts.push(
        <span key={`${cursor}-${highlight.range[0]}`}>
          {document.body.slice(cursor, highlight.range[0])}
        </span>,
      )
    }
    parts.push(
      <mark key={highlight.id} className="workspace-highlight" title="в блокноте">
        {document.body.slice(highlight.range[0], highlight.range[1])}
      </mark>,
    )
    cursor = Math.max(cursor, highlight.range[1])
  }
  if (cursor < end) {
    parts.push(<span key={`${cursor}-${end}`}>{document.body.slice(cursor, end)}</span>)
  }
  return parts
}

export default function DocumentsPane({
  content,
  activeDocumentId,
  visibleDocumentIds,
  performedActionIds,
  highlights,
  readOnly,
  onSelectDocument,
  onAddHighlight,
  onHintDismissed,
  hintDismissed,
  onOpenActions,
}: DocumentsPaneProps): ReactElement {
  const activeDocument =
    content.documents.find((document) => document.id === activeDocumentId) ??
    content.documents[0]
  const rootRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<string | null>(null)
  const [mobileCandidate, setMobileCandidate] = useState<{
    documentId: string
    range: [number, number]
    text: string
  } | null>(null)
  const visibleIds = new Set(visibleDocumentIds)
  const paragraphs = useMemo(
    () => splitDocumentParagraphs(activeDocument.body),
    [activeDocument.body],
  )

  const captureHighlight = (range: [number, number], text: string) => {
    if (readOnly || text.trim().length === 0) return
    onAddHighlight({
      id: makeHighlightId(),
      documentId: activeDocument.id,
      range,
    })
    if (!hintDismissed) onHintDismissed()
  }

  const handleMouseUp = () => {
    if (readOnly || !rootRef.current) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return
    const captured = captureSelectionRange(
      rootRef.current,
      activeDocument.body,
      selection.getRangeAt(0),
    )
    selection.removeAllRanges()
    if (!captured) return
    if (captured.clamped) {
      setTooltip('выделение в одном абзаце за раз')
      window.setTimeout(() => setTooltip(null), 3000)
    }
    captureHighlight(captured.range, captured.text)
  }

  const lockedMessage = (document: CaseDocument): string => {
    const action = content.actions.find((item) => item.id === document.unlockedByAction)
    if (!action) return 'документ пока закрыт'
    return `нужно действие: «${action.label}» (${action.cost} ⏳)`
  }

  return (
    <section className="workspace-panel workspace-documents">
      <nav className="workspace-document-tabs" aria-label="Документы">
        {content.documents.map((document) => {
          const visible = visibleIds.has(document.id)
          const unlockedNow =
            document.unlockedByAction &&
            performedActionIds.includes(document.unlockedByAction)
          return (
            <button
              type="button"
              key={document.id}
              className={[
                'workspace-document-tab',
                document.id === activeDocument.id ? 'is-active' : '',
                visible ? '' : 'is-locked',
              ].join(' ')}
              title={visible ? document.source : lockedMessage(document)}
              onClick={() => {
                if (visible) {
                  onSelectDocument(document.id)
                } else {
                  setTooltip(lockedMessage(document))
                }
              }}
            >
              <span>{document.title}</span>
              {!visible ? <span aria-hidden="true">🔒</span> : null}
              {visible && unlockedNow ? <small>новое</small> : null}
            </button>
          )
        })}
      </nav>

      {tooltip ? (
        <div className="workspace-toast">
          {tooltip}
          {tooltip.startsWith('нужно действие') ? (
            <button type="button" onClick={onOpenActions}>
              открыть действия
            </button>
          ) : null}
        </div>
      ) : null}

      <article
        className="workspace-document-article"
        ref={rootRef}
        onMouseUp={handleMouseUp}
      >
        <header>
          <p className="workspace-eyebrow">{activeDocument.type}</p>
          <h2>{activeDocument.title}</h2>
          <p>{activeDocument.source}</p>
        </header>
        {paragraphs.map((paragraph) => (
          <p
            key={paragraph.start}
            className="workspace-doc-paragraph"
            data-start={paragraph.start}
            data-end={paragraph.end}
            onClick={() => {
              if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
              if (readOnly) return
              const text = activeDocument.body
                .slice(paragraph.start, paragraph.end)
                .trim()
              setMobileCandidate({
                documentId: activeDocument.id,
                range: [paragraph.start, paragraph.end],
                text,
              })
              window.setTimeout(() => setMobileCandidate(null), 4000)
            }}
          >
            {renderDocumentSlice(activeDocument, paragraph.start, paragraph.end, highlights)}
          </p>
        ))}
      </article>

      {!hintDismissed && !readOnly ? (
        <footer className="workspace-highlight-hint">
          выделите фрагмент, чтобы добавить в блокнот
        </footer>
      ) : null}

      {mobileCandidate?.documentId === activeDocument.id ? (
        <div className="workspace-mobile-confirm">
          <span>Сохранить «{mobileCandidate.text.slice(0, 40)}...» в блокнот?</span>
          <button
            type="button"
            onClick={() => {
              captureHighlight(mobileCandidate.range, mobileCandidate.text)
              setMobileCandidate(null)
            }}
          >
            Сохранить
          </button>
          <button type="button" onClick={() => setMobileCandidate(null)}>
            Отмена
          </button>
        </div>
      ) : null}
    </section>
  )
}
