import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface MeetEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  guests: string[];
  googleMeetLink: string | null;
  createdAt: string;
  hostSk: string | null;
  hostName: string | null;
  hostColor: string | null;
  agent?: boolean;
  phoneNumber?: string | null;
}

export interface MeetRequest {
  title: string;
  date: string;
  startTime: string;
  description: string;
  guests: string[];
  hostSk: string | null;
  hostName: string | null;
  hostColor: string | null;
}

@Injectable({ providedIn: 'root' })
export class MeetService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/v1/reuniones`;

  list(year: number, month: number) {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.get<{ data: MeetEvent[] }>(this.url, { params }).pipe(map(({ data }) => data));
  }

  create(request: MeetRequest) {
    return this.http.post<{ data: MeetEvent }>(this.url, request).pipe(map(({ data }) => data));
  }

  update(id: string, request: MeetRequest) {
    return this.http.put<{ data: MeetEvent }>(`${this.url}/${encodeURIComponent(id)}`, request).pipe(map(({ data }) => data));
  }

  remove(id: string) {
    return this.http.delete(`${this.url}/${encodeURIComponent(id)}`);
  }
}
