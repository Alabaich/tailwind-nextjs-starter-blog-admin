'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { marked } from 'marked';

export default function Editor({ initial }) {
  const router = useRouter();
  const isNew = !initial;
  const [title, setTitle] = useState(initial?.title || '');
  const [slug, setSlug] = useState(initial?.slug || '');
  const [date, setDate] = useState(
    initial?.date || new Date().toISOString().slice(0, 10)
  );
  const [tags, setTags] = useState((initial?.tags || []).join(', '));
  const [summary, setSummary] = useState(initial?.summary || '');
  const [draft, setDraft] = useState(initial ? initial.draft : true);
  const [content, setContent] = useState(initial?.content || '');
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const body = { title, slug: slug || undefined, date, tags, summary, draft, content };
    const res = await fetch(isNew ? '/api/posts' : `/api/posts/${initial.slug}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ kind: 'err', text: data.error || 'Save failed' });
      return;
    }
    setMsg({ kind: 'ok', text: 'Saved — press Deploy to publish it' });
    if (isNew) router.push(`/edit/${data.slug}`);
  }

  async function remove() {
    if (!confirm(`Delete "${initial.slug}"? The file will be removed.`)) return;
    const res = await fetch(`/api/posts/${initial.slug}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setMsg({ kind: 'err', text: 'Delete failed' });
    }
  }

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setContent((c) => `${c}\n\n![${file.name}](${data.path})\n`);
      setMsg({ kind: 'ok', text: 'Image uploaded and inserted' });
    } else {
      setMsg({ kind: 'err', text: data.error || 'Upload failed' });
    }
    e.target.value = '';
  }

  return (
    <>
      <div className="grid-2">
        <div>
          <label htmlFor="f-title">title</label>
          <input id="f-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="f-slug">slug</label>
          <input
            id="f-slug"
            value={slug}
            placeholder={isNew ? 'auto from title' : ''}
            disabled={!isNew}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="f-date">date</label>
          <input id="f-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="f-tags">tags (comma separated)</label>
          <input id="f-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
      </div>

      <label htmlFor="f-summary">summary</label>
      <input id="f-summary" value={summary} onChange={(e) => setSummary(e.target.value)} />

      <label htmlFor="f-body">body (mdx)</label>
      {preview ? (
        <div
          className="preview"
          dangerouslySetInnerHTML={{ __html: marked.parse(content || '*Nothing yet*') }}
        />
      ) : (
        <textarea
          id="f-body"
          className="body"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      )}

      <div className="toolbar">
        <button className="primary" onClick={save} disabled={busy || !title}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => setPreview((v) => !v)}>
          {preview ? 'Edit' : 'Preview'}
        </button>
        <button onClick={() => fileInput.current?.click()}>Add image</button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={upload}
        />
        <label
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}
        >
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={draft}
            onChange={(e) => setDraft(e.target.checked)}
          />
          draft
        </label>
        {!isNew && (
          <button className="danger" onClick={remove}>
            Delete
          </button>
        )}
        {msg && <span className={`msg ${msg.kind}`}>{msg.text}</span>}
      </div>
      <p className="sub">
        Preview renders plain Markdown. Custom MDX components from the starter
        appear after a rebuild on the live site.
      </p>
    </>
  );
}
