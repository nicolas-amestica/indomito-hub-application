import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type { AgentManagedConfig, AgentManagementSnapshot } from '../../interfaces/agent-management.interface';
import { AgentManagementService } from '../../services/agent-management.service';
import { AgentManagementComponent } from './agent-management.component';

const config: AgentManagedConfig = {
  personality: { displayName: 'Agente IA', role: 'Asistente virtual', tone: 'Amigable y profesional', language: 'Español chileno formal', responseStyle: 'Preciso, conciso y directo', useEmoji: false, greeting: 'Hola', closing: '', forbiddenPhrases: ['descuento por pago en efectivo'], additionalInstructions: '' },
  generation: { model: 'gemini-3.5-flash-lite', temperature: 0.2, topP: 0.8, maxMessageLength: 1200, maxHistoryTurns: 20, debounceMs: 4000, rateLimitMax: 12, rateLimitWindowSeconds: 60 },
  policies: { offerMeetings: true, humanHandoffEnabled: true, handoffWhatsAppEnabled: true, handoffEmailEnabled: true, handoffPhone: '56963552893', handoffEmail: 'info@girasindomito.cl', explainProgramDifferences: true, sendSernaturWithQuotations: true, handoffConfirmation: 'Te derivé con nuestro equipo.', fallbackResponse: 'Puedo derivarte.' },
  knowledge: [{ id: 'knowledge-1', title: 'Financiamiento', category: 'Pagos', questionHints: [], answer: 'Las cuotas no tienen interés.', active: true, priority: 100, requiresHuman: false }],
  programs: [{ id: 'program-1', name: 'Bariloche', destination: 'bariloche', country: 'Argentina', originRegions: ['v'], originCities: [], description: 'Programa de prueba', activities: ['Excursión'], durationDays: 5, documentKey: 'programas/bariloche.pdf', fileName: 'bariloche.pdf', active: true, sortOrder: 10 }],
};

const revision = { version: '20261027T120000Z', status: 'published' as const, updatedAt: '2026-10-27T12:00:00Z', publishedAt: '2026-10-27T12:00:00Z', config };
const snapshot: AgentManagementSnapshot = { draft: { ...revision, status: 'draft', version: 'draft' }, published: revision, versions: [revision] };
const api = {
  get: vi.fn(() => of(structuredClone(snapshot))),
  saveDraft: vi.fn(() => of(snapshot.draft)),
  publish: vi.fn(() => of(revision)),
  restore: vi.fn(() => of(revision)),
  prepareProgramUpload: vi.fn(),
  uploadProgram: vi.fn(),
};

describe('AgentManagementComponent', () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  });
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ imports: [AgentManagementComponent], providers: [{ provide: AgentManagementService, useValue: api }] });
  });

  it('guarda el formulario actual antes de publicar', async () => {
    const fixture = TestBed.createComponent(AgentManagementComponent);
    fixture.detectChanges(); await fixture.whenStable();
    fixture.componentInstance.form()!.personality.greeting = 'Nuevo saludo';
    fixture.componentInstance.publish(); await fixture.whenStable();
    expect(api.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ personality: expect.objectContaining({ greeting: 'Nuevo saludo' }) }));
    expect(api.publish).toHaveBeenCalledOnce();
    expect(api.saveDraft.mock.invocationCallOrder[0]).toBeLessThan(api.publish.mock.invocationCallOrder[0]);
  });

  it('muestra los destinatarios administrables de la derivación', async () => {
    const fixture = TestBed.createComponent(AgentManagementComponent);
    fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.componentInstance.form()?.policies.handoffPhone).toBe('56963552893');
    expect(fixture.componentInstance.form()?.policies.handoffEmail).toBe('info@girasindomito.cl');
  });

  it.runIf(!navigator.userAgent.toLowerCase().includes('jsdom'))('no desborda en 320, 390, 768 y 1440 px con temas claro y oscuro', async () => {
    const { page } = await import('vitest/browser');
    const fixture = TestBed.createComponent(AgentManagementComponent);
    fixture.detectChanges(); await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    for (const theme of ['light', 'dark']) {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      for (const width of [320, 390, 768, 1440]) {
        await page.viewport(width, 1000); fixture.detectChanges();
        expect(root.scrollWidth, `${theme} ${width}px`).toBeLessThanOrEqual(root.clientWidth);
        expect(getComputedStyle(root.querySelector<HTMLElement>('#agent-management-title')!).color).not.toBe('rgba(0, 0, 0, 0)');
      }
    }
    document.documentElement.classList.remove('dark');
  });
});
