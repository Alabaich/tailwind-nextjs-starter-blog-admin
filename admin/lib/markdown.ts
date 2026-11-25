import DOMPurify from 'dompurify';
import { marked } from 'marked';

let hooked = false;

/**
 * Markdown -> sanitized HTML for the editor preview. Browser only.
 *
 * Markdown allows raw HTML, and post files can come from anywhere (an
 * upstream pull, a restored backup), so the output is sanitized before it is
 * injected into the admin's own origin.
 */
export function renderMarkdown(source: string): string {
  if (typeof window === 'undefined') return '';
  if (!hooked) {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
    hooked = true;
  }
  const html = marked.parse(source, { async: false, gfm: true });
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export function wordCount(source: string): number {
  return source.trim() ? source.trim().split(/\s+/).length : 0;
}
