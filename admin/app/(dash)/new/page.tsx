import type { Metadata } from 'next';
import Editor from '@/components/Editor';

export const metadata: Metadata = { title: 'New post' };

export default function NewPostPage() {
  return <Editor initial={null} />;
}
