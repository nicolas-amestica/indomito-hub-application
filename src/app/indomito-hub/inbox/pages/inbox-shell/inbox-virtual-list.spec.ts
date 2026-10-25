import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ConversationListItemComponent } from '../../components/conversation-list-item/conversation-list-item.component';
import type { ConversationSummary } from '../../interfaces/conversation.interface';

@Component({
  imports: [ConversationListItemComponent, ScrollingModule],
  template: `
    <cdk-virtual-scroll-viewport style="display:block;height:760px" [itemSize]="76" [minBufferPx]="760" [maxBufferPx]="1520">
      <app-conversation-list-item *cdkVirtualFor="let conversation of conversations; trackBy: trackConversation" [conversation]="conversation" />
    </cdk-virtual-scroll-viewport>
  `,
})
class VirtualConversationListHost {
  readonly conversations = Array.from({ length: 10_000 }, (_, index): ConversationSummary => ({
    id: `conversation-${index}`,
    phone: `569${String(index).padStart(8, '0')}`,
    alias: `Conversación ${index}`,
    channel: 'whatsapp',
    status: 'bot',
    reason: null,
    reasonLabel: null,
    agentProcessing: false,
    agentProcessingUntil: null,
    unreadCount: index % 5,
    lastMessagePreview: `Mensaje de prueba ${index}`,
    lastMessageAt: '2026-10-24T00:00:00Z',
    serviceWindowExpiresAt: null,
    createdAt: '2026-10-24T00:00:00Z',
    updatedAt: '2026-10-24T00:00:00Z',
    generation: 1,
  }));

  readonly trackConversation = (_index: number, conversation: ConversationSummary): string => conversation.phone;
}

describe('Inbox conversation list virtualization', () => {
  it('mantiene acotado el DOM al recibir 10.000 conversaciones', async () => {
    const runtimeProcess = (globalThis as unknown as {
      process?: { memoryUsage(): { heapUsed: number } };
    }).process;
    const browserMemory = performance as Performance & {
      memory?: { readonly usedJSHeapSize: number };
    };
    const readHeapUsage = (): number | null =>
      runtimeProcess?.memoryUsage().heapUsed ?? browserMemory.memory?.usedJSHeapSize ?? null;
    const heapBefore = readHeapUsage();
    const startedAt = performance.now();
    const fixture = TestBed.createComponent(VirtualConversationListHost);
    fixture.detectChanges();
    const viewportDebug = fixture.debugElement.query(By.directive(CdkVirtualScrollViewport));
    const viewportElement = viewportDebug.nativeElement as HTMLElement;
    const viewport = viewportDebug.componentInstance as CdkVirtualScrollViewport;
    if (runtimeProcess) {
      Object.defineProperty(viewportElement, 'clientHeight', { configurable: true, value: 760 });
    }
    viewport.checkViewportSize();
    // El runner browser monta el test en un contenedor aislado sin altura de página;
    // se fija una ventana equivalente para comparar DOM, tiempo y heap entre entornos.
    viewport.setRenderedRange({ start: 0, end: 30 });
    await fixture.whenStable();
    fixture.detectChanges();
    const elapsedMilliseconds = performance.now() - startedAt;
    const heapAfter = readHeapUsage();
    const renderedItems = fixture.nativeElement.querySelectorAll('app-conversation-list-item').length;

    expect(renderedItems).toBeGreaterThan(0);
    expect(renderedItems).toBeLessThan(60);
    expect(elapsedMilliseconds).toBeLessThan(1_000);
    if (heapBefore !== null && heapAfter !== null) {
      expect(heapAfter - heapBefore).toBeLessThan(64 * 1024 * 1024);
    }
  });
});
