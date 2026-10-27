import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize, firstValueFrom, switchMap } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { Dialog } from 'primeng/dialog';
import { FileUpload, type FileUploadHandlerEvent } from 'primeng/fileupload';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { Panel } from 'primeng/panel';
import { Paginator } from 'primeng/paginator';
import { ProgressBar } from 'primeng/progressbar';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Slider } from 'primeng/slider';
import { TableModule } from 'primeng/table';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import {
  AGENT_DESTINATION_OPTIONS,
  AGENT_MODEL_OPTIONS,
  AGENT_TONE_OPTIONS,
  createAgentProgram,
  createCommercialPolicy,
  createKnowledgeEntry,
} from '../../constants/agent-management.constant';
import {
  normalizeAgentManagementSnapshot,
  normalizeAgentProgram,
} from '../../fn/normalize-agent-management';
import type {
  AgentCommercialPolicy,
  AgentKnowledgeEntry,
  AgentManagedConfig,
  AgentManagementSnapshot,
  AgentProgram,
} from '../../interfaces/agent-management.interface';
import { AgentManagementService } from '../../services/agent-management.service';
import type { OperationalMetrics } from '../../../../../shared/operational-metrics/interfaces/operational-metrics.interface';
import { OperationalMetricsService } from '../../../../../shared/operational-metrics/services/operational-metrics.service';

type EditorKind = 'knowledge' | 'policy' | 'program' | null;

@Component({
  selector: 'app-agent-management',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    ButtonDirective,
    Card,
    Dialog,
    FileUpload,
    InputNumber,
    InputText,
    Message,
    MultiSelect,
    Panel,
    Paginator,
    ProgressBar,
    Select,
    Skeleton,
    Slider,
    TableModule,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    Tag,
    Textarea,
    ToggleSwitch,
  ],
  templateUrl: './agent-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentManagementComponent {
  private readonly api = inject(AgentManagementService);
  private readonly metricsApi = inject(OperationalMetricsService);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly publishing = signal(false);
  readonly uploading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly snapshot = signal<AgentManagementSnapshot | null>(null);
  readonly metrics = signal<OperationalMetrics | null>(null);
  readonly metricsLoading = signal(true);
  readonly form = signal<AgentManagedConfig | null>(null);
  readonly editor = signal<EditorKind>(null);
  readonly knowledgeDraft = signal<AgentKnowledgeEntry>(createKnowledgeEntry());
  readonly policyDraft = signal<AgentCommercialPolicy>(createCommercialPolicy());
  readonly programDraft = signal<AgentProgram>(createAgentProgram());
  readonly programQuery = signal('');
  readonly programFirst = signal(0);
  readonly programPageSize = signal(12);
  readonly modelOptions = AGENT_MODEL_OPTIONS;
  readonly toneOptions = AGENT_TONE_OPTIONS;
  readonly destinationOptions = AGENT_DESTINATION_OPTIONS;
  readonly regionOptions = [
    'i',
    'ii',
    'iii',
    'iv',
    'v',
    'vi',
    'vii',
    'viii',
    'ix',
    'x',
    'xi',
    'xii',
    'xiv',
    'xv',
    'xvi',
    'rm',
    'brasil',
  ].map((value) => ({ label: value.toUpperCase(), value }));
  readonly completeness = computed(() => {
    const config = this.form();
    if (!config) return 0;
    const checks = [
      config.personality.displayName,
      config.personality.role,
      config.personality.greeting,
      config.policies.handoffConfirmation,
      config.generation.model,
      config.knowledge.some((item) => item.active),
      config.programs.some((item) => item.active),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  });
  readonly hasUnpublishedChanges = computed(
    () =>
      JSON.stringify(this.form()) !== JSON.stringify(this.snapshot()?.published?.config ?? null),
  );
  readonly filteredPrograms = computed(() => {
    const query = this.programQuery().trim().toLowerCase();
    const programs = this.form()?.programs ?? [];
    if (!query) return programs;
    return programs.filter((program) =>
      [
        program.name,
        program.fileName,
        program.country,
        program.destination,
        ...(program.destinations ?? []),
        ...program.originRegions,
        ...program.originCities,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  });
  readonly visiblePrograms = computed(() =>
    this.filteredPrograms().slice(
      this.programFirst(),
      this.programFirst() + this.programPageSize(),
    ),
  );

  constructor() {
    this.load();
    this.loadMetrics();
  }

  private loadMetrics(): void {
    this.metricsLoading.set(true);
    this.metricsApi
      .get()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.metricsLoading.set(false)),
      )
      .subscribe({
        next: (metrics) => this.metrics.set(metrics),
        error: () => this.metrics.set(null),
      });
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .get()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (snapshot) => {
          const normalized = normalizeAgentManagementSnapshot(snapshot);
          this.snapshot.set(normalized);
          this.form.set(structuredClone(normalized.draft.config));
        },
        error: () => this.error.set('No fue posible cargar la configuración del agente.'),
      });
  }

  save(): void {
    const config = this.form();
    if (!config || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    this.api
      .saveDraft(config)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (draft) => {
          this.snapshot.update((value) => (value ? { ...value, draft } : value));
          this.notice.set('Borrador guardado. Los clientes aún no reciben estos cambios.');
        },
        error: () => this.error.set('No fue posible guardar. Revisa los campos obligatorios.'),
      });
  }

  publish(): void {
    const config = this.form();
    if (!config || this.publishing()) return;
    this.publishing.set(true);
    this.error.set('');
    this.notice.set('');
    this.api
      .saveDraft(config)
      .pipe(
        switchMap(() => this.api.publish()),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.publishing.set(false)),
      )
      .subscribe({
        next: (published) => {
          this.snapshot.update((value) =>
            value ? { ...value, published, versions: [published, ...value.versions] } : value,
          );
          this.notice.set('Versión publicada. El agente la usará en las próximas conversaciones.');
        },
        error: () => this.error.set('No fue posible publicar el borrador.'),
      });
  }

  restore(version: string): void {
    this.publishing.set(true);
    this.error.set('');
    this.api
      .restore(version)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.publishing.set(false)),
      )
      .subscribe({
        next: (published) => {
          this.form.set(structuredClone(published.config));
          this.load();
          this.notice.set(`Versión ${version} restaurada y publicada.`);
        },
        error: () => this.error.set('No fue posible restaurar la versión seleccionada.'),
      });
  }

  openKnowledge(item?: AgentKnowledgeEntry): void {
    this.knowledgeDraft.set(structuredClone(item ?? createKnowledgeEntry()));
    this.editor.set('knowledge');
  }
  saveKnowledge(): void {
    const draft = this.knowledgeDraft();
    if (!draft.title.trim() || !draft.answer.trim()) return;
    this.form.update((config) =>
      config
        ? {
            ...config,
            knowledge: [
              ...config.knowledge.filter((item) => item.id !== draft.id),
              structuredClone(draft),
            ].sort((a, b) => b.priority - a.priority),
          }
        : config,
    );
    this.editor.set(null);
  }
  removeKnowledge(id: string): void {
    this.form.update((config) =>
      config ? { ...config, knowledge: config.knowledge.filter((item) => item.id !== id) } : config,
    );
  }
  openPolicy(item?: AgentCommercialPolicy): void {
    this.policyDraft.set(structuredClone(item ?? createCommercialPolicy()));
    this.editor.set('policy');
  }
  savePolicy(): void {
    const draft = this.policyDraft();
    if (!draft.title.trim() || !draft.content.trim()) return;
    this.form.update((config) =>
      config
        ? {
            ...config,
            commercialPolicies: [
              ...config.commercialPolicies.filter((item) => item.id !== draft.id),
              structuredClone(draft),
            ].sort((a, b) => a.sortOrder - b.sortOrder),
          }
        : config,
    );
    this.editor.set(null);
  }
  removePolicy(id: string): void {
    this.form.update((config) =>
      config
        ? {
            ...config,
            commercialPolicies: config.commercialPolicies.filter((item) => item.id !== id),
          }
        : config,
    );
  }
  openProgram(item?: AgentProgram): void {
    this.programDraft.set(normalizeAgentProgram(structuredClone(item ?? createAgentProgram())));
    this.editor.set('program');
  }
  saveProgram(): void {
    const draft = normalizeAgentProgram(this.programDraft());
    if (
      !draft.name.trim() ||
      !draft.destinations?.length ||
      (!draft.originRegions.length && !draft.originCities.length) ||
      (draft.active && !draft.documentKey.trim())
    )
      return;
    this.form.update((config) =>
      config
        ? {
            ...config,
            programs: [
              ...config.programs.filter((item) => item.id !== draft.id),
              structuredClone(draft),
            ].sort((a, b) => a.sortOrder - b.sortOrder),
          }
        : config,
    );
    this.programFirst.set(0);
    this.editor.set(null);
  }
  removeProgram(id: string): void {
    this.form.update((config) =>
      config ? { ...config, programs: config.programs.filter((item) => item.id !== id) } : config,
    );
    this.programFirst.set(0);
  }
  async uploadProgram(event: FileUploadHandlerEvent): Promise<void> {
    const file = event.files[0];
    if (!file || this.uploading()) return;
    this.uploading.set(true);
    this.error.set('');
    try {
      const prepared = await firstValueFrom(this.api.prepareProgramUpload(file));
      await firstValueFrom(this.api.uploadProgram(prepared.uploadUrl, file));
      this.programDraft().fileName = file.name;
      this.programDraft().documentKey = prepared.key;
      this.notice.set('PDF cargado. Guarda el programa y publica el borrador para activarlo.');
    } catch {
      this.error.set('No fue posible cargar el PDF. Verifica que sea válido y no supere 32 MB.');
    } finally {
      this.uploading.set(false);
    }
  }
  downloadProgram(program: AgentProgram): void {
    if (!program.documentKey || this.loading()) return;
    this.api
      .prepareProgramDownload(program.documentKey, program.fileName || 'programa.pdf')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ downloadUrl }) => {
          const anchor = document.createElement('a');
          anchor.href = downloadUrl;
          anchor.download = program.fileName || 'programa.pdf';
          anchor.rel = 'noopener';
          anchor.click();
        },
        error: () => this.error.set('No fue posible preparar la descarga del PDF.'),
      });
  }
  toList(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
