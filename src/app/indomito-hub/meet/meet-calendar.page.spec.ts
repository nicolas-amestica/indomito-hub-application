import { ConfirmationService } from 'primeng/api';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';

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

describe('MeetCalendarPage reglas de reuniones', () => {
  const defaultHost = { id: 'DEFAULT', sk: 'MEET_HOST#DEFAULT', name: 'Coordinadora', color: '#6366f1', active: true, isDefault: true, description: '', createdAt: '', updatedAt: '' };
  const api = { list: vi.fn(() => of([])), create: vi.fn(() => of(agentMeeting)), update: vi.fn(() => of(agentMeeting)), remove: vi.fn(() => of({ ok: true })) };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [MeetCalendarPage], providers: [provideRouter([]),
        { provide: AuthService, useValue: { permissions: signal([{ module: { code: 'MEET_AGENDA' }, allowances: ['c', 'r', 'u', 'd'] }]) } },
        { provide: MeetService, useValue: api },
        { provide: MeetingHostService, useValue: { listOptions: () => of([defaultHost]) } },
      ],
    });
  });

  it('selecciona el anfitrión predeterminado en cada reunión nueva sin cambiar el de una existente', () => {
    const page = TestBed.createComponent(MeetCalendarPage).componentInstance;
    page.open();
    expect(page.form.hostSk).toBe(defaultHost.sk);
    expect(page.form.hostName).toBe(defaultHost.name);
    page.open(undefined, agentMeeting);
    expect(page.form.hostSk).toBe(agentMeeting.hostSk);
    page.open();
    expect(page.form.hostSk).toBe(defaultHost.sk);
  });

  it('selecciona el predeterminado si las opciones llegan después de abrir el diálogo', () => {
    const options = new Subject<typeof defaultHost[]>();
    TestBed.overrideProvider(MeetingHostService, { useValue: { listOptions: () => options } });
    const page = TestBed.createComponent(MeetCalendarPage).componentInstance;
    page.open();
    expect(page.form.hostSk).toBeNull();
    options.next([defaultHost]);
    expect(page.form.hostSk).toBe(defaultHost.sk);
    options.complete();
  });

  it('bloquea únicamente el nombre de reuniones del agente y muestra su origen sin checkbox editable', async () => {
    const fixture = TestBed.createComponent(MeetCalendarPage);
    fixture.componentInstance.open(undefined, agentMeeting);
    fixture.detectChanges();
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[name="title"]');
    expect(input?.readOnly).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('p-checkbox[name="agent"]')).toBeNull();
    fixture.componentInstance.open(undefined, { ...agentMeeting, agent: false });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input?.readOnly).toBe(false);
  });

  it('conserva el nombre y el origen del agente al guardar incluso si se altera el modelo local', () => {
    const fixture = TestBed.createComponent(MeetCalendarPage);
    const page = fixture.componentInstance;
    page.open(undefined, agentMeeting);
    page.form.title = 'Intento de renombrar';
    page.form.agent = false;
    page.save({ invalid: false } as import('@angular/forms').NgForm);
    expect(api.update).toHaveBeenCalledWith(agentMeeting.id, expect.objectContaining({ title: agentMeeting.title, agent: true }));
  });

  it('solicita confirmación PrimeNG y elimina solo al aceptar', () => {
    const fixture = TestBed.createComponent(MeetCalendarPage);
    const confirmations = fixture.debugElement.injector.get(ConfirmationService);
    const confirm = vi.spyOn(confirmations, 'confirm');
    const page = fixture.componentInstance;
    page.open(undefined, agentMeeting);
    page.remove();
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ acceptLabel: 'Eliminar', rejectLabel: 'Cancelar' }));
    expect(api.remove).not.toHaveBeenCalled();
    const confirmation = confirm.mock.calls[0][0];
    confirmation.accept?.();
    expect(api.remove).toHaveBeenCalledExactlyOnceWith(agentMeeting.id);
  });

  it('muestra el aviso de legacy y solo abre Meet al confirmar con la cuenta coordinadora', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const fixture = TestBed.createComponent(MeetCalendarPage);
    const page = fixture.componentInstance;
    page.open(undefined, agentMeeting);
    fixture.detectChanges();
    await fixture.whenStable();
    const join = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(button => button.textContent?.includes('Unirse a Google Meet'));
    join?.click();
    expect(page.hostWarningVisible()).toBe(true);
    expect(open).not.toHaveBeenCalled();
    page.confirmJoinMeet();
    expect(open).toHaveBeenCalledWith('https://meet.google.com/abc-defg-hij?authuser=agente%40work.girasindomito.cl', '_blank', 'noopener,noreferrer');
    expect(page.hostWarningVisible()).toBe(false);
    open.mockRestore();
  });
});
