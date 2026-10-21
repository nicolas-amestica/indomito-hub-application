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
import { ProgressSpinner } from 'primeng/progressspinner';
import { Slider } from 'primeng/slider';
import { Tooltip } from 'primeng/tooltip';

import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import {
  ALLOWED_PHOTO_TYPES,
  MAX_SOURCE_PHOTO_SIZE,
} from '../../constants/profile-photo.constants';
import { prepareProfileImage } from '../../fn/prepare-profile-image';
import { ProfilePhotoService } from '../../services/profile-photo.service';

@Component({
  selector: 'app-user-profile-menu',
  imports: [
    ButtonDirective,
    Dialog,
    FileUpload,
    FormsModule,
    Popover,
    ProgressSpinner,
    Slider,
    Tooltip,
  ],
  templateUrl: './user-profile-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileMenuComponent {
  readonly auth = inject(AuthService);
  readonly photos = inject(ProfilePhotoService);
  readonly maxSourcePhotoSize = MAX_SOURCE_PHOTO_SIZE;
  readonly saving = signal(false);
  readonly preparing = signal(false);
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

  async selectPhoto(
    event: FileUploadHandlerEvent,
    uploader: FileUpload,
    profilePanel: Popover,
  ): Promise<void> {
    const file = event.files[0];
    uploader.clear();
    if (!file || !ALLOWED_PHOTO_TYPES.has(file.type) || file.size > MAX_SOURCE_PHOTO_SIZE) {
      this.notifications.error('Selecciona una imagen JPEG, PNG o WebP de máximo 50 MB.');
      return;
    }

    this.preparing.set(true);
    try {
      const preparedPhoto = await prepareProfileImage(file, this.document);
      this.releaseSourceImage();
      this.sourceUrl = URL.createObjectURL(preparedPhoto);
      await this.loadSourceImage(this.sourceUrl);
      this.cropX.set(50);
      this.cropY.set(50);
      this.cropZoom.set(1);
      profilePanel.hide();
      this.cropVisible.set(true);
      this.document.defaultView?.requestAnimationFrame(() => this.renderCrop());
    } catch {
      this.releaseSourceImage();
      this.notifications.error('No fue posible leer la imagen seleccionada.');
    } finally {
      this.preparing.set(false);
    }
  }

  private loadSourceImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        this.sourceImage = image;
        resolve();
      };
      image.onerror = () => reject(new Error('No fue posible cargar la imagen preparada'));
      image.src = url;
    });
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
