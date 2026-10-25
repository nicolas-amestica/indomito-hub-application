import { buildSafeLinkPreview } from './build-safe-link-preview';

describe('buildSafeLinkPreview', () => {
  it('returns the first absolute HTTP link without trailing punctuation', () => {
    expect(buildSafeLinkPreview('Revisa https://www.example.com/ruta?x=1.')).toEqual({
      href: 'https://www.example.com/ruta?x=1',
      host: 'example.com',
    });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    'https://user:secret@example.com/private',
    'texto sin enlaces',
  ])('rejects unsafe or unsupported content: %s', (content) => {
    expect(buildSafeLinkPreview(content)).toBeNull();
  });
});
