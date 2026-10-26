import { TestBed } from '@angular/core/testing';

import type { ConversationSummary } from '../../interfaces/conversation.interface';
import { ConversationListItemComponent } from './conversation-list-item.component';

const conversation: ConversationSummary = {
  id: 'conversation-1',
  phone: '56911111111',
  alias: 'Ana Pérez',
  channel: 'whatsapp',
  status: 'bot',
  reason: null,
  reasonLabel: null,
  agentProcessing: false,
  agentProcessingUntil: null,
  unreadCount: 3,
  lastMessagePreview: 'Necesito ayuda con mi viaje',
  lastMessageAt: '2026-10-24T12:00:00Z',
  serviceWindowExpiresAt: null,
  createdAt: '2026-10-24T12:00:00Z',
  updatedAt: '2026-10-24T12:00:00Z',
  generation: 1,
};

describe('ConversationListItemComponent accessibility', () => {
  it('expone selección, foco y no leídos con semántica accesible', () => {
    const fixture = TestBed.createComponent(ConversationListItemComponent);
    fixture.componentRef.setInput('conversation', conversation);
    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const unread = fixture.nativeElement.querySelector('[aria-label="3 mensajes no leídos"]') as HTMLElement;

    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent).toContain('Ana Pérez');
    expect(unread).toBeTruthy();
    expect([...fixture.nativeElement.querySelectorAll('span')].some((element: Element) => element.className.includes('tabler--user'))).toBe(true);

    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('emite el teléfono al activar el botón nativo', () => {
    const fixture = TestBed.createComponent(ConversationListItemComponent);
    fixture.componentRef.setInput('conversation', conversation);
    fixture.detectChanges();
    const selectedPhones: string[] = [];
    fixture.componentInstance.selectedConversation.subscribe((phone) => selectedPhones.push(phone));

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

    expect(selectedPhones).toEqual(['56911111111']);
  });
});
