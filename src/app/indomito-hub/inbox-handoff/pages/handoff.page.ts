import { DOCUMENT, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Panel } from 'primeng/panel';
import { ThemeService } from '../../../core/theme/theme.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { HANDOFF_MESSAGE_TOKENS, HANDOFF_PANEL_TOKENS } from '../constants/handoff-design-tokens';
import { HANDOFF_MESSAGES } from '../constants/handoff-messages';
import { handoffConversationQuery, handoffToken } from '../fn/handoff-access';
import type { HandoffPage, HandoffSession } from '../interfaces/handoff.interface';
import { HandoffRequestError } from '../types/handoff-request-error';
import { HandoffApiService } from '../services/handoff-api.service';

@Component({
  selector: 'app-inbox-handoff',
  imports: [DatePipe, RouterLink, ButtonDirective, Message, Panel, PageHeaderComponent],
  templateUrl: './handoff.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HandoffPageComponent {
  readonly theme = inject(ThemeService);
  readonly panelTokens = HANDOFF_PANEL_TOKENS;
  readonly messageTokens = HANDOFF_MESSAGE_TOKENS;
  private readonly conversationHeading =
    viewChild<ElementRef<HTMLHeadingElement>>('conversationHeading');
  private readonly conversationHistory = viewChild<ElementRef<HTMLElement>>('conversationHistory');
  private readonly api = inject(HandoffApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private token = handoffToken(this.route.snapshot.fragment);
  private session: HandoffSession | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  readonly loading = signal(false);
  readonly page = signal<HandoffPage | null>(null);
  readonly error = signal(this.token ? '' : HANDOFF_MESSAGES.unavailable);
  readonly canOpen = signal(!!this.token);
  readonly conversationQuery = handoffConversationQuery(
    this.route.snapshot.paramMap.get('phone') ?? '',
  );

  constructor() {
    afterRenderEffect({
      write: () => {
        const history = this.conversationHistory()?.nativeElement;
        if (!history) return;
        this.conversationHeading()?.nativeElement.focus({ preventScroll: true });
        history.scrollIntoView({ block: 'end', behavior: 'instant' });
      },
    });
    const view = this.document.defaultView;
    // Se retira el secreto del historial sin efectuar una navegación ni canjearlo.
    if (view?.location.hash)
      view.history.replaceState(
        view.history.state,
        '',
        view.location.pathname + view.location.search,
      );
    const meta = inject(Meta);
    const previousRobots = meta.getTag('name="robots"')?.content;
    const previousReferrer = meta.getTag('name="referrer"')?.content;
    meta.updateTag({ name: 'robots', content: 'noindex, nofollow, noarchive' });
    meta.updateTag({ name: 'referrer', content: 'no-referrer' });
    inject(DestroyRef).onDestroy(() => {
      this.disposed = true;
      this.clearAccess();
      if (previousRobots) meta.updateTag({ name: 'robots', content: previousRobots });
      else meta.removeTag('name="robots"');
      if (previousReferrer) meta.updateTag({ name: 'referrer', content: previousReferrer });
      else meta.removeTag('name="referrer"');
    });
  }

  /** Lleva el foco al contenido sin recrear la ruta ni perder el permiso en memoria. */
  focusContent(event: Event): void {
    event.preventDefault();
    this.document.getElementById('handoff-content')?.focus();
  }

  /** Canjea el enlace por decisión explícita de la persona que revisa la derivación. */
  async open(): Promise<void> {
    if (!this.canOpen() || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      if (!this.session) {
        this.session = await this.api.redeem(this.token);
        this.token = '';
        if (this.disposed) {
          this.clearAccess();
          return;
        }
        const remaining = Date.parse(this.session.expiresAt) - Date.now();
        if (remaining <= 0) {
          this.expire();
          return;
        }
        this.expiryTimer = setTimeout(() => this.expire(), remaining);
      }
      await this.readPage();
    } catch (error) {
      this.handleError(error);
    } finally {
      this.loading.set(false);
    }
  }

  /** Recupera otra página sin ampliar el alcance ni la vigencia del permiso. */
  async loadOlder(): Promise<void> {
    const before = this.page()?.nextBefore;
    if (!before || !this.session || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.readPage(before);
      this.conversationHeading()?.nativeElement.focus();
    } catch (error) {
      this.handleError(error);
    } finally {
      this.loading.set(false);
    }
  }

  private async readPage(before?: string): Promise<void> {
    const session = this.session;
    if (!session) return;
    const result = await this.api.read(session.sessionToken, before);
    if (this.disposed || this.session !== session) return;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      this.expire();
      return;
    }
    const messages = before
      ? [...result.messages, ...(this.page()?.messages ?? [])]
      : result.messages;
    this.page.set({ ...result, messages });
    this.canOpen.set(false);
  }

  private handleError(error: unknown): void {
    if (this.disposed) return;
    if (error instanceof HandoffRequestError && error.kind === 'unavailable') {
      this.clearAccess();
      this.error.set(HANDOFF_MESSAGES.unavailable);
    } else {
      this.error.set(HANDOFF_MESSAGES.failed);
    }
  }

  private expire(): void {
    this.clearAccess();
    this.error.set(HANDOFF_MESSAGES.expired);
  }
  private clearAccess(): void {
    clearTimeout(this.expiryTimer);
    this.token = '';
    this.session = null;
    this.canOpen.set(false);
    this.page.set(null);
  }
}
