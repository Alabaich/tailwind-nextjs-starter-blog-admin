'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function DeployRail() {
  const router = useRouter();
  const [info, setInfo] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [msg, setMsg] = useState('');

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      setInfo(await res.json());
    } catch {
      setInfo({ status: 'unreachable' });
    }
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [poll]);

  async function deploy() {
    setMsg('');
    const res = await fetch('/api/publish', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg(data.queued ? 'Queued after the current build' : 'Build started');
      poll();
    } else {
      setMsg(data.error || 'Deploy failed to start');
    }
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const active = info?.active === 'blog-green' ? 'green' : 'blue';
  const building = info?.status === 'building';
  const state =
    info == null
      ? '…'
      : info.status === 'building'
        ? `building ${active === 'blue' ? 'green' : 'blue'}…`
        : info.status === 'error'
          ? 'build failed'
          : info.status === 'unreachable'
            ? 'deployer offline'
            : 'in sync';

  return (
    <>
      <div className="rail">
        <span className="brand">blog-admin</span>
        <span className="split" title={`Traffic is served by blog-${active}`}>
          <span className={active === 'blue' ? 'live-blue' : ''}>blue</span>
          <span className={active === 'green' ? 'live-green' : ''}>green</span>
        </span>
        <span className={`state ${info?.status || ''} ${building ? 'pulse' : ''}`}>
          {state}
        </span>
        {msg && <span className="state">{msg}</span>}
        <span className="spacer" />
        <button onClick={() => setShowLog((v) => !v)}>
          {showLog ? 'Hide log' : 'Log'}
        </button>
        <button className="primary" onClick={deploy} disabled={building}>
          {building ? 'Building…' : 'Deploy'}
        </button>
        <button onClick={logout}>Sign out</button>
      </div>
      {showLog && (
        <div className="wrap" style={{ paddingTop: 16, paddingBottom: 0 }}>
          <div className="log">
            {(info?.log || []).join('\n') || 'No log output yet.'}
          </div>
        </div>
      )}
    </>
  );
}
