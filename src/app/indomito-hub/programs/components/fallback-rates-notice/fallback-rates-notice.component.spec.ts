import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FallbackRatesNoticeComponent } from './fallback-rates-notice.component';

registerLocaleData(localeEsCl);

describe('FallbackRatesNoticeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FallbackRatesNoticeComponent],
      providers: [{ provide: LOCALE_ID, useValue: 'es-CL' }],
    }).compileComponents();
  });

  it('anuncia de forma prominente la fecha de las tasas de respaldo', async () => {
    const fixture = TestBed.createComponent(FallbackRatesNoticeComponent);
    fixture.componentRef.setInput('date', '2027-03-01');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const notice = host.querySelector('[role="status"]');

    expect(notice?.getAttribute('aria-live')).toBe('polite');
    expect(notice?.textContent).toContain('Estás cotizando con tasas de respaldo.');
    expect(notice?.textContent).toContain('1 de marzo de 2027');
  });
});
