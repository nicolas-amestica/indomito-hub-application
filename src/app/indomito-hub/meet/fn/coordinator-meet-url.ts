import { MEETING_COORDINATOR_EMAIL } from '../constants/meeting.constants';

/** Indica a Google la cuenta preferida; la sesión debe estar iniciada en el navegador. */
export function coordinatorMeetUrl(link: string): string | null {
  try {
    const url = new URL(link);
    if (url.protocol !== 'https:' || url.hostname !== 'meet.google.com') return null;
    url.searchParams.set('authuser', MEETING_COORDINATOR_EMAIL);
    return url.toString();
  } catch {
    return null;
  }
}
