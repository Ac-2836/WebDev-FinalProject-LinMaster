'use client';

import {
  buildChecklist,
  CreateImportResponseSchema,
  MAX_IMPORT_AUDIO_BYTES,
  MAX_IMPORT_FILES,
  MAX_IMPORT_PDF_BYTES,
  TestKindSchema,
  UploadImportFileResponseSchema,
  type Checklist,
  type ImportFile,
  type ImportSlot,
  type TestKind,
} from '@linmaster/shared';
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  FileAudio,
  FileText,
  FileX,
  LoaderCircle,
  Upload,
  X,
} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Tabs} from 'radix-ui';
import {useId, useRef, useState} from 'react';
import {toast} from 'sonner';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {api} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

import {pageChips, slotAccepts, slotFiles, templateSlots} from './upload-logic';

const card = 'rounded-[20px] border bg-card shadow-soft';
const PDF_ACCEPT = 'application/pdf,.pdf';
const AUDIO_ACCEPT = 'audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a';
const tabClass =
  'flex min-h-11 flex-1 items-center justify-center rounded-md px-4 py-1.5 font-semibold whitespace-nowrap text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm';

const isAudio = (file: File) => /\.(mp3|m4a)$/i.test(file.name) || file.type.startsWith('audio/');
const isPdf = (file: File) => /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Uploads one file (`POST /tests/imports/files`) after the checks the server would refuse anyway. */
function useUploadFile() {
  const t = useTranslations('exam.upload');
  const errorMessage = useErrorMessage();
  return async (file: File): Promise<ImportFile | null> => {
    const audio = isAudio(file);
    if (!audio && !isPdf(file)) {
      toast.error(t('errors.type', {name: file.name}));
      return null;
    }
    if (file.size > (audio ? MAX_IMPORT_AUDIO_BYTES : MAX_IMPORT_PDF_BYTES)) {
      toast.error(t('errors.size', {name: file.name, max: audio ? 60 : 20}));
      return null;
    }
    const form = new FormData();
    form.append('file', file);
    try {
      return UploadImportFileResponseSchema.parse(await api('/tests/imports/files', {method: 'POST', body: form})).file;
    } catch (err) {
      toast.error(t('errors.upload', {name: file.name, reason: errorMessage(err)}));
      return null;
    }
  };
}

/** `POST /tests/imports`, then the status page. */
function useCreateImport() {
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [creating, setCreating] = useState(false);
  const create = async (kind: TestKind, files: {fileId: string; slots?: ImportSlot[]}[]) => {
    setCreating(true);
    try {
      const res = CreateImportResponseSchema.parse(await api('/tests/imports', {method: 'POST', body: {kind, files}}));
      router.push(`/tests/imports/${res.import.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setCreating(false);
    }
  };
  return {creating, create};
}

/** `/tests/new` (wireframe 05-exam/upload, PLAN Phần F): "AI nhận diện" and "Theo mẫu" tabs. */
export function UploadPage() {
  const t = useTranslations('exam.upload');
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/tests"
        className="inline-flex min-h-11 w-fit items-center gap-1 text-[13px] text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {t('back')}
      </Link>
      <header>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em] sm:text-[34px]">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </header>
      <Tabs.Root defaultValue="ai" className="flex flex-col gap-5">
        <Tabs.List
          className="inline-flex w-full rounded-lg border bg-muted p-0.5 text-sm sm:w-fit"
          aria-label={t('how')}
        >
          <Tabs.Trigger value="ai" className={tabClass}>
            {t('tabAi')}
          </Tabs.Trigger>
          <Tabs.Trigger value="template" className={tabClass}>
            {t('tabTemplate')}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="ai">
          <AiTab />
        </Tabs.Content>
        <Tabs.Content value="template">
          <TemplateTab />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

interface Entry {
  key: string;
  name: string;
  size: number;
  /** Null while uploading. */
  file: ImportFile | null;
}

function AiTab() {
  const t = useTranslations('exam.upload');
  const upload = useUploadFile();
  const {creating, create} = useCreateImport();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [kind, setKind] = useState<TestKind | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function add(list: FileList | null) {
    const files = [...(list ?? [])].slice(0, MAX_IMPORT_FILES - entries.length);
    if (list && list.length > files.length) toast.error(t('errors.tooMany', {max: MAX_IMPORT_FILES}));
    // One at a time, like the API: each PDF is read page by page by the AI.
    for (const file of files) {
      const key = crypto.randomUUID();
      setEntries(e => [...e, {key, name: file.name, size: file.size, file: null}]);
      const uploaded = await upload(file);
      setEntries(e =>
        uploaded ? e.map(x => (x.key === key ? {...x, file: uploaded} : x)) : e.filter(x => x.key !== key),
      );
    }
  }

  function remove(entry: Entry) {
    setEntries(e => e.filter(x => x.key !== entry.key));
    // Best effort: files no import uses are deleted by the server after 24 hours anyway.
    if (entry.file) api(`/tests/imports/files/${entry.file.id}`, {method: 'DELETE'}).catch(() => undefined);
  }

  const ready = entries.flatMap(e => (e.file ? [e.file] : []));
  const checklist = buildChecklist({
    kind,
    files: ready.map(f => ({fileId: f.id, type: f.type, pages: f.pages})),
  });
  const uploading = entries.some(e => !e.file);
  const used = ready.filter(f => !checklist.unusedFileIds.includes(f.id));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-3">
        <label
          onDragOver={e => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            void add(e.dataTransfer.files);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-[20px] border-2 border-dashed bg-card p-8 text-center focus-within:ring-[3px] focus-within:ring-ring/50',
            dragging && 'border-primary bg-secondary',
          )}
        >
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
            <Upload className="size-6" aria-hidden="true" />
          </span>
          <span className="font-semibold">{t('drop')}</span>
          <span className="max-w-md text-sm text-muted-foreground">{t('dropHint')}</span>
          <input
            ref={input}
            type="file"
            multiple
            accept={`${PDF_ACCEPT},${AUDIO_ACCEPT}`}
            className="sr-only"
            onChange={e => {
              void add(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <ul className="flex flex-col gap-2" aria-live="polite">
          {entries.map(entry => (
            <FileRow
              key={entry.key}
              entry={entry}
              unused={!!entry.file && checklist.unusedFileIds.includes(entry.file.id)}
              onRemove={() => remove(entry)}
            />
          ))}
        </ul>
      </div>

      <aside className={cn(card, 'flex h-fit flex-col gap-4 p-5')} aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('checklist')}</h2>
          <label className="flex items-center gap-2 text-sm">
            {t('kind')}
            <select
              className="h-10 rounded-md border bg-background px-2"
              value={kind ?? ''}
              onChange={e => setKind(e.target.value ? TestKindSchema.parse(e.target.value) : null)}
            >
              <option value="">
                {checklist.detectedKind
                  ? t('kindDetected', {kind: t(`kinds.${checklist.detectedKind}`)})
                  : t('kindAuto')}
              </option>
              {TestKindSchema.options.map(k => (
                <option key={k} value={k}>
                  {t(`kinds.${k}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {checklist.items.length ? (
          <ChecklistRows checklist={checklist} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('checklistEmpty')}</p>
        )}
        <Button
          className="h-11 rounded-full"
          disabled={!checklist.complete || !checklist.kind || uploading || creating}
          onClick={() =>
            checklist.kind &&
            create(
              checklist.kind,
              used.map(f => ({fileId: f.id})),
            )
          }
        >
          {creating && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {t('create')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('checklistNote')}</p>
      </aside>
    </div>
  );
}

function FileRow({entry, unused, onRemove}: {entry: Entry; unused: boolean; onRemove: () => void}) {
  const t = useTranslations('exam.upload');
  const file = entry.file;
  const Icon = unused ? FileX : file?.type === 'audio' ? FileAudio : FileText;
  const meta = [fileSize(entry.size), file?.pageCount ? t('pages', {count: file.pageCount}) : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className={cn(card, 'flex flex-col gap-2 p-4', unused && 'opacity-70')}>
      <div className="flex items-center gap-3">
        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{entry.name}</p>
          <p className="text-xs text-muted-foreground">{meta}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={t('remove', {name: entry.name})}
          onClick={onRemove}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        {!file ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            {t('reading')}
          </span>
        ) : unused ? (
          <span className="rounded-full bg-muted px-2.5 py-1">{t('unused')}</span>
        ) : file.type === 'audio' ? (
          <span className="rounded-full bg-muted px-2.5 py-1">
            {t('audio', {
              length:
                file.durationSec === null
                  ? '?'
                  : `${Math.floor(file.durationSec / 60)}:${String(file.durationSec % 60).padStart(2, '0')}`,
            })}
          </span>
        ) : file.pages === null ? (
          <span className="rounded-full bg-warning-soft px-2.5 py-1 text-warning">{t('notRead')}</span>
        ) : (
          pageChips(file.pages)
            .filter(c => c.label !== 'other')
            .map(c => (
              <span key={c.from} className="rounded-full bg-muted px-2.5 py-1">
                <b>{c.from === c.to ? t('page', {n: c.from}) : t('pageRange', {from: c.from, to: c.to})}</b>
                {' · '}
                {t(`labels.${c.label}`)}
                {c.skill && ` ${c.skill === 'listening' ? 'Listening' : 'Reading'}`}
                {c.range && ` ${c.range.from}–${c.range.to}`}
              </span>
            ))
        )}
      </div>
    </li>
  );
}

function ChecklistRows({checklist}: {checklist: Checklist}) {
  const t = useTranslations('exam.upload');
  const several = checklist.kind === 'full';
  return (
    <ul className="flex flex-col gap-3">
      {checklist.items.map(item => {
        const ok = item.status === 'complete';
        const Icon = ok ? CircleCheck : item.required ? CircleAlert : CircleDashed;
        const ranges = item.missing.map(r => (r.from === r.to ? r.from : `${r.from}–${r.to}`)).join(', ');
        return (
          <li key={`${item.skill}-${item.part}`} className="flex gap-2.5">
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                ok ? 'text-success' : item.required ? 'text-warning' : 'text-muted-foreground',
              )}
              aria-hidden="true"
            />
            <div className="text-sm">
              <p className="font-semibold">
                {t(`parts.${item.part}`)}
                {several && ` · ${item.skill === 'listening' ? 'Listening' : 'Reading'}`}
                {item.required && <span className="text-destructive"> *</span>}
              </p>
              <p className="text-muted-foreground">
                {ok
                  ? t('status.complete')
                  : item.status === 'partial'
                    ? t('status.partial', {ranges})
                    : item.required
                      ? t('status.missing')
                      : t('status.optional')}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TemplateTab() {
  const t = useTranslations('exam.upload');
  const upload = useUploadFile();
  const {creating, create} = useCreateImport();
  const [kind, setKind] = useState<TestKind>('reading');
  const [chosen, setChosen] = useState<Partial<Record<ImportSlot, ImportFile>>>({});
  const [busy, setBusy] = useState<ImportSlot | null>(null);
  const name = useId();

  const slots = templateSlots(kind);
  const complete = slots.every(s => !s.required || chosen[s.slot]);
  const ids = Object.fromEntries(Object.entries(chosen).map(([slot, file]) => [slot, file.id]));

  async function pick(slot: ImportSlot, file: File | undefined) {
    if (!file) return;
    // The slot says what it takes: refuse a PDF in the audio slot before it is sent, not after (QA Q-06).
    const type = isAudio(file) ? 'audio' : isPdf(file) ? 'pdf' : null;
    if (type !== slotAccepts(slot)) {
      toast.error(t(type ? 'errors.slotType' : 'errors.type', {name: file.name}));
      return;
    }
    setBusy(slot);
    const uploaded = await upload(file);
    setBusy(null);
    if (!uploaded) return;
    setChosen(c => ({...c, [slot]: uploaded}));
  }

  return (
    <form
      className={cn(card, 'flex flex-col gap-6 p-5')}
      onSubmit={e => {
        e.preventDefault();
        if (complete) void create(kind, slotFiles(kind, ids));
      }}
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-semibold">{t('step1')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {TestKindSchema.options.map(k => (
            <label
              key={k}
              className={cn(
                'flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-xl border p-3 has-checked:border-primary has-checked:bg-secondary has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50',
              )}
            >
              <span className="flex items-center gap-2 font-semibold">
                <input
                  type="radio"
                  name={name}
                  value={k}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  className="accent-primary"
                />
                {t(`kinds.${k}`)}
              </span>
              <span className="text-xs text-muted-foreground">{t(`kindHints.${k}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="flex flex-col gap-3" aria-labelledby={`${name}-files`}>
        <p id={`${name}-files`} className="font-semibold">
          {t('step2')}
        </p>
        <ul className="flex flex-col gap-2">
          {slots.map(({slot, required}) => (
            <SlotRow
              key={slot}
              slot={slot}
              required={required}
              file={chosen[slot]}
              busy={busy === slot}
              testFile={slot !== 'test' && slot !== 'audio' ? chosen.test : undefined}
              onPick={file => pick(slot, file)}
              onUse={file => setChosen(c => ({...c, [slot]: file}))}
              onClear={() =>
                setChosen(c => {
                  const next = {...c};
                  delete next[slot];
                  return next;
                })
              }
            />
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{t('sameFile')}</p>
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">{t('rulesTitle')}</summary>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
            <li>{t('rules.pdf')}</li>
            <li>{t('rules.audio')}</li>
            <li>{t('rules.answers')}</li>
            <li>{t('rules.rights')}</li>
          </ul>
        </details>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">{t('wait')}</p>
        <Button type="submit" className="h-11 rounded-full px-5" disabled={!complete || busy !== null || creating}>
          {creating && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {t('submitTemplate')}
        </Button>
      </div>
    </form>
  );
}

function SlotRow({
  slot,
  required,
  file,
  busy,
  testFile,
  onPick,
  onUse,
  onClear,
}: {
  slot: ImportSlot;
  required: boolean;
  file: ImportFile | undefined;
  busy: boolean;
  /** The file of the "Đề" box, offered for boxes a PDF with an answer key at the end can also fill. */
  testFile: ImportFile | undefined;
  onPick: (file: File | undefined) => void;
  onUse: (file: ImportFile) => void;
  onClear: () => void;
}) {
  const t = useTranslations('exam.upload');
  const input = useRef<HTMLInputElement>(null);
  const audio = slotAccepts(slot) === 'audio';
  const Icon = audio ? FileAudio : FileText;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
      <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1 basis-40">
        <p className="font-semibold">
          {t(`slots.${slot}`)}{' '}
          {required ? (
            <span className="text-destructive">*</span>
          ) : (
            <span className="text-xs font-normal text-muted-foreground">{t('optional')}</span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {busy
            ? t('uploading')
            : file
              ? `${file.originalName} · ${fileSize(file.sizeBytes)}`
              : t(audio ? 'noAudio' : 'noPdf')}
        </p>
      </div>
      {testFile && file?.id !== testFile.id && (
        <Button type="button" variant="ghost" className="h-11 rounded-full px-3" onClick={() => onUse(testFile)}>
          {t('useTestFile')}
        </Button>
      )}
      {file && !required && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={t('clear', {slot: t(`slots.${slot}`)})}
          onClick={onClear}
        >
          <X aria-hidden="true" />
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-full px-4"
        disabled={busy}
        aria-label={`${file ? t('change') : t('choose')}: ${t(`slots.${slot}`)}`}
        onClick={() => input.current?.click()}
      >
        {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {file ? t('change') : t('choose')}
      </Button>
      <input
        ref={input}
        type="file"
        accept={audio ? AUDIO_ACCEPT : PDF_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => {
          onPick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </li>
  );
}
