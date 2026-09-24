import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/auth/auth.models';
import { IamModule, IamProfile, IamUser } from './iam.models';
@Injectable({ providedIn: 'root' })
export class IamService {
  private h = inject(HttpClient);
  private u = environment.apiUrl;
  users() {
    return this.h.get<ApiEnvelope<IamUser[]>>(`${this.u}/iam/usuarios`).pipe(map((x) => x.data));
  }
  profiles() {
    return this.h.get<ApiEnvelope<IamProfile[]>>(`${this.u}/iam/perfiles`).pipe(map((x) => x.data));
  }
  modules() {
    return this.h.get<ApiEnvelope<IamModule[]>>(`${this.u}/iam/modulos`).pipe(map((x) => x.data));
  }
  saveUser(v: unknown) {
    return this.h.post(`${this.u}/iam/usuarios`, v);
  }
  updateUser(id: string, v: unknown) {
    return this.h.put(`${this.u}/iam/usuarios/${encodeURIComponent(id)}`, v);
  }
  toggleUser(id: string, active: boolean) {
    return this.h.patch(`${this.u}/iam/usuarios/${encodeURIComponent(id)}`, { active });
  }
  deleteUser(id: string) {
    return this.h.delete(`${this.u}/iam/usuarios/${encodeURIComponent(id)}`);
  }
  saveProfile(v: unknown) {
    return this.h.post(`${this.u}/iam/perfiles`, v);
  }
  updateProfile(code: string, v: unknown) {
    return this.h.put(`${this.u}/iam/perfiles/${encodeURIComponent(code)}`, v);
  }
  deleteProfile(code: string) {
    return this.h.delete(`${this.u}/iam/perfiles/${encodeURIComponent(code)}`);
  }
  saveModule(v: unknown) {
    return this.h.post(`${this.u}/iam/modulos`, v);
  }
  updateModule(code: string, v: unknown) {
    return this.h.put(`${this.u}/iam/modulos/${encodeURIComponent(code)}`, v);
  }
  deleteModule(code: string) {
    return this.h.delete(`${this.u}/iam/modulos/${encodeURIComponent(code)}`);
  }
  profilePermissions(code: string) {
    return this.h
      .get<ApiEnvelope<Array<{ module: IamModule; allowances: string[] }>>>(
        `${this.u}/iam/perfiles/${code}/permisos`,
      )
      .pipe(map((x) => x.data));
  }
  savePermissions(code: string, v: unknown) {
    return this.h.put(`${this.u}/iam/perfiles/${code}/permisos`, v);
  }
}
