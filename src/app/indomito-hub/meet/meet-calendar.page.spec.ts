import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { MeetingHostService } from '../../core/configuration/meeting-host.service';
import { MeetCalendarPage } from './meet-calendar.page';
import { MeetService, type MeetEvent } from './meet.service';

const agentMeeting: MeetEvent = {
  id: 'agent-meeting',
  title: 'Reunión con cliente',
  date: '2026-10-29',
  startTime: '10:00',
  endTime: '11:00',
  description: '',
  guests: [],
  googleMeetLink: 'https://meet.google.com/abc-defg-hij',
  createdAt: '2026-10-29T10:00:00Z',
  hostSk: 'HOST#DEFAULT',
  hostName: 'Anfitrión',
  hostColor: '#000000',
  agent: true,
  phoneNumber: '56911111111',
};

describe('MeetCalendarPage', () => {
  it('abre la conversación de una reunión del agente en una pestaña nueva', async () => {
    const openAuthenticatedTab = vi.fn().mockReturnValue(true);
    TestBed.configureTestingModule({
      imports: [MeetCalendarPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            permissions: signal([
              { module: { code: 'MEET_AGENDA' }, allowances: ['c', 'u', 'd'] },
            ]),
            openAuthenticatedTab,
          },
        },
        {
          provide: MeetService,
          useValue: { list: () => of([agentMeeting]) },
        },
        {
          provide: MeetingHostService,
          useValue: { listOptions: () => of([]) },
        },
      ],
    });

    const fixture = TestBed.createComponent(MeetCalendarPage);
    fixture.componentInstance.year.set(2026);
    fixture.componentInstance.month.set(9);
    fixture.componentInstance.events.set([agentMeeting]);
    fixture.detectChanges();
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const link = root.querySelector<HTMLAnchorElement>(
      'a[aria-label="Abrir conversación de WhatsApp"]',
    );

    expect(link).not.toBeNull();
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toContain('noopener');
    expect(link?.getAttribute('href')).toContain(
      '/comunicaciones/conversaciones?telefono=56911111111',
    );

    link?.click();
    expect(openAuthenticatedTab).toHaveBeenCalledWith(
      '/comunicaciones/conversaciones?telefono=56911111111',
    );
  });
});
