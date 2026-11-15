import type { MeetEvent } from '../meet.service';

export interface CalendarDay {
  date: string;
  number: number;
  current: boolean;
  today: boolean;
  past: boolean;
  weekday: string;
  events: MeetEvent[];
}
