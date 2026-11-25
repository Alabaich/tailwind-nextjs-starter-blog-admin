'use client';

export default function DashError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="centered">
      <h1>Something went wrong</h1>
      <p className="muted">The admin could not load this page. Details are in the server log.</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
