import {
  MAX_SOURCE_PHOTO_DIMENSION,
  SOURCE_PHOTO_QUALITY,
} from '../constants/profile-photo.constants';

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

export function constrainImageDimensions(
  width: number,
  height: number,
  maxDimension = MAX_SOURCE_PHOTO_DIMENSION,
): ImageDimensions {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function prepareProfileImage(file: File, document: Document): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const dimensions = constrainImageDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D no disponible');

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);

    return await canvasToBlob(canvas);
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No fue posible comprimir la imagen'))),
      'image/webp',
      SOURCE_PHOTO_QUALITY,
    );
  });
}
