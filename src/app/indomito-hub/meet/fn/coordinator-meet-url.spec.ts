import { coordinatorMeetUrl } from './coordinator-meet-url';

describe('coordinatorMeetUrl', () => {
  it('reemplaza la cuenta personal y conserva el código y otros parámetros', () => {
    const url = new URL(coordinatorMeetUrl('https://meet.google.com/abc-defg-hij?authuser=0&hs=122')!);
    expect(url.pathname).toBe('/abc-defg-hij');
    expect(url.searchParams.get('authuser')).toBe('agente@work.girasindomito.cl');
    expect(url.searchParams.get('hs')).toBe('122');
  });
  it('rechaza destinos ajenos a Meet y protocolos no seguros', () => {
    for (const link of ['https://example.test', 'http://meet.google.com/test', 'javascript:alert(1)', 'invalid']) expect(coordinatorMeetUrl(link)).toBeNull();
  });
});
