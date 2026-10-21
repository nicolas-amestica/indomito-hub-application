import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { FileUpload, type FileUploadHandlerEvent } from 'primeng/fileupload';
import { Popover } from 'primeng/popover';
import { Slider } from 'primeng/slider';
import { Tooltip } from 'primeng/tooltip';

import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ProfilePhotoService } from '../../services/profile-photo.service';

const MAX_PHOTO_SIZE = 2 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Component({
  selector: 'app-user-profile-menu',
  imports: [ButtonDirective, Dialog, FileUpload, FormsModule, Popover, Slider, Tooltip],
  templateUrl: './user-profile-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileMenuComponent {
  readonly auth = inject(AuthService);
  readonly photos = inject(ProfilePhotoService);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly cropVisible = signal(false);
  readonly cropX = signal(50);
  readonly cropY = signal(50);
  readonly cropZoom = signal(1);
  readonly cropCanvas = viewChild<ElementRef<HTMLCanvasElement>>('cropCanvas');
  private readonly notifications = inject(NotificationService);
  private readonly document = inject(DOCUMENT);
  private sourceImage: HTMLImageElement | null = null;
  private sourceUrl: string | null = null;

  constructor() {
    effect(() => this.photos.initialize(this.auth.user()?.profilePhoto));
  }

  selectPhoto(event: FileUploadHandlerEvent, uploader: FileUpload, profilePanel: Popover): void {
    const file = event.files[0];
    uploader.clear();
    if (!file || !ALLOWED_PHOTO_TYPES.has(file.type) || file.size > MAX_PHOTO_SIZE) {
      this.notifications.error('Selecciona una imagen JPEG, PNG o WebP de máximo 2 MB.');
      return;
    }
    this.releaseSourceImage();
    this.sourceUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      this.sourceImage = image;
      this.cropX.set(50);
      this.cropY.set(50);
      this.cropZoom.set(1);
      profilePanel.hide();
      this.cropVisible.set(true);
      this.document.defaultView?.requestAnimationFrame(() => this.renderCrop());
    };
    image.onerror = () => {
      this.releaseSourceImage();
      this.notifications.error('No fue posible leer la imagen seleccionada.');
    };
    image.src = this.sourceUrl;
  }

  renderCrop(): void {
    const image = this.sourceImage;
    const canvas = this.cropCanvas()?.nativeElement;
    if (!image || !canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const cropSize = Math.min(image.naturalWidth, image.naturalHeight) / this.cropZoom();
    const sourceX = (this.cropX() / 100) * (image.naturalWidth - cropSize);
    const sourceY = (this.cropY() / 100) * (image.naturalHeight - cropSize);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      sourceX,
      sourceY,
      cropSize,
      cropSize,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }

  async saveCrop(): Promise<void> {
    const canvas = this.cropCanvas()?.nativeElement;
    if (!canvas) return;
    const photo = await canvasToFile(canvas);
    if (!photo) {
      this.notifications.error('No fue posible preparar la foto de perfil.');
      return;
    }
    this.saving.set(true);
    try {
      await this.photos.save(photo);
      this.cropVisible.set(false);
      this.releaseSourceImage();
      this.notifications.success('Tu foto de perfil fue actualizada.');
    } catch {
      this.notifications.error('No fue posible actualizar tu foto de perfil.');
    } finally {
      this.saving.set(false);
    }
  }

  cancelCrop(): void {
    this.cropVisible.set(false);
    this.releaseSourceImage();
  }

  async deletePhoto(): Promise<void> {
    this.deleting.set(true);
    try {
      await this.photos.delete();
      this.notifications.success('Tu foto de perfil fue eliminada.');
    } catch {
      this.notifications.error('No fue posible eliminar tu foto de perfil.');
    } finally {
      this.deleting.set(false);
    }
  }

  private releaseSourceImage(): void {
    if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
    this.sourceUrl = null;
    this.sourceImage = null;
  }
}

function canvasToFile(canvas: HTMLCanvasElement): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? new File([blob], 'profile-photo.webp', { type: blob.type }) : null),
      'image/webp',
      0.9,
    );
  });
}
