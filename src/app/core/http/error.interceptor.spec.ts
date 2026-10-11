import { HttpErrorResponse } from '@angular/common/http';
import { messageForHttpError } from './error.interceptor';
import { APP_MESSAGES } from '../../shared/constants/app-messages';

describe('messageForHttpError', () => {
  it('explains unavailable Calendar configuration without exposing internal details', () => {
    const error = new HttpErrorResponse({ status: 503, error: {
      code: 'CALENDAR_OAUTH_NOT_CONFIGURED', message: 'private backend detail',
    } });
    expect(messageForHttpError(error, 'fallback')).toBe(APP_MESSAGES.http.calendarOAuthNotConfigured);
  });

  it('preserves the local fallback for unknown failures', () => {
    const error = new HttpErrorResponse({ status: 502, error: { message: 'private detail' } });
    expect(messageForHttpError(error, 'fallback')).toBe('fallback');
  });
});
