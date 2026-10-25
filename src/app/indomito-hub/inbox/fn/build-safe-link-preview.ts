export interface SafeLinkPreview {
  readonly href: string;
  readonly host: string;
}

const absoluteHttpUrl = /https?:\/\/[^\s<>"']+/giu;
const trailingPunctuation = /[),.!?;:\]}]+$/u;

export function buildSafeLinkPreview(content: string | null): SafeLinkPreview | null {
  if (!content) return null;
  for (const match of content.matchAll(absoluteHttpUrl)) {
    const candidate = match[0].replace(trailingPunctuation, '');
    if (candidate.length > 2_048) continue;
    try {
      const url = new URL(candidate);
      if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) continue;
      return { href: url.href, host: url.hostname.replace(/^www\./iu, '') };
    } catch {
      // Ignore malformed user-provided URLs and continue with the next candidate.
    }
  }
  return null;
}
