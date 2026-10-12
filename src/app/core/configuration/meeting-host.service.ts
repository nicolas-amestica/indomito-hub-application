import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiEnvelope } from '../auth/auth.models';
import type { MeetingHost, MeetingHostRequest } from './meeting-host.interface';

@Injectable({ providedIn: 'root' })
export class MeetingHostService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/configuracion/anfitriones`;

  list() {
    return this.http
      .get<ApiEnvelope<{ items: MeetingHost[] }>>(this.url)
      .pipe(map(({ data }) => data.items));
  }

  listOptions() {
    return this.http
      .get<ApiEnvelope<{ items: MeetingHost[] }>>(`${this.url}:opciones`)
      .pipe(map(({ data }) => data.items));
  }

  create(request: MeetingHostRequest) {
    return this.http
      .post<ApiEnvelope<MeetingHost>>(this.url, request)
      .pipe(map(({ data }) => data));
  }

  update(id: string, request: MeetingHostRequest) {
    return this.http
      .put<ApiEnvelope<MeetingHost>>(`${this.url}/${encodeURIComponent(id)}`, request)
      .pipe(map(({ data }) => data));
  }

  remove(id: string) {
    return this.http.delete(`${this.url}/${encodeURIComponent(id)}`);
  }
}
