import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProfilePhotoService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly photoUrlState = signal<string | null>(null);

  readonly photoUrl = this.photoUrlState.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => this.revokeCurrentUrl());
  }

  initialize(photo: string | undefined): void {
    this.revokeCurrentUrl();
    this.photoUrlState.set(photo ?? null);
  }

  async load(): Promise<void> {
    try {
      const photo = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/auth/foto-perfil`, { responseType: 'blob' }),
      );
      this.setPhoto(photo);
    } catch {
      this.clearPhoto();
    }
  }

  async save(file: File): Promise<void> {
    await firstValueFrom(
      this.http.put(`${environment.apiUrl}/auth/foto-perfil`, file, {
        headers: { 'Content-Type': file.type },
      }),
    );
    this.setPhoto(file);
  }

  async delete(): Promise<void> {
    await firstValueFrom(this.http.delete(`${environment.apiUrl}/auth/foto-perfil`));
    this.clearPhoto();
  }

  private setPhoto(photo: Blob): void {
    this.revokeCurrentUrl();
    this.photoUrlState.set(URL.createObjectURL(photo));
  }

  private clearPhoto(): void {
    this.revokeCurrentUrl();
    this.photoUrlState.set(null);
  }

  private revokeCurrentUrl(): void {
    const current = this.photoUrlState();
    if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
  }
}
