import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="centered">
      <h1>Not found</h1>
      <p className="muted">That page or post does not exist.</p>
      <Link className="btn" href="/">
        Back to posts
      </Link>
    </main>
  );
}
