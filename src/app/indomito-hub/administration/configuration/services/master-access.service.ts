import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { MasterAccess } from '../interfaces/master-access.interface';

@Injectable({ providedIn: 'root' })
export class MasterAccessService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/configuracion/acceso-maestro`;
  get() {
    return this.http.get<{ data: MasterAccess }>(this.url).pipe(map(({ data }) => data));
  }
  rotate() {
    return this.http.put<{ data: MasterAccess }>(this.url, {}).pipe(map(({ data }) => data));
  }
  revoke() {
    return this.http.delete<{ data: MasterAccess }>(this.url).pipe(map(({ data }) => data));
  }
}
