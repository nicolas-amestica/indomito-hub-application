import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../../core/http/api-response.interface';
import type { AgentConfigRevision, AgentManagedConfig, AgentManagementSnapshot } from '../interfaces/agent-management.interface';

@Injectable({ providedIn: 'root' })
export class AgentManagementService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/configuracion-agente`;

  get() { return this.http.get<ApiSuccessEnvelope<AgentManagementSnapshot>>(this.url).pipe(map(({ data }) => data)); }
  saveDraft(config: AgentManagedConfig) { return this.http.put<ApiSuccessEnvelope<AgentConfigRevision>>(`${this.url}/borrador`, config).pipe(map(({ data }) => data)); }
  publish() { return this.http.post<ApiSuccessEnvelope<AgentConfigRevision>>(`${this.url}/publicaciones`, {}).pipe(map(({ data }) => data)); }
  restore(version: string) { return this.http.post<ApiSuccessEnvelope<AgentConfigRevision>>(`${this.url}/restauraciones`, { version }).pipe(map(({ data }) => data)); }
  prepareProgramUpload(file: File) { return this.http.post<ApiSuccessEnvelope<{ key: string; uploadUrl: string; expiresAt: string }>>(`${this.url}/programas/cargas`, { fileName: file.name, size: file.size }).pipe(map(({ data }) => data)); }
  uploadProgram(url: string, file: File) { return this.http.put(url, file, { headers: { 'Content-Type': 'application/pdf' }, responseType: 'text' }); }
}
