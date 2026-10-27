import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type {
  AgentManagedConfig,
  AgentManagementSnapshot,
} from '../../interfaces/agent-management.interface';
import { AgentManagementService } from '../../services/agent-management.service';
import { AgentManagementComponent } from './agent-management.component';
import { OperationalMetricsService } from '../../../../../shared/operational-metrics/services/operational-metrics.service';

function contrastRatio(foreground: string, background: string): number {
  const luminance = (value: string): number => {
    const channels =
      value
        .match(/[\da-f]{2}/gi)
        ?.slice(0, 3)
        .map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
    const linear = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const config: AgentManagedConfig = {
  personality: {
    displayName: 'Agente IA',
    role: 'Asistente virtual',
    tone: 'Amigable y profesional',
    language: 'Español chileno formal',
    responseStyle: 'Preciso, conciso y directo',
    useEmoji: false,
    greeting: 'Hola',
    closing: '',
    forbiddenPhrases: ['descuento por pago en efectivo'],
    additionalInstructions: '',
  },
  generation: {
    model: 'gemini-3.5-flash-lite',
    temperature: 0.2,
    topP: 0.8,
    maxMessageLength: 1200,
    maxHistoryTurns: 20,
    debounceMs: 4000,
    rateLimitMax: 12,
    rateLimitWindowSeconds: 60,
  },
  policies: {
    offerMeetings: true,
    humanHandoffEnabled: true,
    handoffWhatsAppEnabled: true,
    handoffEmailEnabled: true,
    handoffPhone: '56963552893',
    handoffEmail: 'info@girasindomito.cl',
    explainProgramDifferences: true,
    sendSernaturWithQuotations: true,
    handoffConfirmation: 'Te derivé con nuestro equipo.',
    fallbackResponse: 'Puedo derivarte.',
  },
  commercialPolicies: [],
  knowledge: [
    {
      id: 'knowledge-1',
      title: 'Financiamiento',
      category: 'Pagos',
      questionHints: [],
      answer: 'Las cuotas no tienen interés.',
      active: true,
      priority: 100,
      requiresHuman: false,
    },
  ],
  programs: [
    {
      id: 'program-1',
      name: 'Bariloche',
      destination: 'bariloche',
      destinations: ['bariloche'],
      country: 'Argentina',
      originRegions: ['v'],
      originCities: [],
      description: 'Programa de prueba',
      activities: ['Excursión'],
      durationDays: 5,
      documentKey: 'programas/bariloche.pdf',
      fileName: 'bariloche.pdf',
      active: true,
      sortOrder: 10,
    },
  ],
};

const revision = {
  version: '20261027T120000Z',
  status: 'published' as const,
  updatedAt: '2026-10-27T12:00:00Z',
  publishedAt: '2026-10-27T12:00:00Z',
  config,
};
const snapshot: AgentManagementSnapshot = {
  draft: { ...revision, status: 'draft', version: 'draft' },
  published: revision,
  versions: [revision],
};
const api = {
  get: vi.fn(() => of(structuredClone(snapshot))),
  saveDraft: vi.fn(() => of(snapshot.draft)),
  publish: vi.fn(() => of(revision)),
  restore: vi.fn(() => of(revision)),
  prepareProgramUpload: vi.fn(),
  uploadProgram: vi.fn(),
  prepareProgramDownload: vi.fn(() =>
    of({ downloadUrl: 'https://example.test/programa.pdf', expiresAt: '2026-10-27T12:05:00Z' }),
  ),
};
const metricsApi = {
  get: vi.fn(() =>
    of({
      agent: {
        period: '2026-10',
        calls: 3,
        inputTokens: 100,
        outputTokens: 25,
        thoughtTokens: 0,
        toolUseTokens: 0,
        cachedTokens: 0,
        totalTokens: 125,
      },
      aws: {
        cost: {
          amount: 0.14,
          currency: 'USD',
          estimated: true,
          scope: 'account',
          period: '2026-10',
        },
        freeTier: [],
        safe: 0,
        warning: 0,
        exceeded: 0,
        available: true,
        fetchedAt: '2026-10-27T12:00:00Z',
      },
    }),
  ),
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
    TestBed.configureTestingModule({
      imports: [AgentManagementComponent],
      providers: [
        { provide: AgentManagementService, useValue: api },
        { provide: OperationalMetricsService, useValue: metricsApi },
      ],
    });
  });

  it('guarda el formulario actual antes de publicar', async () => {
    const fixture = TestBed.createComponent(AgentManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.form()!.personality.greeting = 'Nuevo saludo';
    fixture.componentInstance.publish();
    await fixture.whenStable();
    expect(api.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        personality: expect.objectContaining({ greeting: 'Nuevo saludo' }),
      }),
    );
    expect(api.publish).toHaveBeenCalledOnce();
    expect(api.saveDraft.mock.invocationCallOrder[0]).toBeLessThan(
      api.publish.mock.invocationCallOrder[0],
    );
  });

  it('muestra los destinatarios administrables de la derivación', async () => {
    const fixture = TestBed.createComponent(AgentManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.form()?.policies.handoffPhone).toBe('56963552893');
    expect(fixture.componentInstance.form()?.policies.handoffEmail).toBe('info@girasindomito.cl');
  });

  it('normaliza programas antiguos y conserva varios destinos', async () => {
    const legacySnapshot = structuredClone(snapshot);
    legacySnapshot.draft.config.programs[0].destinations = undefined;
    api.get.mockReturnValueOnce(of(legacySnapshot));
    const fixture = TestBed.createComponent(AgentManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.form()?.programs[0].destinations).toEqual(['bariloche']);

    fixture.componentInstance.openProgram({
      ...config.programs[0],
      destinations: ['pucon', 'sur_de_chile'],
    });
    fixture.componentInstance.saveProgram();
    expect(fixture.componentInstance.form()?.programs[0]).toEqual(
      expect.objectContaining({ destination: 'pucon', destinations: ['pucon', 'sur_de_chile'] }),
    );
  });

  it('normaliza palabras clave nulas antes de editar una respuesta histórica', async () => {
    const legacySnapshot = structuredClone(snapshot);
    legacySnapshot.draft.config.knowledge[0].questionHints = null as unknown as string[];
    api.get.mockReturnValueOnce(of(legacySnapshot));
    const fixture = TestBed.createComponent(AgentManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const knowledge = fixture.componentInstance.form()!.knowledge[0];
    expect(knowledge.questionHints).toEqual([]);
    expect(() => fixture.componentInstance.openKnowledge(knowledge)).not.toThrow();
  });

  it('permite agregar, editar y eliminar políticas comerciales', async () => {
    const fixture = TestBed.createComponent(AgentManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.openPolicy();
    fixture.componentInstance.policyDraft.update((policy) => ({
      ...policy,
      title: 'No ofrecer descuentos',
      content: 'No informar descuentos no vigentes.',
    }));
    fixture.componentInstance.savePolicy();
    const policy = fixture.componentInstance.form()!.commercialPolicies[0];
    expect(policy.title).toBe('No ofrecer descuentos');
    fixture.componentInstance.openPolicy(policy);
    fixture.componentInstance.policyDraft.update((item) => ({
      ...item,
      title: 'Descuentos vigentes',
    }));
    fixture.componentInstance.savePolicy();
    expect(fixture.componentInstance.form()!.commercialPolicies[0].title).toBe(
      'Descuentos vigentes',
    );
    fixture.componentInstance.removePolicy(policy.id);
    expect(fixture.componentInstance.form()!.commercialPolicies).toEqual([]);
  });

  it('filtra programas y rechaza borradores activos sin origen o PDF', async () => {
    const fixture = TestBed.createComponent(AgentManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.programQuery.set('region-inexistente');
    expect(fixture.componentInstance.visiblePrograms()).toEqual([]);

    const previousCount = fixture.componentInstance.form()!.programs.length;
    fixture.componentInstance.openProgram();
    fixture.componentInstance.programDraft.update((program) => ({
      ...program,
      name: 'Programa incompleto',
      destination: 'pucon',
      destinations: ['pucon'],
      originRegions: [],
      originCities: [],
      documentKey: '',
    }));
    fixture.componentInstance.saveProgram();
    expect(fixture.componentInstance.form()!.programs).toHaveLength(previousCount);
  });

  it('pagina los 78 PDF migrados sin renderizarlos simultáneamente', async () => {
    const migratedSnapshot = structuredClone(snapshot);
    migratedSnapshot.draft.config.programs = Array.from({ length: 78 }, (_, index) => ({
      ...structuredClone(config.programs[0]),
      id: `program-${index}`,
      name: `Programa ${index}`,
      fileName: `bariloche-${index}.pdf`,
      sortOrder: index,
    }));
    migratedSnapshot.published = null;
    api.get.mockReturnValueOnce(of(migratedSnapshot));
    const fixture = TestBed.createComponent(AgentManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.filteredPrograms()).toHaveLength(78);
    expect(fixture.componentInstance.visiblePrograms()).toHaveLength(12);
    fixture.componentInstance.programFirst.set(72);
    expect(fixture.componentInstance.visiblePrograms()).toHaveLength(6);
  });

  it.runIf(!navigator.userAgent.toLowerCase().includes('jsdom'))(
    'no desborda en 320, 390, 768 y 1440 px con temas claro y oscuro',
    async () => {
      const { page } = await import('vitest/browser');
      const fixture = TestBed.createComponent(AgentManagementComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      for (const theme of ['light', 'dark']) {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        const tokens = getComputedStyle(document.documentElement);
        const ink = tokens.getPropertyValue('--color-ink').trim();
        const muted = tokens.getPropertyValue('--color-muted').trim();
        const surface = tokens.getPropertyValue('--color-surface').trim();
        const canvas = tokens.getPropertyValue('--color-canvas').trim();
        expect(contrastRatio(ink, surface), `${theme} ink/surface`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(muted, surface), `${theme} muted/surface`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(ink, canvas), `${theme} ink/canvas`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(muted, canvas), `${theme} muted/canvas`).toBeGreaterThanOrEqual(4.5);
        for (const width of [320, 390, 768, 1440]) {
          await page.viewport(width, 1000);
          fixture.detectChanges();
          expect(root.scrollWidth, `${theme} ${width}px`).toBeLessThanOrEqual(root.clientWidth);
          expect(
            getComputedStyle(root.querySelector<HTMLElement>('#agent-management-title')!).color,
          ).not.toBe('rgba(0, 0, 0, 0)');
        }
      }
      document.documentElement.classList.remove('dark');
    },
  );
});
