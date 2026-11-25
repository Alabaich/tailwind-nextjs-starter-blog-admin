'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { api, CONTENT_CHANGED, timeAgo } from '@/lib/client';
import type { AdminStatus, Color } from '@/lib/deployer';

const short = (color: Color): 'blue' | 'green' => (color === 'blog-green' ? 'green' : 'blue');

interface Notice {
  kind: 'ok' | 'err' | 'info';
  text: string;
}

export default function DeployRail() {
  const router = useRouter();
  const [info, setInfo] = useState<AdminStatus | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [acting, setActing] = useState(false);
  const previous = useRef<AdminStatus | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  const poll = useCallback(async () => {
    const res = await api<AdminStatus>('/api/status');
    setInfo(res.data ?? { status: 'unreachable' });
  }, []);

  const online = info !== null && info.status !== 'unreachable' ? info : null;
  const busy = online?.status === 'building' || online?.status === 'rolling-back';

  // Poll quickly while something is happening, lazily otherwise, and not at
  // all while the tab is in the background.
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void poll();
    };
    tick();
    const timer = setInterval(tick, busy ? 2000 : 8000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener(CONTENT_CHANGED, tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener(CONTENT_CHANGED, tick);
    };
  }, [poll, busy]);

  // Announce the outcome when a build or rollback finishes.
  useEffect(() => {
    const before = previous.current;
    previous.current = info;
    if (!before || before.status === 'unreachable' || !info || info.status === 'unreachable') {
      return;
    }
    const wasBusy = before.status === 'building' || before.status === 'rolling-back';
    if (!wasBusy) return;
    if (info.status === 'idle') {
      setNotice({ kind: 'ok', text: `${short(info.active)} is live` });
    } else if (info.status === 'error') {
      setNotice({ kind: 'err', text: 'Failed. The live site was not touched.' });
      setShowLog(true);
    }
  }, [info]);

  // Notices are transient; errors stay until the next action.
  useEffect(() => {
    if (!notice || notice.kind === 'err') return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Keep the newest log line in view.
  const logText = online?.log.join('\n') ?? '';
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logText, showLog]);

  async function act(url: string, started: string) {
    setActing(true);
    setNotice(null);
    const res = await api<{ queued?: boolean }>(url, { method: 'POST' });
    setActing(false);
    setNotice(
      res.ok
        ? { kind: 'info', text: res.data?.queued ? 'Queued after the current build' : started }
        : { kind: 'err', text: res.error ?? 'Request failed' }
    );
    void poll();
  }

  async function logout() {
    await api('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const active = online ? short(online.active) : null;
  const standby = active === 'blue' ? 'green' : 'blue';
  let state = 'Connecting…';
  let stateClass = '';
  if (info?.status === 'unreachable') {
    state = 'Deployer offline';
    stateClass = 'error';
  } else if (online?.status === 'building') {
    state = `Building ${standby}…`;
    stateClass = 'busy';
  } else if (online?.status === 'rolling-back') {
    state = 'Rolling back…';
    stateClass = 'busy';
  } else if (online?.status === 'error') {
    state = 'Last build failed';
    stateClass = 'error';
  } else if (online?.dirty) {
    state = 'Unpublished changes';
    stateClass = 'dirty';
  } else if (online) {
    state = online.lastDeployAt ? `Live · deployed ${timeAgo(online.lastDeployAt)}` : 'Live';
    stateClass = 'ok';
  }

  const rollbackTo = online && !busy && online.rollbackTo ? short(online.rollbackTo) : null;

  return (
    <header className="rail">
      <div className="rail-bar">
        <Link href="/" className="brand">
          blog<span>admin</span>
        </Link>

        <span
          className="colors"
          role="img"
          aria-label={active ? `Traffic is served by ${active}` : 'Live color unknown'}
          title={active ? `Traffic is served by blog-${active}` : undefined}
        >
          <span className={active === 'blue' ? 'live blue' : 'blue'}>blue</span>
          <span className={active === 'green' ? 'live green' : 'green'}>green</span>
        </span>

        <span className={`state ${stateClass}`} role="status">
          <i aria-hidden="true" />
          {state}
        </span>

        {notice && (
          <span className={`notice ${notice.kind}`} role="status">
            {notice.text}
          </span>
        )}

        <span className="spacer" />

        <button
          type="button"
          className="ghost"
          aria-expanded={showLog}
          aria-controls="deploy-log"
          onClick={() => setShowLog((v) => !v)}
        >
          {showLog ? 'Hide log' : 'Log'}
        </button>
        {rollbackTo && (
          <button
            type="button"
            className="ghost"
            onClick={() => setConfirmRollback(true)}
            disabled={acting}
            title={`Switch traffic back to blog-${rollbackTo}`}
          >
            Roll back
          </button>
        )}
        <button
          type="button"
          className={online?.dirty && !busy ? 'deploy attention' : 'deploy'}
          onClick={() => act('/api/publish', 'Build started')}
          disabled={!online || busy || acting}
        >
          {busy ? 'Working…' : 'Deploy'}
        </button>
        <button type="button" className="ghost" onClick={logout}>
          Sign out
        </button>
      </div>

      {showLog && (
        <div className="log-drawer" id="deploy-log">
          {online?.error && <p className="log-error">{online.error}</p>}
          <pre className="log" ref={logRef} tabIndex={0} aria-label="Deploy log">
            {logText || 'No log output yet.'}
          </pre>
        </div>
      )}

      <ConfirmDialog
        open={confirmRollback}
        title={`Roll back to ${rollbackTo ?? 'the previous release'}?`}
        confirmLabel="Roll back"
        busy={acting}
        onCancel={() => setConfirmRollback(false)}
        onConfirm={() => {
          setConfirmRollback(false);
          void act('/api/rollback', 'Rollback started');
        }}
      >
        <p>
          Traffic switches to the previous release within a second. Nothing is rebuilt and your
          post files are not changed.
        </p>
        <p>
          The release you are leaving stays on standby, so you can switch forward again. The next
          Deploy publishes whatever is on disk.
        </p>
      </ConfirmDialog>
    </header>
  );
}
