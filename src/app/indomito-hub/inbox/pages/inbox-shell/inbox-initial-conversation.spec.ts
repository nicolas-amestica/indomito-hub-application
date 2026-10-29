import { convertToParamMap, ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { InboxAudioRecorderService } from '../../services/inbox-audio-recorder.service';
import { InboxRealtimeService } from '../../services/inbox-realtime.service';
import { InboxStore } from '../../stores/inbox.store';
import { InboxShellPage } from './inbox-shell.page';

describe('InboxShellPage initial conversation', () => {
  it('selecciona la conversación indicada en el query param telefono', () => {
    const load = vi.fn(async () => undefined);
    const select = vi.fn(async () => undefined);
    const setQuery = vi.fn();
    const store = {
      detail: signal(null),
      messages: signal([]),
      sendStates: signal([]),
      load,
      select,
      setQuery,
    } as unknown as InboxStore;

    TestBed.configureTestingModule({
      imports: [InboxShellPage],
      providers: [{
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap({ telefono: '56911111111' }),
          },
        },
      }],
    });
    TestBed.overrideComponent(InboxShellPage, {
      set: {
        template: '',
        providers: [
          { provide: InboxStore, useValue: store },
          { provide: InboxAudioRecorderService, useValue: { cancel: () => undefined } },
          { provide: InboxRealtimeService, useValue: {} },
        ],
      },
    });

    const fixture = TestBed.createComponent(InboxShellPage);
    fixture.detectChanges();

    expect(fixture.componentInstance.search()).toBe('56911111111');
    expect(setQuery).toHaveBeenCalledWith('56911111111');
    expect(select).toHaveBeenCalledWith('56911111111');
    expect(load).toHaveBeenCalledOnce();
  });
});
