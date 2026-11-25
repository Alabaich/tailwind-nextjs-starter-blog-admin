'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent, KeyboardEvent } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { api, notifyContentChanged, postJson } from '@/lib/client';
import { renderMarkdown, wordCount } from '@/lib/markdown';
import type { Post } from '@/lib/posts';
import { isValidSlug, slugify } from '@/lib/slug';

type View = 'write' | 'split' | 'preview';

interface Message {
  kind: 'ok' | 'err';
  text: string;
}

const VIEWS: { id: View; label: string }[] = [
  { id: 'write', label: 'Write' },
  { id: 'split', label: 'Split' },
  { id: 'preview', label: 'Preview' },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function Editor({ initial }: { initial: Post | null }) {
  const router = useRouter();
  const isNew = initial === null;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [date, setDate] = useState(initial?.date || today());
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [draft, setDraft] = useState(initial ? initial.draft : true);
  const [content, setContent] = useState(initial?.content ?? '');

  const [view, setView] = useState<View>('split');
  const [mounted, setMounted] = useState(false);
  const [msg, setMsg] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const body = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingSelection = useRef<[number, number] | null>(null);

  // Dirty tracking: compare against the last state the server acknowledged.
  const snapshot = JSON.stringify([title, slug, date, tags, summary, draft, content]);
  const [saved, setSaved] = useState(snapshot);
  const dirty = snapshot !== saved;

  const derivedSlug = isNew ? slug.trim() || slugify(title) : slug;
  const slugError = isNew && slug.trim() !== '' && !isValidSlug(slug.trim());

  useEffect(() => {
    setMounted(true);
    // Side-by-side needs room; start in Write on narrow screens.
    if (window.matchMedia('(max-width: 900px)').matches) setView('write');
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Restore the caret after a programmatic edit re-renders the textarea.
  useEffect(() => {
    const sel = pendingSelection.current;
    if (sel && body.current) {
      body.current.focus();
      body.current.setSelectionRange(sel[0], sel[1]);
      pendingSelection.current = null;
    }
  }, [content]);

  const deferred = useDeferredValue(content);
  const html = useMemo(
    () => (mounted && view !== 'write' ? renderMarkdown(deferred) : ''),
    [mounted, view, deferred]
  );
  const words = useMemo(() => wordCount(deferred), [deferred]);

  /** Replaces the current selection with `before + selection + after`. */
  const wrap = useCallback((before: string, after = '', placeholder = '') => {
    const el = body.current;
    const start = el?.selectionStart ?? 0;
    const end = el?.selectionEnd ?? 0;
    setContent((current) => {
      const at = el ? start : current.length;
      const to = el ? end : current.length;
      const selected = current.slice(at, to) || placeholder;
      pendingSelection.current = [at + before.length, at + before.length + selected.length];
      return current.slice(0, at) + before + selected + after + current.slice(to);
    });
  }, []);

  const save = useCallback(async () => {
    if (busy || !title.trim() || slugError) return;
    setBusy(true);
    setMsg(null);
    const payload = { title, date, tags, summary, draft, content };
    const taken = snapshot;
    const res = isNew
      ? await postJson<{ slug: string }>('/api/posts', 'POST', {
          ...payload,
          slug: slug.trim() || undefined,
        })
      : await postJson<{ slug: string }>(`/api/posts/${initial.slug}`, 'PUT', payload);
    setBusy(false);
    if (!res.ok || !res.data) {
      setMsg({ kind: 'err', text: res.error ?? 'Save failed' });
      return;
    }
    setSaved(taken);
    notifyContentChanged();
    if (isNew) {
      router.replace(`/edit/${res.data.slug}`);
    } else {
      setMsg({ kind: 'ok', text: draft ? 'Draft saved' : 'Saved. Deploy to publish.' });
      router.refresh();
    }
  }, [busy, title, slugError, date, tags, summary, draft, content, snapshot, isNew, slug, initial, router]);

  async function remove() {
    if (!initial) return;
    setBusy(true);
    const res = await api(`/api/posts/${initial.slug}`, { method: 'DELETE' });
    setBusy(false);
    setConfirmDelete(false);
    if (!res.ok) {
      setMsg({ kind: 'err', text: res.error ?? 'Delete failed' });
      return;
    }
    notifyContentChanged();
    setSaved(snapshot); // nothing left to lose
    router.push('/');
    router.refresh();
  }

  async function upload(files: FileList | File[]) {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    setUploading(true);
    setMsg(null);
    for (const file of images) {
      const form = new FormData();
      form.append('file', file);
      const res = await api<{ path: string }>('/api/upload', { method: 'POST', body: form });
      if (!res.ok || !res.data) {
        setMsg({ kind: 'err', text: `${file.name}: ${res.error ?? 'upload failed'}` });
        break;
      }
      const alt = file.name.replace(/\.[^.]*$/, '').replace(/[[\]]/g, '');
      wrap(`![${alt}](${res.data.path})\n`);
      notifyContentChanged();
    }
    setUploading(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 's') {
      e.preventDefault();
      void save();
    } else if (e.target === body.current && key === 'b') {
      e.preventDefault();
      wrap('**', '**', 'bold');
    } else if (e.target === body.current && key === 'i') {
      e.preventDefault();
      wrap('_', '_', 'italic');
    } else if (e.target === body.current && key === 'k') {
      e.preventDefault();
      wrap('[', '](https://)', 'link text');
    }
  }

  function onPaste(e: ClipboardEvent) {
    if (e.clipboardData.files.length > 0) {
      e.preventDefault();
      void upload(e.clipboardData.files);
    }
  }

  function onDrop(e: DragEvent) {
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      e.preventDefault();
      void upload(e.dataTransfer.files);
    }
  }

  function leave(e: React.MouseEvent) {
    if (dirty && !window.confirm('Discard unsaved changes?')) e.preventDefault();
  }

  const status = busy ? 'Saving…' : dirty ? 'Unsaved changes' : isNew ? '' : 'All changes saved';

  return (
    <div className="editor" onKeyDown={onKeyDown}>
      <div className="editor-head">
        <Link href="/" className="back" onClick={leave}>
          ← Posts
        </Link>
        <span className={`save-state ${dirty ? 'dirty' : ''}`} role="status">
          {status}
        </span>
        {msg && (
          <span className={`msg ${msg.kind}`} role={msg.kind === 'err' ? 'alert' : 'status'}>
            {msg.text}
          </span>
        )}
        <span className="spacer" />
        {!isNew && (
          <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        )}
        <button
          type="button"
          className="primary"
          onClick={save}
          disabled={busy || !title.trim() || slugError || (!isNew && !dirty)}
          title="Save (Ctrl/⌘ + S)"
        >
          {busy ? 'Saving…' : isNew ? 'Create post' : 'Save'}
        </button>
      </div>

      <input
        className="title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Post title"
        aria-label="Title"
        maxLength={200}
        autoFocus={isNew}
      />

      <div className="meta">
        <div className="field">
          <label htmlFor="f-slug">Slug</label>
          <input
            id="f-slug"
            value={isNew ? slug : initial.slug}
            placeholder={slugify(title) || 'from-the-title'}
            disabled={!isNew}
            aria-invalid={slugError}
            aria-describedby="f-slug-hint"
            onChange={(e) => setSlug(e.target.value)}
            spellCheck={false}
          />
          <span id="f-slug-hint" className={`hint ${slugError ? 'err' : ''}`}>
            {slugError
              ? 'Lowercase letters, digits and hyphens only'
              : isNew
                ? derivedSlug
                  ? `File: ${derivedSlug}.mdx`
                  : 'Generated from the title'
                : 'Fixed after creation, so links keep working'}
          </span>
        </div>
        <div className="field">
          <label htmlFor="f-date">Date</label>
          <input id="f-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="f-tags">Tags</label>
          <input
            id="f-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="next-js, guide"
          />
          <span className="hint">Comma separated</span>
        </div>
        <div className="field">
          <span className="label">Visibility</span>
          <label className="switch">
            <input
              type="checkbox"
              role="switch"
              checked={!draft}
              onChange={(e) => setDraft(!e.target.checked)}
            />
            <span className="track" aria-hidden="true" />
            <span>{draft ? 'Draft' : 'Published'}</span>
          </label>
          <span className="hint">
            {draft ? 'Hidden on the live site' : 'Goes live on the next Deploy'}
          </span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="f-summary">Summary</label>
        <input
          id="f-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="One or two sentences for post lists and search engines"
          maxLength={500}
        />
      </div>

      <div className="body-bar">
        <div className="format" role="toolbar" aria-label="Formatting">
          <button type="button" onClick={() => wrap('**', '**', 'bold')} title="Bold (Ctrl/⌘ + B)">
            <b>B</b>
          </button>
          <button type="button" onClick={() => wrap('_', '_', 'italic')} title="Italic (Ctrl/⌘ + I)">
            <i>I</i>
          </button>
          <button type="button" onClick={() => wrap('\n## ', '\n', 'Heading')} title="Heading">
            H2
          </button>
          <button type="button" onClick={() => wrap('\n> ', '\n', 'Quote')} title="Quote">
            “ ”
          </button>
          <button type="button" onClick={() => wrap('`', '`', 'code')} title="Inline code">
            {'</>'}
          </button>
          <button
            type="button"
            onClick={() => wrap('[', '](https://)', 'link text')}
            title="Link (Ctrl/⌘ + K)"
          >
            Link
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Image'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void upload(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
        <span className="spacer" />
        <div className="segmented" role="group" aria-label="Editor layout">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`view-${v.id}`}
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`panes ${view}`}>
        {view !== 'preview' && (
          <textarea
            ref={body}
            className={`body ${dragging ? 'dragging' : ''}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={onPaste}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            placeholder="Write in Markdown. Paste or drop images straight into the text."
            aria-label="Body (Markdown)"
            spellCheck
          />
        )}
        {view !== 'write' && (
          <div
            className="preview"
            aria-label="Preview"
            // Sanitized by DOMPurify in renderMarkdown.
            dangerouslySetInnerHTML={{
              __html: html || '<p class="muted">Nothing to preview yet.</p>',
            }}
          />
        )}
      </div>

      <p className="editor-foot">
        <span>
          {words} word{words === 1 ? '' : 's'} · about {Math.max(1, Math.round(words / 220))} min
          read
        </span>
        <span>
          Preview renders plain Markdown; the starter&apos;s MDX components appear on the live site.
        </span>
      </p>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this post?"
        confirmLabel="Delete post"
        danger
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      >
        <p>
          <code>{initial?.slug}.mdx</code> is removed from disk. It disappears from the live site
          on the next Deploy.
        </p>
        <p>The deletion is recorded in the content git history, so it can be restored.</p>
      </ConfirmDialog>
    </div>
  );
}
