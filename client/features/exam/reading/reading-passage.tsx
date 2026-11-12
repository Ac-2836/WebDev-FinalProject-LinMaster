'use client';

import type {CandidatePassage} from '@linmaster/shared';
import {Eraser, StickyNote, X} from 'lucide-react';
import {DropdownMenu, Popover} from 'radix-ui';
import {Fragment, useRef, useState} from 'react';

import {addHighlights, clearHighlights, segments, setNote, type Highlight, type TextRange} from './reading-logic';

export interface ReadingPassageProps {
  passage: CandidatePassage;
  highlights: readonly Highlight[];
  onHighlightsChange: (next: Highlight[]) => void;
}

interface MenuState {
  x: number;
  y: number;
  /** The selected text, per paragraph. */
  ranges: TextRange[];
  /** The highlight right-clicked without a selection. */
  at: number | null;
}

/** Character offset of (node, offset) inside a paragraph's text element. */
function offsetIn(el: HTMLElement, node: Node, offset: number) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.setEnd(node, offset);
  return range.toString().length;
}

/**
 * Reading passage with highlights and notes (PLAN C4): select text, right-click (or press the context menu key)
 * and choose Highlight, Notes, Clear or Clear all. Ranges are character offsets per paragraph, so they survive a
 * reload once saved in the attempt state.
 */
export function ReadingPassage({passage, highlights, onHighlightsChange}: ReadingPassageProps) {
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [editing, setEditing] = useState<{index: number; rect: DOMRect} | null>(null);
  // Read after the editor closes, when `editing` is already null.
  const lastEdited = useRef<number | null>(null);
  const noteInput = useRef<HTMLTextAreaElement>(null);
  const pendingNote = useRef<number | null>(null);

  function selectedRanges(): {ranges: TextRange[]; rect: DOMRect | null} {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount || !root.current) return {ranges: [], rect: null};
    const range = selection.getRangeAt(0);
    const ranges: TextRange[] = [];
    root.current.querySelectorAll<HTMLElement>('[data-para]').forEach(el => {
      if (!range.intersectsNode(el)) return;
      const length = el.textContent?.length ?? 0;
      const start = el.contains(range.startContainer) ? offsetIn(el, range.startContainer, range.startOffset) : 0;
      const end = el.contains(range.endContainer) ? offsetIn(el, range.endContainer, range.endOffset) : length;
      if (end > start) ranges.push({paragraph: Number(el.dataset.para), start, end});
    });
    return {ranges, rect: range.getBoundingClientRect()};
  }

  function onContextMenu(e: React.MouseEvent) {
    const {ranges, rect} = selectedRanges();
    const mark = (e.target as Element).closest<HTMLElement>('[data-hl]');
    const at = mark ? Number(mark.dataset.hl) : null;
    if (!ranges.length && at === null) return; // Nothing to act on: keep the browser menu.
    e.preventDefault();
    // The context menu key gives no pointer position: open at the selection instead.
    const fromKeyboard = e.clientX === 0 && e.clientY === 0;
    const anchor = fromKeyboard ? (rect ?? mark?.getBoundingClientRect()) : null;
    setMenu({
      x: anchor ? anchor.left : e.clientX,
      y: anchor ? anchor.bottom : e.clientY,
      ranges,
      at,
    });
  }

  function openNote(index: number) {
    lastEdited.current = index;
    // Called from a click or after the menu closed, so the mark is already rendered.
    const el = root.current?.querySelector(`[data-hl="${index}"]`);
    if (el) setEditing({index, rect: el.getBoundingClientRect()});
  }

  function highlight(withNote: boolean) {
    if (!menu) return;
    const next = addHighlights(highlights, menu.ranges);
    onHighlightsChange(next);
    window.getSelection()?.removeAllRanges();
    if (withNote) {
      const first = menu.ranges[0];
      const index = next.findIndex(
        h => h.paragraph === first.paragraph && h.start <= first.start && first.end <= h.end,
      );
      if (index !== -1) pendingNote.current = index;
    }
  }

  function clear() {
    if (!menu) return;
    if (menu.ranges.length) onHighlightsChange(clearHighlights(highlights, menu.ranges));
    else if (menu.at !== null) onHighlightsChange(highlights.filter((_, i) => i !== menu.at));
    window.getSelection()?.removeAllRanges();
  }

  const note = editing ? highlights[editing.index] : null;

  return (
    <div ref={root} onContextMenu={onContextMenu}>
      <h1 className="text-[1.3em] font-bold">{passage.title}</h1>
      <div className="mt-4 flex max-w-[70ch] flex-col gap-4 font-serif text-[1.13em] leading-[1.9]">
        {(passage.paragraphs ?? []).map((p, i) => (
          <p key={i}>
            {p.label && <strong className="mr-2 font-sans">{p.label}</strong>}
            <span data-para={i}>
              {segments(p.text, i, highlights).map((s, k) =>
                s.highlight < 0 ? (
                  <Fragment key={k}>{s.text}</Fragment>
                ) : (
                  <Fragment key={k}>
                    <mark
                      data-hl={s.highlight}
                      className={
                        highlights[s.highlight]?.note
                          ? 'border-b-2 border-dashed border-primary bg-mark text-black'
                          : 'bg-mark text-black'
                      }
                    >
                      {s.text}
                    </mark>
                    {highlights[s.highlight]?.note && (
                      <button
                        type="button"
                        className="mx-0.5 inline-flex size-6 -translate-y-1 items-center justify-center rounded bg-primary align-middle text-white outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        data-note={s.highlight}
                        aria-label={`Note: ${highlights[s.highlight].note}`}
                        onClick={() => openNote(s.highlight)}
                      >
                        <StickyNote className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </Fragment>
                ),
              )}
            </span>
          </p>
        ))}
      </div>

      <DropdownMenu.Root open={menu !== null} onOpenChange={open => !open && setMenu(null)} modal={false}>
        <DropdownMenu.Trigger asChild>
          <span aria-hidden="true" className="pointer-events-none fixed size-0" style={{left: menu?.x, top: menu?.y}} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            // Open the note editor only once the menu is gone, or the closing menu dismisses it.
            onCloseAutoFocus={e => {
              e.preventDefault();
              if (pendingNote.current !== null) openNote(pendingNote.current);
              pendingNote.current = null;
            }}
            align="start"
            sideOffset={4}
            className="z-50 flex w-44 flex-col rounded-lg border bg-white p-1 font-sans text-sm text-black shadow-xl"
          >
            {menu && menu.ranges.length > 0 && (
              <MenuItem onSelect={() => highlight(false)}>
                <span className="size-3 rounded-sm bg-mark" aria-hidden="true" />
                Highlight
              </MenuItem>
            )}
            <MenuItem
              onSelect={() => (menu?.ranges.length ? highlight(true) : (pendingNote.current = menu?.at ?? null))}
            >
              <StickyNote className="size-4" aria-hidden="true" />
              Notes
            </MenuItem>
            <MenuItem onSelect={clear}>
              <Eraser className="size-4" aria-hidden="true" />
              Clear
            </MenuItem>
            <MenuItem onSelect={() => onHighlightsChange([])} disabled={!highlights.length}>
              <Eraser className="size-4 opacity-60" aria-hidden="true" />
              Clear all
            </MenuItem>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Popover.Root open={!!note} onOpenChange={open => !open && setEditing(null)}>
        <Popover.Anchor asChild>
          <span
            aria-hidden="true"
            className="pointer-events-none fixed"
            style={{
              left: editing?.rect.left,
              top: editing?.rect.top,
              width: editing?.rect.width,
              height: editing?.rect.height,
            }}
          />
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            onOpenAutoFocus={e => {
              e.preventDefault();
              noteInput.current?.focus();
            }}
            onCloseAutoFocus={e => {
              e.preventDefault();
              root.current?.querySelector<HTMLElement>(`[data-note="${lastEdited.current}"]`)?.focus();
            }}
            align="start"
            sideOffset={6}
            collisionPadding={16}
            className="z-50 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-lg border bg-white p-3 font-sans text-sm text-black shadow-xl"
          >
            <div className="flex items-center justify-between font-semibold">
              <label htmlFor="exam-note">Note</label>
              <Popover.Close
                className="inline-flex size-9 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label="Close note"
              >
                <X className="size-4" aria-hidden="true" />
              </Popover.Close>
            </div>
            <textarea
              ref={noteInput}
              id="exam-note"
              className="min-h-20 rounded-md border px-3 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              maxLength={500}
              value={note?.note ?? ''}
              onChange={e => editing && onHighlightsChange(setNote(highlights, editing.index, e.target.value))}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function MenuItem({
  onSelect,
  disabled,
  children,
}: {
  onSelect: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      disabled={disabled}
      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted"
    >
      {children}
    </DropdownMenu.Item>
  );
}
