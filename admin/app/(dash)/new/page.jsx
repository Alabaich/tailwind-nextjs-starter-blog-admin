import Link from 'next/link';
import Editor from '../../../components/Editor';

export default function NewPostPage() {
  return (
    <>
      <h1>New post</h1>
      <p className="sub">
        <Link href="/">← All posts</Link>
      </p>
      <Editor initial={null} />
    </>
  );
}
